import Link from "next/link";
import {
  Users,
  Home,
  GitCompareArrows,
  ListTodo,
  ShieldCheck,
  ArrowRight,
  Plus,
  Sparkles,
} from "lucide-react";
import { getAgency, getHomeCounts } from "@/server/queries";
import { AskButton } from "@/components/assistant/ask-button";

/**
 * The home screen: four doors, and nothing else to read.
 *
 * Each tile is one area with its own colour, a single big number, the two or three facts
 * that decide whether to go in, and one quick action that opens the assistant with the
 * request already started. The detailed view (charts, funnels, feeds) is at /insights.
 *
 * The line above the tiles appears only when approvals or confirmations are waiting.
 * Rules 1 and 5 stop every AI draft and proposed change for a person, and a queue nobody
 * sees is where the assistant's work silently stalls.
 */

type Stat = { text: string; href?: string; warn?: boolean };

function Tile({
  href,
  icon: Icon,
  color,
  title,
  blurb,
  big,
  bigLabel,
  stats,
  action,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  color: string;
  title: string;
  blurb: string;
  big: number;
  bigLabel: string;
  stats: Stat[];
  action: { label: string; prefill?: string; send?: string; icon?: "plus" | "spark" };
}) {
  const tint = (pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`;

  return (
    <div
      className="group relative rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 flex flex-col min-h-[148px] sm:min-h-[172px] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: `linear-gradient(150deg, ${tint(11)} 0%, var(--surface-2) 58%)`,
        borderColor: tint(28),
      }}
    >
      {/* The whole tile opens its page; the links and the action sit above this layer. */}
      <Link href={href} className="absolute inset-0 rounded-2xl" aria-label={`Open ${title}`} />

      {/* A large, faint mark in the corner: identity at a glance, without noise. */}
      <Icon
        size={96}
        strokeWidth={1.25}
        className="absolute -right-4 -bottom-6 pointer-events-none opacity-[0.07] transition-transform duration-300 group-hover:scale-105"
      />

      <div className="relative pointer-events-none flex items-center gap-2.5 sm:gap-3">
        <span
          className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg grid place-items-center shrink-0 text-white shadow-sm"
          style={{ background: color }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] sm:text-[16px] font-semibold leading-tight">{title}</h2>
          <p className="hidden sm:block text-2 text-[12px] mt-0.5 leading-snug truncate">{blurb}</p>
        </div>
        <ArrowRight
          size={16}
          className="text-3 shrink-0 transition-transform group-hover:translate-x-1"
          style={{ color }}
        />
      </div>

      <div className="relative pointer-events-none mt-3 flex items-baseline gap-1.5 sm:gap-2">
        <span className="text-[28px] sm:text-[34px] font-semibold tabular leading-none tracking-[-0.02em]">
          {big}
        </span>
        <span className="text-2 text-[11.5px] sm:text-[13px]">{bigLabel}</span>
      </div>

      <div className="relative pointer-events-none mt-auto pt-3 flex items-end justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5 pointer-events-none">
          {stats.map((s, i) =>
            s.href ? (
              <Link
                key={s.text}
                href={s.href}
                className={`pointer-events-auto relative z-10 text-[11.5px] rounded-full px-2 py-0.5 border hover:underline underline-offset-2 ${i > 0 ? "hidden sm:inline-block" : ""}`}
                style={
                  s.warn
                    ? { color: "#b02f2f", borderColor: "rgba(208,59,59,.4)", background: "rgba(208,59,59,.07)" }
                    : { borderColor: tint(30), background: "var(--surface-2)" }
                }
              >
                {s.text}
              </Link>
            ) : (
              <span
                key={s.text}
                className={`text-[11.5px] rounded-full px-2 py-0.5 border ${i > 0 ? "hidden sm:inline-block" : ""}`}
                style={
                  s.warn
                    ? { color: "#b02f2f", borderColor: "rgba(208,59,59,.4)", background: "rgba(208,59,59,.07)" }
                    : { borderColor: tint(30), background: "var(--surface-2)" }
                }
              >
                {s.text}
              </span>
            ),
          )}
        </div>

        <AskButton
          prefill={action.prefill}
          send={action.send}
          className="relative z-10 pointer-events-auto inline-flex items-center gap-1 rounded-md px-2.5 min-h-8 text-[12px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ background: color }}
        >
          {action.icon === "spark" ? <Sparkles size={13} /> : <Plus size={14} />}
          {action.label}
        </AskButton>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const [agency, c] = await Promise.all([getAgency(), getHomeCounts()]);
  const firstName = agency.user.name.split(" ")[0];
  const waiting = c.approvals + c.confirms;

  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-AU", { hour: "numeric", hour12: false, timeZone: "Australia/Adelaide" }).format(now),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Adelaide",
  }).format(now);

  return (
    <div className="max-w-[1120px]">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-3 text-[11.5px] uppercase tracking-[0.08em] font-medium">{today}</p>
          <h1 className="text-[21px] sm:text-[25px] font-semibold tracking-[-0.02em] mt-0.5">
            {greeting}, {firstName}
          </h1>
        </div>
        <AskButton
          send="What needs my attention today?"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 min-h-8 text-[12.5px] font-medium surface-2 hover:surface-3 transition-colors"
        >
          <Sparkles size={14} className="text-[var(--accent)]" />
          <span className="sm:hidden">What&apos;s on today?</span>
          <span className="hidden sm:inline">What needs my attention today?</span>
        </AskButton>
      </div>

      {waiting > 0 && (
        <Link
          href={c.approvals > 0 ? "/approvals" : "/confirm"}
          className="flex items-center gap-3 rounded-xl border border-[#eda100]/50 bg-[#eda100]/8 px-3.5 py-2.5 mb-3 hover:bg-[#eda100]/14 transition-colors"
        >
          <ShieldCheck size={18} className="text-[#8a5f00] dark:text-[#e8b64a] shrink-0" />
          <span className="text-[14px]">
            <b>{waiting}</b> {waiting === 1 ? "item is" : "items are"} waiting for your OK
            {c.approvals > 0 && c.confirms > 0
              ? ` (${c.approvals} to send, ${c.confirms} to confirm)`
              : c.approvals > 0
                ? " before sending"
                : " before it changes a record"}
            .
          </span>
          <ArrowRight size={16} className="ml-auto text-3 shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Tile
          href="/contacts"
          icon={Users}
          color="#2a78d6"
          title="My contacts"
          blurb="Buyers, sellers, landlords, tenants and agents"
          big={c.contacts}
          bigLabel={c.contacts === 1 ? "person" : "people"}
          stats={[
            c.followupsDue > 0
              ? { text: `${c.followupsDue} follow-up${c.followupsDue === 1 ? "" : "s"} due`, href: "/contacts", warn: true }
              : { text: "No follow-ups due" },
            { text: `${c.withPrefs} with preferences` },
          ]}
          action={{ label: "Add contact", prefill: "Add a new contact: " }}
        />
        <Tile
          href="/properties"
          icon={Home}
          color="#0f9d7a"
          title="My properties"
          blurb="Everything you manage, listed or not"
          big={c.properties}
          bigLabel={c.properties === 1 ? "property" : "properties"}
          stats={[
            { text: `${c.listed} listed`, href: "/properties?status=listed" },
            { text: `${c.offMarket} off market`, href: "/properties?status=off_market" },
            { text: "Listings", href: "/listings" },
          ]}
          action={{ label: "Add property", prefill: "Add a new property: " }}
        />
        <Tile
          href="/matching"
          icon={GitCompareArrows}
          color="#7a4fd6"
          title="Matching"
          blurb="The right buyer for each listing, with a reason"
          big={c.matches}
          bigLabel={c.matches === 1 ? "match found" : "matches found"}
          stats={[
            { text: `${c.liveListings} live listing${c.liveListings === 1 ? "" : "s"}` },
            { text: `${c.withPrefs} buyer${c.withPrefs === 1 ? "" : "s"} to match` },
          ]}
          action={{ label: "Run matching", send: "Run matching for my newest live listing", icon: "spark" }}
        />
        <Tile
          href="/tasks"
          icon={ListTodo}
          color="#d9822b"
          title="My tasks"
          blurb="Calls, follow-ups and jobs to get done"
          big={c.tasksOpen}
          bigLabel="open"
          stats={[
            c.tasksOverdue > 0
              ? { text: `${c.tasksOverdue} overdue`, href: "/tasks", warn: true }
              : { text: c.tasksOpen === 0 ? "All clear" : "Nothing overdue" },
          ]}
          action={{ label: "Add task", prefill: "Add a task: " }}
        />
      </div>
    </div>
  );
}
