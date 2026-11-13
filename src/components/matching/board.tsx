"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Star,
  X,
  Mail,
  Phone,
  CheckCircle2,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Send,
  Pencil,
  Trash2,
  RotateCcw,
  Home,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { BoardProperty, BoardPerson, BoardDraft } from "@/server/queries/match-board";
import { startMatchEmails, redraftMatchEmails, findAudienceFor, aiRewriteDraft } from "@/server/actions/match-emails";
import { approveAndSend, editDraft, rejectDraft } from "@/server/actions/approvals";
import { createTask } from "@/server/actions/ops";
import { RunMatchingButton } from "@/components/forms/run-matching";

/**
 * The Matching board (2026-11-12). Three layers, each answering one question:
 *   1. Board: which property is worth acting on today? (cards, best first; pins on top)
 *   2. Focus: which of its people, and how? (ready to email / worth a call / contacted / weak)
 *   3. Review: are these emails right? (each draft readable and editable; approve all)
 * Nothing is sent without the agent pressing Approve, and the server re-checks consent
 * for each email at the instant it goes (rules 1 and 2).
 */

const PIN_KEY = "ozi-match-pins";
const dayFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Adelaide" });

function usePins() {
  const [pins, setPins] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      setPins(JSON.parse(window.localStorage.getItem(PIN_KEY) ?? "[]"));
    } catch {
      /* storage blocked: pins just do not persist */
    }
  }, []);
  const toggle = (id: string) =>
    setPins((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem(PIN_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return { pins, toggle };
}

function Photo({ p, className }: { p: BoardProperty; className?: string }) {
  return p.listing?.photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- public listing photo via /media
    <img src={`/media/${p.listing.photo}`} alt="" className={`object-cover ${className}`} />
  ) : (
    <div className={`grid place-items-center surface-3 text-3 ${className}`}>
      <Home size={22} />
    </div>
  );
}

const specs = (p: BoardProperty) =>
  [p.beds != null && `${p.beds} bed`, p.baths != null && `${p.baths} bath`, p.parking != null && `${p.parking} car`].filter(Boolean).join(" · ");

export function MatchBoard({
  properties,
  cold,
  focusedId,
}: {
  properties: BoardProperty[];
  cold: { contactId: string; name: string; best: string; days: number | null }[];
  focusedId: string | null;
}) {
  const [q, setQ] = React.useState("");
  const { pins, toggle } = usePins();
  const focused = focusedId ? properties.find((p) => p.id === focusedId) : null;

  if (focused) return <Focus p={focused} pinned={pins.includes(focused.id)} onPin={() => toggle(focused.id)} />;

  const needle = q.trim().toLowerCase();
  const shown = properties
    .filter((p) => !needle || `${p.label} ${p.suburb ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)));
  const totalReady = properties.reduce((n, p) => n + p.counts.ready, 0);
  const withWork = properties.filter((p) => p.counts.ready > 0).length;

  return (
    <div className="grid xl:grid-cols-[1fr_300px] gap-5 items-start">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a property to work on…"
              aria-label="Find a property"
              className="w-full surface-2 border rounded-lg pl-9 pr-3 py-2 text-[16px] sm:text-[13.5px]"
            />
          </div>
          <p className="text-[13px] text-2">
            <strong className="text-[var(--text)]">{totalReady}</strong> people ready to email across{" "}
            <strong className="text-[var(--text)]">{withWork}</strong> {withWork === 1 ? "property" : "properties"}
          </p>
        </div>

        {shown.length === 0 && (
          <div className="surface-2 border rounded-xl p-8 text-center text-2 text-[13.5px]">
            {properties.length === 0 ? "No properties being worked yet. Add one under My properties." : "No property matches that search."}
          </div>
        )}

        <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          {shown.map((p) => {
            const pinned = pins.includes(p.id);
            const pending = p.batch?.drafts.filter((d) => d.status === "pending" || d.status === "drafting").length ?? 0;
            return (
              <article
                key={p.id}
                className={`surface-2 border rounded-xl overflow-hidden flex flex-col ${pinned ? "ring-2 ring-[#F2B705]" : ""}`}
              >
                <Link href={`/matching?focus=${p.id}`} className="relative block">
                  <Photo p={p} className="w-full aspect-[16/9]" />
                  {p.listing?.priceDisplay && (
                    <span className="absolute left-2 bottom-2 rounded-md bg-[#13254A]/85 text-white text-[12px] px-2 py-0.5">
                      {p.listing.priceDisplay}
                    </span>
                  )}
                </Link>
                <div className="p-3.5 flex-1 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <Link href={`/matching?focus=${p.id}`} className="min-w-0 flex-1">
                      <div className="font-semibold text-[14.5px] truncate">{p.label}</div>
                      <div className="text-2 text-[12.5px] truncate">
                        {[p.suburb, specs(p)].filter(Boolean).join(" · ")}
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      aria-label={pinned ? "Unpin" : "Pin to the top"}
                      title={pinned ? "Unpin" : "Pin to the top"}
                      className="p-1 rounded hover:surface-3"
                    >
                      <Star size={16} className={pinned ? "fill-[#F2B705] text-[#F2B705]" : "text-3"} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <Stat n={p.counts.ready} label="ready to email" tone="go" />
                    <Stat n={p.counts.call} label="worth a call" />
                    <Stat n={p.counts.contacted} label="contacted" />
                  </div>
                  <p className="text-[12px] text-2">
                    {p.counts.strong} strong · {p.counts.good} good match{p.counts.good === 1 ? "" : "es"}
                    {pending > 0 && <span className="text-[#8A4B00] font-medium"> · {pending} draft{pending === 1 ? "" : "s"} to review</span>}
                  </p>
                  <Link
                    href={`/matching?focus=${p.id}`}
                    className={`mt-auto text-center rounded-lg min-h-9 py-2 text-[13px] font-semibold ${
                      p.counts.ready > 0 || pending > 0 ? "bg-[var(--accent)] text-white" : "surface-3 border"
                    }`}
                  >
                    {pending > 0 ? "Review drafts" : p.counts.ready > 0 ? `Email ${p.counts.ready} matched` : "Find people with AI"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="surface-2 border rounded-xl p-4 space-y-2 xl:sticky xl:top-4">
        <h2 className="text-[14px] font-semibold">Going cold</h2>
        <p className="text-2 text-[12px]">Good matches you have not emailed, and not heard from in 30+ days.</p>
        {cold.length === 0 ? (
          <p className="text-3 text-[12.5px]">Nobody is going cold.</p>
        ) : (
          <ul className="divide-y text-[13px]">
            {cold.map((c) => (
              <li key={c.contactId} className="py-2">
                <Link href={`/contacts/${c.contactId}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
                <div className="text-2 text-[12px]">
                  Matches {c.best} · {c.days == null ? "never contacted" : `${c.days} days quiet`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "go" }) {
  return (
    <div className={`rounded-lg py-1.5 ${tone === "go" && n > 0 ? "bg-[#E8F6EE] text-[#1B6B3F]" : "surface-3"}`}>
      <div className="text-[18px] font-bold leading-tight">{n}</div>
      <div className="text-[10.5px] leading-tight opacity-80">{label}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- focus */

function Focus({ p, pinned, onPin }: { p: BoardProperty; pinned: boolean; onPin: () => void }) {
  const router = useRouter();
  const ready = p.people.filter((x) => x.group === "ready");
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set(ready.map((x) => x.contactId)));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showWeak, setShowWeak] = React.useState(false);

  const batch = p.batch;
  const active = batch && batch.drafts.some((d) => d.status === "drafting" || d.status === "pending" || d.status === "failed");

  // While drafts are being written, refresh until they land.
  const drafting = batch?.drafts.some((d) => d.status === "drafting");
  const searching = p.audience?.status === "queued" || p.audience?.status === "running";
  React.useEffect(() => {
    if (!drafting && !searching) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [drafting, searching, router]);

  const [finding, setFinding] = React.useState(false);
  async function find() {
    setFinding(true);
    setError(null);
    try {
      const r = await findAudienceFor({ propertyId: p.id });
      if (!r.ok) setError(r.error);
      router.refresh();
    } catch {
      setError("Could not reach the server. Reload the page and try again.");
    } finally {
      setFinding(false);
    }
  }

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const r = await startMatchEmails({ propertyId: p.id, contactIds: [...picked] });
      if (!r.ok) setError(r.error);
      else router.refresh();
    } catch {
      setError("Could not reach the server. Reload the page and try again.");
    } finally {
      setBusy(false);
    }
  }

  const groups: { key: BoardPerson["group"]; title: string; note: string }[] = [
    { key: "ready", title: "Ready to email", note: "Good match, email consent given, not yet emailed about this property." },
    { key: "recent", title: "Emailed this week", note: "Good fit, but they had an email from you in the last 7 days (or one is waiting). Held back so you never over-send." },
    { key: "call", title: "Worth a call", note: "Good match but no email consent (or no email). A call or a task instead." },
    { key: "contacted", title: "Already contacted", note: "Emailed about this property before." },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Link href="/matching" className="inline-flex items-center gap-1 rounded-md surface-2 border px-2.5 min-h-8 hover:surface-3">
          <X size={14} /> Back to the board
        </Link>
        <button type="button" onClick={onPin} className="inline-flex items-center gap-1 rounded-md surface-2 border px-2.5 min-h-8 hover:surface-3">
          <Star size={14} className={pinned ? "fill-[#F2B705] text-[#F2B705]" : ""} /> {pinned ? "Pinned" : "Pin"}
        </button>
        <Link href={`/properties/${p.id}`} className="rounded-md surface-2 border px-2.5 min-h-8 inline-flex items-center hover:surface-3">
          Open the property
        </Link>
        <span className="ml-auto">
          <RunMatchingButton propertyId={p.id} label="Preference match" />
        </span>
      </div>

      <div className="surface-2 border rounded-xl overflow-hidden grid sm:grid-cols-[220px_1fr]">
        <Photo p={p} className="w-full h-full min-h-[130px] aspect-[16/10] sm:aspect-auto" />
        <div className="p-4">
          <h2 className="text-[19px] font-semibold">{p.label}</h2>
          <p className="text-2 text-[13px]">{[p.suburb, specs(p), p.listing?.priceDisplay].filter(Boolean).join(" · ")}</p>
          {!p.listing?.priceDisplay && (
            <p className="text-[12.5px] text-[#8A4B00] mt-1">No price wording on this property yet; the emails will not mention price.</p>
          )}
          {p.listing && p.listing.status !== "live" && p.listing.status !== "under_offer" && (
            <p className="text-[12.5px] text-[#8A4B00] mt-1">
              Not on the website yet, so the emails show no photo and link to {p.section === "new_homes" ? "your New Homes page" : p.listing?.type === "rent" ? "your rentals page" : "your buyer\u2019s agent page"} instead.
            </p>
          )}
          <div className="flex gap-4 mt-2 text-[13px]">
            <span><strong>{p.counts.ready}</strong> ready</span>
            <span><strong>{p.counts.call}</strong> worth a call</span>
            <span><strong>{p.counts.contacted}</strong> contacted</span>
            <span className="text-2">{p.counts.weak} weak</span>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-[var(--accent)]/35 bg-[var(--accent)]/[0.04] p-4 flex flex-wrap items-center gap-3">
        <span className="h-9 w-9 rounded-full bg-[var(--accent)] text-white grid place-items-center shrink-0">
          <Sparkles size={17} />
        </span>
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-[14.5px] font-semibold">Find the right people with AI</h3>
          <p className="text-[12.5px] text-2">
            {searching ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={13} className="animate-spin" /> Reading every client&rsquo;s enquiries, tags and history… about a minute.
              </span>
            ) : p.audience?.status === "done" ? (
              <>
                Read {p.audience.considered} clients and picked {p.audience.picked}, each with a specific reason. Run again any time.
              </>
            ) : p.audience?.status === "failed" ? (
              <span className="text-[#b02f2f]">The last search failed: {p.audience.error}</span>
            ) : (
              <>
                Reads every client you can email (their enquiries in their own words, roles, tags, where they live) and picks who this
                property genuinely suits. Estate agents and developers are left out.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={find}
          disabled={finding || searching}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-white text-[13.5px] font-semibold px-4 min-h-10 disabled:opacity-50"
        >
          {finding || searching ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {p.audience?.status === "done" ? "Find again" : "Find people"}
        </button>
      </section>

      {batch && active ? (
        <Review p={p} batch={batch} />
      ) : (
        <>
          {groups.map((g) => {
            const people = p.people.filter((x) => x.group === g.key);
            if (!people.length) return null;
            return (
              <section key={g.key} className="surface-2 border rounded-xl">
                <header className="px-4 py-3 border-b flex items-center gap-3">
                  <div className="flex-1">
                    <h3 className="text-[14px] font-semibold">
                      {g.title} <span className="text-2 font-normal">{people.length}</span>
                    </h3>
                    <p className="text-2 text-[12px]">{g.note}</p>
                  </div>
                  {g.key === "ready" && (
                    <button
                      type="button"
                      className="text-[12.5px] underline text-2"
                      onClick={() =>
                        setPicked((prev) =>
                          people.every((x) => prev.has(x.contactId)) ? new Set() : new Set(people.map((x) => x.contactId)),
                        )
                      }
                    >
                      {people.every((x) => picked.has(x.contactId)) ? "Untick all" : "Tick all"}
                    </button>
                  )}
                </header>
                <ul className="divide-y">
                  {people.map((x) => (
                    <PersonRow
                      key={x.contactId}
                      x={x}
                      propertyLabel={p.label}
                      picked={picked.has(x.contactId)}
                      onPick={
                        g.key === "ready"
                          ? () =>
                              setPicked((prev) => {
                                const n = new Set(prev);
                                if (n.has(x.contactId)) n.delete(x.contactId);
                                else n.add(x.contactId);
                                return n;
                              })
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          {p.counts.weak > 0 && (
            <section className="surface-2 border rounded-xl">
              <button type="button" onClick={() => setShowWeak((v) => !v)} className="w-full px-4 py-3 flex items-center gap-2 text-left">
                <ChevronDown size={16} className={showWeak ? "rotate-180 transition" : "transition"} />
                <span className="text-[14px] font-semibold">Weak matches</span>
                <span className="text-2 text-[13px]">{p.counts.weak}</span>
              </button>
              {showWeak && (
                <ul className="divide-y border-t">
                  {p.people
                    .filter((x) => x.group === "weak")
                    .map((x) => (
                      <PersonRow key={x.contactId} x={x} propertyLabel={p.label} />
                    ))}
                </ul>
              )}
            </section>
          )}

          {p.people.length === 0 && (
            <div className="surface-2 border rounded-xl p-6 text-center text-2 text-[13.5px]">
              Nobody picked for this property yet. Press <strong>Find people</strong> above.
            </div>
          )}

          {ready.length > 0 && (
            <div className="sticky bottom-3 z-10 surface-2 border rounded-xl shadow-lg p-3 flex flex-wrap items-center gap-3">
              <p className="text-[13px] flex-1 min-w-[200px]">
                <strong>{picked.size}</strong> ticked. The AI writes each a personal email from what they want. You review them
                before anything is sent.
              </p>
              {error && <p role="alert" className="text-[12.5px] text-[#b02f2f] w-full">{error}</p>}
              <button
                type="button"
                disabled={!picked.size || busy}
                onClick={start}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-white text-[14px] font-semibold px-4 min-h-10 disabled:opacity-50"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                Draft {picked.size || ""} personal email{picked.size === 1 ? "" : "s"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PersonRow({
  x,
  propertyLabel,
  picked,
  onPick,
}: {
  x: BoardPerson;
  propertyLabel: string;
  picked?: boolean;
  onPick?: () => void;
}) {
  const [taskState, setTaskState] = React.useState<"idle" | "busy" | "done">("idle");
  const why =
    x.group === "call"
      ? x.doNotContact
        ? "Do not contact"
        : !x.hasEmail
          ? "No email address"
          : x.consent === "revoked"
            ? "Unsubscribed from email"
            : "No email consent recorded"
      : null;

  async function addCallTask() {
    setTaskState("busy");
        const r = await createTask({ title: `Call ${x.name} about ${propertyLabel}`, contactId: x.contactId, dueInDays: 1 }).catch(() => null);
    setTaskState(r && (r as { ok: boolean }).ok ? "done" : "idle");
  }

  return (
    <li className="px-4 py-2.5 flex items-start gap-3">
      {onPick ? (
        <input type="checkbox" checked={!!picked} onChange={onPick} className="mt-1 h-4 w-4 accent-[var(--accent)]" aria-label={`Email ${x.name}`} />
      ) : (
        <span className="w-4" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <Link href={`/contacts/${x.contactId}`} className="font-medium text-[13.5px] hover:underline">
            {x.name}
          </Link>
          <span
            className={`text-[11px] rounded-full px-1.5 ${
              x.score >= 0.8 ? "bg-[#E8F6EE] text-[#1B6B3F]" : x.score >= 0.55 ? "bg-[#EEF3FF] text-[#0034C8]" : "surface-3 text-2"
            }`}
          >
            {x.score >= 0.8 ? "Strong" : x.score >= 0.55 ? "Good" : "Weak"} {Math.round(x.score * 100)}
          </span>
          {why && <span className="text-[11.5px] text-[#8A4B00]">{why}</span>}
          {x.contactedAt && <span className="text-[11.5px] text-2">emailed {dayFmt.format(x.contactedAt)}</span>}
        </div>
        <p className="text-2 text-[12.5px] leading-snug">{x.reason}</p>
        <p className="text-3 text-[11.5px] mt-0.5 flex flex-wrap gap-x-2.5">
          {x.email && <span>{x.email}</span>}
          {x.phone && <span>{x.phone}</span>}
          {[...x.roles, ...x.tags].slice(0, 5).map((t) => (
            <span key={t} className="rounded surface-3 px-1">{t}</span>
          ))}
          {x.recentAt && <span className="text-[#8A4B00]">emailed {dayFmt.format(x.recentAt)}</span>}
        </p>
      </div>
      {x.group === "call" && (
        <div className="flex gap-1 shrink-0">
          {x.phone && (
            <a href={`tel:${x.phone}`} className="p-2 rounded-md surface-3 border" aria-label={`Call ${x.name}`}>
              <Phone size={14} />
            </a>
          )}
          <button
            type="button"
            onClick={addCallTask}
            disabled={taskState !== "idle"}
            className="text-[12px] rounded-md surface-3 border px-2 min-h-8 disabled:opacity-60"
          >
            {taskState === "done" ? "Task added" : taskState === "busy" ? "Adding…" : "Call task"}
          </button>
        </div>
      )}
    </li>
  );
}

/* ---------------------------------------------------------------- review */

function Review({ p, batch }: { p: BoardProperty; batch: NonNullable<BoardProperty["batch"]> }) {
  const router = useRouter();
  const [sending, setSending] = React.useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = React.useState<Record<string, string>>({});
  const [openId, setOpenId] = React.useState<string | null>(null);

  const drafts = [...batch.drafts].sort(
    (a, b) => Number(!!b.reviewNote) - Number(!!a.reviewNote) || a.name.localeCompare(b.name),
  );
  const pending = drafts.filter((d) => d.status === "pending" && d.itemId);
  const drafting = drafts.filter((d) => d.status === "drafting").length;
  const flagged = pending.filter((d) => d.reviewNote).length;
  const failed = drafts.filter((d) => d.status === "failed").length;

  const [allInstr, setAllInstr] = React.useState("");
  const [rewriting, setRewriting] = React.useState<{ done: number; total: number } | null>(null);
  async function rewriteAll() {
    const t = allInstr.trim();
    if (!t) return;
    const list = pending.filter((d) => !results[d.itemId!]);
    setRewriting({ done: 0, total: list.length });
    for (const [i, d] of list.entries()) {
      await aiRewriteDraft({ id: d.itemId!, instruction: t }).catch(() => null);
      setRewriting({ done: i + 1, total: list.length });
    }
    setRewriting(null);
    setAllInstr("");
    router.refresh();
  }

  async function approveAll() {
    const list = pending.filter((d) => !results[d.itemId!]);
    setSending({ done: 0, total: list.length });
    const out: Record<string, string> = {};
    for (const [i, d] of list.entries()) {
      try {
        const r = await approveAndSend({ id: d.itemId! });
        out[d.itemId!] = !r.ok ? `Not sent: ${r.error}` : r.data.blocked ? `Blocked: ${r.data.reason}` : "Sent";
      } catch {
        out[d.itemId!] = "Not sent: could not reach the server";
      }
      setResults((prev) => ({ ...prev, ...out }));
      setSending({ done: i + 1, total: list.length });
    }
    setSending(null);
    router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="surface-2 border rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-[15px] font-semibold">Review the emails</h3>
          <p className="text-2 text-[12.5px]">
            {drafting > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={13} className="animate-spin" /> Writing {drafting} more…
              </span>
            ) : (
              <>
                {pending.length} ready to send
                {flagged > 0 && <span className="text-[#8A4B00]"> · {flagged} flagged to check (at the top)</span>}
                {failed > 0 && <span className="text-[#b02f2f]"> · {failed} could not be drafted</span>}
              </>
            )}
            . Open two or three to check the tone, then approve them all. Consent is checked again as each one is sent.
          </p>
        </div>
        {failed > 0 && (
          <RedraftButton campaignId={batch.campaignId} />
        )}
        <button
          type="button"
          onClick={approveAll}
          disabled={!pending.length || !!sending || drafting > 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-white text-[14px] font-semibold px-4 min-h-10 disabled:opacity-50"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {sending ? `Sending ${sending.done}/${sending.total}…` : `Approve & send ${pending.length}`}
        </button>
      </div>

      {pending.length > 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void rewriteAll();
          }}
          className="surface-2 border rounded-xl p-3 flex flex-wrap items-center gap-2"
        >
          <Wand2 size={16} className="text-[var(--accent)]" />
          <input
            value={allInstr}
            onChange={(e) => setAllInstr(e.target.value)}
            placeholder="Change all emails with AI, e.g. shorter, more casual, mention the stamp duty waiver…"
            aria-label="Change all emails with AI"
            className="flex-1 min-w-[220px] surface-3 border rounded-md px-2.5 py-1.5 text-[16px] sm:text-[13px]"
          />
          <button
            type="submit"
            disabled={!allInstr.trim() || !!rewriting || !!sending}
            className="rounded-md bg-[#13254A] text-white text-[13px] px-3 min-h-9 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {rewriting ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            {rewriting ? `Rewriting ${rewriting.done}/${rewriting.total}…` : `Apply to all ${pending.length}`}
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {drafts.map((d) => (
          <DraftCard
            key={d.recipientId}
            d={d}
            result={d.itemId ? results[d.itemId] : undefined}
            open={openId === d.recipientId}
            onToggle={() => setOpenId((v) => (v === d.recipientId ? null : d.recipientId))}
            propertyLabel={p.label}
          />
        ))}
      </ul>
    </section>
  );
}

function RedraftButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await redraftMatchEmails({ campaignId }).catch(() => null);
        setBusy(false);
        router.refresh();
      }}
      className="inline-flex items-center gap-1 rounded-lg surface-3 border text-[13px] px-3 min-h-10"
    >
      <RotateCcw size={14} /> Draft the failed ones again
    </button>
  );
}

function DraftCard({
  d,
  result,
  open,
  onToggle,
  propertyLabel,
}: {
  d: BoardDraft;
  result?: string;
  open: boolean;
  onToggle: () => void;
  propertyLabel: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [subject, setSubject] = React.useState(d.subject ?? "");
  const [body, setBody] = React.useState(d.body ?? "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const state =
    result ??
    (d.status === "sent"
      ? "Sent"
      : d.status === "blocked"
        ? `Blocked: ${d.note ?? "consent"}`
        : d.status === "rejected"
          ? "Removed"
          : d.status === "failed"
            ? `Not drafted: ${d.note ?? ""}`
            : null);

  async function save() {
    if (!d.itemId) return;
    setBusy(true);
    const r = await editDraft({ id: d.itemId, subject, body }).catch(() => null);
    setBusy(false);
    if (r && r.ok) {
      setEditing(false);
      router.refresh();
    } else setErr(r && !r.ok ? r.error : "Could not save.");
  }
  async function remove() {
    if (!d.itemId) return;
    setBusy(true);
    await rejectDraft({ id: d.itemId, reason: `Removed from the ${propertyLabel} batch` }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  return (
    <li className={`surface-2 border rounded-xl ${d.reviewNote && d.status === "pending" ? "border-[#F3D9A8]" : ""}`}>
      <button type="button" onClick={onToggle} className="w-full text-left px-4 py-3 flex items-center gap-3" disabled={d.status === "drafting"}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-[13.5px]">{d.name}</strong>
            {d.status === "drafting" && (
              <span className="text-2 text-[12px] inline-flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> writing…
              </span>
            )}
            {d.reviewNote && d.status === "pending" && !result && (
              <span className="inline-flex items-center gap-1 text-[11.5px] rounded-full bg-[#FFF4E5] text-[#8A4B00] px-2 py-0.5">
                <AlertTriangle size={11} /> {d.reviewNote}
              </span>
            )}
            {state && (
              <span
                className={`text-[11.5px] rounded-full px-2 py-0.5 ${
                  state === "Sent" ? "bg-[#E8F6EE] text-[#1B6B3F]" : "bg-[#FDECEA] text-[#A12A12]"
                }`}
              >
                {state === "Sent" && <CheckCircle2 size={11} className="inline mr-0.5" />}
                {state}
              </span>
            )}
          </div>
          <div className="text-3 text-[11.5px] flex flex-wrap gap-x-2.5">
            {d.email && <span>{d.email}</span>}
            {d.phone && <span>{d.phone}</span>}
          </div>
          {d.subject && <div className="text-2 text-[12.5px] truncate">{d.subject}</div>}
        </div>
        {d.status !== "drafting" && <ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} />}
      </button>
      {open && d.body && (
        <div className="px-4 pb-4 border-t pt-3 space-y-2">
          {editing ? (
            <>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-label="Subject"
                className="w-full surface-3 border rounded-md px-2.5 py-1.5 text-[16px] sm:text-[13.5px]"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={9}
                aria-label="Email"
                className="w-full surface-3 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px] leading-relaxed"
              />
              {err && <p className="text-[12.5px] text-[#b02f2f]">{err}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={save} disabled={busy} className="rounded-md bg-[var(--accent)] text-white text-[13px] px-3 min-h-8">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-md surface-3 border text-[13px] px-3 min-h-8">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {d.why && (
                <p className="text-[12px] rounded-md surface-3 px-2.5 py-1.5">
                  <strong>Why them:</strong> {d.why.replace(/\s*\[Opening:.*\]$/, "")}
                </p>
              )}
              <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{d.body}</div>
              <p className="text-3 text-[11.5px]">
                Then: the property photo, price and a &ldquo;View the property&rdquo; button, your signature, and the
                unsubscribe link.
              </p>
              {d.status === "pending" && !result && (
                <div className="flex flex-wrap gap-2">
                  <AiEdit itemId={d.itemId!} />
                  <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-md surface-3 border text-[12.5px] px-2.5 min-h-8">
                    <Pencil size={12} /> Edit by hand
                  </button>
                  <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1 rounded-md surface-3 border text-[12.5px] px-2.5 min-h-8 text-[#A12A12]">
                    <Trash2 size={12} /> Don&rsquo;t send this one
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** Change one email with AI: type how, it rewrites with the same facts and rules. */
function AiEdit({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md bg-[#13254A] text-white text-[12.5px] px-2.5 min-h-8"
      >
        <Wand2 size={12} /> Edit with AI
      </button>
    );
  return (
    <form
      className="basis-full flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        setErr(null);
        const r = await aiRewriteDraft({ id: itemId, instruction: text.trim() }).catch(() => null);
        setBusy(false);
        if (r && r.ok) {
          setOpen(false);
          setText("");
          router.refresh();
        } else setErr(r && !r.ok ? r.error : "Could not reach the server.");
      }}
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. shorter, warmer, mention the $15K grant, ask about an inspection Saturday"
        aria-label="How should the AI change this email?"
        className="flex-1 min-w-[200px] surface-3 border rounded-md px-2.5 py-1.5 text-[16px] sm:text-[13px]"
      />
      <button type="submit" disabled={busy || !text.trim()} className="rounded-md bg-[#13254A] text-white text-[12.5px] px-3 min-h-8 disabled:opacity-50 inline-flex items-center gap-1">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} {busy ? "Rewriting…" : "Rewrite"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-md surface-3 border text-[12.5px] px-2.5 min-h-8">
        Cancel
      </button>
      {err && <p className="basis-full text-[12px] text-[#b02f2f]">{err}</p>}
    </form>
  );
}
