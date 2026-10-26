"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Globe, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useAction,
  Modal,
  Input,
  Textarea,
  Select,
  SubmitButton,
  CancelButton,
  FormError,
  RowButton,
  ConfirmButton,
  ActionButton,
} from "./action-form";
import {
  createProperty,
  createListing,
  updateProperty,
  deleteProperty,
  updateListing,
  setListingStatus,
  deleteListing,
  createInspection,
  cancelInspection,
} from "@/server/actions/stock";

export type Option = { value: string; label: string };

/**
 * Creating stock.
 *
 * Two buttons rather than one wizard, because a property and a listing are
 * genuinely different things (§4): the property exists whether or not it is on
 * the market, and outlives any number of campaigns over it.
 */

export function NewPropertyButton({
  suburbs,
  contacts,
}: {
  suburbs: Option[];
  contacts: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const [isLand, setIsLand] = React.useState(false);
  const a = useAction(createProperty, { onSuccess: () => setOpen(false) });

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90"
      >
        <Plus size={13} />
        New property
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New property">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(Object.fromEntries(new FormData(e.currentTarget).entries()));
          }}
        >
          <div className="grid grid-cols-[80px_100px_1fr] gap-2">
            <Input label="Unit" name="unit" errors={a.fieldErrors.unit} />
            <Input label="Number" name="streetNumber" errors={a.fieldErrors.streetNumber} />
            <Input label="Street" name="street" required errors={a.fieldErrors.street} />
          </div>

          <Select
            label="Suburb"
            name="suburbId"
            required
            options={[{ value: "", label: "Choose a suburb…" }, ...suburbs]}
            errors={a.fieldErrors.suburbId}
          />
          <p className="text-3 text-[11px] -mt-2">
            Picked from the list, not typed — matching compares suburbs by record, so a
            hand-typed one would quietly never match anybody. State and postcode come
            from the suburb.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="Type"
              name="propertyType"
              defaultValue="house"
              onChange={(e) => setIsLand(e.target.value === "land")}
              options={[
                { value: "house", label: "House" },
                { value: "unit", label: "Unit" },
                { value: "townhouse", label: "Townhouse" },
                { value: "land", label: "Land" },
                { value: "acreage", label: "Acreage" },
                { value: "commercial", label: "Commercial" },
              ]}
              errors={a.fieldErrors.propertyType}
            />
            <Select
              label="Status"
              name="status"
              defaultValue="prospect"
              options={[
                { value: "prospect", label: "Prospect" },
                { value: "appraised", label: "Appraised" },
                { value: "off_market", label: "Off market" },
              ]}
              errors={a.fieldErrors.status}
            />
          </div>
          <p className="text-3 text-[11px] -mt-2">
            &ldquo;Listed&rdquo; and &ldquo;sold&rdquo; are not choices here — they are
            facts about a campaign, set when one goes live or settles.
          </p>

          {!isLand && (
            <div className="grid grid-cols-3 gap-2">
              <Input label="Beds" name="beds" type="number" min="0" errors={a.fieldErrors.beds} />
              <Input label="Baths" name="baths" type="number" min="0" errors={a.fieldErrors.baths} />
              <Input label="Car" name="parking" type="number" min="0" errors={a.fieldErrors.parking} />
            </div>
          )}
          <Input
            label="Land size (sqm)"
            name="landAreaSqm"
            type="number"
            min="0"
            errors={a.fieldErrors.landAreaSqm}
          />

          <Select
            label="Owner"
            name="ownerContactId"
            options={[{ value: "", label: "Not known yet" }, ...contacts]}
            errors={a.fieldErrors.ownerContactId}
          />
          <p className="text-3 text-[11px] -mt-2">
            Links an existing contact. Adding a person here would skip the duplicate
            check that every other route into the contact list goes through.
          </p>

          <Textarea
            label="Private notes"
            name="internalNotes"
            rows={3}
            errors={a.fieldErrors.internalNotes}
          />
          <Input
            label="What the owner hopes to get"
            name="internalPriceExpectation"
            placeholder="e.g. mid 700s"
            errors={a.fieldErrors.internalPriceExpectation}
          />
          <p className="text-3 text-[11px] -mt-2">
            Both are internal. Public pages read a named projection that cannot return
            these columns, and a test asserts it.
          </p>

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Add property</SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function NewListingButton({ properties }: { properties: Option[] }) {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<"sale" | "rent">("sale");
  const a = useAction(createListing, { onSuccess: () => setOpen(false) });

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90"
      >
        <Plus size={13} />
        New listing
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New listing">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(Object.fromEntries(new FormData(e.currentTarget).entries()));
          }}
        >
          {properties.length === 0 ? (
            <p className="text-[12.5px] text-2">
              There are no properties yet. A listing is a campaign over a property, so
              add the property first.
            </p>
          ) : (
            <>
              <Select
                label="Property"
                name="propertyId"
                required
                options={[{ value: "", label: "Choose a property…" }, ...properties]}
                errors={a.fieldErrors.propertyId}
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <Select
                  label="For"
                  name="listingType"
                  defaultValue="sale"
                  onChange={(e) => setType(e.target.value as "sale" | "rent")}
                  options={[
                    { value: "sale", label: "Sale" },
                    { value: "rent", label: "Rent" },
                  ]}
                />
                <Input
                  label="Method"
                  name="method"
                  placeholder={type === "sale" ? "Private treaty" : "Lease"}
                  errors={a.fieldErrors.method}
                />
              </div>

              <Input
                label="Price wording, exactly as it should appear"
                name="priceDisplay"
                placeholder="Offers above $750,000"
                errors={a.fieldErrors.priceDisplay}
              />
              <p className="text-3 text-[11px] -mt-2">
                Stored and shown verbatim, never assembled from a number: under-quoting
                provisions make the displayed wording a legal artefact. A listing cannot
                go live without it.
              </p>

              {type === "sale" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Search price from"
                    name="searchPriceMin"
                    type="number"
                    min="0"
                    errors={a.fieldErrors.searchPriceMin}
                  />
                  <Input
                    label="Search price to"
                    name="searchPriceMax"
                    type="number"
                    min="0"
                    errors={a.fieldErrors.searchPriceMax}
                  />
                </div>
              ) : (
                <Input
                  label="Rent per week"
                  name="rentPw"
                  type="number"
                  min="0"
                  errors={a.fieldErrors.rentPw}
                />
              )}
              <p className="text-3 text-[11px] -mt-2">
                Hidden. These drive search and matching only, and are never displayed.
              </p>

              <Input
                label="Headline"
                name="publicHeadline"
                placeholder="Renovated character home with a north-facing rear"
                errors={a.fieldErrors.publicHeadline}
              />
              <Textarea
                label="Description"
                name="publicCopy"
                rows={5}
                errors={a.fieldErrors.publicCopy}
              />

              <p className="text-3 text-[11.5px] leading-relaxed">
                Saved as a <strong>draft</strong>. Publishing is a separate, deliberate
                step, and only one campaign per property can be live at a time.
              </p>

              <FormError message={a.error} />
              <div className="flex gap-2 pt-1">
                <SubmitButton pending={a.pending}>Create draft listing</SubmitButton>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------ editing a property */

export type EditableProperty = {
  id: string;
  unit: string | null;
  streetNumber: string | null;
  street: string | null;
  suburbId: string | null;
  postcode: string | null;
  type: string;
  status: string;
  beds: number | null;
  baths: number | null;
  parking: number | null;
  landSqm: number | null;
  ownerContactId: string | null;
  internalNotes: string | null;
  internalPriceExpectation: string | null;
};

/** The states a person decides. "listed" and "sold" are set by a campaign. */
const OWNED_STATUSES = ["prospect", "appraised", "off_market", "archived"];

export function EditPropertyButton({
  property,
  suburbs,
  contacts,
}: {
  property: EditableProperty;
  suburbs: Option[];
  contacts: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const [isLand, setIsLand] = React.useState(property.type === "land");
  const a = useAction(updateProperty, { onSuccess: () => setOpen(false) });

  /**
   * A campaign owns the status while one is running. Rather than showing a select
   * that the server will refuse, the field is replaced by the sentence explaining
   * why — the refusal is more useful before the click than after it.
   */
  const campaignOwnsStatus = property.status === "listed" || property.status === "sold";

  return (
    <>
      <RowButton onClick={() => { a.reset(); setOpen(true); }}>
        <Pencil size={11} />
        Edit
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit property">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({
              ...Object.fromEntries(new FormData(e.currentTarget).entries()),
              id: property.id,
            });
          }}
        >
          <div className="grid grid-cols-[80px_100px_1fr] gap-2">
            <Input label="Unit" name="unit" defaultValue={property.unit ?? ""} errors={a.fieldErrors.unit} />
            <Input
              label="Number"
              name="streetNumber"
              defaultValue={property.streetNumber ?? ""}
              errors={a.fieldErrors.streetNumber}
            />
            <Input
              label="Street"
              name="street"
              required
              defaultValue={property.street ?? ""}
              errors={a.fieldErrors.street}
            />
          </div>

          <Select
            label="Suburb"
            name="suburbId"
            required
            defaultValue={property.suburbId ?? ""}
            options={[{ value: "", label: "Choose a suburb…" }, ...suburbs]}
            errors={a.fieldErrors.suburbId}
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="Type"
              name="propertyType"
              defaultValue={property.type}
              onChange={(e) => setIsLand(e.target.value === "land")}
              options={[
                { value: "house", label: "House" },
                { value: "unit", label: "Unit" },
                { value: "townhouse", label: "Townhouse" },
                { value: "land", label: "Land" },
                { value: "acreage", label: "Acreage" },
                { value: "commercial", label: "Commercial" },
              ]}
              errors={a.fieldErrors.propertyType}
            />
            {campaignOwnsStatus ? (
              <div>
                <span className="block text-[12px] font-medium text-2 mb-1.5">Status</span>
                <div className="surface-3 border rounded-md px-2.5 py-2 text-[13.5px] capitalize">
                  {property.status}
                </div>
              </div>
            ) : (
              <Select
                label="Status"
                name="status"
                defaultValue={
                  OWNED_STATUSES.includes(property.status) ? property.status : "prospect"
                }
                options={[
                  { value: "prospect", label: "Prospect" },
                  { value: "appraised", label: "Appraised" },
                  { value: "off_market", label: "Off market" },
                  { value: "archived", label: "Archived" },
                ]}
                errors={a.fieldErrors.status}
              />
            )}
          </div>
          {campaignOwnsStatus && (
            <p className="text-3 text-[11px] -mt-2">
              Set by the campaign over this property, not by hand. Withdraw or settle the
              listing to change it.
            </p>
          )}

          {!isLand && (
            <div className="grid grid-cols-3 gap-2">
              <Input label="Beds" name="beds" type="number" min="0" defaultValue={property.beds ?? ""} errors={a.fieldErrors.beds} />
              <Input label="Baths" name="baths" type="number" min="0" defaultValue={property.baths ?? ""} errors={a.fieldErrors.baths} />
              <Input label="Car" name="parking" type="number" min="0" defaultValue={property.parking ?? ""} errors={a.fieldErrors.parking} />
            </div>
          )}
          <Input
            label="Land size (sqm)"
            name="landAreaSqm"
            type="number"
            min="0"
            defaultValue={property.landSqm ?? ""}
            errors={a.fieldErrors.landAreaSqm}
          />

          <Select
            label="Owner"
            name="ownerContactId"
            defaultValue={property.ownerContactId ?? ""}
            options={[{ value: "", label: "Not known yet" }, ...contacts]}
            errors={a.fieldErrors.ownerContactId}
          />

          <Textarea
            label="Private notes"
            name="internalNotes"
            rows={3}
            defaultValue={property.internalNotes ?? ""}
            errors={a.fieldErrors.internalNotes}
          />
          <Input
            label="What the owner hopes to get"
            name="internalPriceExpectation"
            placeholder="e.g. mid 700s"
            defaultValue={property.internalPriceExpectation ?? ""}
            errors={a.fieldErrors.internalPriceExpectation}
          />
          <p className="text-3 text-[11px] -mt-2">
            Both are internal. Public pages read a named projection that cannot return
            these columns, and a test asserts it.
          </p>

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Save changes</SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}

/**
 * Deleting a property.
 *
 * Refused as soon as it has ever been listed — its campaigns are the sold archive.
 * The refusal comes from the server, so this button says "Delete" whatever the
 * state and lets the reason arrive as a sentence, rather than hiding itself and
 * leaving the agent wondering where the control went.
 */
export function DeletePropertyButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      action={deleteProperty}
      input={{ id }}
      confirmLabel="Delete for good"
      title="Delete this property"
      onDone={() => router.push("/properties")}
    >
      <Trash2 size={11} />
      Delete
    </ConfirmButton>
  );
}

/* ------------------------------------------------------- editing a listing */

export type EditableListing = {
  id: string;
  type: "sale" | "rent";
  status: string;
  method: string | null;
  priceDisplay: string | null;
  searchMin: number | null;
  searchMax: number | null;
  rentPw: number | null;
  headline: string | null;
  copy: string | null;
  resultDisplay: string | null;
};

export function EditListingButton({ listing }: { listing: EditableListing }) {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<"sale" | "rent">(listing.type);
  const a = useAction(updateListing, { onSuccess: () => setOpen(false) });
  // Sold and leased are results: a sold sale cannot become a rental after the fact.
  const settled = listing.status === "sold" || listing.status === "leased";

  return (
    <>
      <RowButton onClick={() => { a.reset(); setOpen(true); }}>
        <Pencil size={11} />
        Edit
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit listing">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({
              ...Object.fromEntries(new FormData(e.currentTarget).entries()),
              id: listing.id,
              // A live campaign cannot switch between sale and rent, so the select
              // is disabled — and a disabled select submits nothing.
              listingType: type,
            });
          }}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="For"
              name="listingTypeVisible"
              value={type}
              disabled={settled}
              onChange={(e) => setType(e.target.value as "sale" | "rent")}
              options={[
                { value: "sale", label: "Sale" },
                { value: "rent", label: "Rent" },
              ]}
            />
            <Input
              label="Method"
              name="method"
              defaultValue={listing.method ?? ""}
              placeholder={type === "sale" ? "Private treaty" : "Lease"}
              errors={a.fieldErrors.method}
            />
          </div>
          {settled ? (
            <p className="text-3 text-[11px] -mt-2">
              A {listing.status} listing is a result and keeps its type. Start a new listing to
              advertise it again.
            </p>
          ) : (
            type !== listing.type && (
              <p className="text-[11.5px] -mt-2 text-[#9a5b00] dark:text-[#f0b45a]">
                Changing to {type === "rent" ? "rent" : "sale"}: check the price wording and fill
                in the {type === "rent" ? "weekly rent" : "search price range"} below. The public
                page will show it as {type === "rent" ? "for lease" : "for sale"}.
              </p>
            )
          )}

          <Input
            label="Price wording, exactly as it should appear"
            name="priceDisplay"
            defaultValue={listing.priceDisplay ?? ""}
            placeholder="Offers above $750,000"
            errors={a.fieldErrors.priceDisplay}
          />
          <p className="text-3 text-[11px] -mt-2">
            Rendered verbatim, never assembled from a number. Under-quoting provisions
            make the displayed wording a legal artefact, and a live listing cannot be
            saved without it.
          </p>

          {type === "sale" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Search price from"
                name="searchPriceMin"
                type="number"
                min="0"
                defaultValue={listing.searchMin ?? ""}
                errors={a.fieldErrors.searchPriceMin}
              />
              <Input
                label="Search price to"
                name="searchPriceMax"
                type="number"
                min="0"
                defaultValue={listing.searchMax ?? ""}
                errors={a.fieldErrors.searchPriceMax}
              />
            </div>
          ) : (
            <Input
              label="Rent per week"
              name="rentPw"
              type="number"
              min="0"
              defaultValue={listing.rentPw ?? ""}
              errors={a.fieldErrors.rentPw}
            />
          )}
          <p className="text-3 text-[11px] -mt-2">
            Hidden. These drive search and matching only, and are never displayed.
          </p>

          <Input
            label="Headline"
            name="publicHeadline"
            defaultValue={listing.headline ?? ""}
            errors={a.fieldErrors.publicHeadline}
          />
          <Textarea
            label="Description"
            name="publicCopy"
            rows={5}
            defaultValue={listing.copy ?? ""}
            errors={a.fieldErrors.publicCopy}
          />
          <p className="text-3 text-[11px] -mt-2">
            Changing either of these re-embeds the listing, so matching compares against
            the copy that is actually on the page.
          </p>

          <Input
            label="Result wording"
            name="resultDisplay"
            defaultValue={listing.resultDisplay ?? ""}
            placeholder="Sold at auction — leave blank to show nothing"
            errors={a.fieldErrors.resultDisplay}
          />

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Save changes</SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}

/**
 * Publish, withdraw, settle.
 *
 * These were the two inert buttons in the prototype header. What each one offers
 * depends on where the campaign is, because most transitions are one-way: there is
 * no route back to draft, and a settled campaign is frozen. The property's own
 * status moves with it, server-side.
 */
export function ListingStatusButtons({
  listing,
}: {
  listing: { id: string; status: string; type: "sale" | "rent" };
}) {
  const settled = listing.type === "sale" ? "sold" : "leased";
  const settledLabel = listing.type === "sale" ? "Mark sold" : "Mark leased";

  if (listing.status === "sold" || listing.status === "leased") {
    return (
      <span className="text-3 text-[11.5px]">
        Settled — kept in the archive as it was
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      {(listing.status === "draft" || listing.status === "withdrawn") && (
        <ActionButton
          action={setListingStatus}
          input={{ id: listing.id, status: "live" }}
          tone="primary"
          title="Make this campaign live"
        >
          <Globe size={11} />
          {listing.status === "withdrawn" ? "Republish" : "Publish"}
        </ActionButton>
      )}
      {listing.status === "live" && (
        <ActionButton
          action={setListingStatus}
          input={{ id: listing.id, status: "under_offer" }}
          title="Mark under offer"
        >
          Under offer
        </ActionButton>
      )}
      {(listing.status === "live" || listing.status === "under_offer") && (
        <>
          <ConfirmButton
            action={setListingStatus}
            input={{ id: listing.id, status: settled }}
            confirmLabel="Yes, it settled"
            tone="plain"
            title="This freezes the campaign"
          >
            {settledLabel}
          </ConfirmButton>
          <ConfirmButton
            action={setListingStatus}
            input={{ id: listing.id, status: "withdrawn" }}
            confirmLabel="Withdraw it"
            tone="plain"
          >
            Withdraw
          </ConfirmButton>
        </>
      )}
      {listing.status === "draft" && <DeleteListingButton id={listing.id} />}
    </div>
  );
}

/** Drafts only — the server refuses anything that has been advertised. */
export function DeleteListingButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      action={deleteListing}
      input={{ id }}
      confirmLabel="Delete the draft"
      onDone={() => router.push("/listings")}
    >
      <Trash2 size={11} />
      Delete
    </ConfirmButton>
  );
}

/* ---------------------------------------------------------- inspections */

export function NewInspectionButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(createInspection, { onSuccess: () => setOpen(false) });

  return (
    <>
      <RowButton tone="primary" onClick={() => { a.reset(); setOpen(true); }}>
        <Plus size={11} />
        Add inspection
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Schedule an inspection">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({
              ...Object.fromEntries(new FormData(e.currentTarget).entries()),
              listingId,
            });
          }}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="Kind"
              name="kind"
              defaultValue="open"
              options={[
                { value: "open", label: "Open home" },
                { value: "private", label: "Private inspection" },
              ]}
              errors={a.fieldErrors.kind}
            />
            <Select
              label="How long"
              name="minutes"
              defaultValue="30"
              options={[
                { value: "15", label: "15 minutes" },
                { value: "30", label: "30 minutes" },
                { value: "45", label: "45 minutes" },
                { value: "60", label: "1 hour" },
              ]}
              errors={a.fieldErrors.minutes}
            />
          </div>
          <Input
            label="Starts"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={nextSaturdayMorning()}
            errors={a.fieldErrors.startsAt}
          />
          <Input
            label="Capacity"
            name="capacity"
            type="number"
            min="1"
            placeholder="Leave blank for no limit"
            errors={a.fieldErrors.capacity}
          />

          <p className="text-3 text-[11.5px] leading-relaxed">
            Shows on the listing page once the public site is live, and a registration
            writes an interaction and a contact — so this is a lead source, not a diary
            entry. It does not create a calendar event; add one separately if you want
            it in your diary.
          </p>

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Schedule it</SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Cancelled rather than deleted — people register for these. */
export function CancelInspectionButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      action={cancelInspection}
      input={{ id }}
      confirmLabel="Cancel it"
      title="Cancel this inspection"
    >
      <X size={11} />
      Cancel
    </ConfirmButton>
  );
}

/** Open homes are almost always a weekend morning, so that is what prefills. */
function nextSaturdayMorning() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  d.setHours(11, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
