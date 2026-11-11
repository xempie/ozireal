"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
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
} from "./action-form";
import { createFullListing, searchContactsForListing } from "@/server/actions/listing-new";
import type { Option } from "./stock-forms";

/**
 * The one "New listing" form (owner's request, 2026-11-05): the property, the
 * advertising, the contacts on it and, optionally, going live, in one place. Photos
 * are added on the listing's page straight after saving, which is where the form
 * lands.
 */

const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "townhouse", label: "Townhouse" },
  { value: "unit", label: "Unit / apartment" },
  { value: "land", label: "Land / house and land" },
  { value: "acreage", label: "Acreage" },
  { value: "commercial", label: "Commercial" },
];

const ROLES = [
  { value: "owner", label: "Owner / vendor" },
  { value: "landlord", label: "Landlord" },
  { value: "tenant", label: "Tenant" },
  { value: "interested_buyer", label: "Interested buyer" },
  { value: "builder_developer", label: "Builder / developer" },
  { value: "estate_agent", label: "Estate agent" },
  { value: "other", label: "Other" },
];

/** The New Homes finder's areas, as the existing cards use them. */
const AREAS = [
  "Northern suburbs",
  "North-eastern suburbs",
  "Inner north & east",
  "Western & beach",
  "Southern suburbs",
  "Adelaide Hills",
  "Regional SA",
  "Interstate",
];

type Linked =
  | { key: string; role: string; contactId: string; label: string }
  | { key: string; role: string; newContact: { firstName: string; lastName: string; phone: string; email: string } };

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? undefined : Number(v));
const str = (v: FormDataEntryValue | null) => (v === null || v === "" ? undefined : String(v));

export function FullListingButton({
  properties,
  suburbs,
  label = "New listing",
}: {
  properties: Option[];
  suburbs: Option[];
  /** "New property" on the Properties page: the same one form (owner's request, 2026-11-11). */
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<"sale" | "rent">("sale");
  const [existing, setExisting] = React.useState(false);
  const [goLive, setGoLive] = React.useState(false);
  // Nothing pre-chosen (owner, 2026-11-11): where it shows is a deliberate choice.
  const [section, setSection] = React.useState<"advertised" | "new_homes" | null>(null);
  const [sectionError, setSectionError] = React.useState<string | null>(null);
  const [linked, setLinked] = React.useState<Linked[]>([]);
  const a = useAction(createFullListing, {
    onSuccess: (d) => {
      setOpen(false);
      router.push(`/listings/${d.id}`);
    },
  });
  const fe = a.fieldErrors;
  const newHomes = section === "new_homes";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (goLive && !section) {
      setSectionError("Choose where it shows on the website: Currently advertised or New Homes.");
      return;
    }
    setSectionError(null);
    const f = new FormData(e.currentTarget);
    a.run({
      listingType: type,
      // Not going live and not chosen: kept as an ordinary listing, changeable later.
      section: section ?? "advertised",
      goLive,
      propertyId: existing ? str(f.get("propertyId")) : undefined,
      streetNumber: str(f.get("streetNumber")),
      street: str(f.get("street")),
      unit: str(f.get("unit")),
      suburbId: existing ? undefined : str(f.get("suburbId")),
      propertyType: f.get("propertyType"),
      beds: num(f.get("beds")),
      baths: num(f.get("baths")),
      parking: num(f.get("parking")),
      landAreaSqm: num(f.get("landAreaSqm")),
      floorAreaSqm: num(f.get("floorAreaSqm")),
      projectName: str(f.get("projectName")),
      projectArea: str(f.get("projectArea")),
      projectReady: f.get("projectReady") === "on",
      highlights: String(f.get("highlights") ?? "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .slice(0, 4),
      priceDisplay: str(f.get("priceDisplay")),
      searchPriceMin: num(f.get("searchPriceMin")),
      searchPriceMax: num(f.get("searchPriceMax")),
      rentPw: num(f.get("rentPw")),
      publicHeadline: str(f.get("publicHeadline")),
      publicCopy: str(f.get("publicCopy")),
      contacts: linked.map((l) =>
        "contactId" in l ? { role: l.role, contactId: l.contactId } : { role: l.role, newContact: l.newContact },
      ),
    });
  }

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setLinked([]);
          setSection(null);
          setSectionError(null);
          setGoLive(false);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90"
      >
        <Plus size={13} />
        {label}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={label} wide>
        <form className="space-y-5" onSubmit={submit}>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Sale or rent">
            {(["sale", "rent"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={`min-h-9 px-4 rounded-full text-[13px] ${type === t ? "bg-[var(--accent)] text-white font-semibold" : "surface-1 border"}`}
              >
                {t === "sale" ? "For sale" : "For rent"}
              </button>
            ))}
          </div>

          {/* ---- where it will show; decides address vs project */}
          <fieldset className="rounded-lg border p-3 space-y-2 bg-[var(--accent)]/[0.04]">
            <label className="flex items-center gap-2 text-[14.5px] font-semibold">
              <input type="checkbox" className="size-4" checked={goLive} onChange={(e) => setGoLive(e.target.checked)} />
              Go live on the website
            </label>
            <p className="text-[12px] text-2 pl-6">{goLive ? "Show it in (choose one):" : "Saved as a draft. Where it will show once live (optional for now):"}</p>
            <div className="grid sm:grid-cols-2 gap-2 pl-6">
              {(
                [
                  ["advertised", "Currently advertised", "For Sale / For Rent, All Listings, home page and its suburb page. Moves to Sold when it sells."],
                  ["new_homes", "New Homes", "A project card on the New Homes page: suburb only, highlights, bed / bath / car / m², \"Talk to Esi\"."],
                ] as const
              ).map(([v, title, note]) => (
                <label
                  key={v}
                  className={`flex items-start gap-2 rounded-md p-2.5 text-[13px] cursor-pointer surface-2 ${section === v ? "border-2 border-[var(--accent)]" : "border"}`}
                >
                  <input
                    type="radio"
                    name="section"
                    className="mt-1"
                    checked={section === v}
                    onChange={() => {
                      setSection(v);
                      setSectionError(null);
                    }}
                  />
                  <span>
                    <strong>{title}</strong>
                    <span className="block text-2 text-[12px]">{note}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* ---- 1. the property */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-2">1 · {newHomes ? "The project" : "The property"}</h3>
              {!newHomes && properties.length > 0 && (
                <label className="flex items-center gap-1.5 text-[12.5px]">
                  <input type="checkbox" checked={existing} onChange={(e) => setExisting(e.target.checked)} />
                  Already in the CRM
                </label>
              )}
            </div>
            {existing && !newHomes ? (
              <Select
                label="Property"
                name="propertyId"
                options={[{ value: "", label: "Choose a property…" }, ...properties]}
                errors={fe.propertyId}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {newHomes ? (
                  <Input
                    className="col-span-2"
                    label="Project name"
                    name="projectName"
                    placeholder="Five new double-storey homes"
                    errors={fe.projectName}
                  />
                ) : (
                  <>
                    <Input label="Unit" name="unit" errors={fe.unit} />
                    <Input label="Number" name="streetNumber" errors={fe.streetNumber} />
                    <Input className="col-span-2" label="Street" name="street" errors={fe.street} />
                  </>
                )}
                <Select
                  className="col-span-2"
                  label="Suburb"
                  name="suburbId"
                  options={[{ value: "", label: "Choose a suburb…" }, ...suburbs]}
                  errors={fe.suburbId}
                />
                <Select label="Type" name="propertyType" options={PROPERTY_TYPES} />
                <Input label="Bedrooms" name="beds" type="number" min="0" errors={fe.beds} />
                <Input label="Bathrooms" name="baths" type="number" min="0" errors={fe.baths} />
                <Input label="Car spaces" name="parking" type="number" min="0" errors={fe.parking} />
                <Input label="Land m²" name="landAreaSqm" type="number" min="0" errors={fe.landAreaSqm} />
                <Input label="Total floor m²" name="floorAreaSqm" type="number" min="0" errors={fe.floorAreaSqm} />
              </div>
            )}
            {newHomes && (
              <div className="grid sm:grid-cols-3 gap-3">
                <Select
                  label="Area (New Homes finder)"
                  name="projectArea"
                  options={[{ value: "", label: "Choose…" }, ...AREAS.map((x) => ({ value: x, label: x }))]}
                />
                <Input
                  className="sm:col-span-2"
                  label="Highlights on the photo (up to 4, comma-separated)"
                  name="highlights"
                  placeholder="Only 5 homes, Under construction, Completion Feb 2027"
                />
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" name="projectReady" /> Completed, ready to move in
                </label>
              </div>
            )}
          </section>

          {/* ---- 2. the advertising */}
          <section className="space-y-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-2">2 · The advertising</h3>
            <Input
              label="Price wording buyers see, exactly as it should appear"
              name="priceDisplay"
              placeholder={type === "sale" ? "Offers above $750,000" : "$550 per week"}
              errors={fe.priceDisplay}
            />
            {type === "sale" ? (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Search price from (hidden)" name="searchPriceMin" type="number" min="0" errors={fe.searchPriceMin} />
                <Input label="Search price to (hidden)" name="searchPriceMax" type="number" min="0" errors={fe.searchPriceMax} />
              </div>
            ) : (
              <Input label="Rent per week (hidden)" name="rentPw" type="number" min="0" errors={fe.rentPw} />
            )}
            <Input label="Headline" name="publicHeadline" errors={fe.publicHeadline} />
            <Textarea label="Description" name="publicCopy" rows={4} errors={fe.publicCopy} />
            <p className="text-3 text-[11.5px]">Photos: added on the listing&rsquo;s page, which opens when you save.</p>
          </section>

          {/* ---- contacts */}
          <ContactLinks linked={linked} setLinked={setLinked} />

          <FormError message={sectionError ?? a.error} />
          <div className="flex justify-end gap-2">
            <CancelButton onClick={() => setOpen(false)} />
            <SubmitButton pending={a.pending}>{goLive ? "Save and go live" : "Save draft"}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Pick contacts already in the CRM, or add new ones on the spot, each with a role. */
function ContactLinks({ linked, setLinked }: { linked: Linked[]; setLinked: (l: Linked[]) => void }) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<{ id: string; label: string; sub: string }[]>([]);
  const [draft, setDraft] = React.useState<null | { firstName: string; lastName: string; phone: string; email: string }>(null);
  const search = useAction(searchContactsForListing, { refreshOnSuccess: false });

  React.useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await search.run({ q });
      if (r.ok)
        setResults(
          r.data.map((c) => ({
            id: c.id,
            label: `${c.firstName} ${c.lastName}`.trim(),
            sub: c.phone ?? c.email ?? "",
          })),
        );
    }, 250);
    return () => clearTimeout(t);
    // search.run is stable; q is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const add = (l: Linked) => {
    setLinked([...linked, l]);
    setQ("");
    setResults([]);
    setDraft(null);
  };
  const key = () => Math.random().toString(36).slice(2);

  return (
    <section className="space-y-2">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-2">
        Contacts on this listing <span className="normal-case font-normal">(optional, never shown on the website)</span>
      </h3>
      {linked.map((l, i) => (
        <div key={l.key} className="flex items-center gap-2 rounded-md border px-3 py-2 text-[13.5px]">
          <span className="flex-1">
            <strong>{"contactId" in l ? l.label : `${l.newContact.firstName} ${l.newContact.lastName}`.trim()}</strong>
            {!("contactId" in l) && <span className="text-2 text-[12px]"> · new contact</span>}
          </span>
          <select
            aria-label="Role on this listing"
            className="surface-2 border rounded-md px-2 py-1.5 text-[13px]"
            value={l.role}
            onChange={(e) => setLinked(linked.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="button" aria-label="Remove" className="p-1.5" onClick={() => setLinked(linked.filter((_, j) => j !== i))}>
            <X size={15} />
          </button>
        </div>
      ))}

      {draft ? (
        <div className="rounded-md border border-dashed border-[var(--accent)] p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <p className="col-span-full text-[12.5px] font-semibold text-[var(--accent)]">New contact, created when you save</p>
          <Input label="First name" name="nc-first" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
          <Input label="Last name" name="nc-last" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          <Input label="Mobile" name="nc-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          <Input label="Email" name="nc-email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          <div className="col-span-full flex gap-2">
            <button
              type="button"
              disabled={!draft.firstName.trim()}
              onClick={() => add({ key: key(), role: "interested_buyer", newContact: draft })}
              className="min-h-8 px-3 rounded-md bg-[var(--accent)] text-white text-[12.5px] disabled:opacity-50"
            >
              Add to listing
            </button>
            <button type="button" onClick={() => setDraft(null)} className="min-h-8 px-3 rounded-md border text-[12.5px]">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <input
            aria-label="Search contacts"
            placeholder="Search contacts by name, phone or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full surface-2 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px]"
          />
          {q.trim().length >= 2 && (
            <div className="absolute z-10 mt-1 w-full surface-2 border rounded-md shadow-lg text-[13.5px]">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => add({ key: key(), role: "owner", contactId: r.id, label: r.label })}
                  className="block w-full text-left px-3 py-2 hover:surface-3 border-b"
                >
                  <strong>{r.label}</strong> <span className="text-2 text-[12px]">{r.sub}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const [firstName, ...rest] = q.trim().split(/\s+/);
                  const looksPhone = /^[\d +()-]{6,}$/.test(q.trim());
                  const looksEmail = q.includes("@");
                  setDraft({
                    firstName: looksPhone || looksEmail ? "" : firstName,
                    lastName: looksPhone || looksEmail ? "" : rest.join(" "),
                    phone: looksPhone ? q.trim() : "",
                    email: looksEmail ? q.trim() : "",
                  });
                }}
                className="block w-full text-left px-3 py-2 font-semibold text-[var(--accent)] hover:surface-3"
              >
                + Add &ldquo;{q.trim()}&rdquo; as a new contact
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
