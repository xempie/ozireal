"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, ActionError } from "./action";
import { retryFailedJob } from "@/server/jobs/queues";

/** Re-queue one dead-lettered job, from the settings screen. */
export const retryJob = defineAction({
  input: z.object({ jobId: z.string().min(1).max(200) }),
  async handler(input, ctx) {
    const ok = await retryFailedJob(input.jobId);
    if (!ok) {
      throw new ActionError(
        "That job could not be retried — it may have been retried already, or the queue is unreachable.",
      );
    }
    await ctx.audit({
      kind: "commit",
      action: "Retried a failed background job",
      target: input.jobId,
      entityType: "job",
      entityId: undefined,
    });
    revalidatePath("/settings");
    return { retried: true };
  },
});
