import { sql } from "drizzle-orm";
import type { ZodTypeAny } from "zod";
import { auth } from "@/auth";
import { query } from "@/db";
import { suburbs } from "@/db/schema";
import type { ActionResult } from "@/server/actions/action";
import { createContact, updateContact, logInteraction, recordFollowupOutcome } from "@/server/actions/contacts";
import { createTask, completeTask } from "@/server/actions/ops";
import { createProperty, updateProperty, createListing, updateListing } from "@/server/actions/stock";
import { createMessageDraft } from "@/server/actions/drafts";
import { recordConsent } from "@/server/actions/consent";
import { matchContactsForListing, matchListingsForContact } from "@/server/matching/engine";
import { getContact, getProperties, getListing, getTasks } from "@/server/queries";
import { TOOLS, type ToolName } from "./tools";

/**
 * Proposed changes: how a card describes one, and what "Do it" runs.
 *
 * `apply` calls the SAME Server Action the screen's own button calls. The assistant gets
 * no private write path: the Zod schema, the refusals ("that address is already in your
 * stock"), the tenant scope and the audit row are all the action's, unchanged.
 */

export type WriteCard = { title: string; lines: string[] };
export type WriteOutcome = {
  ok: boolean;
  message: string;
  href?: string;
  /** Suggested next steps, phrased as the agent would ask for them. Shown as chips. */
  next?: string[];
};

const label = (s: string) =>
  s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

async function contactName(id: unknown) {
  if (typeof id !== "string") return null;
  const c = await getContact(id).catch(() => null);
  return c ? `${c.firstName} ${c.lastName}` : "unknown contact";
}

async function propertyAddress(id: unknown) {
  if (typeof id !== "string") return null;
  const p = (await getProperties()).find((x) => x.id === id);
  return p ? `${p.unit ? `${p.unit}/` : ""}${p.address}, ${p.suburb ?? ""}` : "unknown property";
}

async function listingAddress(id: unknown) {
  if (typeof id !== "string") return null;
  const l = await getListing(id);
  return l ? l.address : "unknown listing";
}

/** What the card says. Ids are replaced by the names a person recognises. */
export async function describeWrite(name: ToolName, input: Record<string, unknown>): Promise<WriteCard> {
  const fieldLines = (omit: string[]) =>
    Object.entries(input)
      .filter(([k, v]) => !omit.includes(k) && v !== undefined && v !== "")
      .map(([k, v]) => `${label(k)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);

  switch (name) {
    case "create_contact":
      return { title: `Add contact ${input.firstName} ${input.lastName}`, lines: fieldLines(["firstName", "lastName"]) };
    case "update_contact":
      return { title: `Update ${await contactName(input.contactId)}`, lines: fieldLines(["contactId"]) };
    case "log_interaction":
      return {
        title: `Log ${input.direction === "out" ? "outgoing" : "incoming"} ${input.channel} with ${await contactName(input.contactId)}`,
        lines: fieldLines(["contactId", "channel", "direction"]),
      };
    case "record_followup":
      return { title: `Record follow-up with ${await contactName(input.contactId)}`, lines: fieldLines(["contactId"]) };
    case "create_task": {
      const lines = [];
      if (input.contactId) lines.push(`Contact: ${await contactName(input.contactId)}`);
      if (input.listingId) lines.push(`Listing: ${await listingAddress(input.listingId)}`);
      if (input.dueInDays !== undefined)
        lines.push(`Due: ${input.dueInDays === 0 ? "today" : `in ${input.dueInDays} day${input.dueInDays === 1 ? "" : "s"}`}`);
      return { title: `Create task: ${input.title}`, lines };
    }
    case "complete_task": {
      const t = (await getTasks()).find((x) => x.id === input.taskId);
      return { title: `Mark done: ${t?.title ?? "unknown task"}`, lines: [] };
    }
    case "create_property": {
      const addr = [input.unit ? `${input.unit}/` : "", input.streetNumber, input.street].filter(Boolean).join(" ").replace("/ ", "/");
      const lines = fieldLines(["unit", "streetNumber", "street", "suburb", "ownerContactId"]);
      if (input.ownerContactId) lines.push(`Owner: ${await contactName(input.ownerContactId)}`);
      return { title: `Add property ${addr}, ${input.suburb}`, lines };
    }
    case "update_property": {
      const lines = fieldLines(["propertyId", "ownerContactId"]);
      if (input.ownerContactId) lines.push(`Owner: ${await contactName(input.ownerContactId)}`);
      return { title: `Update ${await propertyAddress(input.propertyId)}`, lines };
    }
    case "create_listing":
      return {
        title: `Draft a ${input.listingType === "rent" ? "rental" : "sale"} listing for ${await propertyAddress(input.propertyId)}`,
        lines: [...fieldLines(["propertyId", "listingType"]), "Stays a draft until you publish it on the listing screen."],
      };
    case "update_listing":
      return { title: `Update listing ${await listingAddress(input.listingId)}`, lines: fieldLines(["listingId"]) };
    case "run_matching":
      return {
        title: input.listingId
          ? `Find matching contacts for ${await listingAddress(input.listingId)}`
          : `Find matching listings for ${await contactName(input.contactId)}`,
        lines: ["Uses AI to rank the candidates and write a reason for each (a few cents)."],
      };
    case "record_consent": {
      const ch = input.channel === "sms" ? "SMS" : String(input.channel);
      const how = String(input.method).replace("_", " ");
      return {
        title:
          input.status === "granted"
            ? `Record that ${await contactName(input.contactId)} agreed to ${ch}`
            : `Record that ${await contactName(input.contactId)} withdrew from ${ch}`,
        lines: [
          `How: ${how}`,
          ...(input.wording ? [`What they agreed to: ${input.wording}`] : []),
          "Kept permanently as Spam Act evidence. Only confirm if this is what they said.",
        ],
      };
    }
    case "draft_message": {
      const lines = [];
      if (input.subject) lines.push(`Subject: ${input.subject}`);
      lines.push(String(input.body));
      lines.push("Goes to Approvals. Nothing is sent until you send it there.");
      return {
        title: `Draft ${input.channel === "sms" ? "an SMS" : "an email"} to ${await contactName(input.contactId)}`,
        lines,
      };
    }
    default:
      return { title: name, lines: fieldLines([]) };
  }
}

function outcome<T>(r: ActionResult<T>, success: string, href?: string): WriteOutcome {
  if (r.ok) return { ok: true, message: success, href };
  const fields = r.fieldErrors
    ? Object.entries(r.fieldErrors)
        .map(([k, v]) => `${k}: ${v?.[0]}`)
        .join("; ")
    : "";
  return { ok: false, message: fields ? `${r.error} (${fields})` : r.error };
}

const opt = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

/**
 * What an agent usually does next, after each kind of change. Fixed rather than
 * generated, so the obvious follow-up is always offered even if the model's own
 * suggestions wander. Phrased as sentences the assistant can act on directly.
 */
async function nextSteps(name: ToolName, input: Record<string, unknown>): Promise<string[]> {
  switch (name) {
    case "create_contact":
    case "update_contact": {
      const who =
        name === "create_contact"
          ? `${input.firstName} ${input.lastName}`
          : ((await contactName(input.contactId)) ?? "them");
      return [
        `Find properties that match ${who}`,
        `Add a follow-up task for ${who} tomorrow`,
        `Draft an SMS to ${who}`,
      ];
    }
    case "log_interaction":
    case "record_followup": {
      const who = (await contactName(input.contactId)) ?? "them";
      return [`Add a task to follow up ${who} next week`, `Find properties that match ${who}`];
    }
    case "create_task":
    case "complete_task":
      return ["Show my open tasks", "What is overdue?"];
    case "create_property":
    case "update_property": {
      const addr =
        name === "create_property"
          ? [input.unit ? `${input.unit}/` : "", input.streetNumber, input.street].filter(Boolean).join(" ").replace("/ ", "/")
          : ((await propertyAddress(input.propertyId)) ?? "it");
      return [
        `Create a sale listing for ${addr}`,
        `Create a rental listing for ${addr}`,
        `Add a task about ${addr}`,
      ];
    }
    case "create_listing":
    case "update_listing":
      return [
        "Find matching contacts for this listing",
        "Write the listing headline and copy",
        "Add a task to book the photographer",
      ];
    case "run_matching":
      return input.listingId
        ? ["Show the matches with their reasons", "Draft an SMS to the top match"]
        : ["Show the matching listings", "Draft an SMS about the best one"];
    case "draft_message":
      return ["Draft the same message to the next match", "Add a task to follow up in 3 days"];
    case "record_consent": {
      if (input.status !== "granted") return [];
      const who = (await contactName(input.contactId)) ?? "them";
      return input.channel === "email"
        ? [`Draft an email to ${who}`]
        : input.channel === "sms"
          ? [`Draft an SMS to ${who}`]
          : [`Add a task to call ${who}`];
    }
    default:
      return [];
  }
}

/** Runs a confirmed change, and on success attaches the usual next steps. */
export async function applyWrite(name: ToolName, rawInput: unknown): Promise<WriteOutcome> {
  const result = await applyWriteInner(name, rawInput);
  if (!result.ok) return result;
  const input = (TOOLS[name].schema as ZodTypeAny).safeParse(rawInput ?? {});
  const next = input.success ? await nextSteps(name, input.data as Record<string, unknown>).catch(() => []) : [];
  return { ...result, next };
}

async function applyWriteInner(name: ToolName, rawInput: unknown): Promise<WriteOutcome> {
  const parsed = (TOOLS[name].schema as ZodTypeAny).safeParse(rawInput ?? {});
  if (!parsed.success) return { ok: false, message: "That request was not in a usable shape." };
  const input = parsed.data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- validated just above against the tool's own schema

  switch (name) {
    case "create_contact": {
      const r = await createContact({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? "",
        phone: input.phone ?? "",
        suburb: input.suburb,
        roles: input.roles,
        doNotContact: false,
      });
      return outcome(r, `Added ${input.firstName} ${input.lastName}.`, r.ok ? `/contacts/${r.data.id}` : undefined);
    }

    case "update_contact": {
      const c = await getContact(input.contactId);
      if (!c) return { ok: false, message: "That contact no longer exists." };
      const r = await updateContact({
        id: c.id,
        firstName: input.firstName ?? c.firstName,
        lastName: input.lastName ?? c.lastName,
        email: input.email ?? c.email ?? "",
        phone: input.phone ?? c.phone ?? "",
        suburb: input.suburb ?? c.suburb ?? undefined,
        roles: input.roles ?? (c.roles.length ? c.roles : ["buyer"]),
        doNotContact: c.doNotContact,
      });
      return outcome(r, `Updated ${c.firstName} ${c.lastName}.`, `/contacts/${c.id}`);
    }

    case "log_interaction": {
      const r = await logInteraction(input);
      return outcome(r, "Logged.", `/contacts/${input.contactId}`);
    }

    case "record_followup": {
      const r = await recordFollowupOutcome(input);
      return outcome(r, "Follow-up recorded.", `/contacts/${input.contactId}`);
    }

    case "create_task": {
      const r = await createTask(input);
      return outcome(r, "Task created.", "/tasks");
    }

    case "complete_task": {
      const r = await completeTask({ id: input.taskId });
      return outcome(r, "Task done.", "/tasks");
    }

    case "create_property": {
      const matchesFound = await query((tx) =>
        tx
          .select({ id: suburbs.id, postcode: suburbs.postcode })
          .from(suburbs)
          .where(sql`lower(${suburbs.name}) = lower(${String(input.suburb).trim()})`),
      );
      const narrowed = input.postcode
        ? matchesFound.filter((s) => s.postcode === input.postcode)
        : matchesFound;
      if (narrowed.length === 0) {
        return { ok: false, message: `"${input.suburb}" is not in the suburb list. Add it from the property import, or check the spelling.` };
      }
      if (narrowed.length > 1) {
        return { ok: false, message: `"${input.suburb}" exists with several postcodes (${narrowed.map((s) => s.postcode).join(", ")}). Say which.` };
      }
      const { suburb: _s, ...rest } = input;
      void _s;
      const r = await createProperty({ ...rest, suburbId: narrowed[0].id });
      return outcome(r, r.ok ? `Added ${r.data.address}.` : "", r.ok ? `/properties/${r.data.id}` : undefined);
    }

    case "update_property": {
      const p = (await getProperties()).find((x) => x.id === input.propertyId);
      if (!p) return { ok: false, message: "That property no longer exists." };
      const r = await updateProperty({
        id: p.id,
        unit: opt(p.unit),
        streetNumber: opt(p.streetNumber),
        street: p.street ?? "",
        suburbId: p.suburbId ?? "",
        postcode: opt(p.postcode),
        propertyType: input.propertyType ?? p.type,
        status: input.status,
        ownerContactId: input.ownerContactId ?? p.ownerContactId ?? "",
        beds: input.beds ?? opt(p.beds),
        baths: input.baths ?? opt(p.baths),
        parking: input.parking ?? opt(p.parking),
        landAreaSqm: input.landAreaSqm ?? opt(p.landSqm),
        internalNotes: input.internalNotes ?? opt(p.internalNotes),
        internalPriceExpectation: opt(p.internalPriceExpectation),
      });
      return outcome(r, "Property updated.", `/properties/${p.id}`);
    }

    case "create_listing": {
      const r = await createListing(input);
      return outcome(r, "Draft listing created. Publish it from the listing screen when it is ready.", r.ok ? `/listings/${r.data.id}` : undefined);
    }

    case "update_listing": {
      const l = await getListing(input.listingId);
      if (!l) return { ok: false, message: "That listing no longer exists." };
      const r = await updateListing({
        id: l.id,
        listingType: l.type,
        method: input.method ?? opt(l.method),
        priceDisplay: input.priceDisplay ?? opt(l.priceDisplay),
        searchPriceMin: input.searchPriceMin ?? opt(l.searchMin),
        searchPriceMax: input.searchPriceMax ?? opt(l.searchMax),
        rentPw: input.rentPw ?? opt(l.rentPw),
        publicHeadline: input.publicHeadline ?? opt(l.headline),
        publicCopy: input.publicCopy ?? opt(l.copy),
        resultDisplay: opt(l.resultDisplay),
      });
      return outcome(r, "Listing updated.", `/listings/${l.id}`);
    }

    case "run_matching": {
      const session = await auth();
      const tenantId = session?.user?.tenantId;
      if (!tenantId) return { ok: false, message: "You are signed out." };
      try {
        const m = input.listingId
          ? await matchContactsForListing(tenantId, input.listingId)
          : input.contactId
            ? await matchListingsForContact(tenantId, input.contactId)
            : null;
        if (!m) return { ok: false, message: "Give a listing or a contact to match." };
        if (m.skipped) return { ok: false, message: `Matching did not run: ${m.skipped}` };
        return {
          ok: true,
          message: `Matching found ${m.written} match${m.written === 1 ? "" : "es"} (${m.stage1} passed the filters).`,
          href: input.listingId ? `/listings/${input.listingId}` : `/contacts/${input.contactId}`,
        };
      } catch (e) {
        return { ok: false, message: `Matching failed: ${e instanceof Error ? e.message.slice(0, 160) : "unknown error"}` };
      }
    }

    case "record_consent": {
      const r = await recordConsent(input);
      return outcome(
        r,
        input.status === "granted" ? "Consent recorded." : "Withdrawal recorded.",
        `/contacts/${input.contactId}`,
      );
    }

    case "draft_message": {
      const r = await createMessageDraft(input);
      return outcome(r, "Draft is waiting in Approvals. Review and send it there.", "/approvals");
    }

    default:
      return { ok: false, message: `${name} is not something the assistant can change.` };
  }
}
