"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, ActionError } from "./action";
import {
  putSecret,
  deleteSecret,
  secretsConfigured,
  SECRET_NAMES,
} from "@/server/secrets";

/**
 * Storing a provider credential from the Settings screen.
 *
 * The value arrives, is encrypted, and is never returned — not in the result, not
 * in the audit row, not in a log line. What the audit records is that a named
 * credential CHANGED and who changed it, which is the fact that matters when
 * someone asks why the AI stopped working last Tuesday.
 */

const KEY_SHAPES: Partial<Record<(typeof SECRET_NAMES)[number], { prefix?: string; label: string }>> = {
  ANTHROPIC_API_KEY: { prefix: "sk-ant-", label: "Anthropic API key" },
  VOYAGE_API_KEY: { prefix: "pa-", label: "Voyage API key" },
};

export const saveSecret = defineAction({
  input: z.object({
    name: z.enum(SECRET_NAMES),
    // Long enough to be a key, short enough that a pasted paragraph is refused.
    value: z.string().trim().min(8, "That is too short to be a key").max(500),
  }),
  async handler(input, ctx) {
    if (!secretsConfigured()) {
      throw new ActionError(
        "The server has no SECRETS_KEY (or AUTH_SECRET) configured, so credentials cannot be encrypted. Set one and restart before saving keys here.",
      );
    }

    /**
     * A shape check, not a validity check. It catches the common paste mistakes —
     * the wrong provider's key, a copied label, a truncated string — without
     * pretending we know whether the key actually works. Only the provider knows
     * that, and the first real call will say so.
     */
    const shape = KEY_SHAPES[input.name];
    if (shape?.prefix && !input.value.startsWith(shape.prefix)) {
      throw new ActionError(
        `That does not look like a ${shape.label} — they begin with "${shape.prefix}". Nothing was saved.`,
      );
    }

    const { lastFour } = await putSecret(ctx.tenantId, input.name, input.value, ctx.userId);

    await ctx.audit({
      kind: "edit",
      action: "Updated a stored credential",
      // The NAME and the last four only. Never the value.
      target: `${input.name} (…${lastFour})`,
      entityType: "tenant_secret",
    });

    revalidatePath("/settings");
    return { lastFour };
  },
});

export const removeSecret = defineAction({
  input: z.object({ name: z.enum(SECRET_NAMES) }),
  async handler(input, ctx) {
    await deleteSecret(ctx.tenantId, input.name);
    await ctx.audit({
      kind: "edit",
      action: "Removed a stored credential",
      target: input.name,
      entityType: "tenant_secret",
    });
    revalidatePath("/settings");
    return { removed: true };
  },
});
