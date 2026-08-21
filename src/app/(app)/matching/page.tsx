import Link from "next/link";
import { ArrowLeftRight, Filter, Sparkles, Braces } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Badge,
  ScoreBar,
  ProtoNote,
  Callout,
} from "@/components/ui";
import {
  listings,
  listingAddress,
  matchesForListing,
  contactById,
  contacts,
  matchesForContact,
  listingById,
} from "@/lib/sample-data";

const stages = [
  {
    n: 1,
    name: "Hard filters",
    icon: Filter,
    detail: "price · beds · suburb · availability, in SQL",
    from: "thousands",
    to: "dozens",
    tone: "stock" as const,
  },
  {
    n: 2,
    name: "Vector similarity",
    icon: Braces,
    detail: "the soft wants a filter cannot express",
    from: "dozens",
    to: "about 20",
    tone: "brand" as const,
  },
  {
    n: 3,
    name: "Claude ranks",
    icon: Sparkles,
    detail: "orders the shortlist, writes one sentence per match",
    from: "about 20",
    to: "ranked, explained",
    tone: "ai" as const,
  },
];

export default function MatchingPage() {
  const liveListings = listings.filter(
    (l) => l.status === "live" || l.status === "draft",
  );
  const activeBuyers = contacts.filter(
    (c) => c.preferences && matchesForContact(c.id).length > 0,
  );

  return (
    <>
      <PageHeader
        title="Matching"
        subtitle="Runs in both directions — property to the people who should hear about it, and person to the properties that suit them."
      />

      <Section title="How a match is produced">
        <div className="grid md:grid-cols-3 gap-3">
          {stages.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.n}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon size={14} className="text-3" />
                  <span className="font-semibold text-[13px]">
                    {s.n} · {s.name}
                  </span>
                </div>
                <p className="text-2 text-[12.5px] leading-relaxed">{s.detail}</p>
                <div className="mt-2">
                  <Badge tone={s.tone}>
                    {s.from} → {s.to}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
        <div className="mt-3">
          <Callout tone="ai" title="The reason is not optional">
            An agent will not pick up the phone on the strength of a similarity score.
            The one-sentence reason is what makes this get used daily rather than ignored
            after a week.
          </Callout>
        </div>
      </Section>

      <div className="grid xl:grid-cols-2 gap-6">
        <Section
          title="Property → contacts"
          hint="who should hear about this listing"
        >
          <div className="space-y-4">
            {liveListings.map((l) => {
              const ms = matchesForListing(l.id);
              if (ms.length === 0) return null;
              return (
                <Card key={l.id}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <ArrowLeftRight size={13} className="text-3" />
                    <Link
                      href={`/listings/${l.id}`}
                      className="font-medium text-[13px] hover:underline underline-offset-2"
                    >
                      {listingAddress(l)}
                    </Link>
                    <span className="text-3 text-[12px] ml-auto">
                      {l.priceDisplay || "no price"}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {ms.map((m) => {
                      const c = contactById(m.contactId);
                      if (!c) return null;
                      return (
                        <div
                          key={m.contactId}
                          className="border-l-2 pl-3 border-[var(--line-strong)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <Link
                              href={`/contacts/${c.id}`}
                              className="text-[12.5px] font-medium hover:underline underline-offset-2"
                            >
                              {c.firstName} {c.lastName}
                            </Link>
                            <ScoreBar value={m.score} />
                          </div>
                          <p className="text-2 text-[12px] mt-1 leading-relaxed">
                            {m.reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>

        <Section title="Contact → properties" hint="what suits this person">
          <div className="space-y-4">
            {activeBuyers.map((c) => {
              const ms = matchesForContact(c.id);
              return (
                <Card key={c.id}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <ArrowLeftRight size={13} className="text-3" />
                    <Link
                      href={`/contacts/${c.id}`}
                      className="font-medium text-[13px] hover:underline underline-offset-2"
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                    {c.intent && (
                      <span className="text-3 text-[12px] ml-auto">
                        {c.intent.budgetBand}
                      </span>
                    )}
                  </div>
                  {c.preferences && (
                    <p className="text-3 text-[11.5px] italic mb-2.5 leading-relaxed">
                      “{c.preferences.softRequirements}”
                    </p>
                  )}
                  <div className="space-y-2.5">
                    {ms.map((m) => {
                      const l = listingById(m.listingId);
                      if (!l) return null;
                      return (
                        <div
                          key={m.listingId}
                          className="border-l-2 pl-3 border-[var(--line-strong)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <Link
                              href={`/listings/${l.id}`}
                              className="text-[12.5px] font-medium hover:underline underline-offset-2"
                            >
                              {listingAddress(l)}
                            </Link>
                            <ScoreBar value={m.score} />
                          </div>
                          <p className="text-2 text-[12px] mt-1 leading-relaxed">
                            {m.reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>
      </div>

      <ProtoNote>
        Scores here are authored sample values. In Phase 2 they come from pgvector
        cosine distance, and the reason text comes from Sonnet ranking the shortlist.
      </ProtoNote>
    </>
  );
}
