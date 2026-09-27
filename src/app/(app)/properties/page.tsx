import Link from "next/link";
import { Plus } from "lucide-react";
import {
  PageHeader,
  Badge,
  Table,
  THead,
  TH,
  TD,
  TR,
} from "@/components/ui";
import { getProperties } from "@/server/queries";
import { statusLabel, propertyTypeLabel } from "@/lib/labels";
import {
  NewPropertyButton,
  EditPropertyButton,
} from "@/components/forms/stock-forms";
import { suburbOptions, contactOptions } from "@/server/queries/pickers";
import { ImportPropertiesButton } from "@/components/forms/property-import";

/**
 * One page for all stock, filtered by tab. "Listed" is read from the listings (a live
 * or under-offer campaign), not from the property's own status column, because a
 * campaign is what makes something listed; the other tabs are the property's status.
 */
const TABS = [
  { key: "all", label: "All" },
  { key: "listed", label: "Listed" },
  { key: "off_market", label: "Off market" },
  { key: "prospect", label: "Prospect" },
  { key: "appraised", label: "Appraised" },
  { key: "sold", label: "Sold" },
  { key: "archived", label: "Archived" },
] as const;

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const tab = TABS.some((t) => t.key === status) ? status! : "all";

  const [suburbOpts, contactOpts] = await Promise.all([suburbOptions(), contactOptions()]);
  const all = await getProperties();

  const isListed = (p: (typeof all)[number]) =>
    p.listings.some((l) => l.status === "live" || l.status === "under_offer");
  const inTab = (p: (typeof all)[number], key: string) =>
    key === "all"
      ? p.status !== "archived"
      : key === "listed"
        ? isListed(p)
        : p.status === key;
  const properties = all.filter((p) => inTab(p, tab));

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="All your stock in one place. Listed means a live campaign; the rest is the property's own status."
        actions={
          <div className="flex gap-2">
            <ImportPropertiesButton />
            <NewPropertyButton suburbs={suburbOpts} contacts={contactOpts} />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5 mb-4" role="tablist">
        {TABS.map((t) => {
          const n = all.filter((p) => inTab(p, t.key)).length;
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={t.key === "all" ? "/properties" : `/properties?status=${t.key}`}
              role="tab"
              aria-selected={active}
              className={
                active
                  ? "rounded-full px-3 min-h-8 inline-flex items-center gap-1.5 text-[13px] font-medium bg-[var(--accent)] text-white"
                  : "rounded-full px-3 min-h-8 inline-flex items-center gap-1.5 text-[13px] surface-2 border text-2 hover:surface-3"
              }
            >
              {t.label}
              <span className={active ? "opacity-80 tabular" : "text-3 tabular"}>{n}</span>
            </Link>
          );
        })}
        <Link
          href="/listings"
          className="ml-auto text-[13px] text-2 hover:underline underline-offset-2"
        >
          Manage listings →
        </Link>
      </div>

      <Table minWidth={860}>
        <THead>
          <TR>
            <TH>Address</TH>
            <TH>Type</TH>
            <TH>Configuration</TH>
            <TH>Land</TH>
            <TH>Owner</TH>
            <TH>Listings</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <tbody>
          {properties.map((p) => {
            const ls = p.listings;
            return (
              <TR key={p.id}>
                <TD nowrap>
                  <Link
                    href={`/properties/${p.id}`}
                    className="font-medium hover:underline underline-offset-2"
                  >
                    {p.address}
                  </Link>
                  <div className="text-3 text-[12px]">
                    {[p.suburb, p.state, p.postcode].filter(Boolean).join(" ")}
                  </div>
                </TD>
                <TD className="text-2">{propertyTypeLabel[p.type] ?? p.type}</TD>
                <TD className="tabular whitespace-nowrap text-2">
                  {p.beds ?? "—"} bed · {p.baths ?? "—"} bath · {p.parking ?? "—"} car
                </TD>
                <TD nowrap className="tabular text-2">
                  {p.landSqm && p.landSqm > 0 ? `${p.landSqm} m²` : "—"}
                </TD>
                <TD>
                  {p.ownerContactId && p.ownerName ? (
                    <Link
                      href={`/contacts/${p.ownerContactId}`}
                      className="hover:underline underline-offset-2 text-2"
                    >
                      {p.ownerName}
                    </Link>
                  ) : (
                    <span className="text-3">—</span>
                  )}
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {ls.map((l) => (
                      <Badge
                        key={l.id}
                        tone={
                          l.status === "live"
                            ? "stock"
                            : l.status === "sold"
                              ? "sent"
                              : "neutral"
                        }
                      >
                        {statusLabel[l.status] ?? l.status}
                      </Badge>
                    ))}
                    {ls.length === 0 && <span className="text-3">never listed</span>}
                  </div>
                </TD>
                <TD className="text-right">
                  {/* Editing from the list rather than only from the detail page:
                      most corrections are a bedroom count or an owner link, and
                      making that a two-navigation job is why they do not get made. */}
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
            );
          })}
        </tbody>
      </Table>

      {properties.length === 0 && (
        <div className="text-3 text-[13px] mt-3">
          {all.length === 0 ? "No properties yet." : "Nothing in this tab."}
        </div>
      )}
    </>
  );
}
