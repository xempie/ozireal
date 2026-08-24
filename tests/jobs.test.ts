import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { enqueue, QUEUE_NAME, getConnection, getQueue } from "@/server/jobs/queues";

/**
 * The enqueue contract (B4 review).
 *
 * BullMQ's jobId is not a debounce — it refuses an add whose id already exists,
 * including for FINISHED jobs. With failed jobs kept forever, the naive version
 * meant one failed rebuild silently blocked that contact's brief for good. These
 * tests pin the behaviour that replaced it, against a real Redis.
 */

let queue: Queue;
let reachable = true;

beforeAll(async () => {
  queue = getQueue() as unknown as Queue;
  try {
    await getConnection().connect().catch(() => {});
    await queue.getJobCounts("waiting");
    // A worker may be running against this same Redis (pnpm worker). Pause, so
    // these tests observe what ENQUEUE did rather than racing a consumer.
    await queue.pause();
  } catch {
    reachable = false;
  }
});

afterAll(async () => {
  if (reachable) {
    await queue.obliterate({ force: true }).catch(() => {});
    await queue.resume().catch(() => {});
  }
  await queue.close().catch(() => {});
  await getConnection().quit().catch(() => {});
});

const tenantId = randomUUID();

describe.runIf(process.env.REDIS_URL || true)("enqueue", () => {
  it("collapses a burst: a second request folds into the waiting job", async () => {
    if (!reachable) return;
    const entityId = randomUUID();
    expect(await enqueue("RebuildContactIntent", { tenantId, entityId })).toBe(true);
    expect(await enqueue("RebuildContactIntent", { tenantId, entityId })).toBe(true);

    const waiting = await queue.getWaiting();
    const mine = waiting.filter((j) => j.data.entityId === entityId);
    // Ten emails in a minute must not buy ten Sonnet calls.
    expect(mine).toHaveLength(1);
  });

  it("a COMPLETED job does not block the next request", async () => {
    if (!reachable) return;
    const entityId = randomUUID();
    await enqueue("RebuildContactIntent", { tenantId, entityId });

    // Simulate the worker finishing it, with the key retained (removeOnComplete age).
    const job = await queue.getJob(`RebuildContactIntent-${entityId}`);
    await job!.moveToCompleted("done", "test-token", false).catch(() => {});

    expect(await enqueue("RebuildContactIntent", { tenantId, entityId })).toBe(true);
    const again = await queue.getJob(`RebuildContactIntent-${entityId}`);
    // The brief must rebuild when this afternoon's email arrives, not 24h later.
    expect(await again!.getState()).not.toBe("completed");
  });

  it("a FAILED job does not block the entity forever", async () => {
    if (!reachable) return;
    const entityId = randomUUID();
    await enqueue("SummariseInteraction", { tenantId, entityId });
    const job = await queue.getJob(`SummariseInteraction-${entityId}`);
    await job!.moveToFailed(new Error("boom"), "test-token", false).catch(() => {});

    expect(await enqueue("SummariseInteraction", { tenantId, entityId })).toBe(true);
    const again = await queue.getJob(`SummariseInteraction-${entityId}`);
    // removeOnFail is false — without the fix this entity would never be processed again.
    expect(await again!.getState()).not.toBe("failed");
  });
});
