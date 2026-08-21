import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ page */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6 border-b pb-4 mb-5 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-[17px] sm:text-[19px] font-semibold tracking-[-0.01em]">
          {title}
        </h1>
        {subtitle && <p className="text-2 mt-1 text-[13px] max-w-2xl">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
      )}
    </div>
  );
}

export function Section({
  title,
  hint,
  actions,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-7 min-w-0", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2.5 min-w-0">
            {title && (
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-2">
                {title}
              </h2>
            )}
            {hint && <span className="text-3 text-[12px]">{hint}</span>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ card */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-2 border rounded-lg",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[13px] font-semibold mb-2">{children}</h3>;
}

/* ------------------------------------------------------------------ stat */

export function Stat({
  label,
  value,
  sub,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  href?: string;
  tone?: "default" | "queue" | "blocked" | "ai";
}) {
  const toneRing = {
    default: "",
    queue: "ring-1 ring-[#eda100]/35",
    blocked: "ring-1 ring-[#d03b3b]/35",
    ai: "ring-1 ring-[#4a3aa7]/30",
  }[tone];

  const inner = (
    <div className={cn("surface-2 border rounded-lg p-3.5 h-full", toneRing)}>
      <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
        {label}
      </div>
      <div className="text-[26px] font-semibold leading-tight mt-1 tabular">{value}</div>
      {sub && <div className="text-3 text-[12px] mt-0.5 leading-snug">{sub}</div>}
    </div>
  );

  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/* ----------------------------------------------------------------- badge */

type BadgeTone =
  | "neutral"
  | "brand"
  | "stock"
  | "queue"
  | "ai"
  | "sent"
  | "blocked"
  | "channel";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-[var(--line-strong)] text-2",
  brand: "border-[#2a78d6]/40 text-[#1c5cab] dark:text-[#7fb3f0] bg-[#2a78d6]/8",
  stock: "border-[#1baf7a]/45 text-[#0d7a54] dark:text-[#5fd3a8] bg-[#1baf7a]/8",
  queue: "border-[#eda100]/50 text-[#8a5f00] dark:text-[#e8b64a] bg-[#eda100]/10",
  ai: "border-[#4a3aa7]/40 text-[#4a3aa7] dark:text-[#a79bf0] bg-[#4a3aa7]/8",
  sent: "border-[#008300]/40 text-[#006300] dark:text-[#5fc45f] bg-[#008300]/8",
  blocked: "border-[#d03b3b]/45 text-[#b02f2f] dark:text-[#f08a8a] bg-[#d03b3b]/8",
  channel: "border-[#d1541f]/40 text-[#a8410f] dark:text-[#f0996b] bg-[#d1541f]/8",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-[1px] text-[11px] font-medium whitespace-nowrap leading-[17px]",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- button */

export function Button({
  children,
  variant = "default",
  size = "md",
  className,
  title,
}: {
  children: React.ReactNode;
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  title?: string;
}) {
  const variants = {
    default: "surface-2 border hover:surface-3",
    primary:
      "bg-[var(--accent)] text-white border border-transparent hover:opacity-90",
    ghost: "border border-transparent hover:surface-3",
    danger:
      "surface-2 border border-[#d03b3b]/40 text-[#b02f2f] dark:text-[#f08a8a] hover:bg-[#d03b3b]/8",
  };
  return (
    <button
      type="button"
      title={title ?? "Inert in the prototype — no backend is wired up"}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors cursor-default",
        size === "sm"
          ? "text-[12px] px-2.5 min-h-8"
          : "text-[13px] px-3 min-h-9",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- table */

export function Table({
  children,
  minWidth = 640,
}: {
  children: React.ReactNode;
  /** Floor in px before the card scrolls. Raise it for wide tables. */
  minWidth?: number;
}) {
  return (
    <div className="surface-2 border rounded-lg overflow-hidden min-w-0">
      <div className="overflow-x-auto">
        <table
          className="w-full text-[13px] border-collapse"
          style={{ minWidth }}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="surface-3 text-3 text-[11px] uppercase tracking-[0.05em]">
      {children}
    </thead>
  );
}

export function TH({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "text-left font-medium px-3 py-2 border-b whitespace-nowrap",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  nowrap,
}: {
  children?: React.ReactNode;
  className?: string;
  /** For identity columns - an address must not break as "11 Berry / Fry / Avenue". */
  nowrap?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 border-b align-top",
        nowrap && "whitespace-nowrap",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function TR({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("hover:surface-3 transition-colors", className)}>{children}</tr>
  );
}

/* ------------------------------------------------------------ misc bits */

export function KeyValue({
  items,
  cols = 2,
}: {
  items: [string, React.ReactNode][];
  cols?: 1 | 2 | 3;
}) {
  return (
    <dl
      className={cn(
        "@container grid gap-x-6 gap-y-2.5",
        cols === 1 && "grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3",
        cols === 2 && "grid-cols-1 @sm:grid-cols-2",
        cols === 3 && "grid-cols-2 @sm:grid-cols-3",
      )}
    >
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium">
            {k}
          </dt>
          <dd className="text-[13px] mt-0.5 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Callout({
  tone = "queue",
  title,
  children,
}: {
  tone?: "queue" | "blocked" | "ai" | "brand";
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    queue: "border-[#eda100]/45 bg-[#eda100]/8",
    blocked: "border-[#d03b3b]/45 bg-[#d03b3b]/8",
    ai: "border-[#4a3aa7]/35 bg-[#4a3aa7]/6",
    brand: "border-[#2a78d6]/35 bg-[#2a78d6]/6",
  };
  return (
    <div className={cn("border rounded-lg p-3 text-[12.5px]", tones[tone])}>
      <div className="font-semibold mb-0.5">{title}</div>
      <div className="text-2 leading-relaxed">{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-2 border border-dashed rounded-lg p-8 text-center text-3 text-[13px]">
      {children}
    </div>
  );
}

export function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full surface-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="tabular text-3 text-[12px]">{value.toFixed(2)}</span>
    </div>
  );
}

export function ProtoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-3 text-[11.5px] italic mt-2 leading-relaxed">{children}</p>
  );
}
