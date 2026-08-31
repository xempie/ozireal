"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { optionalInt } from "./fields";
import {
  tasks,
  calendarEvents,
  contacts,
  listings,
  seoIssues,
  redirects,
} from "@/db/schema";

/**
 * The day-to-day records an agent creates by hand: a task, and a diary entry.
 *
 * Both can also arrive from elsewhere — tasks from the confirm queue when a human
 * commits an AI proposal, events from a calendar sync — so the shapes here match
 * what those paths produce. A manually created task and a committed one should be
 * indistinguishable afterwards except for their source label.
 */

const OPTIONAL_UUID = z
  .union([z.string().uuid(), z.literal("")])
  .optional();

export const createTask = defineAction({
  input: z.object({
    title: z.string().trim().min(3, "Say what needs doing").max(200),
    contactId: OPTIONAL_UUID,
    listingId: OPTIONAL_UUID,
    dueInDays: optionalInt(0, 365),
  }),
  async handler(input, ctx) {
    const contactId = input.contactId || null;
    const listingId = input.listingId || null;

    /**
     * A task against a tombstoned or merged-away contact would sit in the list
     * forever pointing at a record nobody should act on. Same guard the
     * interaction paths use.
     */
    if (contactId) {
      const [c] = await ctx.tx
        .select({
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          tombstonedAt: contacts.tombstonedAt,
          mergedIntoId: contacts.mergedIntoId,
        })
        .from(contacts)
        .where(eq(contacts.id, contactId))
        .limit(1);
      if (!c) throw new ActionError("That contact no longer exists.");
      if (c.mergedIntoId) {
        throw new ActionError(
          "That record was merged into another one. Create the task against the surviving record.",
        );
      }
      if (c.tombstonedAt) {
        throw new ActionError("That contact asked to be removed, so no further work is recorded against them.");
      }
    }

    const [created] = await ctx.tx
      .insert(tasks)
      .values({
        tenantId: ctx.tenantId,
        contactId,
        listingId,
        title: input.title,
        status: "open",
        dueAt:
          input.dueInDays !== undefined
            ? new Date(Date.now() + input.dueInDays * 86_400_000)
            : null,
        // Distinguishes a hand-written task from one committed off an AI
        // proposal, which is the only difference that should survive.
        sourceLabel: "Added by hand",
        assignedToUserId: ctx.userId,
      })
      .returning({ id: tasks.id });

    await ctx.audit({
      kind: "edit",
      action: "Created a task",
      target: input.title,
      entityType: "task",
      entityId: created.id,
    });

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    if (contactId) revalidatePath(`/contacts/${contactId}`);
    return { id: created.id };
  },
});

export const completeTask = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [t] = await ctx.tx
      .select({ title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(eq(tasks.id, input.id))
      .limit(1);
    if (!t) throw new ActionError("That task no longer exists.");
    if (t.status === "done") throw new ActionError("That task is already done.");

    await ctx.tx
      .update(tasks)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(tasks.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Completed a task",
      target: t.title,
      entityType: "task",
      entityId: input.id,
    });

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { done: true };
  },
});

/* ------------------------------------------------------------- calendar */

export const createCalendarEvent = defineAction({
  input: z.object({
    title: z.string().trim().min(3, "Give the event a name").max(200),
    kind: z.enum(["inspection", "appraisal", "meeting", "settlement", "personal"]),
    startsAt: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(5).max(24 * 60).default(30),
    contactId: OPTIONAL_UUID,
    listingId: OPTIONAL_UUID,
  }),
  async handler(input, ctx) {
    if (Number.isNaN(input.startsAt.getTime())) {
      throw new ActionError("That start time could not be read.");
    }

    const endsAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);

    if (input.listingId) {
      const [l] = await ctx.tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.id, input.listingId))
        .limit(1);
      if (!l) throw new ActionError("That listing no longer exists.");
    }

    const [created] = await ctx.tx
      .insert(calendarEvents)
      .values({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        /**
         * provider 'ozirealty' and ourWrite true: WE created this one.
         *
         * The distinction is load-bearing for the two-way sync (D5): the external
         * calendar stays the source of truth for anything it owns, and we never
         * edit or delete an event we did not create. Marking ownership now means
         * the sync can be switched on later without having to guess which of the
         * existing rows were ours.
         */
        provider: "ozirealty",
        ourWrite: true,
        title: input.title,
        kind: input.kind,
        startsAt: input.startsAt,
        endsAt,
        contactId: input.contactId || null,
        listingId: input.listingId || null,
      })
      .returning({ id: calendarEvents.id });

    await ctx.audit({
      kind: "edit",
      action: `Added a ${input.kind} to the calendar`,
      target: input.title,
      entityType: "calendar_event",
      entityId: created.id,
    });

    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    return { id: created.id };
  },
});

/* -------------------------------------------------- editing and removing */

/**
 * Correcting a task.
 *
 * Only while it is open. Re-wording a task that is already done rewrites what was
 * reported as finished, and the completed list is the closest thing the console has
 * to a record of the day's work.
 */
export const updateTask = defineAction({
  input: z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(3, "Say what needs doing").max(200),
    contactId: OPTIONAL_UUID,
    listingId: OPTIONAL_UUID,
    /** Blank clears the due date, which is a real choice — "no date" is not "today". */
    dueAt: z.union([z.coerce.date(), z.literal("")]).optional(),
  }),
  async handler(input, ctx) {
    const [t] = await ctx.tx
      .select({ status: tasks.status, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, input.id))
      .limit(1);
    if (!t) throw new ActionError("That task no longer exists.");
    if (t.status === "done") {
      throw new ActionError(
        "That task is already done. Reopen it first if it needs changing.",
      );
    }

    const contactId = input.contactId || null;
    if (contactId) {
      const [c] = await ctx.tx
        .select({
          tombstonedAt: contacts.tombstonedAt,
          mergedIntoId: contacts.mergedIntoId,
        })
        .from(contacts)
        .where(eq(contacts.id, contactId))
        .limit(1);
      if (!c) throw new ActionError("That contact no longer exists.");
      if (c.mergedIntoId) {
        throw new ActionError(
          "That record was merged into another one. Point the task at the surviving record.",
        );
      }
      if (c.tombstonedAt) {
        throw new ActionError(
          "That contact asked to be removed, so no further work is recorded against them.",
        );
      }
    }

    const dueAt =
      input.dueAt === "" || input.dueAt === undefined ? null : input.dueAt;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      throw new ActionError("That due date could not be read.");
    }

    await ctx.tx
      .update(tasks)
      .set({
        title: input.title,
        contactId,
        listingId: input.listingId || null,
        dueAt,
      })
      .where(eq(tasks.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Updated a task",
      target: input.title,
      entityType: "task",
      entityId: input.id,
    });

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    if (contactId) revalidatePath(`/contacts/${contactId}`);
    return { id: input.id };
  },
});

/** Ticked off by mistake, or it turned out not to be finished after all. */
export const reopenTask = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [t] = await ctx.tx
      .select({ status: tasks.status, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.id, input.id))
      .limit(1);
    if (!t) throw new ActionError("That task no longer exists.");
    if (t.status === "open") throw new ActionError("That task is already open.");

    await ctx.tx
      .update(tasks)
      .set({ status: "open", completedAt: null })
      .where(eq(tasks.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Reopened a task",
      target: t.title,
      entityType: "task",
      entityId: input.id,
    });

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { reopened: true };
  },
});

/**
 * Deleting a task.
 *
 * A real delete, unlike almost everything else here. A task is a reminder, not
 * evidence: it records nothing about what was said to a contact, and the audit row
 * this writes is what survives. The interaction it came from — if it came from one
 * — is untouched and still says what the contact actually asked for.
 */
export const deleteTask = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [t] = await ctx.tx
      .select({ title: tasks.title, contactId: tasks.contactId })
      .from(tasks)
      .where(eq(tasks.id, input.id))
      .limit(1);
    if (!t) throw new ActionError("That task no longer exists.");

    await ctx.audit({
      kind: "edit",
      action: "Deleted a task",
      target: t.title,
      entityType: "task",
      entityId: input.id,
    });

    await ctx.tx.delete(tasks).where(eq(tasks.id, input.id));

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    if (t.contactId) revalidatePath(`/contacts/${t.contactId}`);
    return { deleted: true };
  },
});

/**
 * Editing a diary entry.
 *
 * Refused on anything the external calendar owns. `our_write` records whether WE
 * created the event, and the rule the schema states — the external calendar stays
 * the source of truth for anything it owns — has to be enforced somewhere or the
 * two-way sync (D5) will overwrite a person's own Google event on its first run.
 */
export const updateCalendarEvent = defineAction({
  input: z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(3, "Give the event a name").max(200),
    kind: z.enum(["inspection", "appraisal", "meeting", "settlement", "personal"]),
    startsAt: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(5).max(24 * 60).default(30),
    contactId: OPTIONAL_UUID,
    listingId: OPTIONAL_UUID,
  }),
  async handler(input, ctx) {
    const [e] = await ctx.tx
      .select({
        ourWrite: calendarEvents.ourWrite,
        provider: calendarEvents.provider,
        cancelledAt: calendarEvents.cancelledAt,
      })
      .from(calendarEvents)
      .where(eq(calendarEvents.id, input.id))
      .limit(1);
    if (!e) throw new ActionError("That event no longer exists.");
    if (!e.ourWrite) {
      throw new ActionError(
        `That event belongs to your ${e.provider === "google" ? "Google" : "Outlook"} calendar. Change it there — this console never edits an event it did not create.`,
      );
    }
    if (e.cancelledAt) throw new ActionError("That event was cancelled.");

    if (Number.isNaN(input.startsAt.getTime())) {
      throw new ActionError("That start time could not be read.");
    }

    if (input.listingId) {
      const [l] = await ctx.tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.id, input.listingId))
        .limit(1);
      if (!l) throw new ActionError("That listing no longer exists.");
    }

    await ctx.tx
      .update(calendarEvents)
      .set({
        title: input.title,
        kind: input.kind,
        startsAt: input.startsAt,
        endsAt: new Date(input.startsAt.getTime() + input.durationMinutes * 60_000),
        contactId: input.contactId || null,
        listingId: input.listingId || null,
      })
      .where(eq(calendarEvents.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Updated a calendar event",
      target: input.title,
      entityType: "calendar_event",
      entityId: input.id,
    });

    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    return { id: input.id };
  },
});

/**
 * Cancelling a diary entry.
 *
 * `cancelled_at` rather than a delete, so the sync has something to push to the
 * external calendar when it lands — a row that vanished locally is indistinguishable
 * from one that never synced, and the remote copy would survive forever.
 */
export const cancelCalendarEvent = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [e] = await ctx.tx
      .select({
        title: calendarEvents.title,
        ourWrite: calendarEvents.ourWrite,
        provider: calendarEvents.provider,
        cancelledAt: calendarEvents.cancelledAt,
      })
      .from(calendarEvents)
      .where(eq(calendarEvents.id, input.id))
      .limit(1);
    if (!e) throw new ActionError("That event no longer exists.");
    if (!e.ourWrite) {
      throw new ActionError(
        `That event belongs to your ${e.provider === "google" ? "Google" : "Outlook"} calendar. Cancel it there — this console never deletes an event it did not create.`,
      );
    }
    if (e.cancelledAt) throw new ActionError("That event is already cancelled.");

    await ctx.tx
      .update(calendarEvents)
      .set({ cancelledAt: new Date() })
      .where(eq(calendarEvents.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Cancelled a calendar event",
      target: e.title,
      entityType: "calendar_event",
      entityId: input.id,
    });

    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    return { cancelled: true };
  },
});

/* ------------------------------------------------------------ SEO issues */

/**
 * Accepting or dismissing a finding.
 *
 * Rule 4 in one action: the SEO agent proposes and a human decides, and "accepted"
 * means accepted into a change set that a person still has to apply. Nothing here
 * touches a live site, and there is no status that would.
 */
export const setSeoIssueStatus = defineAction({
  input: z.object({
    id: z.string().uuid(),
    status: z.enum(["open", "accepted", "dismissed", "resolved"]),
  }),
  async handler(input, ctx) {
    const [i] = await ctx.tx
      .select({ title: seoIssues.title, status: seoIssues.status })
      .from(seoIssues)
      .where(eq(seoIssues.id, input.id))
      .limit(1);
    if (!i) throw new ActionError("That finding no longer exists.");
    if (i.status === input.status) {
      throw new ActionError("That finding is already in that state.");
    }

    await ctx.tx
      .update(seoIssues)
      .set({ status: input.status })
      .where(eq(seoIssues.id, input.id));

    await ctx.audit({
      kind: input.status === "dismissed" ? "reject" : "approve",
      action: `SEO finding ${input.status}`,
      target: i.title,
      entityType: "seo_issue",
      entityId: input.id,
      metadata: { from: i.status, to: input.status },
    });

    revalidatePath("/seo");
    return { status: input.status };
  },
});

/* ---------------------------------------------------------- redirect map */

/** Legacy paths are compared as written, so they have to be normalised on the way in. */
function normalisePath(p: string) {
  const trimmed = p.trim();
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  // A trailing slash and no trailing slash are the same page to a visitor and two
  // different keys to a unique index, which is how a redirect map grows duplicates.
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
}

const redirectInput = z.object({
  fromPath: z.string().trim().min(1, "The old address is required").max(500),
  toPath: z.string().trim().max(500).optional(),
  status: z.enum(["mapped", "undecided", "blocked"]).default("undecided"),
  note: z.string().trim().max(500).optional(),
});

/**
 * The Wix cutover map (docs/legacy-site.md).
 *
 * A row marked `mapped` must have a destination — that is the whole claim the
 * status makes, and a mapped row with a null target is how a 404 reaches production
 * on switchover day.
 */
export const createRedirect = defineAction({
  input: redirectInput,
  async handler(input, ctx) {
    const fromPath = normalisePath(input.fromPath);
    const toPath = input.toPath ? normalisePath(input.toPath) : null;

    if (input.status === "mapped" && !toPath) {
      throw new ActionError(
        "A mapped redirect needs a destination. Leave it undecided until you know where it should go.",
      );
    }
    if (toPath && toPath === fromPath) {
      throw new ActionError("That redirect points at itself, which is a loop.");
    }

    const [clash] = await ctx.tx
      .select({ id: redirects.id })
      .from(redirects)
      .where(eq(redirects.fromPath, fromPath))
      .limit(1);
    if (clash) {
      throw new ActionError(`${fromPath} is already in the map. Edit that row instead.`);
    }

    const [created] = await ctx.tx
      .insert(redirects)
      .values({
        tenantId: ctx.tenantId,
        fromPath,
        toPath,
        status: input.status,
        note: input.note || null,
      })
      .returning({ id: redirects.id });

    await ctx.audit({
      kind: "edit",
      action: "Added a redirect",
      target: `${fromPath} → ${toPath ?? "undecided"}`,
      entityType: "redirect",
      entityId: created.id,
    });

    revalidatePath("/website");
    revalidatePath("/seo");
    return { id: created.id };
  },
});

export const updateRedirect = defineAction({
  input: redirectInput.extend({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [existing] = await ctx.tx
      .select({ id: redirects.id })
      .from(redirects)
      .where(eq(redirects.id, input.id))
      .limit(1);
    if (!existing) throw new ActionError("That redirect no longer exists.");

    const fromPath = normalisePath(input.fromPath);
    const toPath = input.toPath ? normalisePath(input.toPath) : null;

    if (input.status === "mapped" && !toPath) {
      throw new ActionError(
        "A mapped redirect needs a destination. Leave it undecided until you know where it should go.",
      );
    }
    if (toPath && toPath === fromPath) {
      throw new ActionError("That redirect points at itself, which is a loop.");
    }

    const [clash] = await ctx.tx
      .select({ id: redirects.id })
      .from(redirects)
      .where(and(eq(redirects.fromPath, fromPath), ne(redirects.id, input.id)))
      .limit(1);
    if (clash) {
      throw new ActionError(`${fromPath} is already in the map on another row.`);
    }

    await ctx.tx
      .update(redirects)
      .set({
        fromPath,
        toPath,
        status: input.status,
        note: input.note || null,
      })
      .where(eq(redirects.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Updated a redirect",
      target: `${fromPath} → ${toPath ?? "undecided"}`,
      entityType: "redirect",
      entityId: input.id,
    });

    revalidatePath("/website");
    revalidatePath("/seo");
    return { id: input.id };
  },
});

export const deleteRedirect = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [r] = await ctx.tx
      .select({ fromPath: redirects.fromPath })
      .from(redirects)
      .where(eq(redirects.id, input.id))
      .limit(1);
    if (!r) throw new ActionError("That redirect no longer exists.");

    await ctx.audit({
      kind: "edit",
      action: "Removed a redirect",
      target: r.fromPath,
      entityType: "redirect",
      entityId: input.id,
    });

    await ctx.tx.delete(redirects).where(eq(redirects.id, input.id));

    revalidatePath("/website");
    revalidatePath("/seo");
    return { deleted: true };
  },
});
