import Link from "next/link";
import { FileText, Plus, Download, ShieldCheck } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Badge,
  Button,
  Table,
  THead,
  TH,
  TD,
  TR,
  KeyValue,
  Callout,
  ProtoNote,
} from "@/components/ui";
import { proposals } from "@/lib/sample-data-2";
import { propertyById, contactById, contactName } from "@/lib/sample-data";
import { money, relative, shortDate } from "@/lib/utils";

const statusTone = {
  draft: "neutral",
  in_approval: "queue",
  sent: "brand",
  won: "sent",
  lost: "blocked",
} as const;

const statusLabel = {
  draft: "Draft",
  in_approval: "In approval",
  sent: "Sent",
  won: "Won",
  lost: "Lost",
} as const;

export default function ProposalsPage() {
  const featured = proposals[0];
  const property = propertyById(featured.propertyId);
  const contact = contactById(featured.contactId);

  const won = proposals.filter((p) => p.status === "won").length;
  const sent = proposals.filter((p) => p.status !== "draft").length;

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle="Listing presentations assembled from the property, comparable sales and the agency's own material."
        actions={
          <Button variant="primary">
            <Plus size={13} />
            New proposal
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 [&>*:last-child:nth-child(odd)]:sm:col-span-2">
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Proposals sent
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">{sent}</div>
        </Card>
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Won
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">{won}</div>
          <div className="text-3 text-[11.5px]">
            {Math.round((won / sent) * 100)}% of those sent
          </div>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-2">
          <Callout tone="queue" title="A proposal is outbound">
            It carries the agency's name and a price estimate to a prospective vendor, so
            it goes through the approval queue like any other message. Nothing generates
            and sends in one step.
          </Callout>
        </Card>
      </div>

      <Section title="All proposals">
        <Table minWidth={880}>
          <THead>
            <TR>
              <TH>Property</TH>
              <TH>For</TH>
              <TH>Estimate shown</TH>
              <TH className="text-right">Comparables</TH>
              <TH className="text-right">Pages</TH>
              <TH>Status</TH>
              <TH>Created</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {proposals.map((p) => {
              const prop = propertyById(p.propertyId);
              return (
                <TR key={p.id}>
                  <TD nowrap>
                    {prop && (
                      <Link
                        href={`/properties/${prop.id}`}
                        className="font-medium hover:underline underline-offset-2"
                      >
                        {prop.address}
                      </Link>
                    )}
                    <div className="text-3 text-[12px]">{prop?.suburb}</div>
                  </TD>
                  <TD nowrap>
                    <Link
                      href={`/contacts/${p.contactId}`}
                      className="text-2 hover:underline underline-offset-2"
                    >
                      {contactName(p.contactId)}
                    </Link>
                  </TD>
                  <TD className="tabular whitespace-nowrap text-2">
                    {money(p.estimateLow)} – {money(p.estimateHigh)}
                  </TD>
                  <TD className="text-right tabular text-2">{p.comparables}</TD>
                  <TD className="text-right tabular text-2">{p.pages}</TD>
                  <TD>
                    <Badge tone={statusTone[p.status]}>{statusLabel[p.status]}</Badge>
                  </TD>
                  <TD className="text-2 whitespace-nowrap">{relative(p.createdAt)}</TD>
                  <TD className="text-right">
                    <Button size="sm">
                      <Download size={11} />
                      PDF
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Section>

      <Section title="Preview" hint="the proposal currently in approval">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} className="text-3" />
              <CardTitle>
                {property ? `${property.address}, ${property.suburb}` : "Proposal"}
              </CardTitle>
              <Badge tone="queue" className="ml-auto">
                Awaiting approval
              </Badge>
            </div>

            <div className="space-y-3">
              {[
                ["1. Cover and agency introduction", "Brand, licence, contact details"],
                ["2. The property", "Attributes, condition, features, photography"],
                [
                  "3. Comparable sales",
                  `${featured.comparables} recent sales within 1.5km, with adjustments`,
                ],
                ["4. Price estimate", "A range, with the reasoning behind it"],
                ["5. Marketing plan", "Channels, spend, timeline"],
                ["6. Fee structure", "Commission and marketing costs"],
                ["7. Next steps", "Agency agreement and campaign start"],
              ].map(([t, d]) => (
                <div key={t} className="flex items-start gap-3 border-b pb-2.5 last:border-b-0">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium">{t}</div>
                    <div className="text-3 text-[11.5px] mt-0.5">{d}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="primary" size="sm">
                <ShieldCheck size={12} />
                Approve and send
              </Button>
              <Button size="sm">Edit</Button>
              <Button variant="danger" size="sm">
                Reject
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardTitle>Estimate</CardTitle>
              <div className="text-[20px] font-semibold tabular">
                {money(featured.estimateLow)} – {money(featured.estimateHigh)}
              </div>
              <ProtoNote>
                A range, never a single number, and never a figure the agent has not
                signed off. Under-quoting provisions apply to what a vendor is told as
                much as to what a buyer sees.
              </ProtoNote>
            </Card>

            {contact && (
              <Card>
                <CardTitle>Prospective vendor</CardTitle>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="text-[13px] font-medium hover:underline underline-offset-2"
                >
                  {contact.firstName} {contact.lastName}
                </Link>
                <div className="text-3 text-[12px] mt-0.5">{contact.email}</div>
                {contact.intent && (
                  <p className="text-2 text-[12px] mt-2 leading-relaxed">
                    {contact.intent.brief}
                  </p>
                )}
              </Card>
            )}

            {property && (
              <Card>
                <CardTitle>Source data</CardTitle>
                <KeyValue
                  cols={1}
                  items={[
                    ["Property", `${property.beds} bed · ${property.baths} bath`],
                    ["Land", `${property.landSqm} m²`],
                    ["Built", String(property.yearBuilt)],
                    ["Comparables", `${featured.comparables} sales`],
                    ["Generated", shortDate(featured.createdAt)],
                  ]}
                />
              </Card>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
