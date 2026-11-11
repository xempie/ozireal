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
  /** A property still being worked (not sold or archived) against every possible lead. */
  async MatchProperty(job) {
    const { matchContactsForProperty } = await import("@/server/matching/engine");
    return matchContactsForProperty(job.data.tenantId, job.data.entityId);
  },
  /**
   * Nightly: queue a match for every property in every tenant, so new leads are matched
   * against existing stock too. Each MatchProperty job collapses by property id.
   */
  async MatchAllProperties() {
    const { properties, tenants } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");
    const { MATCHABLE_PROPERTY_STATUSES } = await import("@/server/matching/engine");
    const { withTenant } = await import("@/db");
    const { enqueue } = await import("./queues");
    const ts = await db.select({ id: tenants.id }).from(tenants);
    let queued = 0;
    for (const t of ts) {
      // Sold and archived stock is never matched, so it is not queued either.
      const ps = await withTenant(t.id, (tx) =>
        tx
          .select({ id: properties.id })
          .from(properties)
          .where(inArray(properties.status, [...MATCHABLE_PROPERTY_STATUSES])),
      );
      for (const p of ps) if (await enqueue("MatchProperty", { tenantId: t.id, entityId: p.id })) queued++;
    }
    return { queued };
  },
  /** Photos to a Red / Amber / Green condition read (2026-11-11). */
  async RunBuildingCheck(job) {
    const { runBuildingCheck } = await import("@/server/building-check/run");
    return runBuildingCheck(job.data.tenantId, job.data.entityId);
  },
  async MatchListings(job) {
    const { matchListingsForContact } = await import("@/server/matching/engine");
    return matchListingsForContact(job.data.tenantId, job.data.entityId);
  },
  async EmbedListing(job) {
    const { embedListing } = await import("@/server/ai/embed");
    const result = await embedListing(job.data.tenantId, job.data.entityId);
    // The listing now has fresh copy (and maybe a vector): re-match its property.
    const { listings } = await import("@/db/schema");
    const { withTenant } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { enqueue } = await import("./queues");
    const [l] = await withTenant(job.data.tenantId, (tx) =>
      tx.select({ propertyId: listings.propertyId }).from(listings).where(eq(listings.id, job.data.entityId)).limit(1),
    );
    if (l) await enqueue("MatchProperty", { tenantId: job.data.tenantId, entityId: l.propertyId });
    return result;
  },
  async EmbedContactPreferences(job) {
    const { embedContactPreferences } = await import("@/server/ai/embed");
    const { enqueue } = await import("./queues");
    const result = await embedContactPreferences(job.data.tenantId, job.data.entityId);
    // Preferences changed: match this lead against all stock still being worked.
    await enqueue("MatchListings", { tenantId: job.data.tenantId, entityId: job.data.entityId });
    return result;
  },
  async DailyBrief(job) {
    return { pending: "B7", tenantId: job.data.tenantId };
  },
  /** Fixed-template notices for a new website enquiry — no AI, no marketing. */
  async NotifyEnquiry(job) {
    const { notifyEnquiry } = await import("@/server/outbound/notices");
    return notifyEnquiry(job.data.tenantId, job.data.entityId);
  },
};

export function startWorker() {
  /**
   * The nightly sweep as a BullMQ job scheduler (CLAUDE.md §8: repeatable jobs, no cron).
   * Upserted on every boot, so the schedule lives in code and survives restarts.
   */
  void (async () => {
    try {
      const { getQueue } = await import("./queues");
      await getQueue().upsertJobScheduler(
        "MatchAllProperties",
        { pattern: "0 30 2 * * *", tz: "Australia/Adelaide" },
        { name: "MatchAllProperties", data: { tenantId: "all", entityId: "all" } },
      );
    } catch (e) {
      console.error("[worker] could not schedule the nightly match:", e instanceof Error ? e.message : e);
    }
  })();

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
