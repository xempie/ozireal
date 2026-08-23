import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * Database access.
 *
 * §13 says multi-tenancy is enforced at the query layer. In practice that is two
 * layers, because one is not enough:
 *
 *   1. Postgres row-level security. The app connects as a NON-owner role, and every
 *      policy tests `tenant_id = current_tenant_id()`. When `app.tenant_id` is unset
 *      the policy denies, so a forgotten filter returns NOTHING rather than every
 *      tenant's rows. Proven in scripts/db-guards.sh.
 *   2. `withTenant()` below, which sets that value for the scope of a transaction.
 *
 * Migrations and the seed connect as the OWNER, which RLS does not apply to - that is
 * the intended exemption, and is why there is no bypass role for application code to
 * acquire by accident.
 */

const client = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === "production" ? 10 : 3,
  idle_timeout: 20,
  // Dates come back as Date objects; the console formats them itself.
  transform: { undefined: null },
});

export const db = drizzle(client, { schema });
export { schema };
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Run queries as a given tenant.
 *
 * `set_local` scopes the setting to the transaction, so it cannot leak to the next
 * request that borrows the same pooled connection - the failure mode that makes
 * connection-level tenancy dangerous under concurrency.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

/**
 * The tenant for this request, taken from the signed-in session.
 *
 * This is the load-bearing line of the whole tenancy design: the value that reaches
 * `set_local app.tenant_id` comes from an authenticated session, not from a URL, a
 * header, or a client-supplied field. Row-level security then refuses everything else,
 * so a bug in a query cannot widen what a request can see.
 *
 * It throws rather than falling back to "the first tenant". A fallback would mean an
 * unauthenticated request silently reading real rows, which is exactly the failure
 * this arrangement exists to prevent.
 */
export async function currentTenantId(): Promise<string> {
  /**
   * Seeds, tests and CLI scripts have no session. They opt in explicitly, and only
   * outside production - so the escape hatch cannot be reached by a request on a
   * deployed host, which is the only place it would matter.
   */
  if (env.NODE_ENV !== "production" && process.env.OZI_SYSTEM_TENANT === "1") {
    return systemTenantId();
  }

  const { auth } = await import("@/auth");
  const session = await auth();
  const tenantId = session?.user?.tenantId;

  if (!tenantId) {
    throw new Error(
      "No tenant in session. Every read runs as an authenticated user; " +
        "background jobs must call withTenant() with an explicit tenant instead.",
    );
  }
  return tenantId;
}

/** The common case: run a query as the signed-in user's tenant. */
export async function query<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withTenant(await currentTenantId(), fn);
}

/**
 * For code with no session: the seed, migrations, tests and (later) BullMQ workers.
 * Named so that seeing it in a request path is obviously wrong.
 */
export async function systemTenantId(): Promise<string> {
  const rows = await db.execute<{ id: string }>(
    sql`select id from tenants order by created_at limit 1`,
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("No tenant row. Run `pnpm db:reset`.");
  return id;
}

export async function queryAsSystemTenant<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withTenant(await systemTenantId(), fn);
}
