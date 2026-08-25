"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { llmSettings } from "@/db/schema";
import { invalidateLlmConfig } from "@/server/ai/config";

/**
 * Saving LLM configuration.
 *
 * The validation here mirrors the database CHECK constraints rather than
 * replacing them — the constraints are the guarantee, this is the readable
 * error. Structured temperature is absent from the schema entirely: it is not a
 * setting, it is 0, and the column refuses anything else.
 */
export const saveLlmSettings = defineAction({
  input: z.object({
    fastModel: z.string().trim().min(1, "A model id is required").max(120),
    writingModel: z.string().trim().min(1, "A model id is required").max(120),
    proseTemperature: z.coerce
      .number()
      .min(0, "Temperature runs from 0 to 1")
      .max(1, "Temperature runs from 0 to 1"),
    extractionMaxTokens: z.coerce.number().int().min(256).max(32000),
    briefMaxTokens: z.coerce.number().int().min(256).max(32000),
    rankingMaxTokens: z.coerce.number().int().min(256).max(32000),
    /**
     * Blank means "no cap", which is different from zero ("never spend"). Kept as
     * a raw union and normalised in the handler rather than with .transform(),
     * because a module-scope arrow in a "use server" file is refused by the
     * compiler — every export there has to be an async function.
     */
    monthlyBudgetAud: z.union([z.coerce.number().min(0), z.literal("")]),
    budgetAction: z.enum(["block", "warn"]),
    fastInputUsdPerMtok: z.coerce.number().min(0).max(1000),
    fastOutputUsdPerMtok: z.coerce.number().min(0).max(1000),
    writingInputUsdPerMtok: z.coerce.number().min(0).max(1000),
    writingOutputUsdPerMtok: z.coerce.number().min(0).max(1000),
    audPerUsd: z.coerce.number().min(0.1).max(10),
  }),
  async handler(input, ctx) {
    const budget = input.monthlyBudgetAud === "" ? null : Number(input.monthlyBudgetAud);

    /**
     * A model id is free text so a model released today is usable today. The
     * cost of that freedom is a typo reaching the API as a 404 on the next job,
     * so the shape is sanity-checked — enough to catch a paste accident, not so
     * much that it second-guesses a real id we have not heard of.
     */
    for (const [label, id] of [
      ["fast", input.fastModel],
      ["writing", input.writingModel],
    ] as const) {
      if (!/^[a-z0-9][a-z0-9._:-]*$/i.test(id)) {
        throw new ActionError(
          `"${id}" does not look like a model id, so the ${label} model was not changed. Ids look like "claude-sonnet-5".`,
        );
      }
    }

    await ctx.tx
      .insert(llmSettings)
      .values({
        tenantId: ctx.tenantId,
        fastModel: input.fastModel,
        writingModel: input.writingModel,
        proseTemperature: input.proseTemperature,
        extractionMaxTokens: input.extractionMaxTokens,
        briefMaxTokens: input.briefMaxTokens,
        rankingMaxTokens: input.rankingMaxTokens,
        monthlyBudgetAud: budget?.toFixed(2) ?? null,
        budgetAction: input.budgetAction,
        fastInputUsdPerMtok: input.fastInputUsdPerMtok.toFixed(4),
        fastOutputUsdPerMtok: input.fastOutputUsdPerMtok.toFixed(4),
        writingInputUsdPerMtok: input.writingInputUsdPerMtok.toFixed(4),
        writingOutputUsdPerMtok: input.writingOutputUsdPerMtok.toFixed(4),
        audPerUsd: input.audPerUsd.toFixed(4),
        updatedByUserId: ctx.userId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: llmSettings.tenantId,
        set: {
          fastModel: input.fastModel,
          writingModel: input.writingModel,
          proseTemperature: input.proseTemperature,
          extractionMaxTokens: input.extractionMaxTokens,
          briefMaxTokens: input.briefMaxTokens,
          rankingMaxTokens: input.rankingMaxTokens,
          monthlyBudgetAud: budget?.toFixed(2) ?? null,
          budgetAction: input.budgetAction,
          fastInputUsdPerMtok: input.fastInputUsdPerMtok.toFixed(4),
          fastOutputUsdPerMtok: input.fastOutputUsdPerMtok.toFixed(4),
          writingInputUsdPerMtok: input.writingInputUsdPerMtok.toFixed(4),
          writingOutputUsdPerMtok: input.writingOutputUsdPerMtok.toFixed(4),
          audPerUsd: input.audPerUsd.toFixed(4),
          updatedByUserId: ctx.userId,
          updatedAt: new Date(),
        },
      });

    await ctx.audit({
      kind: "edit",
      action: "Changed the AI configuration",
      target: `${input.fastModel} / ${input.writingModel}`,
      entityType: "llm_settings",
      metadata: {
        budget,
        budgetAction: input.budgetAction,
        proseTemperature: input.proseTemperature,
      },
    });

    // The cache holds for 30s otherwise, which is a confusing delay right after
    // pressing save.
    ctx.afterCommit(async () => invalidateLlmConfig(ctx.tenantId));

    revalidatePath("/settings");
    revalidatePath("/costs");
    return { saved: true };
  },
});
