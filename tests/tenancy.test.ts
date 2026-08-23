import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";

/**
 * Row-level security.
 *
 * §13 says tenancy is enforced at the query layer. The application helper composes the
 * predicate, but a helper only works when it is used - so the database has the final
 * say. These tests connect as the APPLICATION role (not the owner, which RLS exempts)
 * and check that forgetting the tenant returns nothing rather than everything.
 */

const APP_URL = (process.env.DATABASE_URL ?? "").replace(
  "//ozirealty@",
  "//ozirealty_app:dev-only-not-for-production@",
);

let owner: postgres.Sql;
let app: postgres.Sql;
let tenantId: string;

beforeAll(async () => {
  owner = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  app = postgres(APP_URL, { max: 1, onnotice: () => {} });
  const [t] = await owner<{ id: string }[]>`select id from tenants limit 1`;
  tenantId = t.id;
});

afterAll(async () => {
  await owner?.end();
  await app?.end();
});

const TENANT_TABLES = [
  "contacts",
  "interactions",
  "consents",
  "properties",
  "listings",
  "approval_items",
  "tasks",
  "ai_generations",
];

describe("row-level security", () => {
  it("returns NOTHING when no tenant is set", async () => {
    for (const table of TENANT_TABLES) {
      const [row] = await app.unsafe<{ n: number }[]>(
        `select count(*)::int as n from ${table}`,
      );
      expect(row.n, `${table} leaked rows with no tenant set`).toBe(0);
    }
  });

  it("returns rows for the tenant that is set", async () => {
    await app.begin(async (tx) => {
      await tx.unsafe(`select set_config('app.tenant_id', '${tenantId}', true)`);
      const [row] = await tx.unsafe<{ n: number }[]>(
        `select count(*)::int as n from contacts`,
      );
      expect(row.n).toBeGreaterThan(0);
    });
  });

  it("returns nothing for a DIFFERENT tenant id", async () => {
    await app.begin(async (tx) => {
      await tx.unsafe(
        `select set_config('app.tenant_id', '00000000-0000-0000-0000-000000000000', true)`,
      );
      const [row] = await tx.unsafe<{ n: number }[]>(
        `select count(*)::int as n from contacts`,
      );
      expect(row.n).toBe(0);
    });
  });

  it("does not leak the setting to the next transaction on the same connection", async () => {
    // set_local is transaction-scoped. If it were set_config(..., false) or a plain
    // SET, the value would survive on the pooled connection and the NEXT request -
    // potentially another tenant's - would read these rows.
    await app.begin(async (tx) => {
      await tx.unsafe(`select set_config('app.tenant_id', '${tenantId}', true)`);
      const [row] = await tx.unsafe<{ n: number }[]>(
        `select count(*)::int as n from contacts`,
      );
      expect(row.n).toBeGreaterThan(0);
    });

    const [after] = await app.unsafe<{ n: number }[]>(
      `select count(*)::int as n from contacts`,
    );
    expect(after.n, "tenant setting leaked past its transaction").toBe(0);
  });

  it("refuses to INSERT a row belonging to another tenant", async () => {
    let message: string | null = null;
    try {
      await app.begin(async (tx) => {
        await tx.unsafe(`select set_config('app.tenant_id', '${tenantId}', true)`);
        await tx.unsafe(
          `insert into contacts (tenant_id, first_name, last_name)
           values ('00000000-0000-0000-0000-000000000000', 'Mallory', 'Elsewhere')`,
        );
      });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/row-level security|violates/i);
  });
});
