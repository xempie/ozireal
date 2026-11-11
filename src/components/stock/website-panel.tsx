import Link from "next/link";
import { Eye, MessageSquare, Camera, Globe } from "lucide-react";
import { Card, CardTitle, Badge, Empty } from "@/components/ui";
import { getListing, getInspections, getListingPhotos } from "@/server/queries";
import { getListingContacts, getListingSection, LISTING_ROLE_LABELS } from "@/server/queries/stock";
import { ListingPhotos } from "@/components/forms/listing-photos";
import {
  EditListingButton,
  ListingStatusButtons,
  NewInspectionButton,
  CancelInspectionButton,
  DeleteListingButton,
} from "@/components/forms/stock-forms";
import { statusLabel } from "@/lib/labels";
import { money, shortDate, timeOfDay, relative } from "@/lib/utils";

/**
 * A property's advertising, on the property's own page (2026-11-11): the old listing
 * page's working parts (photos, price, copy, publishing, inspections, contacts and
 * performance) now live here, so stock is managed in one place.
 */
export async function WebsitePanel({ listingId }: { listingId: string }) {
  const [l, photos, insp, linked, where] = await Promise.all([
    getListing(listingId),
    getListingPhotos(listingId),
    getInspections().then((all) => all.filter((i) => i.listingId === listingId)),
    getListingContacts(listingId),
    getListingSection(listingId),
  ]);
  if (!l) return null;

  const newHomes = where?.websiteSection === "new_homes";
  const live = l.status === "live" || l.status === "under_offer";
  const publicPath = newHomes ? "/new-homes-adelaide" : `/${l.type === "rent" ? "for-rent" : "for-sale"}/${l.slug}`;
  const searchRange =
    l.type === "rent"
      ? l.searchMin !== null
        ? `$${l.searchMin}/wk`
        : "Not set"
      : l.searchMin !== null && l.searchMax !== null
        ? `${money(l.searchMin)} – ${money(l.searchMax)}`
        : "Not set";

  return (
    <section id="website" className="space-y-4 scroll-mt-20">
      <Card>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <CardTitle>{live ? "On the website" : l.status === "draft" ? "Preparing for the website" : "Advertising"}</CardTitle>
          <Badge tone={live ? "stock" : l.status === "draft" ? "queue" : "neutral"}>
            {statusLabel[l.status] ?? l.status}
          </Badge>
          <Badge tone={newHomes ? "brand" : "neutral"}>{newHomes ? "New Homes" : "Currently advertised"}</Badge>
          <span className="ml-auto flex flex-wrap gap-1.5">
            {live && (
              <a
                href={`https://www.ozirealty.com.au${publicPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12.5px] px-2.5 min-h-8 rounded-md surface-2 border hover:surface-3"
              >
                <Globe size={12} /> View on website
              </a>
            )}
            <EditListingButton
              listing={{
                id: l.id,
                type: l.type,
                status: l.status,
                method: l.method,
                priceDisplay: l.priceDisplay,
                searchMin: l.searchMin,
                searchMax: l.searchMax,
                rentPw: l.rentPw,
                headline: l.headline,
                copy: l.copy,
                resultDisplay: l.resultDisplay,
              }}
            />
            <ListingStatusButtons listing={{ id: l.id, status: l.status, type: l.type }} />
            {l.status === "draft" && <DeleteListingButton id={l.id} />}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-3 min-w-0">
            <div>
              <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1">Price shown</div>
              <p className="text-[15px] font-semibold">
                {l.resultDisplay ?? l.priceDisplay ?? <span className="text-3 italic font-normal">Not written yet: needed to go live</span>}
              </p>
              <p className="text-3 text-[11.5px]">
                {l.type === "rent" ? "Rental" : "Sale"}
                {l.method ? ` · ${l.method}` : ""} · search range {searchRange} (hidden)
              </p>
            </div>
            <div>
              <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1">Headline</div>
              <p className="text-[14px] font-medium">{l.headline || <span className="text-3 italic">Not written yet</span>}</p>
            </div>
            <div>
              <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1">Description</div>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap line-clamp-6">
                {l.copy || <span className="text-3 italic">Not written yet</span>}
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-1">
              Photos{photos.length ? ` (${photos.length})` : ""}
            </div>
            <ListingPhotos listingId={l.id} photos={photos} />
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardTitle>Performance</CardTitle>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[19px] font-semibold tabular">{l.views7d}</div>
              <div className="text-3 text-[11px] inline-flex items-center gap-1"><Eye size={10} /> views 7d</div>
            </div>
            <div>
              <div className="text-[19px] font-semibold tabular">{l.enquiries7d}</div>
              <div className="text-3 text-[11px] inline-flex items-center gap-1"><MessageSquare size={10} /> enquiries</div>
            </div>
            <div>
              <div className="text-[19px] font-semibold tabular">{l.photos}</div>
              <div className="text-3 text-[11px] inline-flex items-center gap-1"><Camera size={10} /> photos</div>
            </div>
          </div>
          <p className="text-3 text-[11.5px] mt-2">
            {l.publishedAt ? `Published ${relative(l.publishedAt)}` : "Not published"}
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <CardTitle>Inspections</CardTitle>
            <span className="ml-auto">
              <NewInspectionButton listingId={l.id} />
            </span>
          </div>
          {insp.length === 0 ? (
            <Empty>None scheduled.</Empty>
          ) : (
            <ul className="space-y-2">
              {insp.map((i) => (
                <li key={i.id} className="text-[12.5px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{shortDate(i.startsAt)} · {timeOfDay(i.startsAt)}</span>
                    <Badge tone={i.kind === "open" ? "stock" : "neutral"}>{i.kind}</Badge>
                    <span className="ml-auto"><CancelInspectionButton id={i.id} /></span>
                  </div>
                  <div className="text-3 text-[11.5px]">
                    {i.registrations} registered{i.capacity ? ` of ${i.capacity}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Contacts on this property</CardTitle>
          {linked.length === 0 ? (
            <Empty>None attached.</Empty>
          ) : (
            <ul className="space-y-1.5 text-[13px]">
              {linked.map((k) => (
                <li key={`${k.contactId}-${k.role}`} className="flex items-center justify-between gap-2">
                  <Link href={`/contacts/${k.contactId}`} className="font-medium hover:underline underline-offset-2">
                    {k.firstName} {k.lastName}
                  </Link>
                  <span className="text-2 text-[12px]">{LISTING_ROLE_LABELS[k.role] ?? k.role}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}
