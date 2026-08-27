"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  useAction,
  Modal,
  Input,
  Textarea,
  Select,
  SubmitButton,
  FormError,
} from "./action-form";
import { createProperty, createListing } from "@/server/actions/stock";

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
