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
  enquiryTrend,
  followupCompliance,
  contactsBySource,
  contactsByIntent,
  pipelineFunnel,
  suburbPerformance,
  campaignPerformance,
  aiSpendTrend,
  listingTrafficTrend,
} from "@/lib/sample-data-2";
import { listings, listingAddress, statusLabel } from "@/lib/sample-data";

export default function ReportsPage() {
  const onTime = followupCompliance.reduce((s, w) => s + w["On time"], 0);
  const late = followupCompliance.reduce((s, w) => s + w.Late, 0);
  const missed = followupCompliance.reduce((s, w) => s + w.Missed, 0);
  const rate = Math.round((onTime / (onTime + late + missed)) * 100);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Nine weeks of activity across the agency. Sample data throughout."
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
          <StackedArea
            data={enquiryTrend}
            keys={["Web", "Email", "Social", "Phone"]}
            xKey="week"
            height={240}
          />
        </Card>

        <Card>
          <CardTitle>Follow-up compliance</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            {rate}% on time across the period. Late is recoverable; missed is a lost
            relationship.
          </p>
          <Bars
            data={followupCompliance}
            keys={["On time", "Late", "Missed"]}
            xKey="week"
            stacked
            height={240}
            colorOffset={5}
          />
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardTitle>Pipeline conversion</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-3">Last 90 days.</p>
          <Funnel stages={pipelineFunnel} />
        </Card>

        <Card>
          <CardTitle>Where contacts come from</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">All time.</p>
          <HBars
            data={contactsBySource}
            labelKey="source"
            valueKey="count"
            height={230}
          />
        </Card>

        <Card>
          <CardTitle>Contacts by intent</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            From the rolling brief, rebuilt after every interaction.
          </p>
          <Donut data={contactsByIntent} height={230} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardTitle>Enquiries by suburb</CardTitle>
          <HBars
            data={suburbPerformance}
            labelKey="suburb"
            valueKey="enquiries"
            height={210}
          />
        </Card>

        <Card>
          <CardTitle>Campaign performance</CardTitle>
          <Bars
            data={campaignPerformance}
            keys={["Sent", "Opened", "Replied"]}
            xKey="name"
            height={210}
          />
        </Card>

        <Card>
          <CardTitle>AI spend by model</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">
            Weekly. Haiku carries the volume, Sonnet carries the cost.
          </p>
          <MultiLine
            data={aiSpendTrend}
            keys={["Haiku", "Sonnet"]}
            xKey="week"
            height={210}
            valueFormat="money"
          />
        </Card>
      </div>

      <Section title="Listing performance">
        <Table>
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
            {listings
              .filter((l) => l.views7d > 0)
              .sort((a, b) => b.views7d - a.views7d)
              .map((l) => (
                <TR key={l.id}>
                  <TD className="font-medium">{listingAddress(l)}</TD>
                  <TD className="text-2">{statusLabel[l.status]}</TD>
                  <TD className="text-2">{l.priceDisplay || "—"}</TD>
                  <TD className="text-right tabular text-2">
                    {l.views7d.toLocaleString()}
                  </TD>
                  <TD className="text-right tabular text-2">{l.enquiries7d}</TD>
                  <TD className="text-right tabular text-2">{l.photos}</TD>
                  <TD className="text-right tabular font-medium">
                    {((l.enquiries7d / l.views7d) * 100).toFixed(1)}%
                  </TD>
                </TR>
              ))}
          </tbody>
        </Table>
        <ProtoNote>
          Enquiry rate is the honest measure of a listing. High views with a low rate
          usually means the price display or the lead photo is doing the damage.
        </ProtoNote>
      </Section>

      <Section title="Website traffic">
        <Card>
          <MultiLine
            data={listingTrafficTrend}
            keys={["Views"]}
            xKey="week"
            height={140}
          />
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
