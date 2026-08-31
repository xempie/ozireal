import Link from "next/link";
import { Plus, MapPinOff } from "lucide-react";
import {
  PageHeader,
  Badge,
  Table,
  THead,
  TH,
  TD,
  TR,
  ProtoNote,
} from "@/components/ui";
import { getProperties } from "@/server/queries";
import { statusLabel, propertyTypeLabel } from "@/lib/labels";
import {
  NewPropertyButton,
  EditPropertyButton,
} from "@/components/forms/stock-forms";
import { suburbOptions, contactOptions } from "@/server/queries/pickers";

export default async function PropertiesPage() {
  const [suburbOpts, contactOpts] = await Promise.all([suburbOptions(), contactOptions()]);
  const properties = await getProperties();

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="The stock, whether or not it is currently advertised. A property outlives its listings."
        actions={<NewPropertyButton suburbs={suburbOpts} contacts={contactOpts} />}
      />

      <Table minWidth={860}>
        <THead>
          <TR>
            <TH>Address</TH>
            <TH>Type</TH>
            <TH>Configuration</TH>
            <TH>Land</TH>
            <TH>Owner</TH>
            <TH>Listings</TH>
            <TH>Geocode</TH>
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
                <TD>
                  {p.lat === null ? (
                    <Badge tone="queue">
                      <MapPinOff size={10} />
                      pending
                    </Badge>
                  ) : (
                    <Badge tone="sent">set</Badge>
                  )}
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
        <div className="text-3 text-[13px] mt-3">No properties yet.</div>
      )}

      <ProtoNote>
        Coordinates are empty across the board because no geocoding provider is
        connected yet (D11). The columns and the backfill job exist so switching it on
        later is credentials plus a run — not a migration.
      </ProtoNote>
    </>
  );
}
