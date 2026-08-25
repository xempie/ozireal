import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { withTenant } from "@/db";
import { tenantSecrets } from "@/db/schema";

/**
 * Provider credentials, entered by the agency in Settings rather than typed into a
 * file on the server.
 *
 * Encrypted with AES-256-GCM before it touches a column, so a database dump, a
 * backup, or a careless SELECT yields ciphertext. GCM rather than CBC because it
 * authenticates: a tampered ciphertext fails to decrypt instead of silently
 * producing a wrong key that then leaks through an error message somewhere.
 *
 * The wrapping key lives in the environment. That is the honest shape of this: you
 * cannot encrypt your way to zero secrets on disk, only down to ONE — and one held
 * outside the database is worth a great deal, because the database is what gets
 * dumped, replicated and restored into a staging box.
 *
 * Rotating SECRETS_KEY invalidates stored secrets. They are re-enterable in ten
 * seconds from Settings, which is the right trade against building key re-wrapping
 * for a single-tenant agency.
 */

export const SECRET_NAMES = [
  "ANTHROPIC_API_KEY",
  "VOYAGE_API_KEY",
  "DEEPGRAM_API_KEY",
  "MESSAGEMEDIA_KEY",
  "MESSAGEMEDIA_SECRET",
] as const;
export type SecretName = (typeof SECRET_NAMES)[number];

const KEY_VERSION = 1;

function wrappingKey(): Buffer {
  const material = process.env.SECRETS_KEY ?? process.env.AUTH_SECRET;
  if (!material || material.length < 16) {
    throw new Error(
      "SECRETS_KEY (or AUTH_SECRET) must be set, at least 16 characters, to store credentials.",
    );
  }
  // HKDF so the stored-secrets key is DERIVED rather than being AUTH_SECRET itself —
  // the session signer and the credential encryptor should not be the same bytes.
  return Buffer.from(hkdfSync("sha256", material, "ozi-secrets-v1", "tenant-secrets", 32));
}

export function secretsConfigured(): boolean {
  const material = process.env.SECRETS_KEY ?? process.env.AUTH_SECRET;
  return !!material && material.length >= 16;
}

function encrypt(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", wrappingKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(row: { ciphertext: string; iv: string; authTag: string }): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    wrappingKey(),
    Buffer.from(row.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(row.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Store or replace a credential. Returns the last four, for the screen. */
export async function putSecret(
  tenantId: string,
  name: SecretName,
  value: string,
  userId: string,
): Promise<{ lastFour: string }> {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("An empty value is not a credential.");

  const enc = encrypt(trimmed);
  const lastFour = trimmed.slice(-4);

  await withTenant(tenantId, (tx) =>
    tx
      .insert(tenantSecrets)
      .values({
        tenantId,
        name,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        keyVersion: KEY_VERSION,
        lastFour,
        updatedByUserId: userId,
      })
      .onConflictDoUpdate({
        target: [tenantSecrets.tenantId, tenantSecrets.name],
        set: {
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
          keyVersion: KEY_VERSION,
          lastFour,
          updatedByUserId: userId,
          updatedAt: new Date(),
        },
      }),
  );

  return { lastFour };
}

export async function deleteSecret(tenantId: string, name: SecretName): Promise<void> {
  await withTenant(tenantId, (tx) =>
    tx
      .delete(tenantSecrets)
      .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.name, name))),
  );
}

/**
 * The plaintext, for one call. The ONLY function that decrypts.
 *
 * Falls back to the environment so the worker, tests and CI keep working from a
 * variable when one is set — but the stored value wins, because that is the one a
 * person can change without a deploy.
 */
export async function getSecret(
  tenantId: string,
  name: SecretName,
): Promise<string | null> {
  if (secretsConfigured()) {
    const [row] = await withTenant(tenantId, (tx) =>
      tx
        .select({
          ciphertext: tenantSecrets.ciphertext,
          iv: tenantSecrets.iv,
          authTag: tenantSecrets.authTag,
        })
        .from(tenantSecrets)
        .where(and(eq(tenantSecrets.tenantId, tenantId), eq(tenantSecrets.name, name)))
        .limit(1),
    );
    if (row) {
      try {
        return decrypt(row);
      } catch {
        // Wrong wrapping key (SECRETS_KEY changed) or tampering. Say so loudly
        // rather than falling through to a stale env value and confusing everyone.
        console.error(
          `[secrets] ${name} could not be decrypted — SECRETS_KEY may have changed. Re-enter it in Settings.`,
        );
        return null;
      }
    }
  }
  return process.env[name] ?? null;
}

/**
 * What Settings may render: whether each credential is set, where it came from, and
 * four characters. Never the value — this shape is what makes it impossible to leak
 * one into a React component by accident.
 */
export async function getSecretStatus(tenantId: string): Promise<
  { name: SecretName; configured: boolean; source: "stored" | "environment" | null; lastFour: string | null; updatedAt: Date | null }[]
> {
  const rows = secretsConfigured()
    ? await withTenant(tenantId, (tx) =>
        tx
          .select({
            name: tenantSecrets.name,
            lastFour: tenantSecrets.lastFour,
            updatedAt: tenantSecrets.updatedAt,
          })
          .from(tenantSecrets)
          .where(eq(tenantSecrets.tenantId, tenantId)),
      )
    : [];

  return SECRET_NAMES.map((name) => {
    const stored = rows.find((r) => r.name === name);
    if (stored) {
      return { name, configured: true, source: "stored" as const, lastFour: stored.lastFour, updatedAt: stored.updatedAt };
    }
    const fromEnv = process.env[name];
    if (fromEnv) {
      return { name, configured: true, source: "environment" as const, lastFour: fromEnv.slice(-4), updatedAt: null };
    }
    return { name, configured: false, source: null, lastFour: null, updatedAt: null };
  });
}
