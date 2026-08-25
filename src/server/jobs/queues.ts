import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * Background jobs (B3.1, CLAUDE.md §8).
 *
 * One rule shapes everything here: a failed AI call — or a dead Redis — must never
 * fail a user request. So the connection is lazy, enqueueing is best-effort with the
 * failure written to the console rather than thrown, and the interaction row is
 * always committed BEFORE anything is enqueued. The queue accelerates the product;
 * it is not load-bearing for correctness. A missed job is repaired by re-enqueueing
 * from the database, which still holds the truth.
 */

export const QUEUE_NAME = "ozirealty";

export type JobName =
  | "SummariseInteraction"
  | "RebuildContactIntent"
  | "MatchContacts"
  | "MatchListings"
  | "EmbedListing"
  | "EmbedContactPreferences"
  | "DailyBrief";

export type JobPayload = {
  tenantId: string;
  /** What the job is about — an interaction id, a contact id, a property id. */
  entityId: string;
};

let connection: IORedis | null = null;

export function redisUrl(): string {
  return process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
}

/**
 * One shared connection, created on first use.
 *
 * maxRetriesPerRequest: null is BullMQ's requirement for blocking commands;
 * enableOfflineQueue: false makes a down Redis fail FAST instead of buffering
 * commands in memory until the process gives up — the enqueue wrapper below turns
 * that fast failure into a logged skip.
 */
export function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(redisUrl(), {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      // Do not spin forever against a Redis that is not there.
      retryStrategy: (times) => (times > 20 ? null : Math.min(times * 500, 10_000)),
      lazyConnect: true,
    });
    connection.on("error", () => {
      /* surfaced via enqueue()'s catch and getQueueHealth(); a listener must exist
         or ioredis escalates every hiccup to an uncaught exception. */
    });
  }
  return connection;
}

let queue: Queue<JobPayload, unknown, JobName> | null = null;

export function getQueue(): Queue<JobPayload, unknown, JobName> {
  if (!queue) {
    queue = new Queue<JobPayload, unknown, JobName>(QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        /**
         * §8: small, idempotent, retryable with exponential backoff.
         * 5 attempts spanning ~4 minutes rides out an AI-provider blip;
         * anything still failing after that parks in the failed set, which the
         * dead-letter view reads. Completed jobs are pruned; failed jobs are
         * KEPT — they are the evidence the dead-letter view exists to show.
         */
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: false,
      },
    });
  }
  return queue;
}

/**
 * Enqueue, best-effort.
 *
 * The jobId collapses a burst: ten emails from one person in a minute should mean
 * one brief rebuild, not ten paid Sonnet calls.
 *
 * But BullMQ's jobId is not a debounce — "if you attempt to add a job with an id
 * that already exists, it will not be added", and that holds for FINISHED jobs
 * too, for as long as the key survives. With removeOnComplete at 24h and
 * removeOnFail false, the naive version means: a contact whose brief was rebuilt
 * this morning gets no rebuild from this afternoon's email, and a contact whose
 * rebuild ever failed gets no rebuild EVER again. Both are silent.
 *
 * So a finished job with this id is removed first, and only a live one (waiting,
 * delayed or active) is allowed to absorb the new request. That keeps the collapse
 * and drops the trap. Found by the B4 review.
 */
export async function enqueue(name: JobName, payload: JobPayload): Promise<boolean> {
  // BullMQ reserves ':' as its key separator and refuses it in custom ids.
  const jobId = `${name}-${payload.entityId}`;
  try {
    const queue = getQueue();

    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "failed") {
        await existing.remove();
      } else if (state === "active") {
        /**
         * Mid-flight: it has already read the rows it is going to read, so folding
         * into it would silently drop whatever just landed — a brief permanently
         * missing the interaction that triggered the rebuild. Schedule a trailing
         * run instead, under a minute-bucketed id so a burst still collapses to at
         * most one follow-up per minute.
         */
        const bucket = Math.floor(Date.now() / 60_000);
        await queue.add(name, payload, {
          jobId: `${jobId}-after-${bucket}`,
          delay: 30_000,
        });
        return true;
      } else {
        // Waiting or delayed: not started yet, so it will see the new rows too.
        return true;
      }
    }

    await queue.add(name, payload, { jobId });
    return true;
  } catch (e) {
    console.error(
      `[jobs] enqueue ${name}(${payload.entityId}) failed — job skipped, DB is source of truth:`,
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

/**
 * For the dead-letter view. Honest when Redis is down: `reachable: false` and empty
 * lists, never a fabricated zero that reads as "all healthy".
 */
export async function getQueueHealth() {
  try {
    const q = getQueue();
    const counts = await q.getJobCounts("waiting", "active", "delayed", "failed", "completed");
    const failed = await q.getFailed(0, 19);
    return {
      reachable: true,
      counts,
      failed: failed.map((j) => ({
        id: j.id ?? "?",
        name: j.name,
        entityId: j.data?.entityId ?? "?",
        attemptsMade: j.attemptsMade,
        failedReason: j.failedReason?.slice(0, 300) ?? "unknown",
        timestamp: j.timestamp ? new Date(j.timestamp) : null,
      })),
    };
  } catch {
    return { reachable: false as const, counts: null, failed: [] };
  }
}

/** Re-queue one failed job, from the dead-letter view. */
export async function retryFailedJob(jobId: string): Promise<boolean> {
  try {
    const job = await getQueue().getJob(jobId);
    if (!job) return false;
    await job.retry();
    return true;
  } catch {
    return false;
  }
}
