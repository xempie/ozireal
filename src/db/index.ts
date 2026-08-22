import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, type SQL } from "drizzle-orm";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * Database access.
 *
 * §13: multi-tenancy is enforced at the QUERY layer, never in the UI. Launch is a
 * single office (D1), but every tenant-scoped table carries `tenant_id` and reads go
 * through `forTenant()`, because retrofitting either is impractical once data exists.
 */

const client = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === "production" ? 10 : 3,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
export { schema };
export type Db = typeof db;

/** Tables that are NOT tenant-scoped. Everything else must carry a tenant filter. */
const GLOBAL_TABLES = new Set(["suburbs", "tenants"]);

/**
 * A tenant-bound handle. `where()` composes the tenant predicate with your own, so a
 * query cannot accidentally omit it:
 *
 *   const t = forTenant(tenantId);
 *   await db.select().from(contacts).where(t.where(contacts, eq(contacts.id, id)));
 *
 * This is a guard rail, not a security boundary on its own - Phase 1.1 adds row-level
 * security in Postgres so the database enforces it even if application code slips.
 */
export function forTenant(tenantId: string) {
  return {
    tenantId,
    where<T extends { tenantId: unknown; _: { name: string } }>(
      table: T,
      ...extra: (SQL | undefined)[]
    ): SQL | undefined {
      if (GLOBAL_TABLES.has(table._.name)) {
        return extra.length ? and(...extra) : undefined;
      }
      return and(
        eq(table.tenantId as never, tenantId),
        ...extra.filter(Boolean),
      );
    },
  };
}

export type TenantDb = ReturnType<typeof forTenant>;
