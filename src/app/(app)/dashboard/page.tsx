import Link from "next/link";
import { Users, Home, GitCompareArrows, ListTodo, ShieldCheck, ArrowRight } from "lucide-react";
import { getAgency, getHomeCounts } from "@/server/queries";

/**
 * The home screen: four doors, and nothing else to read.
 *
 * The detailed view that used to live here (charts, funnels, feeds) is at /insights,
 * under Advanced. This page answers one question, "where do I go next", and each tile
 * carries only the number that makes the choice.
 *
 * The one line that can appear above the tiles is the approval and confirm queues.
 * Rules 1 and 5 route every AI draft and every AI-proposed change through a person;
 * a queue nobody sees is a queue where the assistant's work silently stalls.
 */

function Tile({
  href,
  icon: Icon,
  title,
  big,
  lines,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  big: string | number;
  lines: { text: string; href?: string; tone?: "warn" }[];
}) {
  return (
    <div className="group relative surface-2 border rounded-xl p-5 sm:p-6 flex flex-col min-h-[180px] transition-colors hover:border-[var(--accent)]">
      {/* The whole tile is the link; the sub-links sit above it so they stay clickable. */}
      <Link href={href} className="absolute inset-0 rounded-xl" aria-label={title} />
      <div className="flex items-center gap-3">
        <span className="h-11 w-11 rounded-lg accent-soft text-[var(--accent)] grid place-items-center shrink-0">
          <Icon size={22} />
        </span>
        <h2 className="text-[18px] font-semibold">{title}</h2>
        <ArrowRight
          size={18}
          className="ml-auto text-3 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
        />
      </div>
      <div className="text-[40px] font-semibold tabular leading-none mt-5">{big}</div>
      <div className="mt-auto pt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {lines.map((l) =>
          l.href ? (
            <Link
              key={l.text}
              href={l.href}
              className={`relative z-10 hover:underline underline-offset-2 ${l.tone === "warn" ? "text-[#b02f2f] dark:text-[#f08a8a] font-medium" : "text-2"}`}
            >
              {l.text}
            </Link>
          ) : (
            <span
              key={l.text}
              className={l.tone === "warn" ? "text-[#b02f2f] dark:text-[#f08a8a] font-medium" : "text-2"}
            >
              {l.text}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const [agency, c] = await Promise.all([getAgency(), getHomeCounts()]);
  const firstName = agency.user.name.split(" ")[0];
  const waiting = c.approvals + c.confirms;

  const hour = Number(
    new Intl.DateTimeFormat("en-AU", { hour: "numeric", hour12: false, timeZone: "Australia/Adelaide" }).format(new Date()),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-[1100px]">
      <h1 className="text-[24px] sm:text-[28px] font-semibold mt-1">
        {greeting}, {firstName}
      </h1>
      <p className="text-2 text-[14px] mt-1 mb-6">
        Where to next?
      </p>

      {waiting > 0 && (
        <Link
          href={c.approvals > 0 ? "/approvals" : "/confirm"}
          className="flex items-center gap-3 rounded-xl border border-[#eda100]/50 bg-[#eda100]/8 px-4 py-3 mb-5 hover:bg-[#eda100]/14 transition-colors"
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

      <div className="grid sm:grid-cols-2 gap-4">
        <Tile
          href="/contacts"
          icon={Users}
          title="My contacts"
          big={c.contacts}
          lines={[
            c.followupsDue > 0
              ? { text: `${c.followupsDue} follow-up${c.followupsDue === 1 ? "" : "s"} due`, tone: "warn" }
              : { text: "No follow-ups due" },
          ]}
        />
        <Tile
          href="/properties"
          icon={Home}
          title="My properties"
          big={c.properties}
          lines={[
            { text: `${c.listed} listed`, href: "/properties?status=listed" },
            { text: `${c.offMarket} off market`, href: "/properties?status=off_market" },
            { text: "Listings", href: "/listings" },
          ]}
        />
        <Tile
          href="/matching"
          icon={GitCompareArrows}
          title="Matching"
          big="Match"
          lines={[{ text: "The right buyer for a property, or the right property for a buyer" }]}
        />
        <Tile
          href="/tasks"
          icon={ListTodo}
          title="My tasks"
          big={c.tasksOpen}
          lines={[
            c.tasksOverdue > 0
              ? { text: `${c.tasksOverdue} overdue`, tone: "warn" }
              : { text: c.tasksOpen === 0 ? "All clear" : "Nothing overdue" },
          ]}
        />
      </div>
    </div>
  );
}
