"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Home,
  Tags,
  GitCompareArrows,
  ShieldCheck,
  CheckCheck,
  ListTodo,
  Scale,
  Receipt,
  Settings,
  Search,
  Send,
  CalendarDays,
  Mic,
  FileText,
  Newspaper,
  TrendingUp,
  Globe,
  BarChart3,
  ScrollText,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { counts, agency, contacts, listings, listingAddress } from "@/lib/sample-data";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
  badgeTone?: "queue" | "plain";
};

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Today",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/tasks", label: "Tasks", icon: ListTodo, badge: counts.tasksOpen, badgeTone: "plain" },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/voice", label: "Voice notes", icon: Mic },
    ],
  },
  {
    label: "Stock",
    items: [
      { href: "/properties", label: "Properties", icon: Home },
      { href: "/listings", label: "Listings", icon: Tags },
      { href: "/matching", label: "Matching", icon: GitCompareArrows },
      { href: "/campaigns", label: "Campaigns", icon: Send },
    ],
  },
  {
    label: "Queues",
    items: [
      { href: "/approvals", label: "Approvals", icon: ShieldCheck, badge: counts.approvals, badgeTone: "queue" },
      { href: "/confirm", label: "Confirm queue", icon: CheckCheck, badge: counts.confirms + counts.merges, badgeTone: "queue" },
    ],
  },
  {
    label: "Assist",
    items: [
      { href: "/compliance", label: "Compliance", icon: Scale },
      { href: "/proposals", label: "Proposals", icon: FileText },
      { href: "/content", label: "Content & social", icon: Newspaper },
      { href: "/seo", label: "SEO agent", icon: TrendingUp },
    ],
  },
  {
    label: "Website",
    items: [{ href: "/website", label: "Public site", icon: Globe }],
  },
  {
    label: "Ops",
    items: [
      { href: "/costs", label: "AI cost & jobs", icon: Receipt },
      { href: "/audit", label: "Audit log", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const allNavItems = groups.flatMap((g) =>
  g.items.map((i) => ({ ...i, group: g.label })),
);

/* --------------------------------------------------------------- sidebar */

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "shrink-0 border-r surface-2 flex flex-col h-screen sticky top-0 transition-[width] duration-150",
        collapsed ? "w-[60px]" : "w-[228px]",
      )}
    >
      <div className="px-3 h-14 flex items-center border-b shrink-0 gap-2">
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <span className="h-6 w-6 rounded bg-[var(--accent)] text-white grid place-items-center text-[12px] font-bold shrink-0">
            O
          </span>
          {!collapsed && (
            <span className="font-semibold text-[14px] truncate">{agency.name}</span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={onToggle}
            className="ml-auto text-3 hover:text-[var(--text)] transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {collapsed && (
          <button
            onClick={onToggle}
            className="w-full grid place-items-center py-2 mb-2 text-3 hover:text-[var(--text)]"
            title="Expand sidebar"
          >
            <PanelLeft size={15} />
          </button>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-3.5">
            {!collapsed && (
              <div className="text-3 text-[10.5px] uppercase tracking-[0.09em] font-semibold px-2 mb-1.5">
                {g.label}
              </div>
            )}
            {g.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] mb-0.5 transition-colors",
                    collapsed && "justify-center",
                    active
                      ? "accent-soft font-medium text-[var(--accent)]"
                      : "text-2 hover:surface-3",
                  )}
                >
                  <Icon size={15} className="shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1">{item.label}</span>
                      {item.badge ? (
                        <span
                          className={cn(
                            "tabular text-[11px] rounded px-1.5 py-[1px] font-semibold shrink-0",
                            item.badgeTone === "queue"
                              ? "bg-[#eda100]/18 text-[#8a5f00] dark:text-[#e8b64a]"
                              : "surface-3 text-3",
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t p-3 shrink-0">
          <div className="text-[12.5px] font-medium truncate">{agency.user.name}</div>
          <div className="text-3 text-[11.5px] truncate">
            {agency.user.role} · {agency.licence}
          </div>
        </div>
      )}
    </aside>
  );
}

/* ---------------------------------------------------------- theme toggle */

function ThemeToggle() {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("ozi-theme");
    const isDark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    window.localStorage.setItem("ozi-theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      className="text-3 hover:text-[var(--text)] transition-colors p-1.5 rounded-md hover:surface-3"
      title={dark ? "Switch to light" : "Switch to dark"}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

/* -------------------------------------------------------- command palette */

type Cmd = { label: string; sub: string; href: string };

function useCommands(): Cmd[] {
  return React.useMemo(() => {
    const nav = allNavItems.map((i) => ({
      label: i.label,
      sub: i.group,
      href: i.href,
    }));
    const people = contacts.map((c) => ({
      label: `${c.firstName} ${c.lastName}`,
      sub: `Contact · ${c.suburb}`,
      href: `/contacts/${c.id}`,
    }));
    const stock = listings.map((l) => ({
      label: listingAddress(l),
      sub: `Listing · ${l.status}`,
      href: `/listings/${l.id}`,
    }));
    return [...nav, ...people, ...stock];
  }, []);
}

function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const commands = useCommands();
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);

  const results = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands.slice(0, 9);
    return commands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(needle) ||
          c.sub.toLowerCase().includes(needle),
      )
      .slice(0, 9);
  }, [q, commands]);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
    }
  }, [open]);

  React.useEffect(() => setSel(0), [q]);

  if (!open) return null;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] flex items-start justify-center pt-[14vh] px-4"
      onClick={onClose}
    >
      <div
        className="surface-2 border rounded-xl w-full max-w-[520px] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b">
          <Search size={15} className="text-3 shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && results[sel]) {
                e.preventDefault();
                go(results[sel].href);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Jump to a page, contact or listing…"
            className="bg-transparent outline-none text-[14px] w-full placeholder:text-[var(--text-3)]"
          />
          <kbd className="text-[10.5px] text-3 border rounded px-1.5 py-[2px] shrink-0">
            Esc
          </kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <div className="px-3.5 py-6 text-center text-3 text-[13px]">
              Nothing matches “{q}”.
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.href + r.label}
              onMouseEnter={() => setSel(i)}
              onClick={() => go(r.href)}
              className={cn(
                "w-full text-left px-3.5 py-2 flex items-center gap-3",
                i === sel ? "accent-soft" : "hover:surface-3",
              )}
            >
              <span className="text-[13px] truncate flex-1">{r.label}</span>
              <span className="text-3 text-[11.5px] shrink-0">{r.sub}</span>
              {i === sel && (
                <CornerDownLeft size={12} className="text-3 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- top bar */

export function TopBar() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="h-14 border-b surface-2 flex items-center gap-4 px-5 sticky top-0 z-20">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 surface-3 border rounded-md px-2.5 py-1.5 w-full max-w-md text-left hover:border-[var(--line-strong)] transition-colors"
        >
          <Search size={14} className="text-3 shrink-0" />
          <span className="text-[13px] text-3 flex-1 truncate">
            Search contacts, properties, listings…
          </span>
          <kbd className="text-[10.5px] text-3 border rounded px-1 py-[1px] shrink-0">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="text-3 text-[11.5px] hidden md:inline mr-1.5">
            Prototype · sample data
          </span>
          <ThemeToggle />
          <button
            onClick={() => router.push("/login")}
            className="text-3 hover:text-[var(--text)] transition-colors p-1.5 rounded-md hover:surface-3"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
          <span className="h-7 w-7 rounded-full surface-3 border grid place-items-center text-[11px] font-semibold ml-1">
            SW
          </span>
        </div>
      </header>

      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ----------------------------------------------------------------- shell */

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 py-6 w-full max-w-[1500px]">{children}</main>
      </div>
    </div>
  );
}
