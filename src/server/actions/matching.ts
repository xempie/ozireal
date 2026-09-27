"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { applyWrite, type WriteOutcome } from "@/server/assistant/writes";
import type { ActionResult } from "./action";

/**
 * The Matching page's "Find buyers" / "Find properties" buttons.
 *
 * The same code path as the assistant's run_matching after Do it: the same checks
 * (a property is not a listing, a contact needs preferences, a listing must be live)
 * and the same plain-English refusals, so the button and the chat can never disagree.
 *
 * Not defineAction: the ranking stage calls Claude and can take several seconds, and
 * defineAction would hold a database transaction open for all of it. It still
 * authenticates and validates its input (§13); the engine scopes to the tenant.
 */
export async function runMatching(raw: unknown): Promise<ActionResult<WriteOutcome>> {
  const session = await auth();
  if (!session?.user?.tenantId) return { ok: false, error: "You are signed out. Sign in and try again." };

  const parsed = z
    .union([
      z.object({ listingId: z.string().uuid() }),
      z.object({ contactId: z.string().uuid() }),
    ])
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Choose a listing or a contact to match." };

  const result = await applyWrite("run_matching", parsed.data);
  revalidatePath("/matching");
  revalidatePath("/dashboard");
  return { ok: true, data: result };
}
