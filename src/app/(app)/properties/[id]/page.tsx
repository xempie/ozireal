import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, History } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Badge,
  KeyValue,
  Table,
  THead,
  TH,
  TD,
  TR,
  ProtoNote,
} from "@/components/ui";
import {
  properties,
  propertyById,
  listingsForProperty,
  contactById,
  statusLabel,
} from "@/lib/sample-data";
import { shortDate, money } from "@/lib/utils";

export function generateStaticParams() {
  return properties.map((p) => ({ id: p.id }));
}

export default async function PropertyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = propertyById(id);
  if (!p) notFound();
  const history = listingsForProperty(p.id);
  const owner = contactById(p.ownerContactId);

  return (
    <>
      <PageHeader
        title={p.address}
        subtitle={`${p.suburb} ${p.state} ${p.postcode} · ${p.type} · built ${p.yearBuilt}`}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardTitle>Attributes</CardTitle>
            <KeyValue
              cols={3}
              items={[
                ["Bedrooms", p.beds],
                ["Bathrooms", p.baths],
                ["Parking", p.parking],
                ["Land area", p.landSqm > 0 ? `${p.landSqm} m²` : "—"],
                ["Floor area", `${p.floorSqm} m²`],
                ["Year built", p.yearBuilt],
                ["Condition", p.condition],
              ]}
            />
            <div className="mt-3 pt-3 border-t">
              <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1.5">
                Features
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.features.map((f) => (
                  <Badge key={f} tone="stock">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          <Section title="Listing history" hint="the whole life of the property">
            <Table>
              <THead>
                <TR>
                  <TH>Campaign</TH>
                  <TH>Type</TH>
                  <TH>Status</TH>
                  <TH>Price shown</TH>
                  <TH>Listed</TH>
                  <TH>Result</TH>
                </TR>
              </THead>
              <tbody>
                {history.map((l) => (
                  <TR key={l.id}>
                    <TD>
                      <Link
                        href={`/listings/${l.id}`}
                        className="font-medium hover:underline underline-offset-2"
                      >
                        {l.headline || "Untitled draft"}
                      </Link>
                    </TD>
                    <TD className="text-2">{l.type === "rent" ? "Rental" : "Sale"}</TD>
                    <TD>
                      <Badge
                        tone={
                          l.status === "live"
                            ? "stock"
                            : l.status === "sold"
                              ? "sent"
                              : "neutral"
                        }
                      >
                        {statusLabel[l.status]}
                      </Badge>
                    </TD>
                    <TD className="text-2">{l.priceDisplay || "—"}</TD>
                    <TD className="text-2 whitespace-nowrap">
                      {shortDate(l.listedAt)}
                    </TD>
                    <TD className="text-2">{l.resultDisplay || "—"}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <ProtoNote>
              <History size={11} className="inline mr-1" />
              Old campaigns are never deleted. Powell Street was sold in 2019 before its
              renovation and is on the market again now — the same property, two
              listings.
            </ProtoNote>
          </Section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Address</CardTitle>
            <KeyValue
              cols={1}
              items={[
                ["Street", p.address],
                ["Suburb", `${p.suburb} ${p.state} ${p.postcode}`],
                ["G-NAF identifier", p.gnafPid ?? "not matched (deferred)"],
                [
                  "Coordinates",
                  p.lat === null ? "not geocoded (deferred)" : `${p.lat}, ${p.lng}`,
                ],
              ]}
            />
            <ProtoNote>
              Structured columns rather than free text, so suburb filtering in search
              actually works.
            </ProtoNote>
          </Card>

          {owner && (
            <Card>
              <CardTitle>Owner</CardTitle>
              <Link
                href={`/contacts/${owner.id}`}
                className="text-[13px] font-medium hover:underline underline-offset-2"
              >
                {owner.firstName} {owner.lastName}
              </Link>
              <div className="text-3 text-[12px] mt-0.5">{owner.email}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {owner.roles.map((r) => (
                  <Badge key={r} tone="stock">
                    {r}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          <Card className="border-[#d03b3b]/25 bg-[#d03b3b]/[0.03]">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={13} className="text-[#b02f2f] dark:text-[#f08a8a]" />
              <CardTitle>Internal only</CardTitle>
            </div>
            <KeyValue
              cols={1}
              items={[
                ["Price expectation", p.internalPriceExpectation],
                ["Notes", p.internalNotes],
              ]}
            />
            <ProtoNote>
              Rule 8. Public pages never query this table directly — they read named
              projections that cannot return these fields, and a test asserts it.
            </ProtoNote>
          </Card>
        </div>
      </div>
    </>
  );
}
