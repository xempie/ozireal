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
  Menu,
  X,
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

/* ------------------------------------------------------------- nav content */

function NavList({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2">
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
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={cn(
                  // min-h-9 keeps every row a comfortable tap target on a phone.
                  "flex items-center gap-2.5 rounded-md px-2 min-h-9 text-[13px] mb-0.5 transition-colors",
                  collapsed && "justify-center",
                  active
                    ? "accent-soft font-medium text-[var(--accent)]"
                    : "text-2 hover:surface-3",
                )}
              >
                <Icon size={16} className="shrink-0" />
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
  );
}

function UserFooter() {
  return (
    <div className="border-t p-3 shrink-0">
      <div className="text-[12.5px] font-medium truncate">{agency.user.name}</div>
      <div className="text-3 text-[11.5px] truncate">
        {agency.user.role} · {agency.licence}
      </div>
    </div>
  );
}

/* ------------------------------------------------- sidebar (desktop, lg+) */

function DesktopSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "hidden lg:flex shrink-0 border-r surface-2 flex-col h-screen sticky top-0 transition-[width] duration-150",
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
            className="ml-auto text-3 hover:text-[var(--text)] transition-colors p-1"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          className="w-full grid place-items-center py-2 text-3 hover:text-[var(--text)]"
          title="Expand sidebar"
        >
          <PanelLeft size={15} />
        </button>
      )}

      <NavList collapsed={collapsed} />
      {!collapsed && <UserFooter />}
    </aside>
  );
}

/* ------------------------------------------ drawer (mobile and tablet) */

function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Escape closes it, and the body must not scroll behind the overlay.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          "lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-[264px] max-w-[85vw] surface-2 border-r",
          "flex flex-col transition-transform duration-200 will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="px-3 h-14 flex items-center border-b shrink-0 gap-2">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2 min-w-0"
          >
            <span className="h-6 w-6 rounded bg-[var(--accent)] text-white grid place-items-center text-[12px] font-bold shrink-0">
              O
            </span>
            <span className="font-semibold text-[14px] truncate">{agency.name}</span>
          </Link>
          <button
            onClick={onClose}
            className="ml-auto text-3 hover:text-[var(--text)] p-2 -mr-1"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <NavList collapsed={false} onNavigate={onClose} />
        <UserFooter />
      </aside>
    </>
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
      className="text-3 hover:text-[var(--text)] transition-colors p-2 rounded-md hover:surface-3"
      title={dark ? "Switch to light" : "Switch to dark"}
      aria-label="Toggle theme"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
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

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      className="fixed inset-0 z-[60] bg-black/35 backdrop-blur-[2px] flex items-start justify-center pt-[10vh] sm:pt-[14vh] px-3"
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
            className="bg-transparent outline-none text-[16px] sm:text-[14px] w-full placeholder:text-[var(--text-3)]"
          />
          <kbd className="hidden sm:inline text-[10.5px] text-3 border rounded px-1.5 py-[2px] shrink-0">
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
                "w-full text-left px-3.5 py-2.5 flex items-center gap-3",
                i === sel ? "accent-soft" : "hover:surface-3",
              )}
            >
              <span className="text-[13px] truncate flex-1">{r.label}</span>
              <span className="text-3 text-[11.5px] shrink-0 hidden sm:inline">
                {r.sub}
              </span>
              {i === sel && <CornerDownLeft size={12} className="text-3 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- top bar */

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
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
      <header className="h-14 border-b surface-2 flex items-center gap-2 sm:gap-4 px-3 sm:px-5 sticky top-0 z-30">
        <button
          onClick={onOpenMenu}
          className="lg:hidden text-2 hover:text-[var(--text)] p-2 -ml-1 rounded-md hover:surface-3 shrink-0"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 surface-3 border rounded-md px-2.5 h-9 flex-1 min-w-0 max-w-md text-left hover:border-[var(--line-strong)] transition-colors"
          aria-label="Search"
        >
          <Search size={15} className="text-3 shrink-0" />
          <span className="text-[13px] text-3 flex-1 truncate hidden sm:inline">
            Search contacts, properties, listings…
          </span>
          <span className="text-[13px] text-3 flex-1 truncate sm:hidden">Search…</span>
          <kbd className="hidden md:inline text-[10.5px] text-3 border rounded px-1 py-[1px] shrink-0">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          <span className="text-3 text-[11.5px] hidden xl:inline mr-1.5">
            Prototype · sample data
          </span>
          <ThemeToggle />
          <button
            onClick={() => router.push("/login")}
            className="text-3 hover:text-[var(--text)] transition-colors p-2 rounded-md hover:surface-3"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
          <span className="h-8 w-8 rounded-full surface-3 border grid place-items-center text-[11px] font-semibold ml-0.5 shrink-0">
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
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();

  // Navigating from inside the drawer should leave it closed on the new page.
  React.useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen">
      <DesktopSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 w-full max-w-[1500px] min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
