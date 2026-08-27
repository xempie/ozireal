import { eq } from "drizzle-orm";
import { withTenant } from "@/db";
import { llmSettings } from "@/db/schema";

/**
 * The stored LLM settings row, or null where a tenant has never saved one.
 *
 * A READ, deliberately not in the "use server" actions file: everything exported
 * from there becomes a callable endpoint, and a settings read has no business
 * being one.
 */
export async function readLlmSettings(tenantId: string) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx.select().from(llmSettings).where(eq(llmSettings.tenantId, tenantId)).limit(1),
  );
  return row ?? null;
}

/**
 * Does ANY user have a password? Drives the login page's setup hint.
 *
 * Deliberately not per-address: asking "does this email have a password" from an
 * unauthenticated page is an enumeration oracle.
 */
export async function anyUserHasPassword(): Promise<boolean> {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { isNotNull } = await import("drizzle-orm");
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(isNotNull(users.passwordHash))
    .limit(1);
  return rows.length > 0;
}
