import { AlertTriangle, CheckCircle2, PlugZap } from "lucide-react";
import { Card, CardTitle, Badge, Empty, ProtoNote } from "@/components/ui";
import { getQueueHealth } from "@/server/jobs/queues";
import { relative } from "@/lib/utils";
import { RetryJobButton } from "./retry-button";

/**
 * The dead-letter view (B3.1).
 *
 * A job that exhausted its five attempts parks in the failed set and STAYS there —
 * failed jobs are evidence, not litter. This renders them where the one user
 * actually looks, with a retry per row. And it is honest about the distinction
 * between "no failures" and "cannot see the queue": a dead Redis renders as
 * unreachable, never as a comforting zero.
 */
export async function QueueHealthCard() {
  const health = await getQueueHealth();

  if (!health.reachable) {
    return (
      <Card>
        <CardTitle>Background jobs</CardTitle>
        <div className="flex items-start gap-2 text-[12.5px] rounded-md border border-[#eda100]/50 bg-[#eda100]/10 p-2.5">
          <PlugZap size={14} className="shrink-0 mt-px" />
          <span>
            The queue is unreachable — Redis is not running. Intake keeps working
            (the database is the source of truth); summaries and rebuilds will queue
            up again once the worker is back.
          </span>
        </div>
      </Card>
    );
  }

  const c = health.counts ?? {};
  return (
    <Card>
      <CardTitle>Background jobs</CardTitle>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge tone="neutral">waiting {c.waiting ?? 0}</Badge>
        <Badge tone="neutral">active {c.active ?? 0}</Badge>
        <Badge tone="neutral">delayed {c.delayed ?? 0}</Badge>
        <Badge tone={health.failed.length > 0 ? "blocked" : "sent"}>
          failed {c.failed ?? 0}
        </Badge>
      </div>

      {health.failed.length === 0 ? (
        <div className="flex items-center gap-2 text-2 text-[12.5px]">
          <CheckCircle2 size={14} className="text-[#006300] dark:text-[#5fc45f]" />
          Nothing in the dead-letter set.
        </div>
      ) : (
        <div className="space-y-2">
          {health.failed.map((j) => (
            <div key={j.id} className="surface-3 border rounded-md p-2.5 text-[12px]">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertTriangle size={12} className="text-[#b02f2f] dark:text-[#f08a8a] shrink-0" />
                <span className="font-medium">{j.name}</span>
                <span className="text-3 font-mono text-[11px]">{j.entityId.slice(0, 8)}</span>
                <span className="text-3 ml-auto">
                  {j.attemptsMade} attempts
                  {j.timestamp && ` · ${relative(j.timestamp)}`}
                </span>
              </div>
              <p className="text-2 mt-1 leading-relaxed break-all">{j.failedReason}</p>
              <div className="mt-2">
                <RetryJobButton jobId={j.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      <ProtoNote>
        Five attempts with exponential backoff, then a job parks here. It is kept —
        a failed job is the evidence of what did not happen.
      </ProtoNote>
    </Card>
  );
}
