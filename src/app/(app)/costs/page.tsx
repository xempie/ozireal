import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  Stat,
  Badge,
  Button,
  CardTitle,
  Table,
  THead,
  TH,
  TD,
  TR,
  ProtoNote,
  Callout,
} from "@/components/ui";
import { Bars, MultiLine } from "@/components/charts";
import { aiSpendTrend } from "@/lib/sample-data-2";
import {
  aiGenerations,
  costByDay,
  totalMonthCost,
  todayCost,
  jobQueue,
  adapters,
} from "@/lib/sample-data";
import { moneyPrecise, relative } from "@/lib/utils";

export default function CostsPage() {
  const totalCalls = aiGenerations.reduce((s, g) => s + g.calls, 0);
  const totalTokens = aiGenerations.reduce(
    (s, g) => s + g.inputTokens + g.outputTokens,
    0,
  );
  const sonnetCost = aiGenerations
    .filter((g) => g.model === "Sonnet")
    .reduce((s, g) => s + g.costAud, 0);

  return (
    <>
      <PageHeader
        title="AI cost & jobs"
        subtitle="Every generation is logged with its model, tokens, cost and the record that caused it. Per-tenant cost visibility is a launch requirement, not a later addition."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <Stat label="Today" value={moneyPrecise(todayCost)} tone="ai" />
        <Stat
          label="Month to date"
          value={moneyPrecise(totalMonthCost)}
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
          value={`${Math.round((sonnetCost / totalMonthCost) * 100)}%`}
          sub="of spend, from 13% of calls"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardTitle>Spend, last seven days</CardTitle>
          <Bars
            data={costByDay.map((d) => ({ day: d.day, Spend: d.aud }))}
            keys={["Spend"]}
            xKey="day"
            height={200}
            valueFormat="money"
            colorOffset={6}
          />
        </Card>
        <Card>
          <CardTitle>Spend by model, weekly</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Haiku carries the call volume; Sonnet carries the cost.
          </p>
          <MultiLine
            data={aiSpendTrend}
            keys={["Haiku", "Sonnet"]}
            xKey="week"
            height={200}
            valueFormat="money"
          />
        </Card>
      </div>

      <Section title="By task" hint="model choice is the main cost control">
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
            {aiGenerations
              .slice()
              .sort((a, b) => b.costAud - a.costAud)
              .map((g) => (
                <TR key={g.task}>
                  <TD className="font-medium">{g.task}</TD>
                  <TD>
                    <Badge tone={g.model === "Sonnet" ? "ai" : "neutral"}>
                      {g.model}
                    </Badge>
                  </TD>
                  <TD className="text-right tabular text-2">
                    {g.calls.toLocaleString()}
                  </TD>
                  <TD className="text-right tabular text-2">
                    {(g.inputTokens / 1000).toFixed(0)}k
                  </TD>
                  <TD className="text-right tabular text-2">
                    {(g.outputTokens / 1000).toFixed(0)}k
                  </TD>
                  <TD className="text-right tabular text-2">
                    {(g.avgLatencyMs / 1000).toFixed(1)}s
                  </TD>
                  <TD className="text-right tabular font-medium">
                    {moneyPrecise(g.costAud)}
                  </TD>
                </TR>
              ))}
          </tbody>
        </Table>
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
                    {j.failed + j.dead > 0 && (
                      <Button size="sm">
                        <RefreshCw size={11} />
                        Retry
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <ProtoNote>
            Jobs are small, idempotent and retried with backoff. A failed AI call never
            fails a user request — it lands here instead.
          </ProtoNote>
        </Section>

        <Section title="Channel adapters">
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
                      <Badge tone="queue">
                        <AlertTriangle size={10} />
                        degraded
                      </Badge>
                    )}
                  </TD>
                  <TD className="text-2">{relative(a.lastReceived)}</TD>
                  <TD className="text-right tabular text-2">{a.today}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <ProtoNote>
            Adding a channel means adding one adapter class and registering it. The
            pipeline behind them is never edited.
          </ProtoNote>
        </Section>
      </div>
    </>
  );
}
