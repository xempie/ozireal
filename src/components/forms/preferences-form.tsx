"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { useAction, Modal, Input, Textarea, SubmitButton, CancelButton, FormError } from "./action-form";
import { setContactPreferences } from "@/server/actions/preferences";

/**
 * Edit what a contact is looking for: the fields matching filters on.
 *
 * The areas box takes suburbs and postcodes mixed ("Norwood, Kensington, 5067"). The
 * server sorts them out (see resolveAreas in actions/preferences.ts), so a suburb
 * that was never loaded still works as "Salisbury 5108" or just "5108".
 *
 * Budget fields accept "700k" and "1.2m" as well as plain numbers. A field left blank
 * is cleared, because this dialog is the whole picture rather than a patch.
 */

export type EditablePreferences = {
  suburbs: string[];
  postcodes: string[];
  priceMin: number | null;
  priceMax: number | null;
  rentPwMax: number | null;
  bedsMin: number | null;
  bathsMin: number | null;
  parkingMin: number | null;
  propertyTypes: string[];
  timeline: string | null;
  financeStatus: string | null;
  softRequirements: string | null;
} | null;

const TYPES = [
  ["house", "House"],
  ["unit", "Unit / apartment"],
  ["townhouse", "Townhouse"],
  ["land", "Land"],
  ["acreage", "Acreage"],
  ["commercial", "Commercial"],
] as const;

/** "700k" → 700000, "1.2m" → 1200000, "$850,000" → 850000, "" → null. */
function money(v: FormDataEntryValue | null): number | null | "bad" {
  const s = String(v ?? "").trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!s) return null;
  const m = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(s);
  if (!m) return "bad";
  const n = Number(m[1]) * (m[2] === "m" ? 1_000_000 : m[2] === "k" ? 1_000 : 1);
  return Math.round(n);
}

function whole(v: FormDataEntryValue | null): number | null | "bad" {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /^\d+$/.test(s) ? Number(s) : "bad";
}

const fmt = (n: number | null) => (n === null ? "" : String(n));

export function EditPreferencesButton({
  contactId,
  current,
}: {
  contactId: string;
  current: EditablePreferences;
}) {
  const [open, setOpen] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const a = useAction(setContactPreferences, { onSuccess: () => setOpen(false) });

  const areas = current ? [...current.suburbs, ...current.postcodes].join(", ") : "";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    const f = new FormData(e.currentTarget);

    const nums = {
      priceMin: money(f.get("priceMin")),
      priceMax: money(f.get("priceMax")),
      rentPwMax: money(f.get("rentPwMax")),
      bedsMin: whole(f.get("bedsMin")),
      bathsMin: whole(f.get("bathsMin")),
      parkingMin: whole(f.get("parkingMin")),
    };
    const bad = Object.entries(nums).find(([, v]) => v === "bad");
    if (bad) {
      setLocalError("Numbers only in the budget and minimum fields (700k and 1.2m are fine).");
      return;
    }
    const str = (k: string) => String(f.get(k) ?? "").trim() || null;

    a.run({
      contactId,
      ...nums,
      propertyTypes: f.getAll("propertyTypes").map(String),
      areas: String(f.get("areas") ?? "")
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      replaceAreas: true,
      timeline: str("timeline"),
      financeStatus: str("financeStatus"),
      softRequirements: str("softRequirements"),
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          a.reset();
          setLocalError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 text-[12px] px-2.5 min-h-7 rounded-md surface-2 border hover:surface-3"
      >
        <Pencil size={12} />
        {current ? "Edit" : "Add"}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="What they are looking for">
        <form className="space-y-3" onSubmit={submit}>
          <Textarea
            label="Suburbs or postcodes"
            name="areas"
            rows={2}
            defaultValue={areas}
            placeholder="e.g. Norwood, Kensington, 5067, Salisbury 5108"
            errors={a.fieldErrors.areas}
          />
          <p className="text-3 text-[11px] -mt-2">
            Separate with commas. A postcode covers every suburb in it. If a suburb is not
            recognised, add its postcode after it.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Budget from" name="priceMin" defaultValue={fmt(current?.priceMin ?? null)} placeholder="e.g. 650k" inputMode="decimal" />
            <Input label="Budget to" name="priceMax" defaultValue={fmt(current?.priceMax ?? null)} placeholder="e.g. 850k" inputMode="decimal" />
          </div>
          <Input
            label="Or rent up to ($ a week)"
            name="rentPwMax"
            defaultValue={fmt(current?.rentPwMax ?? null)}
            placeholder="for tenants, e.g. 600"
            inputMode="numeric"
          />

          <div className="grid grid-cols-3 gap-2">
            <Input label="Beds (min)" name="bedsMin" defaultValue={fmt(current?.bedsMin ?? null)} inputMode="numeric" />
            <Input label="Baths (min)" name="bathsMin" defaultValue={fmt(current?.bathsMin ?? null)} inputMode="numeric" />
            <Input label="Car (min)" name="parkingMin" defaultValue={fmt(current?.parkingMin ?? null)} inputMode="numeric" />
          </div>

          <fieldset>
            <legend className="block text-[12px] font-medium text-2 mb-1.5">Property type</legend>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map(([value, label]) => (
                <label
                  key={value}
                  className="inline-flex items-center gap-1.5 text-[12.5px] border rounded-md px-2 py-1.5 surface-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name="propertyTypes"
                    value={value}
                    defaultChecked={current?.propertyTypes.includes(value) ?? false}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-3 text-[11px] mt-1">None ticked means any type.</p>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Timeline" name="timeline" defaultValue={current?.timeline ?? ""} placeholder="e.g. within 3 months" />
            <Input label="Finance" name="financeStatus" defaultValue={current?.financeStatus ?? ""} placeholder="e.g. pre-approved" />
          </div>

          <Textarea
            label="Anything else, in their words"
            name="softRequirements"
            rows={2}
            defaultValue={current?.softRequirements ?? ""}
            placeholder="e.g. quiet street, north-facing yard, walk to school"
          />

          <FormError message={localError ?? a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Save</SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}
