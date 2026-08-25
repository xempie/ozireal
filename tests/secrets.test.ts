import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import { systemTenantId } from "@/db";
import {
  putSecret,
  getSecret,
  deleteSecret,
  getSecretStatus,
  secretsConfigured,
} from "@/server/secrets";

/**
 * Credentials entered in Settings (user request during B5).
 *
 * The claims worth testing are all about what does NOT happen: the plaintext must
 * not be in the column, must not survive a wrapping-key change, and must not reach
 * the shape the screen renders.
 */

process.env.SECRETS_KEY ??= "test-secrets-key-at-least-16";

let sql: postgres.Sql;
let tenantId: string;
const USER = "00000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  tenantId = await systemTenantId();
});
afterAll(async () => {
  await sql?.end();
});
beforeEach(async () => {
  await sql`delete from tenant_secrets`;
});

async function realUserId() {
  const [u] = await sql<{ id: string }[]>`select id from users limit 1`;
  return u?.id ?? null;
}

describe("storing a credential", () => {
  it("round-trips through encryption", async () => {
    await putSecret(tenantId, "ANTHROPIC_API_KEY", "sk-ant-secret-value-1234", (await realUserId())!);
    expect(await getSecret(tenantId, "ANTHROPIC_API_KEY")).toBe("sk-ant-secret-value-1234");
  });

  it("never stores the plaintext in the column", async () => {
    await putSecret(tenantId, "ANTHROPIC_API_KEY", "sk-ant-hunter2-hunter2", (await realUserId())!);
    const [row] = await sql<{ ciphertext: string; iv: string; auth_tag: string; last_four: string }[]>`
      select ciphertext, iv, auth_tag, last_four from tenant_secrets where name = 'ANTHROPIC_API_KEY'`;
    // A database dump must be worth nothing on its own.
    expect(row.ciphertext).not.toContain("hunter2");
    expect(row.ciphertext).not.toContain("sk-ant");
    expect(row.iv).toBeTruthy();
    expect(row.auth_tag).toBeTruthy();
    // Four characters identify a key to its owner and no one else.
    expect(row.last_four).toBe("ter2");
  });

  it("replaces rather than duplicating", async () => {
    const uid = (await realUserId())!;
    await putSecret(tenantId, "ANTHROPIC_API_KEY", "sk-ant-first-value-aaaa", uid);
    await putSecret(tenantId, "ANTHROPIC_API_KEY", "sk-ant-second-value-bbbb", uid);
    const [n] = await sql<{ n: number }[]>`
      select count(*)::int as n from tenant_secrets where name = 'ANTHROPIC_API_KEY'`;
    expect(n.n).toBe(1);
    expect(await getSecret(tenantId, "ANTHROPIC_API_KEY")).toBe("sk-ant-second-value-bbbb");
  });

  it("a changed wrapping key fails closed rather than returning nonsense", async () => {
    await putSecret(tenantId, "ANTHROPIC_API_KEY", "sk-ant-value-to-lose-1234", (await realUserId())!);
    const original = process.env.SECRETS_KEY;
    process.env.SECRETS_KEY = "a-completely-different-key-here";
    try {
      // GCM authenticates, so the wrong key cannot silently yield a wrong string.
      expect(await getSecret(tenantId, "ANTHROPIC_API_KEY")).toBeNull();
    } finally {
      process.env.SECRETS_KEY = original;
    }
  });

  it("tampered ciphertext is refused, not decrypted", async () => {
    await putSecret(tenantId, "ANTHROPIC_API_KEY", "sk-ant-tamper-check-1234", (await realUserId())!);
    await sql`update tenant_secrets set ciphertext = 'AAAA' || ciphertext where name = 'ANTHROPIC_API_KEY'`;
    expect(await getSecret(tenantId, "ANTHROPIC_API_KEY")).toBeNull();
  });
});

describe("what the screen is allowed to see", () => {
  it("reports configured/source/lastFour and never the value", async () => {
    await putSecret(tenantId, "ANTHROPIC_API_KEY", "sk-ant-visible-check-9876", (await realUserId())!);
    const statuses = await getSecretStatus(tenantId);
    const row = statuses.find((s) => s.name === "ANTHROPIC_API_KEY")!;
    expect(row).toMatchObject({ configured: true, source: "stored", lastFour: "9876" });
    // The shape itself is the protection: there is no field to leak.
    expect(JSON.stringify(statuses)).not.toContain("sk-ant-visible-check");
  });

  it("falls back to the environment when nothing is stored", async () => {
    process.env.VOYAGE_API_KEY = "pa-env-fallback-value";
    const statuses = await getSecretStatus(tenantId);
    const row = statuses.find((s) => s.name === "VOYAGE_API_KEY")!;
    expect(row).toMatchObject({ configured: true, source: "environment" });
    delete process.env.VOYAGE_API_KEY;
  });

  it("a stored key wins over the environment — that is the point of the screen", async () => {
    process.env.VOYAGE_API_KEY = "pa-env-value";
    await putSecret(tenantId, "VOYAGE_API_KEY", "pa-stored-value-wins", (await realUserId())!);
    expect(await getSecret(tenantId, "VOYAGE_API_KEY")).toBe("pa-stored-value-wins");
    delete process.env.VOYAGE_API_KEY;
  });

  it("removal falls back rather than leaving a ghost", async () => {
    const uid = (await realUserId())!;
    await putSecret(tenantId, "DEEPGRAM_API_KEY", "dg-some-value-here", uid);
    await deleteSecret(tenantId, "DEEPGRAM_API_KEY");
    expect(await getSecret(tenantId, "DEEPGRAM_API_KEY")).toBeNull();
    const statuses = await getSecretStatus(tenantId);
    expect(statuses.find((s) => s.name === "DEEPGRAM_API_KEY")).toMatchObject({
      configured: false,
      source: null,
    });
  });
});

describe("encryption readiness", () => {
  it("is honest about a server that cannot encrypt", () => {
    const original = process.env.SECRETS_KEY;
    const auth = process.env.AUTH_SECRET;
    delete process.env.SECRETS_KEY;
    delete process.env.AUTH_SECRET;
    try {
      expect(secretsConfigured()).toBe(false);
    } finally {
      process.env.SECRETS_KEY = original;
      if (auth) process.env.AUTH_SECRET = auth;
    }
  });
});
