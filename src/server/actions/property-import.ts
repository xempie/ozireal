"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction } from "./action";
import { importProperty } from "@/server/import/property-import-schema";
import {
  extractProperties,
  resolveRow,
  commitRow,
  type ResolvedRow,
} from "@/server/import/properties";

/**
 * Import properties from a file (JSON, Markdown or PDF) — preview, then commit.
 *
 * Preview writes nothing. It reads the file (Claude does the reading for Markdown and
 * PDF, logged to the cost ledger like every other call), then shows what each row would
 * do: which suburb it lands in, whether the owner and tenants are people already in the
 * contact list, and why any row would be skipped. The agent unticks what is wrong and
 * presses Import; only then does anything land.
 *
 * The preview's AI call runs inside the action's transaction, holding one connection for
 * the few seconds a read takes. Acceptable for a one-user office; it is the same trade
 * B5 recorded for the SMS send and would move out with it.
 */

/** 5 MB of PDF is ~6.7 MB once base64-encoded; next.config raises the action body limit to match. */
const MAX_CONTENT = 7_000_000;

export const previewPropertyImport = defineAction({
  input: z.object({
    fileName: z.string().trim().min(1).max(200),
    kind: z.enum(["json", "md", "pdf"]),
    content: z.string().min(1, "The file is empty.").max(MAX_CONTENT, "That file is too large (5 MB at most)."),
  }),
  async handler(input, ctx) {
    const rows = await extractProperties(ctx.tenantId, {
      kind: input.kind,
      content: input.content,
      name: input.fileName,
    });
    const seen = new Set<string>();
    const resolved: ResolvedRow[] = [];
    for (const row of rows) resolved.push(await resolveRow(ctx.tx, row, seen));
    return { rows: resolved };
  },
});

export const commitPropertyImport = defineAction({
  input: z.object({
    fileName: z.string().trim().min(1).max(200),
    rows: z.array(importProperty).min(1, "Tick at least one property to import.").max(200),
  }),
  async handler(input, ctx) {
    const seen = new Set<string>();
    const imported: { address: string; propertyId: string }[] = [];
    const skipped: { address: string; reason: string }[] = [];
    let newContacts = 0;
    let linkedContacts = 0;
    let reviews = 0;

    for (const row of input.rows) {
      // Re-resolved here, not taken from the preview: the list may have changed since,
      // and the browser's copy of the preview is not something to trust.
      const resolved = await resolveRow(ctx.tx, row, seen);
      if (resolved.problem) {
        skipped.push({ address: `${resolved.address}, ${resolved.suburbLabel}`, reason: resolved.problem });
        continue;
      }
      const result = await commitRow(ctx.tx, ctx.tenantId, resolved, input.fileName);
      imported.push({ address: `${resolved.address}, ${resolved.suburbLabel}`, propertyId: result.propertyId });
      for (const p of [result.owner, ...result.tenants]) {
        if (!p) continue;
        if (p.outcome === "existing") linkedContacts++;
        else newContacts++;
        if (p.outcome === "ambiguous") reviews++;
      }
    }

    await ctx.audit({
      kind: "edit",
      action: `Imported ${imported.length} ${imported.length === 1 ? "property" : "properties"}`,
      target: input.fileName,
      entityType: "property",
      metadata: { imported, skipped, newContacts, linkedContacts, reviews },
    });

    revalidatePath("/properties");
    revalidatePath("/contacts");
    revalidatePath("/confirm");
    revalidatePath("/dashboard");
    return { imported, skipped, newContacts, linkedContacts, reviews };
  },
});
