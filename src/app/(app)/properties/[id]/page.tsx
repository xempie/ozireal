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
  ScoreBar,
} from "@/components/ui";
import { getProperty, getListingsForProperty, getContact, getMatchesForProperty } from "@/server/queries";
import { RunMatchingButton } from "@/components/forms/run-matching";
import { MATCHABLE_PROPERTY_STATUSES } from "@/server/matching/engine";
import { suburbOptions, contactOptions } from "@/server/queries/pickers";
import {
  EditPropertyButton,
  DeletePropertyButton,
  NewListingButton,
} from "@/components/forms/stock-forms";
import { statusLabel, propertyTypeLabel } from "@/lib/labels";
import { shortDate } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";
import { WebsitePanel } from "@/components/stock/website-panel";
import { buildingChecksForProperty } from "@/server/queries/building-checks";

export default async function PropertyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProperty(id);
  if (!p) notFound();
  const [history, owner, suburbOpts, contactOpts, propertyMatches, checks] = await Promise.all([
    getListingsForProperty(p.id),
    p.ownerContactId ? getContact(p.ownerContactId) : Promise.resolve(null),
    suburbOptions(),
    contactOptions(),
    getMatchesForProperty(p.id),
    buildingChecksForProperty(p.id),
  ]);

  const locality = [p.suburb, p.state, p.postcode].filter(Boolean).join(" ");
  const subtitle = [
    locality,
    propertyTypeLabel[p.type] ?? p.type,
    p.yearBuilt ? `built ${p.yearBuilt}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const features = p.features ?? [];

  return (
    <>
      <PageHeader
        title={
          p.current?.websiteSection === "new_homes" && p.current.projectName ? p.current.projectName : p.address
        }
        subtitle={subtitle}
        actions={
          <>
            <EditPropertyButton
              property={{
                id: p.id,
                unit: p.unit,
                streetNumber: p.streetNumber,
                street: p.street,
                suburbId: p.suburbId,
                postcode: p.postcode,
                type: p.type,
                status: p.status,
                beds: p.beds,
                baths: p.baths,
                parking: p.parking,
                landSqm: p.landSqm,
                ownerContactId: p.ownerContactId,
                internalNotes: p.internalNotes,
                internalPriceExpectation: p.internalPriceExpectation,
              }}
              suburbs={suburbOpts}
              contacts={contactOpts}
            />
            {/* Refused server-side the moment a listing exists, because the
                campaigns hanging off this row are the sold archive. */}
            <DeletePropertyButton id={p.id} />
          </>
        }
      />

      {/* The advertising, merged in from the old listing page (2026-11-11). */}
      <div className="mb-6">
        {p.current && p.current.status !== "withdrawn" ? (
          <WebsitePanel listingId={p.current.id} />
        ) : (
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <CardTitle>Not on the website</CardTitle>
                <p className="text-2 text-[12.5px]">
                  Prepare the price wording, description and photos; publish when you are ready.
                  It is matched to buyers either way.
                </p>
              </div>
              <NewListingButton properties={[{ value: p.id, label: p.address }]} label="Prepare advertising" />
            </div>
          </Card>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <Card>
            <CardTitle>Attributes</CardTitle>
            <KeyValue
              cols={3}
              items={[
                ["Bedrooms", p.beds ?? "—"],
                ["Bathrooms", p.baths ?? "—"],
                ["Parking", p.parking ?? "—"],
                ["Land area", p.landSqm && p.landSqm > 0 ? `${p.landSqm} m²` : "—"],
                ["Floor area", p.floorSqm ? `${p.floorSqm} m²` : "—"],
                ["Year built", p.yearBuilt ?? "—"],
                ["Condition", p.condition ?? "—"],
              ]}
            />
            <div className="mt-3 pt-3 border-t">
              <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1.5">
                Features
              </div>
              <div className="flex flex-wrap gap-1.5">
                {features.map((f) => (
                  <Badge key={f} tone="stock">
                    {f}
                  </Badge>
                ))}
                {features.length === 0 && (
                  <span className="text-3 text-[12px]">None recorded</span>
                )}
              </div>
            </div>
          </Card>

          <Section title="Listing history" hint="the whole life of the property">
            <Table minWidth={780}>
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
                        {/* The status column says whether it is a draft; this is only the name. */}
                        {l.headline || "Untitled listing"}
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
                        {statusLabel[l.status] ?? l.status}
                      </Badge>
                    </TD>
                    <TD className="text-2">{l.priceDisplay || "—"}</TD>
                    <TD className="text-2 whitespace-nowrap">
                      {shortDate(l.listedAt)}
                    </TD>
                    <TD className="text-2">{l.resultDisplay || "—"}</TD>
                  </TR>
                ))}
                {history.length === 0 && (
                  <TR>
                    <TD className="text-3">Never listed.</TD>
                  </TR>
                )}
              </tbody>
            </Table>
            <ProtoNote>
              <History size={11} className="inline mr-1" />
              Old campaigns are never deleted. Powell Street was sold in 2019 before its
              renovation and is on the market again now — the same property, two
              listings.
            </ProtoNote>
          </Section>

          {/* Matched on the property, listed or not (0017). */}
          {/* Building checks on this property (2026-11-11). */}
          <Card>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <CardTitle>Building checks</CardTitle>
              <Link
                href={`/building-checks/new?property=${p.id}`}
                className="ml-auto inline-flex items-center rounded-md bg-[var(--accent)] text-white text-[12.5px] font-medium px-2.5 min-h-8"
              >
                New building check
              </Link>
            </div>
            {checks.length === 0 ? (
              <p className="text-3 text-[12.5px]">
                None yet. Take photos on site for a Red / Amber / Green condition read.
              </p>
            ) : (
              <ul className="divide-y text-[13px]">
                {checks.map((b) => (
                  <li key={b.id} className="py-2 flex flex-wrap items-center gap-2">
                    <Link href={`/building-checks/${b.id}`} className="font-medium hover:underline underline-offset-2">
                      {shortDate(b.createdAt)}
                    </Link>
                    {b.status === "done" ? (
                      <span className="text-2">
                        <span className="text-[#A12A12] font-semibold">{b.red} red</span> ·{" "}
                        <span className="text-[#8A4B00] font-semibold">{b.amber} amber</span> · {b.green} green
                      </span>
                    ) : (
                      <span className="text-3">{b.status === "failed" ? "failed" : "running…"}</span>
                    )}
                    <span className="ml-auto text-3 text-[12px]">{b.photos.length} photos</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div id="matches" className="scroll-mt-20" />
          <Section title="Buyers who suit it" hint="matched whether or not it is listed">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <p className="text-2 text-[12.5px]">
                  {propertyMatches.length
                    ? `${propertyMatches.length} match${propertyMatches.length === 1 ? "" : "es"}, best first.`
                    : "No matches yet."}
                </p>
                {(MATCHABLE_PROPERTY_STATUSES as readonly string[]).includes(p.status) && (
                  <RunMatchingButton
                    propertyId={p.id}
                    label={propertyMatches.length ? "Match again" : "Find buyers"}
                  />
                )}
              </div>
              {propertyMatches.length > 0 && (
                <div className="mt-3 space-y-2.5">
                  {propertyMatches.map((m) => (
                    <div key={m.contactId} className="border-l-2 pl-3 border-[var(--line-strong)]">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/contacts/${m.contactId}`}
                          className="text-[12.5px] font-medium hover:underline underline-offset-2"
                        >
                          {m.contactFirstName} {m.contactLastName}
                        </Link>
                        <ScoreBar value={m.score} />
                      </div>
                      <p className="text-2 text-[12px] mt-1 leading-relaxed">{m.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Address</CardTitle>
            <KeyValue
              cols={1}
              items={[
                ["Street", p.address],
                ["Suburb", locality || "—"],
                ["G-NAF identifier", p.gnafPid ?? "not matched (deferred)"],
                [
                  "Coordinates",
                  p.lat === null ? "not geocoded (deferred)" : `${p.lat}`,
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
              <div className="text-3 text-[12px] mt-0.5">{owner.email ?? "—"}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {owner.roles.map((r) => (
                  <Badge key={r} tone="stock">
                    {roleLabel(r)}
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
                ["Price expectation", p.internalPriceExpectation ?? "—"],
                ["Notes", p.internalNotes ?? "—"],
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
