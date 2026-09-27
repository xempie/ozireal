import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { properties, suburbs, contacts, contactRoles } from "@/db/schema";
import { runTask, TaskOutputError } from "@/server/ai/run-task";
import { ClaudeError } from "@/server/ai/claude";
import { loadPrompt } from "@/server/ai/prompts";
import { resolveContact, _internals } from "@/server/intake/resolve";
import { normaliseEmail, toE164 } from "@/lib/normalise";
import { streetKey } from "@/lib/address";
import { ActionError } from "@/server/actions/action";
import {
  importProperty,
  parseImportJson,
  formatAddress,
  type ImportPerson,
  type ImportProperty,
} from "./property-import-schema";

/**
 * Property import (bulk-in, small batches — D8 lifted for this on 2026-09-26).
 *
 * Two steps, and the gap between them is the point: `extract` + `resolve` build a
 * preview that writes NOTHING, and only `commitRow`, run from the agent's explicit
 * Import press, touches the database. §3.5 says AI never silently writes to a record;
 * a Markdown or PDF import is read by Claude, so its output is shown before it lands.
 *
 * Commit re-validates and re-resolves every row rather than trusting the preview the
 * browser sends back — the preview is a picture of the data, not a permission slip.
 */

export type ImportFileKind = "json" | "md" | "pdf";

const EXTRACT_PROMPT = "extract-properties.v1";

/** Unlike a JSON upload, an empty extraction is an answer ("nothing found"), not a schema error. */
const extraction = z.object({ properties: z.array(importProperty).max(200) });

export async function extractProperties(
  tenantId: string,
  file: { kind: ImportFileKind; content: string; name: string },
): Promise<ImportProperty[]> {
  if (file.kind === "json") {
    const r = parseImportJson(file.content);
    if (!r.ok) throw new ActionError(r.error);
    return r.properties;
  }

  const prompt = loadPrompt(EXTRACT_PROMPT);
  try {
    const { data } = await runTask(extraction, {
      task: "extract-properties",
      model: "haiku",
      output: "structured",
      system: [{ text: prompt.text, cache: true }],
      messages: [
        {
          role: "user",
          content:
            file.kind === "pdf"
              ? [
                  {
                    type: "document",
                    source: { type: "base64", media_type: "application/pdf", data: file.content },
                  },
                  { type: "text", text: `The uploaded file is "${file.name}". Extract its properties.` },
                ]
              : `The uploaded file is "${file.name}":\n\n<document>\n${file.content}\n</document>`,
        },
      ],
      // ~400 tokens a property with its people; 200 properties would not fit anyway,
      // and truncation fails loudly rather than returning half a portfolio.
      maxTokens: 16_000,
      tenantId,
      promptVersion: prompt.version,
    });
    if (data.properties.length === 0) {
      throw new ActionError("No properties were found in that file.");
    }
    return data.properties;
  } catch (e) {
    if (e instanceof ActionError) throw e;
    if (e instanceof ClaudeError) {
      throw new ActionError(
        /API key/i.test(e.message)
          ? "Reading Markdown and PDF files needs an Anthropic API key (Settings → Credentials). JSON files import without one."
          : `The file could not be read just now (${e.message.slice(0, 120)}). Try again, or upload JSON.`,
      );
    }
    if (e instanceof TaskOutputError) {
      throw new ActionError(
        "The file was read but the result did not come back in a usable shape. Nothing was imported — try again, or upload JSON.",
      );
    }
    throw e;
  }
}

/* ------------------------------------------------------------ resolution */

export type PersonMatch = {
  name: string;
  phone: string | null;
  email: string | null;
  /** existing: one live record shares a key; review: several do; new: none, or no key at all. */
  match: "existing" | "review" | "new";
  existingName: string | null;
};

export type ResolvedRow = {
  row: ImportProperty;
  address: string;
  suburbLabel: string;
  suburbId: string | null;
  /** A suburb the import would add to the list, because the file gave its postcode and state. */
  newSuburb: { name: string; state: string; postcode: string } | null;
  owner: PersonMatch | null;
  tenants: PersonMatch[];
  /** Why this row will not be imported. Null means it will. */
  problem: string | null;
};

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

async function findSuburb(tx: Tx, row: ImportProperty) {
  const matches = await tx
    .select({ id: suburbs.id, name: suburbs.name, state: suburbs.state, postcode: suburbs.postcode })
    .from(suburbs)
    .where(sql`lower(${suburbs.name}) = lower(${row.suburb.trim()})`);
  // A suburb name can recur across states and postcodes; whatever the file states narrows it.
  const narrowed = matches.filter(
    (s) =>
      (!row.postcode || s.postcode === row.postcode) &&
      (!row.state || s.state.toLowerCase() === row.state.toLowerCase()),
  );
  return narrowed.length === 1 ? narrowed[0] : null;
}

async function matchPerson(tx: Tx, p: ImportPerson): Promise<PersonMatch> {
  const email = normaliseEmail(p.email);
  const phone = toE164(p.phone);
  const candidates = email || phone ? await _internals.findCandidates(tx, email, phone) : [];
  return {
    name: p.name,
    phone: p.phone,
    email: p.email,
    match: candidates.length === 0 ? "new" : candidates.length === 1 ? "existing" : "review",
    existingName:
      candidates.length === 1 ? `${candidates[0].firstName} ${candidates[0].lastName}` : null,
  };
}

/**
 * What would happen to each row, without writing anything. `seen` catches the same
 * address appearing twice in one file — the second would otherwise be refused only at
 * commit, after the first had already been written.
 */
export async function resolveRow(
  tx: Tx,
  row: ImportProperty,
  seen: Set<string>,
): Promise<ResolvedRow> {
  const address = formatAddress(row);
  const suburb = await findSuburb(tx, row);

  let problem: string | null = null;
  let newSuburb: ResolvedRow["newSuburb"] = null;
  if (!suburb) {
    // State comes from the FILE, never a literal: §10 forbids hardcoding a jurisdiction.
    if (row.postcode && row.state) {
      newSuburb = { name: titleCase(row.suburb), state: row.state.toUpperCase(), postcode: row.postcode };
    } else {
      problem = `"${row.suburb}" is not in the suburb list, and the file does not give its postcode and state to add it.`;
    }
  }

  const key = [row.unit ?? "", row.streetNumber ?? "", streetKey(row.street), row.suburb, row.postcode ?? ""]
    .join("|")
    .toLowerCase();
  if (!problem && seen.has(key)) problem = "This address appears twice in the file.";
  seen.add(key);

  if (!problem && suburb) {
    const sameSpot = await tx
      .select({ street: properties.street })
      .from(properties)
      .where(
        and(
          eq(properties.suburbId, suburb.id),
          row.streetNumber ? eq(properties.streetNumber, row.streetNumber) : sql`true`,
          row.unit ? eq(properties.unit, row.unit) : sql`${properties.unit} is null`,
        ),
      );
    if (sameSpot.some((p) => streetKey(p.street) === streetKey(row.street))) {
      problem = "Already in your properties.";
    }
  }

  if (!problem && row.propertyType === "land" && (row.beds || row.baths)) {
    problem = "Marked as land but has bedrooms or bathrooms.";
  }

  return {
    row,
    address,
    suburbLabel: suburb
      ? `${suburb.name} ${suburb.state} ${suburb.postcode}`
      : [titleCase(row.suburb), row.state, row.postcode].filter(Boolean).join(" "),
    suburbId: suburb?.id ?? null,
    newSuburb,
    owner: row.owner ? await matchPerson(tx, row.owner) : null,
    tenants: await Promise.all(row.tenants.map((t) => matchPerson(tx, t))),
    problem,
  };
}

/* ---------------------------------------------------------------- commit */

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || null };
}

/**
 * Through the SAME identity resolution every enquiry uses (§4): a key match attaches,
 * a conflicting one creates a fresh record plus a merge review, and a name alone never
 * matches anything. The import adds the role; it never merges.
 */
async function upsertPerson(
  tx: Tx,
  tenantId: string,
  p: ImportPerson,
  role: "landlord" | "tenant",
  livesAt: { address: string; suburb: string } | null,
) {
  const { firstName, lastName } = splitName(p.name);
  const resolution = await resolveContact(
    tx,
    tenantId,
    { kind: "claimed", email: p.email, phone: p.phone, firstName, lastName },
    { channel: "manual", summary: `Property import (${role})` },
  );

  await tx
    .insert(contactRoles)
    .values({ tenantId, contactId: resolution.contactId, role })
    .onConflictDoUpdate({
      target: [contactRoles.contactId, contactRoles.role],
      set: { activeTo: null },
      setWhere: sql`${contactRoles.activeTo} is not null`,
    });

  // A tenant lives at the property. Fill the address only where it is blank, so an
  // import never overwrites something a person typed.
  if (livesAt) {
    await tx
      .update(contacts)
      .set({
        addressLine: sql`coalesce(${contacts.addressLine}, ${livesAt.address})`,
        suburb: sql`coalesce(${contacts.suburb}, ${livesAt.suburb})`,
      })
      .where(eq(contacts.id, resolution.contactId));
  }
  return { id: resolution.contactId, outcome: resolution.outcome };
}

export async function commitRow(
  tx: Tx,
  tenantId: string,
  resolved: ResolvedRow,
  sourceName: string,
) {
  const { row } = resolved;

  let suburbId = resolved.suburbId;
  let suburbState: string;
  let suburbName: string;
  let suburbPostcode: string | null;
  if (suburbId) {
    const [s] = await tx.select().from(suburbs).where(eq(suburbs.id, suburbId)).limit(1);
    suburbState = s.state;
    suburbName = s.name;
    suburbPostcode = s.postcode;
  } else {
    const ns = resolved.newSuburb!;
    const [s] = await tx
      .insert(suburbs)
      .values(ns)
      .onConflictDoUpdate({ target: [suburbs.name, suburbs.state, suburbs.postcode], set: { name: ns.name } })
      .returning();
    suburbId = s.id;
    suburbState = s.state;
    suburbName = s.name;
    suburbPostcode = s.postcode;
  }

  const owner = row.owner ? await upsertPerson(tx, tenantId, row.owner, "landlord", null) : null;

  const [created] = await tx
    .insert(properties)
    .values({
      tenantId,
      unit: row.unit,
      streetNumber: row.streetNumber,
      street: row.street,
      suburbId,
      state: suburbState,
      postcode: row.postcode || suburbPostcode,
      propertyType: row.propertyType,
      status: "off_market",
      beds: row.beds,
      baths: row.baths,
      parking: row.parking,
      landAreaSqm: row.landAreaSqm,
      ownerContactId: owner?.id ?? null,
      internalNotes: `Imported from ${sourceName}${row.sourceRef ? ` (source id ${row.sourceRef})` : ""}.`,
    })
    .returning({ id: properties.id });

  const tenants = [];
  for (const t of row.tenants) {
    tenants.push(
      await upsertPerson(tx, tenantId, t, "tenant", {
        address: resolved.address,
        suburb: suburbName,
      }),
    );
  }

  return { propertyId: created.id, owner, tenants };
}
