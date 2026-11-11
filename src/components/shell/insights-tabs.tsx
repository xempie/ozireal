"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileSpreadsheet, TrendingUp } from "lucide-react";

/**
 * Insights holds three different features under one menu item (2026-11-11). Each keeps
 * its own address and its own job; the tabs say what each is for so they never blur.
 */
const TABS = [
  { href: "/insights", label: "Performance", note: "How the business is doing", icon: BarChart3 },
  { href: "/reports", label: "Reports", note: "Activity counts and exports", icon: FileSpreadsheet },
  { href: "/seo", label: "SEO", note: "Website search health", icon: TrendingUp },
] as const;

export const INSIGHTS_PATHS = TABS.map((t) => t.href);

export function InsightsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Insights" className="mb-5 -mt-1 overflow-x-auto">
      <div className="grid grid-cols-3 gap-2 min-w-[420px]">
        {TABS.map((t) => {
          const on = pathname === t.href || pathname.startsWith(t.href + "/");
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                on ? "border-2 border-[var(--accent)] bg-[var(--accent)]/[0.06]" : "border surface-2 hover:surface-3"
              }`}
            >
              <Icon size={18} className={on ? "text-[var(--accent)] shrink-0" : "text-2 shrink-0"} />
              <span className="min-w-0">
                <span className={`block text-[13.5px] font-semibold ${on ? "text-[var(--accent)]" : ""}`}>{t.label}</span>
                <span className="block text-[11.5px] text-2 truncate">{t.note}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
