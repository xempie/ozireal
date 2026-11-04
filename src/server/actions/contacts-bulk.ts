"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { contacts, contactRoles, interactions, mergeReviews } from "@/db/schema";
import { defineAction, ActionError } from "./action";
import { CONTACT_ROLES as CONTACT_ROLES_ALL } from "@/lib/roles";

/**
 * Bulk actions on the contacts list (owner's request, 2026-11-04).
 *
 * Each one does exactly what its single-contact counterpart does, to many rows in one
 * transaction, and writes one audit entry naming the count. Tombstoned and merged-away
 * records are skipped, since they take no new activity. No bulk SEND lives here:
 * outbound messages go through the approval queue (§3.1).
 */

const ids = z.array(z.string().uuid()).min(1, "Select at least one contact").max(500);

const ROLES = CONTACT_ROLES_ALL;

/** The selected rows that can still be changed. */
const live = (contactIds: string[]) =>
  and(inArray(contacts.id, contactIds), isNull(contacts.tombstonedAt), isNull(contacts.mergedIntoId));

function done() {
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
}

/** The bulk form of tombstoneContact: hidden, do-not-contact, history sealed — never erased. */
export const bulkDeleteContacts = defineAction({
  input: z.object({
    contactIds: ids,
    reason: z.string().trim().min(3, "Record why").max(300),
  }),
  async handler(input, ctx) {
    const now = new Date();
    const rows = await ctx.tx
      .update(contacts)
      .set({ tombstonedAt: now, doNotContact: true, updatedAt: now })
      .where(live(input.contactIds))
      .returning({ id: contacts.id });
    if (!rows.length) throw new ActionError("None of those contacts can be deleted.");
    const hit = rows.map((r) => r.id);

    await ctx.tx
      .update(interactions)
      .set({ tombstonedAt: now })
      .where(and(inArray(interactions.contactId, hit), isNull(interactions.tombstonedAt)));

    await ctx.audit({
      kind: "edit",
      action: `Deleted ${hit.length} contact${hit.length === 1 ? "" : "s"} (privacy tombstone)`,
      target: `${hit.length} contacts`,
      metadata: { reason: input.reason, contactIds: hit },
    });
    done();
    return { count: hit.length };
  },
});

export const bulkAddRole = defineAction({
  input: z.object({ contactIds: ids, role: z.enum(ROLES) }),
  async handler(input, ctx) {
    const rows = await ctx.tx.select({ id: contacts.id }).from(contacts).where(live(input.contactIds));
    for (const { id } of rows) {
      await ctx.tx
        .insert(contactRoles)
        .values({ tenantId: ctx.tenantId, contactId: id, role: input.role })
        .onConflictDoUpdate({
          target: [contactRoles.contactId, contactRoles.role],
          set: { activeTo: null },
          setWhere: sql`${contactRoles.activeTo} is not null`,
        });
    }
    await ctx.audit({
      kind: "edit",
      action: `Added role ${input.role} to ${rows.length} contacts`,
      target: `${rows.length} contacts`,
    });
    done();
    return { count: rows.length };
  },
});

/** Ends the role rather than deleting it: roles are history on the person (§4). */
export const bulkRemoveRole = defineAction({
  input: z.object({ contactIds: ids, role: z.enum(ROLES) }),
  async handler(input, ctx) {
    const rows = await ctx.tx
      .update(contactRoles)
      .set({ activeTo: new Date().toISOString().slice(0, 10) })
      .where(
        and(
          inArray(contactRoles.contactId, input.contactIds),
          eq(contactRoles.role, input.role),
          isNull(contactRoles.activeTo),
        ),
      )
      .returning({ id: contactRoles.contactId });
    await ctx.audit({
      kind: "edit",
      action: `Removed role ${input.role} from ${rows.length} contacts`,
      target: `${rows.length} contacts`,
    });
    done();
    return { count: rows.length };
  },
});

/** The bulk form of recordFollowupOutcome: one interaction row per contact, then the column. */
export const bulkSetOutcome = defineAction({
  input: z.object({
    contactIds: ids,
    outcome: z.string().trim().min(3, "Say what happened").max(500),
  }),
  async handler(input, ctx) {
    const now = new Date();
    const rows = await ctx.tx.select({ id: contacts.id }).from(contacts).where(live(input.contactIds));
    if (!rows.length) throw new ActionError("None of those contacts can be updated.");
    await ctx.tx.insert(interactions).values(
      rows.map(({ id }) => ({
        tenantId: ctx.tenantId,
        contactId: id,
        channel: "manual" as const,
        direction: "out" as const,
        occurredAt: now,
        subject: "Follow-up",
        body: input.outcome,
        createdByUserId: ctx.userId,
      })),
    );
    await ctx.tx
      .update(contacts)
      .set({ lastFollowupAt: now, lastFollowupOutcome: input.outcome, updatedAt: now })
      .where(inArray(contacts.id, rows.map((r) => r.id)));
    await ctx.audit({
      kind: "edit",
      action: `Recorded a follow-up outcome on ${rows.length} contacts`,
      target: input.outcome.slice(0, 60),
    });
    done();
    return { count: rows.length };
  },
});

/** Blocks every future send at the gate. Turning it back off stays a per-contact decision. */
export const bulkDoNotContact = defineAction({
  input: z.object({ contactIds: ids }),
  async handler(input, ctx) {
    const rows = await ctx.tx
      .update(contacts)
      .set({ doNotContact: true, updatedAt: new Date() })
      .where(live(input.contactIds))
      .returning({ id: contacts.id });
    await ctx.audit({
      kind: "edit",
      action: `Marked ${rows.length} contacts do not contact`,
      target: `${rows.length} contacts`,
    });
    done();
    return { count: rows.length };
  },
});

/** Two picked by hand go to the merge review queue; nothing is merged without review. */
export const bulkProposeMerge = defineAction({
  input: z.object({ contactIds: z.array(z.string().uuid()).length(2, "Pick exactly two") }),
  async handler(input, ctx) {
    const [a, b] = input.contactIds;
    if (a === b) throw new ActionError("Pick two different contacts.");
    const rows = await ctx.tx.select({ id: contacts.id }).from(contacts).where(live([a, b]));
    if (rows.length !== 2) throw new ActionError("One of those contacts can no longer be merged.");
    const [r] = await ctx.tx
      .insert(mergeReviews)
      .values({ tenantId: ctx.tenantId, contactAId: a, contactBId: b, similarity: 1, matchedOn: "manual" })
      .returning({ id: mergeReviews.id });
    await ctx.audit({ kind: "merge", action: "Sent two contacts to merge review", target: "2 contacts" });
    revalidatePath("/contacts");
    return { id: r.id };
  },
});
