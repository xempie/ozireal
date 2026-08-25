import { Worker, type Job } from "bullmq";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { QUEUE_NAME, getConnection, type JobName, type JobPayload } from "./queues";

/**
 * The worker process (B3.1). Runs beside the web app — `pnpm worker` locally,
 * worker.service on the instance — sharing the schema and the tenant-scoped client
 * but never a Next.js request. §8's whole list of jobs eventually lands here.
 *
 * Handlers hold to three rules:
 *   - idempotent: at-least-once delivery means a handler may run twice; running
 *     twice must equal running once.
 *   - tenant-scoped: every DB touch goes through withTenant(payload.tenantId) —
 *     there is no session here to fall back on.
 *   - honest: a handler whose real work arrives in a later phase says so and
 *     succeeds without side effects. It does NOT fabricate output — a fake summary
 *     poisons the record it lands on, and B4 would build the AI on top of lies.
 */

type Handler = (job: Job<JobPayload, unknown, JobName>) => Promise<unknown>;

const handlers: Record<JobName, Handler> = {
  /**
   * B4: Haiku extracts, Sonnet writes (§9). A TaskOutputError (schema-invalid
   * model output) rides the normal retry train — the next attempt usually parses —
   * and parks in the dead-letter view with the raw response ledgered if it never
   * does. A ClaudeError with retryable=false (bad key, bad request) fails fast
   * for the same five attempts but tells the operator what to actually fix.
   */
  async SummariseInteraction(job) {
    const { summariseInteraction } = await import("@/server/ai/handlers");
    return summariseInteraction(job.data.tenantId, job.data.entityId);
  },
  async RebuildContactIntent(job) {
    const { rebuildContactIntent } = await import("@/server/ai/handlers");
    return rebuildContactIntent(job.data.tenantId, job.data.entityId);
  },
  /** B5: listing → ranked contacts, and the reverse. */
  async MatchContacts(job) {
    const { matchContactsForListing } = await import("@/server/matching/engine");
    return matchContactsForListing(job.data.tenantId, job.data.entityId);
  },
  async MatchListings(job) {
    const { matchListingsForContact } = await import("@/server/matching/engine");
    return matchListingsForContact(job.data.tenantId, job.data.entityId);
  },
  async EmbedListing(job) {
    const { embedListing } = await import("@/server/ai/embed");
    return embedListing(job.data.tenantId, job.data.entityId);
  },
  async EmbedContactPreferences(job) {
    const { embedContactPreferences } = await import("@/server/ai/embed");
    return embedContactPreferences(job.data.tenantId, job.data.entityId);
  },
  async DailyBrief(job) {
    return { pending: "B7", tenantId: job.data.tenantId };
  },
};

export function startWorker() {
  const worker = new Worker<JobPayload, unknown, JobName>(
    QUEUE_NAME,
    async (job) => {
      const handler = handlers[job.name];
      if (!handler) throw new Error(`No handler for job '${job.name}'`);
      return handler(job);
    },
    {
      connection: getConnection(),
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[worker] ${job.name}(${job.data.entityId}) done`);
  });
  worker.on("failed", (job, err) => {
    console.error(
      `[worker] ${job?.name}(${job?.data.entityId}) attempt ${job?.attemptsMade} failed: ${err.message}`,
    );
  });

  return worker;
}

/** `pnpm worker` runs this file directly. */
if (process.argv[1]?.replace(/\\/g, "/").endsWith("jobs/worker.ts")) {
  // A worker with no database is useless; fail at boot, not mid-job.
  db.execute(sql`select 1`)
    .then(() => {
      const w = startWorker();
      console.log(`[worker] listening on queue '${QUEUE_NAME}'`);
      const stop = async () => {
        await w.close();
        process.exit(0);
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
    })
    .catch((e) => {
      console.error("[worker] database unreachable at boot:", e.message);
      process.exit(1);
    });
}
