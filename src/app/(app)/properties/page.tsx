import Link from "next/link";
import { PageHeader, Badge, Table, THead, TH, TD, TR } from "@/components/ui";
import { getProperties } from "@/server/queries";
import { propertyTypeLabel } from "@/lib/labels";
import { EditPropertyButton } from "@/components/forms/stock-forms";
import { suburbOptions, contactOptions, propertyOptions } from "@/server/queries/pickers";
import { FullListingButton } from "@/components/forms/new-listing-form";
import { ImportPropertiesButton } from "@/components/forms/property-import";

/**
 * Properties: the one place for all stock (owner's request, 2026-11-11). It absorbed the
 * Listings page: a listing is the advertising for a property, so each row says where the
 * property stands on the website, and Board is the old listings view.
 *
 * Every property still being worked is matched against every possible lead, listed or
 * not, so the matched-buyer count sits on every row.
 */

type Row = Awaited<ReturnType<typeof getProperties>>[number];
type Stage = "website" | "preparing" | "off_market" | "sold" | "archived";

/** Where a property stands: its campaign first, then its own status. */
function stageOf(p: Row): Stage {
  const c = p.current;
  if (c && (c.status === "live" || c.status === "under_offer")) return "website";
  if (p.status === "archived") return "archived";
  if (p.status === "sold" || c?.status === "sold" || c?.status === "leased") return "sold";
  if (c?.status === "draft") return "preparing";
  return "off_market";
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "website", label: "On the website" },
  { key: "new_homes", label: "New Homes" },
  { key: "preparing", label: "Preparing" },
  { key: "off_market", label: "Off market" },
  { key: "sold", label: "Sold & leased" },
  { key: "archived", label: "Archived" },
] as const;

const BADGE: Record<Stage, { label: string; tone: "stock" | "queue" | "neutral" | "sent" }> = {
  website: { label: "On website", tone: "stock" },
  preparing: { label: "Preparing", tone: "queue" },
  off_market: { label: "Off market", tone: "neutral" },
  sold: { label: "Sold / leased", tone: "sent" },
  archived: { label: "Archived", tone: "neutral" },
};

function titleOf(p: Row) {
  return p.current?.websiteSection === "new_homes" && p.current.projectName
    ? p.current.projectName
    : p.address || "Untitled";
}

function nextStep(p: Row, stage: Stage): string {
  switch (stage) {
    case "website":
      return p.current?.status === "under_offer" ? "Under offer" : p.matchCount ? `Send to ${p.matchCount} matched` : "Live";
    case "preparing":
      return p.current?.priceDisplay ? "Add photos, then go live" : "Write the price wording";
    case "off_market":
      return p.matchCount ? `Offer off-market to ${p.matchCount}` : "Appraise or prepare";
    case "sold":
      return "In the sold archive";
    default:
      return "—";
  }
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.key === sp.status) ? sp.status! : "all";
  const view = sp.view === "board" ? "board" : "list";
  const q = (sp.q ?? "").trim().toLowerCase();

  const [suburbOpts, contactOpts, propertyOpts, all] = await Promise.all([
    suburbOptions(),
    contactOptions(),
    propertyOptions(),
    getProperties(),
  ]);

  const staged = all.map((p) => ({ p, stage: stageOf(p) }));
  const inFilter = ({ p, stage }: (typeof staged)[number], key: string) =>
    key === "all"
      ? stage !== "archived"
      : key === "new_homes"
        ? stage === "website" && p.current?.websiteSection === "new_homes"
        : stage === key;
  const matchesQuery = ({ p }: (typeof staged)[number]) =>
    !q ||
    [p.address, p.suburb, p.current?.projectName, p.ownerName]
      .filter(Boolean)
      .some((x) => String(x).toLowerCase().includes(q));
  const shown = staged.filter((x) => inFilter(x, filter) && matchesQuery(x));

  const count = (key: string) => staged.filter((x) => inFilter(x, key)).length;
  const totalMatches = staged
    .filter((x) => x.stage !== "sold" && x.stage !== "archived")
    .reduce((n, x) => n + x.p.matchCount, 0);

  const href = (o: { status?: string; view?: string }) => {
    const u = new URLSearchParams();
    const st = o.status ?? filter;
    const vw = o.view ?? view;
    if (st !== "all") u.set("status", st);
    if (vw !== "list") u.set("view", vw);
    if (q) u.set("q", q);
    const s = u.toString();
    return s ? `/properties?${s}` : "/properties";
  };

  const tiles = [
    { key: "all", label: "All stock", n: count("all"), note: "properties" },
    { key: "website", label: "On the website", n: count("website"), note: "advertised + New Homes" },
    { key: "preparing", label: "Preparing", n: count("preparing"), note: "drafts, not public" },
    { key: "off_market", label: "Off market", n: count("off_market"), note: "matched quietly" },
  ];

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="Everything you hold: on the website, being prepared, off market, sold. Every property still being worked is matched to buyers."
        actions={
          <div className="flex gap-2">
            <ImportPropertiesButton />
            <FullListingButton properties={propertyOpts} suburbs={suburbOpts} label="Add property" />
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {tiles.map((t) => (
          <Link
            key={t.key}
            href={href({ status: t.key })}
            className={`rounded-lg p-3.5 surface-2 hover:surface-3 ${filter === t.key ? "border-2 border-[var(--accent)]" : "border"}`}
          >
            <div className="text-2 text-[12px]">{t.label}</div>
            <div className="text-[24px] font-semibold tabular leading-tight">{t.n}</div>
            <div className="text-3 text-[11.5px]">{t.note}</div>
          </Link>
        ))}
        <div className="rounded-lg p-3.5 surface-2 border">
          <div className="text-2 text-[12px]">Matched buyers</div>
          <div className="text-[24px] font-semibold tabular leading-tight text-[#0E9F6E]">{totalMatches}</div>
          <div className="text-3 text-[11.5px]">across stock being worked</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <form action="/properties" className="mr-1">
          {filter !== "all" && <input type="hidden" name="status" value={filter} />}
          {view !== "list" && <input type="hidden" name="view" value={view} />}
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search address, suburb, project or owner…"
            aria-label="Search properties"
            className="surface-2 border rounded-md px-2.5 min-h-8 text-[16px] sm:text-[13px] w-[260px] max-w-full"
          />
        </form>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={href({ status: f.key })}
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "rounded-full px-3 min-h-8 inline-flex items-center gap-1.5 text-[13px] font-medium bg-[var(--accent)] text-white"
                  : "rounded-full px-3 min-h-8 inline-flex items-center gap-1.5 text-[13px] surface-2 border text-2 hover:surface-3"
              }
            >
              {f.label}
              <span className={active ? "opacity-80 tabular" : "text-3 tabular"}>{count(f.key)}</span>
            </Link>
          );
        })}
        <div className="ml-auto flex rounded-md border overflow-hidden text-[12.5px]">
          {(["list", "board"] as const).map((v) => (
            <Link
              key={v}
              href={href({ view: v })}
              aria-current={view === v ? "true" : undefined}
              className={view === v ? "px-3 py-1.5 bg-[var(--accent)] text-white" : "px-3 py-1.5 surface-2 hover:surface-3"}
            >
              {v === "list" ? "List" : "Board"}
            </Link>
          ))}
        </div>
      </div>

      {view === "board" ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3 items-start">
          {(["preparing", "website", "off_market", "sold", "archived"] as Stage[]).map((st) => {
            const items = shown.filter((x) => x.stage === st);
            return (
              <div key={st} className="rounded-lg surface-1 border p-2.5 space-y-2 min-w-0">
                <div className="flex items-center justify-between px-1">
                  <Badge tone={BADGE[st].tone}>{BADGE[st].label}</Badge>
                  <span className="text-3 text-[12px] tabular">{items.length}</span>
                </div>
                {items.map(({ p }) => (
                  <Link
                    key={p.id}
                    href={`/properties/${p.id}`}
                    className="block rounded-md surface-2 border p-2.5 hover:surface-3"
                  >
                    <div className="font-medium text-[13px] truncate">{titleOf(p)}</div>
                    <div className="text-3 text-[11.5px] truncate">{p.suburb}</div>
                    <div className="text-2 text-[12px] mt-1 truncate">{p.current?.resultDisplay ?? p.current?.priceDisplay ?? "No price yet"}</div>
                    {p.matchCount > 0 && st !== "sold" && st !== "archived" && (
                      <div className="text-[11.5px] mt-1 text-[#0E9F6E] font-medium">{p.matchCount} matched buyers</div>
                    )}
                  </Link>
                ))}
                {items.length === 0 && <p className="text-3 text-[12px] px-1">Nothing here.</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <Table minWidth={980}>
          <THead>
            <TR>
              <TH>Property</TH>
              <TH>Specs</TH>
              <TH>Website</TH>
              <TH>Price shown</TH>
              <TH>Matched buyers</TH>
              <TH>Next step</TH>
              <TH className="text-right">Edit</TH>
            </TR>
          </THead>
          <tbody>
            {shown.map(({ p, stage }) => (
              <TR key={p.id}>
                <TD nowrap>
                  <Link href={`/properties/${p.id}`} className="font-medium hover:underline underline-offset-2">
                    {titleOf(p)}
                  </Link>
                  <div className="text-3 text-[12px]">
                    {[p.suburb, propertyTypeLabel[p.type] ?? p.type, p.ownerName ? `Owner ${p.ownerName}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </TD>
                <TD className="tabular whitespace-nowrap text-2">
                  {[p.beds != null ? `${p.beds} bed` : null, p.baths != null ? `${p.baths} bath` : null, p.parking != null ? `${p.parking} car` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={BADGE[stage].tone}>{BADGE[stage].label}</Badge>
                    {stage === "website" && p.current?.websiteSection === "new_homes" && <Badge tone="brand">New Homes</Badge>}
                  </div>
                </TD>
                <TD className="text-2 max-w-[220px] truncate">
                  {p.current?.resultDisplay ?? p.current?.priceDisplay ?? <span className="text-3">—</span>}
                </TD>
                <TD className="tabular">
                  {stage === "sold" || stage === "archived" ? (
                    <span className="text-3">—</span>
                  ) : (
                    <Link href={`/matching?focus=${p.id}`} className="font-semibold text-[#0E9F6E] hover:underline">
                      {p.matchCount}
                    </Link>
                  )}
                </TD>
                <TD className="text-[12.5px] text-[var(--accent)] font-medium whitespace-nowrap">
                  {p.matchCount && (stage === "website" || stage === "off_market") ? (
                    <Link href={`/matching?focus=${p.id}`} className="hover:underline">
                      {nextStep(p, stage)}
                    </Link>
                  ) : (
                    nextStep(p, stage)
                  )}
                </TD>
                <TD className="text-right">
                  <EditPropertyButton
                    property={{
                      id: p.id,
                      unit: p.unit,
                      streetNumber: p.streetNumber,
                      street: p.street,
                      suburbId: p.suburbId,
                      postcode: p.postcode,
                      type: p.type,
                      status: p.status,
                      beds: p.beds,
                      baths: p.baths,
                      parking: p.parking,
                      landSqm: p.landSqm,
                      ownerContactId: p.ownerContactId,
                      internalNotes: p.internalNotes,
                      internalPriceExpectation: p.internalPriceExpectation,
                    }}
                    suburbs={suburbOpts}
                    contacts={contactOpts}
                  />
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {shown.length === 0 && (
        <div className="text-3 text-[13px] mt-3">
          {all.length === 0 ? "No properties yet." : q ? "Nothing matches that search." : "Nothing in this view."}
        </div>
      )}
    </>
  );
}
