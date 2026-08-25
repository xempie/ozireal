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
