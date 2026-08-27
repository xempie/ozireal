"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { tasks, calendarEvents, contacts, listings } from "@/db/schema";

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
    dueInDays: z.coerce.number().int().min(0).max(365).optional(),
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
