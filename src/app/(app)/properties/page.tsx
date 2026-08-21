import Link from "next/link";
import { Plus, MapPinOff } from "lucide-react";
import {
  PageHeader,
  Badge,
  Button,
  Table,
  THead,
  TH,
  TD,
  TR,
  ProtoNote,
} from "@/components/ui";
import {
  properties,
  listingsForProperty,
  contactById,
  statusLabel,
} from "@/lib/sample-data";

export default function PropertiesPage() {
  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="The stock, whether or not it is currently advertised. A property outlives its listings."
        actions={
          <Button variant="primary">
            <Plus size={13} />
            New property
          </Button>
        }
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
          </TR>
        </THead>
        <tbody>
          {properties.map((p) => {
            const ls = listingsForProperty(p.id);
            const owner = contactById(p.ownerContactId);
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
                    {p.suburb} {p.state} {p.postcode}
                  </div>
                </TD>
                <TD className="text-2">{p.type}</TD>
                <TD className="tabular whitespace-nowrap text-2">
                  {p.beds} bed · {p.baths} bath · {p.parking} car
                </TD>
                <TD nowrap className="tabular text-2">
                  {p.landSqm > 0 ? `${p.landSqm} m²` : "—"}
                </TD>
                <TD>
                  {owner ? (
                    <Link
                      href={`/contacts/${owner.id}`}
                      className="hover:underline underline-offset-2 text-2"
                    >
                      {owner.firstName} {owner.lastName}
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
                        {statusLabel[l.status]}
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
              </TR>
            );
          })}
        </tbody>
      </Table>

      <ProtoNote>
        Coordinates are empty across the board because no geocoding provider is
        connected yet (D11). The columns and the backfill job exist so switching it on
        later is credentials plus a run — not a migration.
      </ProtoNote>
    </>
  );
}
