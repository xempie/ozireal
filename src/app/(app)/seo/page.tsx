import { AlertOctagon, AlertTriangle, Info, Ban } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Badge,
  Callout,
  Empty,
  ProtoNote,
} from "@/components/ui";
import { getSeoIssues } from "@/server/queries";
import { SeoIssueButtons } from "@/components/forms/ops-forms";

const sev = {
  critical: {
    tone: "blocked" as const,
    icon: AlertOctagon,
    label: "Critical",
  },
  warning: {
    tone: "queue" as const,
    icon: AlertTriangle,
    label: "Warning",
  },
  info: {
    tone: "neutral" as const,
    icon: Info,
    label: "Info",
  },
};

export default async function SeoPage() {
  const seoIssues = await getSeoIssues();
  const critical = seoIssues.filter((i) => i.severity === "critical").length;
  const affected = seoIssues.reduce((s, i) => s + (i.affected ?? 0), 0);

  return (
    <>
      <PageHeader
        title="SEO agent"
        subtitle="Crawls the site fortnightly and produces a change set you can read. It has no ability to publish — not even a disabled one."
        /* No "Run a crawl" button. The crawler is Phase 5 and does not exist, and a
           button that starts nothing is worse than none — it makes an empty findings
           list look like a clean site rather than a tool that never ran. */
        actions={
          <span className="text-3 text-[12px] inline-flex items-center gap-1.5">
            <Ban size={12} />
            Crawling is not built yet — these findings were loaded by hand
          </span>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 [&>*:last-child:nth-child(odd)]:sm:col-span-2">
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Open findings
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">
            {seoIssues.length}
          </div>
          <div className="text-3 text-[11.5px]">{critical} critical</div>
        </Card>
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            URLs affected
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">{affected}</div>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-2">
          <CardTitle>Search impressions and clicks</CardTitle>
          {/* Search Console is not connected yet, so there are no impressions or clicks
              to plot. An invented curve here would be indistinguishable from a real one. */}
          <Empty>No search data yet</Empty>
        </Card>
      </div>

      <div className="mb-6">
        <Callout tone="blocked" title="This agent proposes, it never deploys">
          Every finding below produces a reviewable change. A human applies it. There is
          no publish button on this screen and no setting that adds one — the same rule
          that governs outbound messages governs anything that touches a live site.
        </Callout>
      </div>

      <Section title="Change set" hint="open findings from the latest crawl">
        <div className="space-y-3">
          {seoIssues.map((issue) => {
            const s = sev[issue.severity];
            const Icon = s.icon;
            return (
              <Card
                key={issue.id}
                className={
                  issue.severity === "critical"
                    ? "border-[#d03b3b]/35 bg-[#d03b3b]/[0.03]"
                    : undefined
                }
              >
                <div className="flex items-start gap-3">
                  <Icon
                    size={16}
                    className={
                      issue.severity === "critical"
                        ? "text-[#b02f2f] dark:text-[#f08a8a] mt-0.5 shrink-0"
                        : "text-3 mt-0.5 shrink-0"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold">{issue.title}</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                      <Badge tone="neutral">{issue.affected} URLs</Badge>
                    </div>
                    <p className="text-2 text-[12.5px] mt-1.5 leading-relaxed">
                      {issue.detail}
                    </p>

                    <div className="mt-2.5 surface-3 border rounded-md p-2.5">
                      <div className="text-3 text-[10.5px] uppercase tracking-[0.05em] font-medium mb-1">
                        Proposed change
                      </div>
                      <p className="text-[12.5px] leading-relaxed">{issue.proposal}</p>
                    </div>

                    <div className="flex flex-wrap items-start gap-2 mt-3">
                      <SeoIssueButtons id={issue.id} status={issue.status} />
                      <span className="text-3 text-[11.5px] sm:ml-auto inline-flex items-center gap-1 mt-1">
                        <Ban size={11} />
                        cannot be applied automatically
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        <ProtoNote>
          The two critical findings are both migration risks rather than ordinary SEO
          hygiene — they exist because the Wix cutover has not happened yet. They stop
          being findings the moment the redirect map is finished.
        </ProtoNote>
      </Section>
    </>
  );
}
