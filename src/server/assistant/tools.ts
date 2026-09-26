import { z } from "zod";
import type { ToolDefinition } from "@/server/ai/claude";
import {
  getHomeCounts,
  getContacts,
  getContact,
  getInteractionsFor,
  getProperties,
  getListings,
  getTasks,
  getMatchesForListing,
  getMatchesForContact,
} from "@/server/queries";

/**
 * The assistant's tools.
 *
 * Two kinds, and the difference is the product's rules made mechanical:
 *
 *   read  — answered on the spot. Reports, lists, look-ups. Nothing changes.
 *   write — NEVER executed by the model. The turn stops, the chat shows a card saying
 *           exactly what would happen, and only the person's "Do it" runs it — through
 *           the same Server Action the screen's own button calls, so every check,
 *           refusal and audit row applies unchanged (rules 1 and 5).
 *
 * There is no send tool. The furthest a message gets is a draft in Approvals.
 */

const ROLES = ["buyer", "vendor", "landlord", "tenant", "referrer", "investor", "business_vendor", "agent"] as const;
const PROPERTY_TYPES = ["house", "unit", "townhouse", "land", "acreage", "commercial"] as const;
const uuid = () => z.string().uuid();

type ToolSpec = {
  kind: "read" | "write";
  description: string;
  /** Always a z.object; typed loosely so `satisfies` does not fight Zod's generics. */
  schema: z.ZodTypeAny;
};

export const TOOLS = {
  /* ------------------------------------------------------------------ reads */
  get_overview: {
    kind: "read",
    description:
      "Headline numbers: contacts, follow-ups due, properties (listed / off market), open and overdue tasks, and items waiting in Approvals or the Confirm queue.",
    schema: z.object({}),
  },
  search_contacts: {
    kind: "read",
    description:
      "Find contacts. Filter by free text (name, email, phone, suburb), by role, or to those with a follow-up due. Returns up to `limit` rows with id, roles, intent and follow-up state.",
    schema: z.object({
      query: z.string().max(100).optional(),
      role: z.enum(ROLES).optional(),
      followupDue: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  },
  get_contact: {
    kind: "read",
    description:
      "One contact in full: details, roles, preferences, AI brief, recent interactions and open tasks.",
    schema: z.object({ contactId: uuid() }),
  },
  list_properties: {
    kind: "read",
    description:
      "Properties, optionally filtered. status 'listed' means a live or under-offer campaign; the others are the property's own status.",
    schema: z.object({
      status: z
        .enum(["all", "listed", "off_market", "prospect", "appraised", "sold", "archived"])
        .optional(),
      suburb: z.string().max(80).optional(),
    }),
  },
  get_property: {
    kind: "read",
    description: "One property with its owner and every listing (campaign) it has had.",
    schema: z.object({ propertyId: uuid() }),
  },
  list_listings: {
    kind: "read",
    description: "Sale and rental campaigns, optionally by status, with price wording, views and enquiries.",
    schema: z.object({
      status: z.enum(["draft", "live", "under_offer", "sold", "leased", "withdrawn"]).optional(),
    }),
  },
  list_tasks: {
    kind: "read",
    description: "Tasks. filter: open (default), overdue, done or all.",
    schema: z.object({ filter: z.enum(["open", "overdue", "done", "all"]).optional() }),
  },
  get_matches: {
    kind: "read",
    description:
      "Existing match results: contacts matched to a listing, or listings matched to a contact, each with its one-line reason. Use run_matching first if none exist.",
    schema: z.object({ listingId: uuid().optional(), contactId: uuid().optional() }),
  },

  /* ----------------------------------------------------------------- writes */
  create_contact: {
    kind: "write",
    description: "Add a person to the contact list. Duplicates by email or phone raise a merge review, never a merge.",
    schema: z.object({
      firstName: z.string().min(1).max(80),
      lastName: z.string().min(1).max(80),
      email: z.string().max(320).optional(),
      phone: z.string().max(30).optional(),
      suburb: z.string().max(80).optional(),
      roles: z.array(z.enum(ROLES)).min(1),
    }),
  },
  update_contact: {
    kind: "write",
    description: "Change a contact's details or roles. Only the fields given change.",
    schema: z.object({
      contactId: uuid(),
      firstName: z.string().min(1).max(80).optional(),
      lastName: z.string().min(1).max(80).optional(),
      email: z.string().max(320).optional(),
      phone: z.string().max(30).optional(),
      suburb: z.string().max(80).optional(),
      roles: z.array(z.enum(ROLES)).min(1).optional(),
    }),
  },
  log_interaction: {
    kind: "write",
    description: "Record something that happened with a contact (a call, a meeting, an SMS conversation).",
    schema: z.object({
      contactId: uuid(),
      channel: z.enum(["phone", "sms", "manual", "social"]),
      direction: z.enum(["in", "out"]),
      subject: z.string().max(200).optional(),
      body: z.string().min(1).max(4000),
    }),
  },
  record_followup: {
    kind: "write",
    description: "Record the outcome of a follow-up and, optionally, when the next one is due.",
    schema: z.object({
      contactId: uuid(),
      outcome: z.string().min(3).max(500),
      channel: z.enum(["phone", "email", "sms", "manual", "social"]),
      nextDueInDays: z.number().int().min(0).max(365).optional(),
    }),
  },
  create_task: {
    kind: "write",
    description: "Create a task, optionally tied to a contact or listing and due in N days.",
    schema: z.object({
      title: z.string().min(3).max(200),
      contactId: uuid().optional(),
      listingId: uuid().optional(),
      dueInDays: z.number().int().min(0).max(365).optional(),
    }),
  },
  complete_task: {
    kind: "write",
    description: "Mark a task done.",
    schema: z.object({ taskId: uuid() }),
  },
  create_property: {
    kind: "write",
    description:
      "Add a property to stock. `suburb` is a suburb name; it must already be in the suburb list. Status is prospect, appraised or off_market.",
    schema: z.object({
      unit: z.string().max(20).optional(),
      streetNumber: z.string().max(20).optional(),
      street: z.string().min(1).max(120),
      suburb: z.string().min(1).max(80),
      postcode: z.string().max(10).optional(),
      propertyType: z.enum(PROPERTY_TYPES),
      status: z.enum(["prospect", "appraised", "off_market"]).optional(),
      beds: z.number().int().min(0).max(30).optional(),
      baths: z.number().int().min(0).max(30).optional(),
      parking: z.number().int().min(0).max(30).optional(),
      landAreaSqm: z.number().int().min(0).max(10_000_000).optional(),
      ownerContactId: uuid().optional(),
      internalNotes: z.string().max(2000).optional(),
    }),
  },
  update_property: {
    kind: "write",
    description: "Change a property's details, owner or status. Only the fields given change.",
    schema: z.object({
      propertyId: uuid(),
      propertyType: z.enum(PROPERTY_TYPES).optional(),
      status: z.enum(["prospect", "appraised", "off_market", "archived"]).optional(),
      beds: z.number().int().min(0).max(30).optional(),
      baths: z.number().int().min(0).max(30).optional(),
      parking: z.number().int().min(0).max(30).optional(),
      landAreaSqm: z.number().int().min(0).max(10_000_000).optional(),
      ownerContactId: uuid().optional(),
      internalNotes: z.string().max(2000).optional(),
    }),
  },
  create_listing: {
    kind: "write",
    description:
      "Start a DRAFT sale or rental campaign for a property. priceDisplay is the exact public wording (e.g. 'Offers over $750,000') and must be the agent's words — ask for it rather than inventing one. Publishing is done by the agent on the listing screen, not here.",
    schema: z.object({
      propertyId: uuid(),
      listingType: z.enum(["sale", "rent"]),
      method: z.string().max(60).optional(),
      priceDisplay: z.string().max(200).optional(),
      searchPriceMin: z.number().int().min(0).max(50_000_000).optional(),
      searchPriceMax: z.number().int().min(0).max(50_000_000).optional(),
      rentPw: z.number().int().min(0).max(100_000).optional(),
      publicHeadline: z.string().max(200).optional(),
      publicCopy: z.string().max(6000).optional(),
    }),
  },
  update_listing: {
    kind: "write",
    description: "Change a listing's wording, headline, copy, method or price fields. Only the fields given change.",
    schema: z.object({
      listingId: uuid(),
      method: z.string().max(60).optional(),
      priceDisplay: z.string().max(200).optional(),
      searchPriceMin: z.number().int().min(0).max(50_000_000).optional(),
      searchPriceMax: z.number().int().min(0).max(50_000_000).optional(),
      rentPw: z.number().int().min(0).max(100_000).optional(),
      publicHeadline: z.string().max(200).optional(),
      publicCopy: z.string().max(6000).optional(),
    }),
  },
  run_matching: {
    kind: "write",
    description:
      "Run the matching engine for a listing (find contacts) or a contact (find listings). Uses AI, so it asks first. Then read the results with get_matches.",
    schema: z.object({ listingId: uuid().optional(), contactId: uuid().optional() }),
  },
  record_consent: {
    kind: "write",
    description:
      "Record that a contact agreed to (or withdrew from) SMS, email or phone contact, given outside a web form. ONLY when the agent tells you the person actually agreed — never infer it. For a grant, `wording` is what they agreed to and is required.",
    schema: z.object({
      contactId: uuid(),
      channel: z.enum(["sms", "email", "phone"]),
      status: z.enum(["granted", "revoked"]),
      method: z.enum(["phone_call", "email", "sms", "in_person", "in_writing"]),
      wording: z.string().max(1000).optional(),
    }),
  },
  draft_message: {
    kind: "write",
    description:
      "Draft an SMS or email to one contact. It goes to Approvals; the agent reviews and sends it there. Refused if the contact has not consented on that channel.",
    schema: z.object({
      contactId: uuid(),
      channel: z.enum(["sms", "email"]),
      subject: z.string().max(200).optional(),
      body: z.string().min(1).max(4000),
      listingId: uuid().optional(),
    }),
  },
} satisfies Record<string, ToolSpec>;

export type ToolName = keyof typeof TOOLS;

export function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(TOOLS, name);
}

/** The definitions sent to the model. Built once. */
export const TOOL_DEFINITIONS: ToolDefinition[] = Object.entries(TOOLS).map(([name, t]) => {
  const { $schema: _drop, ...schema } = z.toJSONSchema(t.schema) as Record<string, unknown>;
  void _drop;
  return {
    name,
    description: (t.kind === "write" ? "[Asks the user to confirm first] " : "") + t.description,
    input_schema: schema,
  };
});

/* --------------------------------------------------------------- reads */

function fullName(c: { firstName: string; lastName: string }) {
  return `${c.firstName} ${c.lastName}`.trim();
}

/** Runs a read tool. Results are compact JSON — the model reads them, a person does not. */
export async function runReadTool(name: ToolName, rawInput: unknown): Promise<unknown> {
  const input = (TOOLS[name].schema as z.ZodTypeAny).parse(rawInput ?? {}) as Record<string, unknown>;

  switch (name) {
    case "get_overview":
      return getHomeCounts();

    case "search_contacts": {
      const q = String(input.query ?? "").toLowerCase().trim();
      const now = Date.now();
      const rows = (await getContacts()).filter(
        (c) =>
          (!q ||
            [fullName(c), c.email, c.phone, c.suburb]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))) &&
          (!input.role || c.roles.includes(input.role as (typeof ROLES)[number])) &&
          (!input.followupDue || (c.followupDueAt && c.followupDueAt.getTime() <= now)),
      );
      const limit = (input.limit as number | undefined) ?? 20;
      return {
        total: rows.length,
        contacts: rows.slice(0, limit).map((c) => ({
          id: c.id,
          name: fullName(c),
          phone: c.phone,
          email: c.email,
          suburb: c.suburb,
          roles: c.roles,
          intent: c.intentType,
          sentiment: c.sentiment,
          budget: c.budgetBand,
          followupDue: c.followupDueAt,
          lastOutcome: c.lastFollowupOutcome,
          doNotContact: c.doNotContact,
        })),
      };
    }

    case "get_contact": {
      const id = input.contactId as string;
      const [c, history, tasks] = await Promise.all([
        getContact(id),
        getInteractionsFor(id),
        getTasks(),
      ]);
      if (!c) return { error: "No contact with that id." };
      return {
        id: c.id,
        name: fullName(c),
        phone: c.phone,
        email: c.email,
        suburb: c.suburb,
        roles: c.roles,
        doNotContact: c.doNotContact,
        followupDue: c.followupDueAt,
        lastOutcome: c.lastFollowupOutcome,
        brief: c.intent?.brief ?? null,
        intent: c.intent ? { type: c.intent.type, sentiment: c.intent.sentiment, budget: c.intent.budgetBand, timeline: c.intent.timeline } : null,
        preferences: c.preferences,
        consent: [...new Map(c.consents.map((k) => [k.channel, k.status])).entries()].map(
          ([channel, status]) => ({ channel, status }),
        ),
        recentInteractions: history.slice(0, 8).map((i) => ({
          at: i.at,
          channel: i.channel,
          direction: i.direction,
          subject: i.subject,
          body: (i.body ?? "").slice(0, 400),
        })),
        openTasks: tasks
          .filter((t) => t.contactId === id && !t.done)
          .map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt })),
      };
    }

    case "list_properties": {
      const status = (input.status as string | undefined) ?? "all";
      const suburb = String(input.suburb ?? "").toLowerCase().trim();
      const rows = (await getProperties()).filter((p) => {
        const listed = p.listings.some((l) => l.status === "live" || l.status === "under_offer");
        const ok =
          status === "all" ? p.status !== "archived" : status === "listed" ? listed : p.status === status;
        return ok && (!suburb || (p.suburb ?? "").toLowerCase().includes(suburb));
      });
      return {
        total: rows.length,
        properties: rows.slice(0, 50).map((p) => ({
          id: p.id,
          address: `${p.unit ? `${p.unit}/` : ""}${p.address}, ${p.suburb ?? ""}`,
          type: p.type,
          status: p.status,
          beds: p.beds,
          baths: p.baths,
          parking: p.parking,
          owner: p.ownerName,
          ownerContactId: p.ownerContactId,
          listings: p.listings.map((l) => ({ id: l.id, status: l.status })),
        })),
      };
    }

    case "get_property": {
      const id = input.propertyId as string;
      const [all, listings] = await Promise.all([getProperties(), getListings()]);
      const p = all.find((x) => x.id === id);
      if (!p) return { error: "No property with that id." };
      return {
        ...p,
        listings: listings
          .filter((l) => l.propertyId === id)
          .map((l) => ({
            id: l.id,
            type: l.type,
            status: l.status,
            priceDisplay: l.priceDisplay,
            headline: l.headline,
            views7d: l.views7d,
            enquiries7d: l.enquiries7d,
          })),
      };
    }

    case "list_listings": {
      const rows = (await getListings()).filter((l) => !input.status || l.status === input.status);
      return {
        total: rows.length,
        listings: rows.slice(0, 50).map((l) => ({
          id: l.id,
          propertyId: l.propertyId,
          address: l.address,
          type: l.type,
          status: l.status,
          priceDisplay: l.priceDisplay,
          headline: l.headline,
          photos: l.photos,
          views7d: l.views7d,
          enquiries7d: l.enquiries7d,
        })),
      };
    }

    case "list_tasks": {
      const filter = (input.filter as string | undefined) ?? "open";
      const now = Date.now();
      const rows = (await getTasks()).filter((t) =>
        filter === "all"
          ? true
          : filter === "done"
            ? t.done
            : filter === "overdue"
              ? !t.done && t.dueAt !== null && t.dueAt.getTime() < now
              : !t.done,
      );
      return {
        total: rows.length,
        tasks: rows.slice(0, 50).map((t) => ({
          id: t.id,
          title: t.title,
          dueAt: t.dueAt,
          overdue: !t.done && t.dueAt !== null && t.dueAt.getTime() < now,
          done: t.done,
          contact: t.contactName,
          contactId: t.contactId,
        })),
      };
    }

    case "get_matches": {
      if (input.listingId) {
        const rows = await getMatchesForListing(input.listingId as string);
        return rows.slice(0, 20).map((m) => ({
          contactId: m.contactId,
          contact: `${m.contactFirstName} ${m.contactLastName}`,
          score: m.score,
          reason: m.reason,
        }));
      }
      if (input.contactId) {
        const rows = await getMatchesForContact(input.contactId as string);
        return rows.slice(0, 20).map((m) => ({
          listingId: m.listingId,
          address: m.address,
          priceDisplay: m.priceDisplay,
          score: m.score,
          reason: m.reason,
        }));
      }
      return { error: "Give a listingId or a contactId." };
    }

    default:
      throw new Error(`${name} is not a read tool.`);
  }
}
