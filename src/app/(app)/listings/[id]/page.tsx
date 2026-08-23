import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Globe,
  Camera,
  Eye,
  MessageSquare,
  Users,
  Lock,
} from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Badge,
  Button,
  KeyValue,
  Callout,
  ScoreBar,
  Empty,
  ProtoNote,
} from "@/components/ui";
import {
  getListing,
  getProperty,
  getMatchesForListing,
  getInspections,
  getContact,
} from "@/server/queries";
import { statusLabel } from "@/lib/labels";
import { money, shortDate, timeOfDay, relative } from "@/lib/utils";

export default async function ListingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const l = await getListing(id);
  if (!l) notFound();
  const p = await getProperty(l.propertyId);
  const listingMatches = await getMatchesForListing(l.id);
  const insp = (await getInspections()).filter((i) => i.listingId === l.id);

  /**
   * Consent state is not carried on the match row, so it is read per matched contact.
   * getContact returns every consent row newest first, so the first row for a channel
   * is the current state.
   */
  const matchContacts = new Map(
    (await Promise.all(listingMatches.map((m) => getContact(m.contactId))))
      .filter((c) => c !== null)
      .map((c) => [c.id, c] as const),
  );

  const subtitle = [
    l.type === "rent" ? "Rental" : "Sale",
    l.method,
    `listed ${shortDate(l.listedAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const searchRange =
    l.type === "rent"
      ? l.searchMin !== null
        ? `$${l.searchMin}/wk`
        : "Not set"
      : l.searchMin !== null && l.searchMax !== null
        ? `${money(l.searchMin)} – ${money(l.searchMax)}`
        : "Not set";

  return (
    <>
      <PageHeader
        title={l.address}
        subtitle={subtitle}
        actions={
          <>
            <Badge tone={l.status === "live" ? "stock" : "queue"}>
              {statusLabel[l.status] ?? l.status}
            </Badge>
            {l.status === "draft" ? (
              <Button variant="primary">Publish</Button>
            ) : (
              <Button>Withdraw</Button>
            )}
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <Card>
            <CardTitle>Public copy</CardTitle>
            <div className="space-y-3">
              <div>
                <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1">
                  Headline
                </div>
                <p className="text-[14px] font-medium">
                  {l.headline || (
                    <span className="text-3 italic">Not written yet</span>
                  )}
                </p>
              </div>
              <div>
                <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1">
                  Description
                </div>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                  {l.copy || <span className="text-3 italic">Not written yet</span>}
                </p>
              </div>
            </div>
            <ProtoNote>
              Deliberately separate from the internal notes on the property. Nothing
              from the internal side can reach a public page.
            </ProtoNote>
          </Card>

          <Card>
            <CardTitle>Price</CardTitle>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1">
                  Displayed publicly — text, as authored
                </div>
                <div className="text-[16px] font-semibold">
                  {l.priceDisplay || (
                    <span className="text-[#b02f2f] dark:text-[#f08a8a] text-[13px] font-normal italic">
                      Not set — cannot publish
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1">
                  Hidden search range
                </div>
                <div className="text-[13px] tabular text-2">{searchRange}</div>
                <div className="text-3 text-[11.5px] mt-0.5">
                  Drives filters only. Never displayed.
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Callout tone="queue" title="Under-quoting">
                The displayed wording is a legal artefact. The agent authors it and the
                software renders it verbatim — it is never composed from a number.
              </Callout>
            </div>
          </Card>

          <Section title="Matched contacts" hint="who should hear about this">
            {listingMatches.length === 0 ? (
              <Empty>No matches yet — this listing has no embedding.</Empty>
            ) : (
              <div className="space-y-2">
                {listingMatches.map((m) => {
                  const c = matchContacts.get(m.contactId);
                  const emailConsent = c?.consents.find(
                    (x) => x.channel === "email",
                  )?.status;
                  return (
                    <Card key={m.contactId} className="p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link
                            href={`/contacts/${m.contactId}`}
                            className="font-medium text-[13px] hover:underline underline-offset-2"
                          >
                            {m.contactFirstName} {m.contactLastName}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge tone={m.stage === "ranked" ? "ai" : "neutral"}>
                              {m.stage === "ranked" ? "AI ranked" : "similarity only"}
                            </Badge>
                            {emailConsent !== "granted" && (
                              <Badge tone="blocked">no email consent</Badge>
                            )}
                          </div>
                        </div>
                        <ScoreBar value={m.score} />
                      </div>
                      <p className="text-2 text-[12.5px] mt-2 leading-relaxed">
                        {m.reason}
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
            <div className="mt-3">
              <Button variant="primary">
                <Users size={13} />
                Draft a campaign to these contacts
              </Button>
              <ProtoNote>
                Drafts land in the approval queue. There is no path from here to a send.
              </ProtoNote>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Performance</CardTitle>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[20px] font-semibold tabular">{l.views7d}</div>
                <div className="text-3 text-[11px] inline-flex items-center gap-1">
                  <Eye size={10} /> views 7d
                </div>
              </div>
              <div>
                <div className="text-[20px] font-semibold tabular">{l.enquiries7d}</div>
                <div className="text-3 text-[11px] inline-flex items-center gap-1">
                  <MessageSquare size={10} /> enquiries
                </div>
              </div>
              <div>
                <div className="text-[20px] font-semibold tabular">{l.photos}</div>
                <div className="text-3 text-[11px] inline-flex items-center gap-1">
                  <Camera size={10} /> photos
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Website</CardTitle>
            <div className="flex items-start gap-2">
              <Globe size={13} className="text-3 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[12px] font-mono break-all text-2">
                  /{l.type === "rent" ? "for-rent" : "for-sale"}/{l.slug}
                </div>
                <div className="text-3 text-[11.5px] mt-1">
                  {l.publishedAt
                    ? `Published ${relative(l.publishedAt)} · revalidated on save`
                    : "Not published"}
                </div>
              </div>
            </div>
            <ProtoNote>
              Slugs are stable and never reused, so an old link never lands on someone
              else&apos;s property.
            </ProtoNote>
          </Card>

          {insp.length > 0 && (
            <Card>
              <CardTitle>Inspections</CardTitle>
              <ul className="space-y-2">
                {insp.map((i) => (
                  <li key={i.id} className="text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <span>
                        {shortDate(i.startsAt)} · {timeOfDay(i.startsAt)}
                      </span>
                      <Badge tone={i.kind === "open" ? "stock" : "neutral"}>
                        {i.kind}
                      </Badge>
                    </div>
                    <div className="text-3 text-[11.5px]">
                      {i.registrations} registered
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {p && (
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
                  [
                    "Owner",
                    p.ownerContactId && p.ownerName ? (
                      <Link
                        key="o"
                        href={`/contacts/${p.ownerContactId}`}
                        className="underline underline-offset-2"
                      >
                        {p.ownerName}
                      </Link>
                    ) : (
                      "—"
                    ),
                  ],
                ]}
              />
              <div className="mt-3 flex items-start gap-1.5 text-[11.5px] text-2">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>
                  Structurally unable to reach a public route — public pages read through
                  their own allow-listed projections.
                </span>
              </div>
            </Card>
          )}

          {p && (
            <Card>
              <CardTitle>Property</CardTitle>
              <Link
                href={`/properties/${p.id}`}
                className="text-[13px] font-medium hover:underline underline-offset-2"
              >
                {[p.address, [p.suburb, p.postcode].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ")}
              </Link>
              <div className="text-3 text-[12px] mt-1">
                {p.beds ?? "—"} bed · {p.baths ?? "—"} bath · {p.parking ?? "—"} car ·{" "}
                {p.landSqm ? `${p.landSqm}m²` : "—"}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
