import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Mail,
  Phone,
  MapPin,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  FileText,
} from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Badge,
  KeyValue,
  Callout,
  ScoreBar,
  Empty,
  ProtoNote,
} from "@/components/ui";
import {
  getContact,
  getInteractionsFor,
  getMatchesForContact,
  getListings,
  getTasks,
} from "@/server/queries";
import { channelLabel, propertyTypeLabel, statusLabel } from "@/lib/labels";
import { relative, dateTime, money, shortDate } from "@/lib/utils";
import {
  LogInteractionButton,
  RecordOutcomeButton,
  EditContactButton,
  RemoveContactButton,
} from "@/components/forms/contact-forms";

export default async function ContactDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getContact(id);
  if (!c) notFound();

  const [log, contactMatches, listings, tasks] = await Promise.all([
    getInteractionsFor(c.id),
    getMatchesForContact(c.id),
    getListings(),
    getTasks(),
  ]);

  /** One pass over the listings already loaded beats a lookup per interaction. */
  const addressByListingId = new Map(listings.map((l) => [l.id, l.address]));
  const contactTasks = tasks.filter((t) => t.contactId === c.id && !t.done);

  return (
    <>
      <PageHeader
        title={`${c.firstName} ${c.lastName}`}
        subtitle={`${c.roles.join(" · ")} · owned by ${c.owner ?? "unassigned"} · created ${shortDate(c.createdAt)}`}
        actions={
          // A superseded record takes no new activity. Leaving the buttons here would
          // contradict the banner below and split one person's history across two
          // records again, which is the thing the merge just undid.
          c.mergedIntoId ? null : (
            <>
              <LogInteractionButton contactId={c.id} />
              <RecordOutcomeButton contactId={c.id} />
              <EditContactButton
                contact={{
                  id: c.id,
                  firstName: c.firstName,
                  lastName: c.lastName,
                  email: c.email,
                  phone: c.phone,
                  suburb: c.suburb,
                  roles: c.roles,
                  doNotContact: c.doNotContact,
                }}
              />
              <RemoveContactButton
                contactId={c.id}
                name={`${c.firstName} ${c.lastName}`}
              />
            </>
          )
        }
      />

      {c.mergedIntoId && (
        <div className="mb-6">
          <Callout tone="queue" title="This record was merged">
            It was superseded by{" "}
            <Link
              href={`/contacts/${c.mergedIntoId}`}
              className="underline underline-offset-2 font-medium"
            >
              the older record
            </Link>
            , which is where new activity should go. Nothing here was deleted — the
            interactions and consents below stay attached to this record because
            reassigning them would falsify who actually gave that consent, and when.
          </Callout>
        </div>
      )}

      {c.mergedIn.length > 0 && (
        <div className="mb-6">
          <Callout tone="queue" title="Includes merged records">
            {c.mergedIn.map((m) => `${m.firstName} ${m.lastName}`).join(", ")} was merged
            into this one. Their history appears below, marked with where it came from.
          </Callout>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {c.intent && (
            <Card className="border-[#4a3aa7]/25 bg-[#4a3aa7]/[0.04]">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-[#4a3aa7] dark:text-[#a79bf0]" />
                <CardTitle>Rolling brief</CardTitle>
                <span className="text-3 text-[11.5px] ml-auto">
                  rebuilt {relative(c.intent.rebuiltAt)}
                </span>
              </div>
              <p className="text-[13.5px] leading-relaxed">
                {c.intent.brief ?? "No brief built yet."}
              </p>
              <div className="mt-3 pt-3 border-t">
                <KeyValue
                  cols={3}
                  items={[
                    ["Intent", <span className="capitalize" key="i">{c.intent.type ?? "—"}</span>],
                    ["Budget band", c.intent.budgetBand ?? "—"],
                    ["Timeline", c.intent.timeline ?? "—"],
                    [
                      "Sentiment",
                      <span className="capitalize" key="s">
                        {c.intent.sentiment ?? "—"}
                      </span>,
                    ],
                    [
                      "Confidence",
                      c.intent.confidence !== null
                        ? c.intent.confidence.toFixed(2)
                        : "—",
                    ],
                    [
                      "Blockers",
                      c.intent.blockers.length ? c.intent.blockers.join("; ") : "None",
                    ],
                  ]}
                />
              </div>
              <ProtoNote>
                Derived, never hand-edited. A wrong brief is fixed by correcting the
                interaction underneath it, then letting the job rebuild.
              </ProtoNote>
            </Card>
          )}

          <Section title="Interaction log" hint="append-only, every channel">
            <div className="space-y-2">
              {log.map((i) => {
                const address = i.listingId
                  ? addressByListingId.get(i.listingId)
                  : undefined;
                return (
                  <Card key={i.id} className="p-3">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge tone="channel">
                        {channelLabel[i.channel] ?? i.channel}
                      </Badge>
                      <Badge tone={i.direction === "in" ? "brand" : "neutral"}>
                        {i.direction === "in" ? "inbound" : "outbound"}
                      </Badge>
                      <span className="text-[12.5px] font-medium">{i.subject}</span>
                      <span className="text-3 text-[11.5px] ml-auto">
                        {dateTime(i.at)}
                      </span>
                    </div>
                    <p className="text-2 text-[12.5px] leading-relaxed whitespace-pre-wrap">
                      {i.body}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      {i.hasRaw && (
                        <span className="text-3 text-[11.5px] inline-flex items-center gap-1">
                          <FileText size={11} />
                          original message stored
                        </span>
                      )}
                      {i.listingId && address && (
                        <Link
                          href={`/listings/${i.listingId}`}
                          className="text-[11.5px] underline underline-offset-2 text-2"
                        >
                          {address}
                        </Link>
                      )}
                      {i.viaMergedRecord && (
                        <span className="text-3 text-[11.5px]">
                          from merged record {i.viaMergedRecord.firstName}{" "}
                          {i.viaMergedRecord.lastName}
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
              {log.length === 0 && <Empty>No interactions recorded yet.</Empty>}
            </div>
          </Section>

          <Section title="Matched properties" hint="with the reason, never a bare score">
            {contactMatches.length === 0 ? (
              <Empty>No matches — this contact has no stored preferences yet.</Empty>
            ) : (
              <div className="space-y-2">
                {contactMatches.map((m) => (
                  <Card key={m.listingId} className="p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/listings/${m.listingId}`}
                          className="font-medium text-[13px] hover:underline underline-offset-2"
                        >
                          {m.address}
                        </Link>
                        <div className="text-3 text-[12px] mt-0.5">
                          {m.priceDisplay || "Price not set"} ·{" "}
                          {statusLabel[m.listingStatus] ?? m.listingStatus}
                        </div>
                      </div>
                      <ScoreBar value={m.score} />
                    </div>
                    <p className="text-2 text-[12.5px] mt-2 leading-relaxed">
                      {m.reason}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Identity</CardTitle>
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-3 shrink-0" />
                <span className="truncate">{c.email ?? "No email on file"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-3 shrink-0" />
                <span className="tabular">{c.phone ?? "No phone on file"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-3 shrink-0" />
                <span>{c.suburb ?? "No suburb on file"}</span>
              </div>
            </div>
            {c.doNotContact && (
              <div className="mt-3">
                <Callout tone="blocked" title="Do not contact">
                  This contact has asked for no further contact. Every send path checks
                  this flag independently of channel consent.
                </Callout>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>Last follow-up</CardTitle>
            <p className="text-[13px] leading-relaxed">
              {c.lastFollowupOutcome ?? "No follow-up recorded yet."}
            </p>
            <p className="text-3 text-[11.5px] mt-1.5">
              {c.lastFollowupAt ? relative(c.lastFollowupAt) : "—"}
              {c.followupDueAt && ` · next due ${shortDate(c.followupDueAt)}`}
            </p>
            <ProtoNote>
              A first-class column, not a note — it is what the day is sorted by.
            </ProtoNote>
          </Card>

          {c.preferences && (
            <Card>
              <CardTitle>Preferences</CardTitle>
              <KeyValue
                cols={1}
                items={[
                  [
                    "Suburbs",
                    c.preferences.suburbs.length
                      ? c.preferences.suburbs.join(", ")
                      : "—",
                  ],
                  [
                    "Price",
                    c.preferences.priceMax && c.preferences.priceMax > 0
                      ? `${money(c.preferences.priceMin ?? 0)} – ${money(c.preferences.priceMax)}`
                      : "n/a — rental",
                  ],
                  [
                    "Minimums",
                    `${c.preferences.bedsMin ?? 0} bed · ${c.preferences.bathsMin ?? 0} bath · ${c.preferences.parkingMin ?? 0} car`,
                  ],
                  [
                    "Type",
                    c.preferences.propertyTypes.length
                      ? c.preferences.propertyTypes
                          .map((t) => propertyTypeLabel[t] ?? t)
                          .join(", ")
                      : "—",
                  ],
                  ["Timeline", c.preferences.timeline ?? "—"],
                  ["Finance", c.preferences.financeStatus ?? "—"],
                ]}
              />
              <div className="mt-3 pt-3 border-t">
                <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1">
                  Soft requirements
                </div>
                <p className="text-[12.5px] leading-relaxed italic">
                  {c.preferences.softRequirements
                    ? `“${c.preferences.softRequirements}”`
                    : "None recorded."}
                </p>
                <ProtoNote>
                  This free text is what the similarity search reads. It catches what a
                  filter cannot express.
                </ProtoNote>
              </div>
            </Card>
          )}

          <Card>
            <CardTitle>Consent</CardTitle>
            <div className="space-y-3">
              {c.consents.map((k) => (
                <div
                  key={k.id}
                  className="text-[12.5px]"
                >
                  <div className="flex items-center gap-2">
                    {k.status === "granted" ? (
                      <ShieldCheck
                        size={13}
                        className="text-[#006300] dark:text-[#5fc45f] shrink-0"
                      />
                    ) : (
                      <ShieldAlert
                        size={13}
                        className="text-[#b02f2f] dark:text-[#f08a8a] shrink-0"
                      />
                    )}
                    <span className="font-medium uppercase text-[11px] tracking-[0.05em]">
                      {k.channel}
                    </span>
                    <Badge tone={k.status === "granted" ? "sent" : "blocked"}>
                      {k.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-3 text-[11.5px] mt-1 pl-5 space-y-0.5">
                    <div>{k.sourceForm}</div>
                    <div>{[shortDate(k.at), k.ip].filter(Boolean).join(" · ")}</div>
                    {k.viaMergedRecord && (
                      <div>
                        captured against {k.viaMergedRecord.firstName}{" "}
                        {k.viaMergedRecord.lastName}, merged into this record
                      </div>
                    )}
                  </div>
                  {k.wordingShown && k.wordingShown !== "—" && (
                    <p className="text-3 text-[11px] italic mt-1 pl-5 leading-relaxed">
                      “{k.wordingShown}”
                    </p>
                  )}
                </div>
              ))}
              {c.consents.length === 0 && <Empty>No consent recorded yet.</Empty>}
            </div>
            <ProtoNote>
              Provenance is captured at submission and can never be reconstructed
              afterwards. Without it a send cannot be defended.
            </ProtoNote>
          </Card>

          {contactTasks.length > 0 && (
            <Card>
              <CardTitle>Open tasks</CardTitle>
              <ul className="space-y-2">
                {contactTasks.map((t) => (
                  <li key={t.id} className="text-[12.5px]">
                    <div>{t.title}</div>
                    <div className="text-3 text-[11.5px]">
                      {[
                        t.dueAt ? `due ${shortDate(t.dueAt)}` : null,
                        t.source ? `from ${t.source}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
