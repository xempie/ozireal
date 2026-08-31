import { sql } from "drizzle-orm";
import { db, withTenant, type Tx } from "@/db";

/**
 * The only way a public page reaches the database.
 *
 * ## Why this exists rather than reusing `query()`
 *
 * `query()` resolves the tenant from the signed-in session and `currentTenantId()`
 * **throws** when there is none — deliberately, because a fallback there would mean an
 * unauthenticated request silently reading real rows. Public pages have no session by
 * definition, so they cannot use it, and must not be given a way to.
 *
 * `queryAsSystemTenant()` is not the answer either: it is named to look wrong in a
 * request path precisely so nobody reaches for it there, and this IS a request path.
 *
 * So the public site gets its own door, and the door is narrow. It resolves the tenant
 * the same way — first by `created_at` — but it is the *only* thing in `src/server/public`
 * that touches `db`, everything reached through it is a named projection in a sibling
 * file, and rule 8's test asserts what those projections may return.
 *
 * ## It still opens a tenant transaction
 *
 * `withTenant` sets `app.tenant_id`, so row-level security applies exactly as it does to
 * a console request. That matters more here than anywhere: a mistake in a public
 * projection is a mistake with an audience. RLS is the layer that turns a forgotten
 * `where` into zero rows instead of into somebody else's data.
 *
 * ## D1: one office, one tenant
 *
 * The launch scope (CLAUDE.md §1) is a single tenant, so "the tenant" is unambiguous.
 * When a second one arrives this is the function that learns to resolve by hostname —
 * which is why every public read goes through it rather than each page deciding.
 */

/** Cached for the life of the process. The tenant row does not change under us. */
let cachedTenantId: string | null = null;

export async function publicTenantId(): Promise<string> {
  if (cachedTenantId) return cachedTenantId;

  const rows = await db.execute<{ id: string }>(
    sql`select id from tenants order by created_at limit 1`,
  );
  const id = rows[0]?.id;
  if (!id) {
    /**
     * Loud rather than an empty page. A public site with no tenant row is a
     * misconfiguration, and rendering "no properties found" would hide it behind
     * something that looks like an ordinary empty state.
     */
    throw new Error(
      "No tenant row, so the public site cannot resolve which agency it is for.",
    );
  }
  cachedTenantId = id;
  return id;
}

/**
 * Run a read as the public tenant.
 *
 * Every function in `src/server/public/*` uses this and nothing else. Nothing in
 * `src/app/(public)` may import `db`, `query`, or a `src/server/queries/*` module —
 * those return whole rows shaped for a screen behind auth, and one of them reaching a
 * public page is exactly the leak rule 8 describes.
 */
export async function publicQuery<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withTenant(await publicTenantId(), fn);
}
