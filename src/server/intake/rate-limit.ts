import { getConnection } from "@/server/jobs/queues";

/**
 * Per-IP and per-tenant rate limits for the public form (B3.4).
 *
 * Redis INCR with expiry — cheap, shared with the queue's connection. Two windows:
 * a burst window that stops a tight loop, and an hourly window that stops a slow
 * drip. Limits are deliberately generous: a real person re-enquiring about three
 * properties in a minute must never be told to go away.
 *
 * FAIL OPEN, loudly. If Redis is down the form keeps accepting: a spam burst during
 * an outage costs someone ten minutes of triage in the merge queue; a refused real
 * lead is money lost silently. The console error is the honest record that the
 * guard was down.
 */

const LIMITS = [
  { window: 60, max: 5, keyOf: (ip: string) => `rl:ip-burst:${ip}` },
  { window: 3600, max: 20, keyOf: (ip: string) => `rl:ip-hour:${ip}` },
] as const;

/** The whole tenant's hourly ceiling — the backstop against a distributed drip. */
const TENANT_LIMIT = { window: 3600, max: 200 };

export type RateCheck = { allowed: boolean; guardDown: boolean };

export async function checkRateLimit(ip: string | null, tenantId: string): Promise<RateCheck> {
  try {
    const redis = getConnection();
    if (redis.status !== "ready") await redis.connect().catch(() => {});

    const checks: Promise<number>[] = [];
    if (ip) {
      for (const l of LIMITS) checks.push(bump(redis, l.keyOf(ip), l.window));
    }
    checks.push(bump(redis, `rl:tenant:${tenantId}`, TENANT_LIMIT.window));

    const counts = await Promise.all(checks);
    const ipAllowed = !ip || LIMITS.every((l, i) => counts[i] <= l.max);
    const tenantAllowed = counts[counts.length - 1] <= TENANT_LIMIT.max;

    return { allowed: ipAllowed && tenantAllowed, guardDown: false };
  } catch (e) {
    console.error(
      "[rate-limit] guard unavailable, failing open:",
      e instanceof Error ? e.message : e,
    );
    return { allowed: true, guardDown: true };
  }
}

async function bump(
  redis: ReturnType<typeof getConnection>,
  key: string,
  windowSeconds: number,
): Promise<number> {
  const count = await redis.incr(key);
  // Only the first hit sets the expiry; INCR on an existing key keeps its TTL.
  if (count === 1) await redis.expire(key, windowSeconds);
  return count;
}
