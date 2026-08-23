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
  Bars,
  Donut,
  Funnel,
  HBars,
  Sparkline,
} from "@/components/charts";
import {
  getAiCostSummary,
  getApprovals,
  getApprovalThroughput,
  getContactsByIntent,
  getCounts,
  getEnquiriesBySuburb,
  getEnquiryTrend,
  getFollowupsDue,
  getInspections,
  getListingPerformance,
  getListingsNeedingAttention,
  getPipelineFunnel,
  getRecentEnquiries,
} from "@/server/queries";
import { channelLabel } from "@/lib/labels";
import { relative, shortDate, timeOfDay, moneyPrecise } from "@/lib/utils";

const DAY = 86400000;

/**
 * An honest hole where a chart would go.
 *
 * Holds the height the chart would have taken so the grid does not reflow, and says
 * plainly that the rows needed to draw it do not exist yet.
 */
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

export default async function DashboardPage() {
  const [
    counts,
    followups,
    enquiries,
    upcoming,
    needsAttention,
    approvals,
    cost,
    trend,
    byIntent,
    funnel,
    bySuburb,
    throughput,
    listingPerformance,
  ] = await Promise.all([
    getCounts(),
    getFollowupsDue(),
    // Wide enough to answer "this week" and "the week before" from real rows. The feed
    // lower down still shows only the first five.
    getRecentEnquiries(200),
    getInspections({ upcomingOnly: true }),
    getListingsNeedingAttention(),
    getApprovals(),
    getAiCostSummary(),
    getEnquiryTrend(),
    getContactsByIntent(),
    getPipelineFunnel(),
    getEnquiriesBySuburb(),
    getApprovalThroughput(),
    getListingPerformance(),
  ]);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const fortnightAgo = new Date(now.getTime() - 14 * DAY);

  const enquiriesThisWeek = enquiries.filter((i) => i.at >= weekAgo).length;
  const enquiriesLastWeek = enquiries.filter(
    (i) => i.at >= fortnightAgo && i.at < weekAgo,
  ).length;
  /**
   * A delta needs a prior week to divide by. Without one there is no honest number to
   * print, so the KPI carries no delta at all rather than a flattering guess.
   */
  const enquiryDelta =
    enquiriesLastWeek > 0
      ? Math.round(((enquiriesThisWeek - enquiriesLastWeek) / enquiriesLastWeek) * 100)
      : null;

  const liveViews = listingPerformance.reduce((s, l) => s + (l.views7d ?? 0), 0);

  const overdue = followups.filter(
    (c) => c.followupDueAt !== null && c.followupDueAt.getTime() < now.getTime() - DAY,
  ).length;

  const blocked = approvals.filter((a) => a.status === "blocked");

  const enquirySeries = trend.map((w) => ({
    week: w.week,
    Web: w.Web,
    Email: w.Email,
    Social: w.Social,
    Phone: w.Phone,
  }));
  const spendSeries = cost.byDay.map((d) => ({ day: d.day, aud: d.aud ?? 0 }));
  const suburbSeries = bySuburb.map((s) => ({
    suburb: s.suburb,
    enquiries: s.enquiries,
  }));
  const throughputSeries = throughput.map((t) => ({
    period: t.period,
    Approved: t.Approved,
    Pending: t.Pending,
    Rejected: t.Rejected,
    Blocked: t.Blocked,
  }));

  const today = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Adelaide",
  }).format(now);

  return (
    <>
      <PageHeader title="Today" subtitle={`${today} · Adelaide.`} />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <Kpi
          label="Enquiries this week"
          value={enquiriesThisWeek}
          delta={
            enquiryDelta === null
              ? undefined
              : `${enquiryDelta >= 0 ? "+" : ""}${enquiryDelta}%`
          }
          deltaGood={enquiryDelta !== null && enquiryDelta >= 0}
          sub="all channels"
          spark={enquirySeries.length > 1 ? enquirySeries : undefined}
          sparkKey="Web"
          color={0}
        />
        <Kpi
          label="Listing views"
          value={liveViews.toLocaleString()}
          sub="public site, 7 days"
        />
        <Kpi
          label="Follow-ups due"
          value={followups.length}
          sub={`${overdue} already overdue`}
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
          value={moneyPrecise(cost.today)}
          sub={`${moneyPrecise(cost.totalMonth)} month to date`}
          href="/costs"
          spark={spendSeries.length > 1 ? spendSeries : undefined}
          sparkKey="aud"
          color={6}
        />
      </div>

      {blocked.length > 0 && (
        <div className="mb-6">
          <Callout tone="blocked" title="A message was blocked at send time">
            {blocked[0].blockReason ?? "The consent check failed at send time."}{" "}
            <Link href="/approvals" className="underline underline-offset-2">
              Review it
            </Link>
            .
          </Callout>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 [&>*:last-child:nth-child(odd)]:sm:col-span-2 [&>*:last-child:nth-child(odd)]:md:col-span-2 [&>*:last-child:nth-child(odd)]:lg:col-span-1">
        <Card className="sm:col-span-2 lg:col-span-2">
          <CardTitle>Enquiries by channel</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Weekly, every adapter. The website is the growth channel.
          </p>
          {enquirySeries.length > 0 ? (
            <StackedArea
              data={enquirySeries}
              keys={["Web", "Email", "Social", "Phone"]}
              xKey="week"
              height={230}
            />
          ) : (
            <NoData height={230}>
              Not enough history yet to bucket enquiries by week.
            </NoData>
          )}
        </Card>

        <Card>
          <CardTitle>Contacts by intent</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Derived from the rolling brief.
          </p>
          {byIntent.length > 0 ? (
            <Donut
              data={byIntent}
              height={230}
              centerValue={String(counts.contacts)}
              centerLabel="contacts"
            />
          ) : (
            <NoData height={230}>No briefs built yet.</NoData>
          )}
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 [&>*:last-child:nth-child(odd)]:sm:col-span-2 [&>*:last-child:nth-child(odd)]:md:col-span-2 [&>*:last-child:nth-child(odd)]:lg:col-span-1">
        <Card>
          <CardTitle>Pipeline</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-3">Last 90 days.</p>
          {funnel.length > 0 ? (
            <Funnel stages={funnel} />
          ) : (
            <NoData height={180}>Nothing has entered the pipeline yet.</NoData>
          )}
        </Card>

        <Card>
          <CardTitle>Website traffic</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Two measures three orders of magnitude apart. A shared axis would flatten
            one of them, so each gets its own panel.
          </p>
          <NoData height={200}>
            No weekly traffic history yet. Views and enquiries are held as a rolling
            seven-day count, not a series.
          </NoData>
        </Card>

        <Card>
          <CardTitle>Enquiries by suburb</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Where the demand actually is.
          </p>
          {suburbSeries.length > 0 ? (
            <HBars
              data={suburbSeries}
              labelKey="suburb"
              valueKey="enquiries"
              height={220}
            />
          ) : (
            <NoData height={220}>No enquiries tied to a listing yet.</NoData>
          )}
        </Card>
      </div>

      {/* Tables */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
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
                {followups.map((c) => {
                  const isOverdue =
                    c.followupDueAt !== null &&
                    c.followupDueAt.getTime() < now.getTime() - DAY;
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
                        {c.followupDueAt === null ? (
                          <span className="text-3">—</span>
                        ) : isOverdue ? (
                          <Badge tone="blocked">
                            <AlertTriangle size={11} />
                            {relative(c.followupDueAt)}
                          </Badge>
                        ) : (
                          <span className="text-2">{shortDate(c.followupDueAt)}</span>
                        )}
                      </TD>
                      <TD>
                        {c.sentiment ? (
                          <Badge
                            tone={
                              c.sentiment === "hot"
                                ? "sent"
                                : c.sentiment === "cooling"
                                  ? "blocked"
                                  : "neutral"
                            }
                          >
                            {c.sentiment}
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
              {enquiries.length === 0 && (
                <Card className="p-3">
                  <span className="text-3 text-[13px]">No enquiries yet.</span>
                </Card>
              )}
              {enquiries.slice(0, 5).map((i) => (
                <Card key={i.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <Badge tone="channel">{channelLabel[i.channel] ?? i.channel}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <Link
                          href={`/contacts/${i.contactId}`}
                          className="font-medium text-[13px] hover:underline underline-offset-2"
                        >
                          {i.contactName}
                        </Link>
                        <span className="text-3 text-[12px]">{i.subject}</span>
                        <span className="text-3 text-[11.5px] ml-auto shrink-0">
                          {relative(i.at)}
                        </span>
                      </div>
                      <p className="text-2 text-[12.5px] mt-1 leading-relaxed line-clamp-2">
                        {i.body}
                      </p>
                      {i.contactCreatedAt !== null &&
                        i.contactCreatedAt.getTime() > now.getTime() - 7 * DAY && (
                          <Badge tone="brand" className="mt-1.5">
                            new contact
                          </Badge>
                        )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Approval throughput</CardTitle>
            <p className="text-3 text-[11.5px] -mt-1 mb-2">
              What you did with the queue, to date.
            </p>
            {throughputSeries.length > 0 ? (
              <Bars
                data={throughputSeries}
                keys={["Approved", "Pending", "Rejected", "Blocked"]}
                xKey="period"
                stacked
                height={180}
              />
            ) : (
              <NoData height={180}>Nothing has been through the queue yet.</NoData>
            )}
          </Card>

          <Section title="Upcoming inspections">
            <Card className="p-0" padded={false}>
              {upcoming.length === 0 && (
                <div className="p-4 text-3 text-[13px]">Nothing scheduled.</div>
              )}
              {upcoming.map((n) => (
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
                  <Link
                    href={`/listings/${n.listingId}`}
                    className="text-[12.5px] text-2 hover:underline underline-offset-2 block mt-1"
                  >
                    {n.address}
                  </Link>
                  <div className="text-3 text-[11.5px] mt-0.5">
                    {n.registrations} registered
                  </div>
                </div>
              ))}
            </Card>
          </Section>

          <Section title="Listings needing attention">
            <Card className="p-0" padded={false}>
              {needsAttention.length === 0 && (
                <div className="p-4 text-3 text-[13px]">Nothing needs attention.</div>
              )}
              {needsAttention.map((l) => (
                <div key={l.id} className="p-3 border-b last:border-b-0">
                  <Link
                    href={`/listings/${l.id}`}
                    className="text-[12.5px] font-medium hover:underline underline-offset-2"
                  >
                    {l.address}
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
              Every chart here is an aggregate query over the same rows the rest of the
              console reads, and the AI spend panel reads `ai_generations` directly.
            </ProtoNote>
          </Section>
        </div>
      </div>
    </>
  );
}
