import Link from "next/link";
import { Home, Users } from "lucide-react";
import { PageHeader, Section, Card, Badge, ScoreBar } from "@/components/ui";
import { getAllMatches, getBuyersWithPreferences, getListings, getContacts } from "@/server/queries";
import { RunMatchingButton } from "@/components/forms/run-matching";
import { MATCHABLE_STATUSES } from "@/server/matching/engine";
import { AskButton } from "@/components/assistant/ask-button";

/**
 * Matching, in both directions, with a button on every row that can be matched.
 *
 * It used to show only listings and contacts that ALREADY had matches, with no way to
 * start a run, so on a fresh system it looked empty and inert. Now every live listing
 * and every contact with preferences is listed, with its results or "no matches yet".
 * The run goes through the same checks as the assistant (actions/matching.ts).
 */

const money = (n: number | null) =>
  n === null ? null : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0)}m` : `$${Math.round(n / 1000)}k`;

export default async function MatchingPage() {
  const [allListings, allMatches, buyers, contactRows] = await Promise.all([
    getListings(),
    getAllMatches(),
    getBuyersWithPreferences(),
    getContacts(),
  ]);

  // Drafts included: off-market deals are matched without being published.
  const live = allListings.filter((l) => MATCHABLE_STATUSES.includes(l.status));
  const withoutPrefs = contactRows.length - buyers.length;

  return (
    <>
      <PageHeader
        title="Matching"
        subtitle="Find the buyers who suit a listing, or the listings that suit a buyer. Each match comes with a one-line reason."
      />

      <div className="grid xl:grid-cols-2 gap-6">
        <Section title="Listings → buyers" hint={`${live.length} to match, drafts included`}>
          <div className="space-y-3">
            {live.length === 0 && (
              <Card>
                <p className="text-[13px]">No listings yet.</p>
                <p className="text-2 text-[12.5px] mt-1">
                  Create a sale or rental listing for a property and it appears here. It can
                  stay a draft: matching does not need it published.
                </p>
              </Card>
            )}
            {live.map((l) => {
              const ms = allMatches.filter((m) => m.listingId === l.id);
              return (
                <Card key={l.id}>
                  <div className="flex items-start gap-3">
                    <Home size={15} className="text-3 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/listings/${l.id}`}
                        className="font-medium text-[13.5px] hover:underline underline-offset-2"
                      >
                        {l.address}
                      </Link>
                      <div className="text-3 text-[12px] mt-0.5">
                        <Badge tone={l.status === "draft" ? "neutral" : "stock"}>{l.status === "under_offer" ? "Under offer" : l.status === "draft" ? "Draft" : "Live"}</Badge>{" "}
                        {l.type === "rent" ? "Rental" : "Sale"} · {l.priceDisplay || "no price wording"}
                      </div>
                    </div>
                    <RunMatchingButton
                      listingId={l.id}
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

        <Section title="Buyers → listings" hint={`${buyers.length} with preferences`}>
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
                      <div key={m.listingId} className="border-l-2 pl-3 border-[var(--line-strong)]">
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={`/listings/${m.listingId}`}
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
