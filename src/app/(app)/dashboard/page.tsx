import Link from "next/link";
import { AlertTriangle, Calendar, Camera, TrendingUp, TrendingDown } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Badge,
  Table,
  THead,
  TH,
  TD,
  TR,
  Callout,
  ProtoNote,
} from "@/components/ui";
import {
  StackedArea,
  MultiLine,
  Bars,
  Donut,
  Funnel,
  HBars,
  Sparkline,
} from "@/components/charts";
import {
  counts,
  followupsDue,
  newEnquiries,
  contactName,
  contactById,
  inspections,
  listingById,
  listingAddress,
  listings,
  todayCost,
  totalMonthCost,
  blockedApprovals,
} from "@/lib/sample-data";
import {
  enquiryTrend,
  listingTrafficTrend,
  contactsByIntent,
  pipelineFunnel,
  suburbPerformance,
  approvalThroughput,
  aiSpendTrend,
} from "@/lib/sample-data-2";
import { relative, shortDate, timeOfDay, moneyPrecise, TODAY } from "@/lib/utils";

const channelLabel: Record<string, string> = {
  web_form: "Web form",
  email: "Email",
  sms: "SMS",
  social: "Social",
  phone: "Phone",
  voice_note: "Voice note",
  manual: "Manual",
};

function Kpi({
  label,
  value,
  delta,
  deltaGood,
  sub,
  href,
  spark,
  sparkKey,
  color,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaGood?: boolean;
  sub?: string;
  href?: string;
  spark?: Record<string, string | number>[];
  sparkKey?: string;
  color?: number;
}) {
  const body = (
    <div className="surface-2 border rounded-lg p-3.5 h-full flex flex-col">
      <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
        {label}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-[26px] font-semibold leading-tight tabular">{value}</span>
        {delta && (
          <span
            className={
              deltaGood
                ? "text-[11.5px] font-medium text-[#006300] dark:text-[#5fc45f] inline-flex items-center gap-0.5"
                : "text-[11.5px] font-medium text-[#b02f2f] dark:text-[#f08a8a] inline-flex items-center gap-0.5"
            }
          >
            {deltaGood ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {delta}
          </span>
        )}
      </div>
      {sub && <div className="text-3 text-[11.5px] mt-0.5 leading-snug">{sub}</div>}
      {spark && sparkKey && (
        <div className="mt-2 -mb-1">
          <Sparkline data={spark} dataKey={sparkKey} color={color ?? 0} />
        </div>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-85">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function DashboardPage() {
  const needsAttention = listings.filter(
    (l) =>
      l.status === "draft" || (l.status === "live" && (l.photos === 0 || !l.priceDisplay)),
  );
  const upcoming = inspections
    .filter((i) => i.startsAt.getTime() >= TODAY.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const enquiriesThisWeek = 49;
  const liveViews = listingTrafficTrend[listingTrafficTrend.length - 1].Views;

  return (
    <>
      <PageHeader
        title="Today"
        subtitle="Wednesday 20 August 2026 · Adelaide. Everything on this screen is sample data."
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Kpi
          label="Enquiries this week"
          value={enquiriesThisWeek}
          delta="+22%"
          deltaGood
          sub="all channels"
          spark={enquiryTrend}
          sparkKey="Web"
          color={0}
        />
        <Kpi
          label="Listing views"
          value={liveViews.toLocaleString()}
          delta="+21%"
          deltaGood
          sub="public site, 7 days"
          spark={listingTrafficTrend}
          sparkKey="Views"
          color={2}
        />
        <Kpi
          label="Follow-ups due"
          value={followupsDue.length}
          sub="2 already overdue"
          href="/contacts"
        />
        <Kpi
          label="Awaiting approval"
          value={counts.approvals}
          sub={`${counts.blocked} blocked at send time`}
          href="/approvals"
        />
        <Kpi
          label="AI spend today"
          value={moneyPrecise(todayCost)}
          sub={`${moneyPrecise(totalMonthCost)} month to date`}
          href="/costs"
          spark={aiSpendTrend}
          sparkKey="Sonnet"
          color={6}
        />
      </div>

      {blockedApprovals.length > 0 && (
        <div className="mb-6">
          <Callout tone="blocked" title="A message was blocked at send time">
            {blockedApprovals[0].blockReason}{" "}
            <Link href="/approvals" className="underline underline-offset-2">
              Review it
            </Link>
            .
          </Callout>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardTitle>Enquiries by channel</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Weekly, every adapter. The website is the growth channel.
          </p>
          <StackedArea
            data={enquiryTrend}
            keys={["Web", "Email", "Social", "Phone"]}
            xKey="week"
            height={230}
          />
        </Card>

        <Card>
          <CardTitle>Contacts by intent</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Derived from the rolling brief.
          </p>
          <Donut
            data={contactsByIntent}
            height={230}
            centerValue={String(counts.contacts)}
            centerLabel="contacts"
          />
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardTitle>Pipeline</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-3">Last 90 days.</p>
          <Funnel stages={pipelineFunnel} />
        </Card>

        <Card>
          <CardTitle>Website traffic</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Two measures three orders of magnitude apart. A shared axis would flatten
            one of them, so each gets its own panel.
          </p>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[11.5px] font-medium text-2">Listing views</span>
              <span className="text-[11.5px] tabular text-3">
                {listingTrafficTrend[listingTrafficTrend.length - 1].Views.toLocaleString()} this week
              </span>
            </div>
            <MultiLine
              data={listingTrafficTrend}
              keys={["Views"]}
              xKey="week"
              height={78}
              valueFormat="int"
            />
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-[11.5px] font-medium text-2">Enquiries</span>
              <span className="text-[11.5px] tabular text-3">
                {listingTrafficTrend[listingTrafficTrend.length - 1].Enquiries} this week
              </span>
            </div>
            <Bars
              data={listingTrafficTrend}
              keys={["Enquiries"]}
              xKey="week"
              height={78}
              colorOffset={2}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Enquiries by suburb</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Where the demand actually is.
          </p>
          <HBars
            data={suburbPerformance}
            labelKey="suburb"
            valueKey="enquiries"
            height={220}
          />
        </Card>
      </div>

      {/* Tables */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Follow-ups due" hint="sorted by how overdue">
            <Table>
              <THead>
                <TR>
                  <TH>Contact</TH>
                  <TH>Last outcome</TH>
                  <TH>Due</TH>
                  <TH>Intent</TH>
                </TR>
              </THead>
              <tbody>
                {followupsDue.map((c) => {
                  const overdue =
                    c.followupDueAt !== null &&
                    c.followupDueAt.getTime() < TODAY.getTime() - 86400000;
                  return (
                    <TR key={c.id}>
                      <TD>
                        <Link
                          href={`/contacts/${c.id}`}
                          className="font-medium hover:underline underline-offset-2"
                        >
                          {c.firstName} {c.lastName}
                        </Link>
                        <div className="text-3 text-[12px]">{c.suburb}</div>
                      </TD>
                      <TD className="text-2 max-w-[280px]">{c.lastFollowupOutcome}</TD>
                      <TD>
                        {overdue ? (
                          <Badge tone="blocked">
                            <AlertTriangle size={11} />
                            {relative(c.followupDueAt as Date)}
                          </Badge>
                        ) : (
                          <span className="text-2">
                            {shortDate(c.followupDueAt as Date)}
                          </span>
                        )}
                      </TD>
                      <TD>
                        {c.intent ? (
                          <Badge
                            tone={
                              c.intent.sentiment === "hot"
                                ? "sent"
                                : c.intent.sentiment === "cooling"
                                  ? "blocked"
                                  : "neutral"
                            }
                          >
                            {c.intent.sentiment}
                          </Badge>
                        ) : (
                          <span className="text-3">—</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </Section>

          <Section title="Recent enquiries" hint="every channel, one feed">
            <div className="space-y-2">
              {newEnquiries.slice(0, 5).map((i) => {
                const c = contactById(i.contactId);
                return (
                  <Card key={i.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <Badge tone="channel">{channelLabel[i.channel]}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <Link
                            href={`/contacts/${i.contactId}`}
                            className="font-medium text-[13px] hover:underline underline-offset-2"
                          >
                            {contactName(i.contactId)}
                          </Link>
                          <span className="text-3 text-[12px]">{i.subject}</span>
                          <span className="text-3 text-[11.5px] ml-auto shrink-0">
                            {relative(i.at)}
                          </span>
                        </div>
                        <p className="text-2 text-[12.5px] mt-1 leading-relaxed line-clamp-2">
                          {i.body}
                        </p>
                        {c && c.createdAt.getTime() > TODAY.getTime() - 7 * 86400000 && (
                          <Badge tone="brand" className="mt-1.5">
                            new contact
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Approval throughput</CardTitle>
            <p className="text-3 text-[11.5px] -mt-1 mb-2">
              What you did with the queue this week.
            </p>
            <Bars
              data={approvalThroughput}
              keys={["Approved", "Edited", "Rejected", "Blocked"]}
              xKey="day"
              stacked
              height={180}
            />
          </Card>

          <Section title="Upcoming inspections">
            <Card className="p-0" padded={false}>
              {upcoming.length === 0 && (
                <div className="p-4 text-3 text-[13px]">Nothing scheduled.</div>
              )}
              {upcoming.map((n) => {
                const l = listingById(n.listingId);
                return (
                  <div key={n.id} className="p-3 border-b last:border-b-0">
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className="text-3 shrink-0" />
                      <span className="text-[12.5px] font-medium">
                        {shortDate(n.startsAt)} · {timeOfDay(n.startsAt)}
                      </span>
                      <Badge tone={n.kind === "open" ? "stock" : "neutral"}>
                        {n.kind === "open" ? "Open" : "Private"}
                      </Badge>
                    </div>
                    {l && (
                      <Link
                        href={`/listings/${l.id}`}
                        className="text-[12.5px] text-2 hover:underline underline-offset-2 block mt-1"
                      >
                        {listingAddress(l)}
                      </Link>
                    )}
                    <div className="text-3 text-[11.5px] mt-0.5">
                      {n.registrations} registered
                    </div>
                  </div>
                );
              })}
            </Card>
          </Section>

          <Section title="Listings needing attention">
            <Card className="p-0" padded={false}>
              {needsAttention.map((l) => (
                <div key={l.id} className="p-3 border-b last:border-b-0">
                  <Link
                    href={`/listings/${l.id}`}
                    className="text-[12.5px] font-medium hover:underline underline-offset-2"
                  >
                    {listingAddress(l)}
                  </Link>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {l.status === "draft" && <Badge tone="queue">Draft</Badge>}
                    {l.photos === 0 && (
                      <Badge tone="blocked">
                        <Camera size={10} />
                        No photos
                      </Badge>
                    )}
                    {!l.priceDisplay && <Badge tone="blocked">No price set</Badge>}
                  </div>
                </div>
              ))}
            </Card>
            <ProtoNote>
              Every chart here reads from the same sample module. In Phase 2 these are
              aggregate queries, and the AI spend panel reads `ai_generations` directly.
            </ProtoNote>
          </Section>
        </div>
      </div>
    </>
  );
}
