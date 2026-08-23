import { Download } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Button,
  Table,
  THead,
  TH,
  TD,
  TR,
  ProtoNote,
  Callout,
} from "@/components/ui";
import {
  StackedArea,
  Bars,
  Donut,
  Funnel,
  HBars,
  MultiLine,
} from "@/components/charts";
import {
  getAiSpendByModel,
  getCampaignPerformance,
  getContactsByIntent,
  getContactsBySource,
  getEnquiriesBySuburb,
  getEnquiryTrend,
  getListingPerformance,
  getPipelineFunnel,
} from "@/server/queries";
import { statusLabel } from "@/lib/labels";

/**
 * An honest hole where a chart would go.
 *
 * Holds the height the chart would have taken so the grid does not reflow, and says
 * plainly that the rows needed to draw it do not exist yet.
 */
function NoData({
  height = 210,
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

export default async function ReportsPage() {
  const [trend, bySource, byIntent, funnel, bySuburb, campaigns, spend, listings] =
    await Promise.all([
      getEnquiryTrend(),
      getContactsBySource(),
      getContactsByIntent(),
      getPipelineFunnel(),
      getEnquiriesBySuburb(),
      getCampaignPerformance(),
      getAiSpendByModel(),
      getListingPerformance(),
    ]);

  const enquirySeries = trend.map((w) => ({
    week: w.week,
    Web: w.Web,
    Email: w.Email,
    Social: w.Social,
    Phone: w.Phone,
  }));
  const sourceSeries = bySource.map((s) => ({ source: s.source, count: s.count }));
  const suburbSeries = bySuburb.map((s) => ({
    suburb: s.suburb,
    enquiries: s.enquiries,
  }));
  const campaignSeries = campaigns.map((c) => ({
    name: c.name,
    Sent: c.Sent,
    Opened: c.Opened,
    Replied: c.Replied,
  }));
  const spendSeries = spend.map((s) => ({
    task: s.task,
    Haiku: s.Haiku ?? 0,
    Sonnet: s.Sonnet ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Activity across the agency, counted from the rows the console holds."
        actions={
          <Button>
            <Download size={13} />
            Export CSV
          </Button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardTitle>Enquiry volume by channel</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            The website is doing the heavy lifting, and its share is growing.
          </p>
          {enquirySeries.length > 0 ? (
            <StackedArea
              data={enquirySeries}
              keys={["Web", "Email", "Social", "Phone"]}
              xKey="week"
              height={240}
            />
          ) : (
            <NoData height={240}>
              Not enough history yet to bucket enquiries by week.
            </NoData>
          )}
        </Card>

        <Card>
          <CardTitle>Follow-up compliance</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Late is recoverable; missed is a lost relationship.
          </p>
          <NoData height={240}>
            No follow-up outcome history yet. Contacts carry the next due date, not a
            record of whether each past one was met.
          </NoData>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 [&>*:last-child:nth-child(odd)]:md:col-span-2 [&>*:last-child:nth-child(odd)]:lg:col-span-1">
        <Card>
          <CardTitle>Pipeline conversion</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-3">Last 90 days.</p>
          {funnel.length > 0 ? (
            <Funnel stages={funnel} />
          ) : (
            <NoData height={190}>Nothing has entered the pipeline yet.</NoData>
          )}
        </Card>

        <Card>
          <CardTitle>Where contacts come from</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">All time.</p>
          {sourceSeries.length > 0 ? (
            <HBars
              data={sourceSeries}
              labelKey="source"
              valueKey="count"
              height={230}
            />
          ) : (
            <NoData height={230}>No contacts yet.</NoData>
          )}
        </Card>

        <Card>
          <CardTitle>Contacts by intent</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            From the rolling brief, rebuilt after every interaction.
          </p>
          {byIntent.length > 0 ? (
            <Donut data={byIntent} height={230} />
          ) : (
            <NoData height={230}>No briefs built yet.</NoData>
          )}
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 [&>*:last-child:nth-child(odd)]:sm:col-span-2 [&>*:last-child:nth-child(odd)]:md:col-span-2 [&>*:last-child:nth-child(odd)]:lg:col-span-1">
        <Card>
          <CardTitle>Enquiries by suburb</CardTitle>
          {suburbSeries.length > 0 ? (
            <HBars
              data={suburbSeries}
              labelKey="suburb"
              valueKey="enquiries"
              height={210}
            />
          ) : (
            <NoData height={210}>No enquiries tied to a listing yet.</NoData>
          )}
        </Card>

        <Card>
          <CardTitle>Campaign performance</CardTitle>
          {campaignSeries.length > 0 ? (
            <Bars
              data={campaignSeries}
              keys={["Sent", "Opened", "Replied"]}
              xKey="name"
              height={210}
            />
          ) : (
            <NoData height={210}>No campaigns have been sent yet.</NoData>
          )}
        </Card>

        <Card>
          <CardTitle>AI spend by model</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            By task. Haiku carries the volume, Sonnet carries the cost.
          </p>
          {spendSeries.length > 0 ? (
            <MultiLine
              data={spendSeries}
              keys={["Haiku", "Sonnet"]}
              xKey="task"
              height={210}
              valueFormat="money"
            />
          ) : (
            <NoData height={210}>Nothing has been generated yet.</NoData>
          )}
        </Card>
      </div>

      <Section title="Listing performance">
        {listings.length > 0 ? (
          <Table minWidth={820}>
            <THead>
              <TR>
                <TH>Listing</TH>
                <TH>Status</TH>
                <TH>Price shown</TH>
                <TH className="text-right">Views 7d</TH>
                <TH className="text-right">Enquiries 7d</TH>
                <TH className="text-right">Photos</TH>
                <TH className="text-right">Enquiry rate</TH>
              </TR>
            </THead>
            <tbody>
              {listings.map((l, i) => (
                <TR key={`${l.address}-${i}`}>
                  <TD nowrap className="font-medium">
                    {l.address}
                  </TD>
                  <TD className="text-2">{statusLabel[l.status] ?? l.status}</TD>
                  <TD nowrap className="text-2">
                    {l.priceDisplay || "—"}
                  </TD>
                  <TD className="text-right tabular text-2">
                    {l.views7d.toLocaleString()}
                  </TD>
                  <TD className="text-right tabular text-2">{l.enquiries7d}</TD>
                  <TD className="text-right tabular text-2">{l.photos}</TD>
                  <TD className="text-right tabular font-medium">
                    {l.views7d > 0
                      ? `${((l.enquiries7d / l.views7d) * 100).toFixed(1)}%`
                      : "—"}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <Card>
            <NoData height={120}>No listing traffic recorded yet.</NoData>
          </Card>
        )}
        <ProtoNote>
          Enquiry rate is the honest measure of a listing. High views with a low rate
          usually means the price display or the lead photo is doing the damage.
        </ProtoNote>
      </Section>

      <Section title="Website traffic">
        <Card>
          <NoData height={140}>
            No weekly traffic history yet. Views and enquiries are held as a rolling
            seven-day count, not a series.
          </NoData>
          <div className="mt-3">
            <Callout tone="brand" title="One measure per axis, always">
              Views and enquiries differ by two orders of magnitude. Putting both on one
              chart with two y-scales would let either line be drawn to tell any story —
              so they get separate panels instead.
            </Callout>
          </div>
        </Card>
      </Section>
    </>
  );
}
