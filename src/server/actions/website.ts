"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { defineAction } from "./action";
import { tenants } from "@/db/schema";

/**
 * Website settings from the console's Website section.
 *
 * Each call sets only the keys it is given, merged into tenants.site_settings with
 * jsonb `||`, so a future option is never wiped by an older screen that does not know
 * it. The public pages that read a key are revalidated so the change shows at once.
 */
export const setSiteSettings = defineAction({
  input: z
    .object({
      homeListingFilters: z.boolean().optional(),
    })
    .strict(),
  async handler(input, ctx) {
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length === 0) return { changed: 0 };

    await ctx.tx
      .update(tenants)
      .set({ siteSettings: sql`${tenants.siteSettings} || ${JSON.stringify(patch)}::jsonb` })
      .where(eq(tenants.id, ctx.tenantId));

    await ctx.audit({
      kind: "edit",
      action: "Changed a website setting",
      target: Object.entries(patch)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", "),
      metadata: patch,
    });

    revalidatePath("/");
    revalidatePath("/for-sale");
    revalidatePath("/website");
    return { changed: Object.keys(patch).length };
  },
});
