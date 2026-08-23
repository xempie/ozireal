import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The signed form token — the no-CAPTCHA spam defence (B3.4).
 *
 * GET /api/forms/[key] issues one; the POST requires it back. The token proves three
 * things a naive bot cannot fake without doing real work:
 *
 *   - the form was actually fetched from us (the signature),
 *   - a human-plausible interval passed between fetch and submit (issuedAt: bots
 *     that POST in under 3 seconds fail; tokens older than 24h are stale pages),
 *   - this token has not been used before (the nonce is single-use; the pipeline's
 *     replay index enforces the burn — a second submit with the same nonce collapses
 *     into the first rather than becoming a second enquiry).
 *
 * The token also freezes WHICH consent wording was on screen when the page
 * rendered, so the consent row records what the person actually saw, not whatever
 * the template says by the time the POST arrives. Wording travels as a hash and the
 * text comes back with the submission; the hash refuses a tampered pairing.
 *
 * Honestly stated limit: a patient bot that fetches, waits four seconds and submits
 * passes. This raises the cost of drive-by spam to "run a real browser with state",
 * which is the design goal — the last line against a determined actor is the
 * honeypot quarantine plus rate limits, not this.
 */

const VERSION = "v1";
export const MIN_FILL_MS = 3_000;
export const MAX_AGE_MS = 24 * 3600 * 1000;

function secret(): string {
  const s = process.env.FORM_TOKEN_SECRET ?? process.env.AUTH_SECRET;
  if (!s) {
    throw new Error(
      "FORM_TOKEN_SECRET (or AUTH_SECRET) is required to sign form tokens.",
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function hashWording(wording: string): string {
  return createHmac("sha256", "consent-wording").update(wording).digest("base64url").slice(0, 16);
}

export function issueFormToken(formKey: string, consentWording: string): string {
  const issuedAt = Date.now();
  const nonce = randomBytes(12).toString("base64url");
  const payload = `${VERSION}.${formKey}.${issuedAt}.${nonce}.${hashWording(consentWording)}`;
  return `${payload}.${sign(payload)}`;
}

export type TokenCheck =
  | { ok: true; nonce: string; issuedAt: number }
  | { ok: false; reason: "malformed" | "bad-signature" | "too-fast" | "expired" | "wrong-form" | "wording-mismatch" };

export function verifyFormToken(
  token: string,
  formKey: string,
  consentWording: string,
  now = Date.now(),
): TokenCheck {
  const parts = token.split(".");
  if (parts.length !== 6 || parts[0] !== VERSION) return { ok: false, reason: "malformed" };
  const [version, key, issuedAtStr, nonce, wordingHash, signature] = parts;

  const payload = `${version}.${key}.${issuedAtStr}.${nonce}.${wordingHash}`;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad-signature" };
  }

  if (key !== formKey) return { ok: false, reason: "wrong-form" };
  if (wordingHash !== hashWording(consentWording)) {
    return { ok: false, reason: "wording-mismatch" };
  }

  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return { ok: false, reason: "malformed" };
  if (now - issuedAt < MIN_FILL_MS) return { ok: false, reason: "too-fast" };
  if (now - issuedAt > MAX_AGE_MS) return { ok: false, reason: "expired" };

  return { ok: true, nonce, issuedAt };
}
