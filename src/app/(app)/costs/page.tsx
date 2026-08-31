import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  Stat,
  Badge,
  CardTitle,
  Table,
  THead,
  TH,
  TD,
  TR,
  ProtoNote,
  Callout,
  Empty,
} from "@/components/ui";
import { Bars } from "@/components/charts";
import { getAdapters, getAiCostSummary, getJobQueue } from "@/server/queries";
import { QueueHealthCard } from "@/components/jobs/queue-health";
import { moneyPrecise, relative } from "@/lib/utils";

/** An honest hole where a chart would go, holding the height so the grid does not reflow. */
function NoData({
  height = 200,
  children,
}: {
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-center text-center text-3 text-[12.5px]"
      style={{ height }}
    >
      {children}
    </div>
  );
}

export default async function CostsPage() {
  const [cost, jobQueue, adapters] = await Promise.all([
    getAiCostSummary(),
    getJobQueue(),
    getAdapters(),
  ]);

  const byTask = cost.byTask;
  const totalCalls = byTask.reduce((s, g) => s + (g.calls ?? 0), 0);
  const totalTokens = byTask.reduce(
    (s, g) => s + (g.inputTokens ?? 0) + (g.outputTokens ?? 0),
    0,
  );
  const sonnet = byTask.filter((g) => g.model === "Sonnet");
  const sonnetCost = sonnet.reduce((s, g) => s + (g.costAud ?? 0), 0);
  const sonnetCalls = sonnet.reduce((s, g) => s + (g.calls ?? 0), 0);
  const sonnetShare =
    cost.totalMonth > 0 ? Math.round((sonnetCost / cost.totalMonth) * 100) : 0;
  const sonnetCallShare =
    totalCalls > 0 ? Math.round((sonnetCalls / totalCalls) * 100) : 0;
  const spendByDay = cost.byDay.slice(-7).map((d) => ({ day: d.day, Spend: d.aud ?? 0 }));

  return (
    <>
      <PageHeader
        title="AI cost & jobs"
        subtitle="Every generation is logged with its model, tokens, cost and the record that caused it. Per-tenant cost visibility is a launch requirement, not a later addition."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Today" value={moneyPrecise(cost.today)} tone="ai" />
        <Stat
          label="Month to date"
          value={moneyPrecise(cost.totalMonth)}
          sub={`${totalCalls.toLocaleString()} calls`}
          tone="ai"
        />
        <Stat
          label="Tokens"
          value={`${(totalTokens / 1_000_000).toFixed(2)}M`}
          sub="input + output"
        />
        <Stat
          label="Sonnet share"
          value={`${sonnetShare}%`}
          sub={`of spend, from ${sonnetCallShare}% of calls`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardTitle>Spend, last seven days</CardTitle>
          {spendByDay.length > 0 ? (
            <Bars
              data={spendByDay}
              keys={["Spend"]}
              xKey="day"
              height={200}
              valueFormat="money"
              colorOffset={6}
            />
          ) : (
            <NoData>No generations logged yet.</NoData>
          )}
        </Card>
        <Card>
          <CardTitle>Spend by model, weekly</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Haiku carries the call volume; Sonnet carries the cost.
          </p>
          <NoData>
            Not enough history to bucket by week yet — generations are logged from the
            first call onwards.
          </NoData>
        </Card>
      </div>

      <Section title="By task" hint="model choice is the main cost control">
        {byTask.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Task</TH>
                <TH>Model</TH>
                <TH className="text-right">Calls</TH>
                <TH className="text-right">In</TH>
                <TH className="text-right">Out</TH>
                <TH className="text-right">Latency</TH>
                <TH className="text-right">Cost</TH>
              </TR>
            </THead>
            <tbody>
              {byTask
                .slice()
                .sort((a, b) => (b.costAud ?? 0) - (a.costAud ?? 0))
                .map((g) => (
                  <TR key={`${g.task}-${g.model}`}>
                    <TD className="font-medium">{g.task}</TD>
                    <TD>
                      <Badge tone={g.model === "Sonnet" ? "ai" : "neutral"}>
                        {g.model}
                      </Badge>
                    </TD>
                    <TD className="text-right tabular text-2">
                      {(g.calls ?? 0).toLocaleString()}
                    </TD>
                    <TD className="text-right tabular text-2">
                      {((g.inputTokens ?? 0) / 1000).toFixed(0)}k
                    </TD>
                    <TD className="text-right tabular text-2">
                      {((g.outputTokens ?? 0) / 1000).toFixed(0)}k
                    </TD>
                    <TD className="text-right tabular text-2">
                      {((g.avgLatencyMs ?? 0) / 1000).toFixed(1)}s
                    </TD>
                    <TD className="text-right tabular font-medium">
                      {moneyPrecise(g.costAud ?? 0)}
                    </TD>
                  </TR>
                ))}
            </tbody>
          </Table>
        ) : (
          <Empty>No generations logged yet.</Empty>
        )}
        <div className="mt-3">
          <Callout tone="ai" title="Read this table as a cost lever">
            The two Haiku rows are 87% of all calls and under 8% of the spend. Moving
            work down a model tier, caching stable prompt prefixes, and batching anything
            not time-sensitive are the controls that matter — not shaving the AWS bill.
          </Callout>
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Job queue">
          {jobQueue.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Job</TH>
                  <TH className="text-right">Pending</TH>
                  <TH className="text-right">Active</TH>
                  <TH className="text-right">Failed</TH>
                  <TH className="text-right">Dead</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {jobQueue.map((j) => (
                  <TR key={j.name}>
                    <TD className="font-mono text-[12px]">{j.name}</TD>
                    <TD className="text-right tabular text-2">{j.pending}</TD>
                    <TD className="text-right tabular text-2">{j.active}</TD>
                    <TD className="text-right tabular">
                      {j.failed > 0 ? (
                        <span className="text-[#b02f2f] dark:text-[#f08a8a] font-medium">
                          {j.failed}
                        </span>
                      ) : (
                        <span className="text-2">0</span>
                      )}
                    </TD>
                    <TD className="text-right tabular">
                      {j.dead > 0 ? (
                        <span className="text-[#b02f2f] dark:text-[#f08a8a] font-medium">
                          {j.dead}
                        </span>
                      ) : (
                        <span className="text-2">0</span>
                      )}
                    </TD>
                    <TD className="text-right">
                      {/* These rows are counts per job NAME, so there is nothing here
                          to retry - a retry needs a job id. The dead-letter card
                          below lists the actual failed jobs with a button each. */}
                      {j.failed + j.dead > 0 && (
                        <span className="text-3 text-[11.5px] inline-flex items-center gap-1">
                          <RefreshCw size={11} />
                          retry below
                        </span>
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>No queue counts yet — the worker is not wired up.</Empty>
          )}
          <ProtoNote>
            Jobs are small, idempotent and retried with backoff. A failed AI call never
            fails a user request — it lands here instead.
          </ProtoNote>

          {/* The dead-letter set, with a real retry per job. It was only on
              /settings, which is not where anyone looks after seeing a failure
              count on this page. */}
          <div className="mt-4">
            <QueueHealthCard />
          </div>
        </Section>

        <Section title="Channel adapters">
          {adapters.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Channel</TH>
                  <TH>Status</TH>
                  <TH>Last received</TH>
                  <TH className="text-right">Today</TH>
                </TR>
              </THead>
              <tbody>
                {adapters.map((a) => (
                  <TR key={a.name}>
                    <TD className="font-medium">{a.name}</TD>
                    <TD>
                      {a.status === "ok" ? (
                        <Badge tone="sent">
                          <CheckCircle2 size={10} />
                          ok
                        </Badge>
                      ) : (
                        <Badge tone={a.status === "down" ? "blocked" : "queue"}>
                          <AlertTriangle size={10} />
                          {a.status}
                        </Badge>
                      )}
                    </TD>
                    <TD className="text-2">
                      {a.lastReceived ? relative(a.lastReceived) : "—"}
                    </TD>
                    <TD className="text-right tabular text-2">{a.today}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>No adapters registered yet.</Empty>
          )}
          <ProtoNote>
            Adding a channel means adding one adapter class and registering it. The
            pipeline behind them is never edited.
          </ProtoNote>
        </Section>
      </div>
    </>
  );
}
