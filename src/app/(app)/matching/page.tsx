import Link from "next/link";
import { Home, Users } from "lucide-react";
import { PageHeader, Section, Card, Badge, ScoreBar } from "@/components/ui";
import { getAllMatches, getBuyersWithPreferences, getProperties, getContacts } from "@/server/queries";
import { RunMatchingButton } from "@/components/forms/run-matching";
import { MATCHABLE_STATUSES, MATCHABLE_PROPERTY_STATUSES } from "@/server/matching/engine";
import { AskButton } from "@/components/assistant/ask-button";

/**
 * Matching, in both directions, with a button on every row that can be matched.
 *
 * The left column is PROPERTIES, listed or not (2026-09-30, migration 0017): off-market
 * stock is matched without any listing. Sold and archived properties are left out.
 * Every contact with preferences is on the right. The run goes through the same checks
 * as the assistant (actions/matching.ts).
 */

const propertyStatusLabel: Record<string, string> = {
  prospect: "Prospect",
  appraised: "Appraised",
  off_market: "Off market",
  listed: "Listed",
};

const money = (n: number | null) =>
  n === null ? null : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0)}m` : `$${Math.round(n / 1000)}k`;

export default async function MatchingPage() {
  const [allProperties, allMatches, buyers, contactRows] = await Promise.all([
    getProperties(),
    getAllMatches(),
    getBuyersWithPreferences(),
    getContacts(),
  ]);

  const stock = allProperties.filter((p) =>
    (MATCHABLE_PROPERTY_STATUSES as readonly string[]).includes(p.status),
  );
  const withoutPrefs = contactRows.length - buyers.length;

  return (
    <>
      <PageHeader
        title="Matching"
        subtitle="Find the buyers who suit a property, listed or not, or the properties that suit a buyer. Each match comes with a one-line reason."
      />

      <div className="grid xl:grid-cols-2 gap-6">
        <Section title="Properties → buyers" hint={`${stock.length} to match, listed or not`}>
          <div className="space-y-3">
            {stock.length === 0 && (
              <Card>
                <p className="text-[13px]">No properties yet.</p>
                <p className="text-2 text-[12.5px] mt-1">
                  Add a property and it appears here. It does not need a listing to be matched.
                </p>
              </Card>
            )}
            {stock.map((p) => {
              const ms = allMatches.filter((m) => m.propertyId === p.id);
              const campaign = p.listings.find((l) => MATCHABLE_STATUSES.includes(l.status));
              return (
                <Card key={p.id}>
                  <div className="flex items-start gap-3">
                    <Home size={15} className="text-3 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/properties/${p.id}`}
                        className="font-medium text-[13.5px] hover:underline underline-offset-2"
                      >
                        {p.unit ? `${p.unit}/` : ""}
                        {p.address}, {p.suburb}
                      </Link>
                      <div className="text-3 text-[12px] mt-0.5">
                        <Badge tone={campaign ? "stock" : "neutral"}>
                          {campaign
                            ? campaign.status === "draft"
                              ? "Draft listing"
                              : campaign.status === "under_offer"
                                ? "Under offer"
                                : "Listed"
                            : (propertyStatusLabel[p.status] ?? p.status)}
                        </Badge>{" "}
                        {p.type} · {p.beds ?? "—"} bed
                        {!campaign && " · not listed, no price"}
                      </div>
                    </div>
                    <RunMatchingButton
                      propertyId={p.id}
                      label={ms.length ? "Match again" : "Find buyers"}
                    />
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {ms.length === 0 && <p className="text-3 text-[12px]">No matches yet.</p>}
                    {ms.map((m) => (
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
                </Card>
              );
            })}
          </div>
        </Section>

        <Section title="Buyers → properties" hint={`${buyers.length} with preferences`}>
          <div className="space-y-3">
            {withoutPrefs > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-[12.5px]">
                <span className="text-2 flex-1">
                  {withoutPrefs} contact{withoutPrefs === 1 ? " has" : "s have"} no preferences, so
                  {withoutPrefs === 1 ? " it" : " they"} can&apos;t be matched yet.
                </span>
                <AskButton
                  prefill="Set preferences for "
                  className="shrink-0 text-[12px] rounded-md border px-2.5 min-h-8 surface-2 hover:surface-3"
                >
                  Set preferences
                </AskButton>
              </div>
            )}
            {buyers.length === 0 && (
              <Card>
                <p className="text-[13px]">No contacts with preferences yet.</p>
                <p className="text-2 text-[12.5px] mt-1">
                  Tell the assistant what someone is looking for, e.g. &ldquo;Esi wants a 3 bed
                  house in Norwood, $700k–$850k&rdquo;.
                </p>
              </Card>
            )}
            {buyers.map((b) => {
              const ms = allMatches.filter((m) => m.contactId === b.id);
              const budget =
                b.priceMin !== null || b.priceMax !== null
                  ? `${money(b.priceMin) ?? "any"}–${money(b.priceMax) ?? "any"}`
                  : b.rentPwMax !== null
                    ? `up to $${b.rentPwMax}/wk`
                    : null;
              const summary = [
                budget,
                b.bedsMin !== null ? `${b.bedsMin}+ bed` : null,
                b.propertyTypes?.length ? b.propertyTypes.join("/") : null,
                (() => {
                  const areas = [...b.suburbs, ...(b.postcodes ?? [])];
                  return areas.length ? areas.slice(0, 3).join(", ") + (areas.length > 3 ? "…" : "") : null;
                })(),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <Card key={b.id}>
                  <div className="flex items-start gap-3">
                    <Users size={15} className="text-3 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/contacts/${b.id}`}
                          className="font-medium text-[13.5px] hover:underline underline-offset-2"
                        >
                          {b.firstName} {b.lastName}
                        </Link>
                        {b.doNotContact && <Badge tone="blocked">do not contact</Badge>}
                      </div>
                      <div className="text-3 text-[12px] mt-0.5">{summary || "preferences set"}</div>
                    </div>
                    {!b.doNotContact && (
                      <RunMatchingButton
                        contactId={b.id}
                        label={ms.length ? "Match again" : "Find properties"}
                      />
                    )}
                  </div>
                  {b.softRequirements && (
                    <p className="text-3 text-[11.5px] italic mt-2 leading-relaxed">
                      &ldquo;{b.softRequirements}&rdquo;
                    </p>
                  )}
                  <div className="mt-3 space-y-2.5">
                    {ms.length === 0 && <p className="text-3 text-[12px]">No matches yet.</p>}
                    {ms.map((m) => (
                      <div key={m.propertyId} className="border-l-2 pl-3 border-[var(--line-strong)]">
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={m.listingId ? `/listings/${m.listingId}` : `/properties/${m.propertyId}`}
                            className="text-[12.5px] font-medium hover:underline underline-offset-2"
                          >
                            {m.address}
                          </Link>
                          <ScoreBar value={m.score} />
                        </div>
                        <p className="text-2 text-[12px] mt-1 leading-relaxed">{m.reason}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>
      </div>
    </>
  );
}
