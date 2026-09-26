import { z } from "zod";

/**
 * The shape a property import is normalised to, whatever file it came from.
 *
 * A JSON upload is validated against this directly; a Markdown or PDF upload is read by
 * Claude, which is asked for exactly this shape and then held to it (runTask). So there
 * is one definition of "an importable property", and neither path can put anything in
 * the database the other could not.
 *
 * Deliberately absent: rent, arrears, lease dates, trust balances, owner payouts. The
 * product advertises rentals and does not manage them (D10), and trust accounting is out
 * of scope entirely (§14). A property-management export carries all of that; the importer
 * takes the property and the people and leaves the ledger behind.
 */

export const IMPORT_PROPERTY_TYPES = [
  "house",
  "unit",
  "townhouse",
  "land",
  "acreage",
  "commercial",
] as const;

/** What people call the same thing in exports. Anything unrecognised is refused, not guessed. */
const TYPE_ALIASES: Record<string, (typeof IMPORT_PROPERTY_TYPES)[number]> = {
  apartment: "unit",
  flat: "unit",
  villa: "unit",
  duplex: "townhouse",
  terrace: "townhouse",
  "vacant land": "land",
  block: "land",
  rural: "acreage",
};

const text = (max: number) =>
  z.preprocess(
    (v) => (v === undefined || v === null ? null : String(v).trim() || null),
    z.string().max(max).nullable(),
  );

const count = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
  z.number().int().min(0).max(30).nullable(),
);

export const importPerson = z.object({
  name: z.preprocess(
    // "Hassan Varasi (1/17 DEVON)" — a label the source system appended, not a name.
    (v) =>
      String(v ?? "")
        .replace(/\s*\([^)]*\)\s*$/, "")
        .replace(/\.{3,}$|…$/, "")
        .trim(),
    z.string().min(1).max(160),
  ),
  phone: text(40).default(null),
  email: text(320).default(null),
});
export type ImportPerson = z.infer<typeof importPerson>;

export const importProperty = z.object({
  unit: text(20).default(null),
  streetNumber: text(20).default(null),
  street: z.string().trim().min(1).max(120),
  suburb: z.string().trim().min(1).max(80),
  postcode: text(10).default(null),
  state: text(10).default(null),
  propertyType: z.preprocess(
    (v) => {
      const s = String(v ?? "").trim().toLowerCase();
      return TYPE_ALIASES[s] ?? s;
    },
    z.enum(IMPORT_PROPERTY_TYPES),
  ),
  beds: count.default(null),
  baths: count.default(null),
  parking: count.default(null),
  landAreaSqm: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number().int().min(0).max(10_000_000).nullable(),
  ).default(null),
  /** The source system's own id, kept in the private notes so a row can be traced back. */
  sourceRef: text(60).default(null),
  owner: importPerson.nullable().default(null),
  tenants: z.array(importPerson).max(8).default([]),
});
export type ImportProperty = z.infer<typeof importProperty>;

/** A file holds a batch. 200 is well past any real export and well short of a bulk load (D8). */
export const importFile = z.object({
  properties: z.array(importProperty).min(1, "The file contained no properties.").max(200),
});

/** "1/17 Devon Drive" — the same shape createProperty builds. */
export function formatAddress(r: Pick<ImportProperty, "unit" | "streetNumber" | "street">) {
  return [r.unit ? `${r.unit}/` : "", r.streetNumber, r.street]
    .filter(Boolean)
    .join(" ")
    .replace("/ ", "/");
}

/** A JSON upload may be the object above, or just the array. */
export function parseImportJson(raw: string) {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false as const, error: "That file is not valid JSON." };
  }
  const parsed = importFile.safeParse(Array.isArray(json) ? { properties: json } : json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "file"}: ${i.message}`)
      .join("; ");
    return { ok: false as const, error: `The JSON does not match the import format (${issues}).` };
  }
  return { ok: true as const, properties: parsed.data.properties };
}
