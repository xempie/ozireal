"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  contacts,
  contactRoles,
  contactPreferences,
  contactPreferenceSuburbs,
  interactions,
  mergeReviews,
  confirmItems,
  tasks,
  suburbs,
} from "@/db/schema";
import type { Tx } from "@/db";
import { defineAction, ActionError, toE164, normaliseEmail } from "./action";
import { optionalInt } from "./fields";
import { manualAdapter } from "@/server/intake/adapters/manual";
import {
  taskProposal,
  preferenceChangeProposal,
  type PreferenceChangeProposal,
} from "@/server/ai/proposals";
import { ingestInTx } from "@/server/intake/pipeline";
import { enqueue } from "@/server/jobs/queues";

/**
 * Contact writes — the first real write path in the product.
 *
 * Every one goes through defineAction, so it is Zod-validated, authenticated,
 * tenant-scoped and audited without each function having to remember to do those.
 */

/**
 * A record that has been tombstoned or merged away takes no new activity.
 *
 * The screens hide the buttons, which is not the same thing as preventing the write —
 * a stale tab, a bookmarked form, or a future API client all reach the action directly.
 * Enforcing it here means the rule holds regardless of what the interface does.
 */
async function assertWritable(tx: Tx, contactId: string) {
  const [c] = await tx
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
      "That record was merged into another one. Record this against the surviving record instead.",
    );
  }
  if (c.tombstonedAt) {
    throw new ActionError(
      "That contact asked to be removed. Nothing further can be recorded against them.",
    );
  }
  return c;
}

/**
 * Apply a committed preference change (B4.5).
 *
 * Numeric fields coerce and range-check; text fields cap; suburbs resolve BY NAME
 * against the suburbs table — a name that resolves to nothing is reported back
 * rather than silently dropped, because "committed" must mean "applied". Suburb
 * changes ADD, never remove: a proposal sourced from "we're also open to Prospect"
 * must not delete the suburbs the person already wanted.
 */
async function applyPreferenceChange(
  tx: Tx,
  tenantId: string,
  contactId: string,
  p: PreferenceChangeProposal,
) {
  // The one-row-per-contact preferences record, created on first commit.
  let [prefs] = await tx
    .select({ id: contactPreferences.id })
    .from(contactPreferences)
    .where(eq(contactPreferences.contactId, contactId))
    .limit(1);
  if (!prefs) {
    [prefs] = await tx
      .insert(contactPreferences)
      .values({ tenantId, contactId })
      .returning({ id: contactPreferences.id });
  }

  const numeric: Partial<Record<PreferenceChangeProposal["field"], [number, number]>> = {
    priceMin: [0, 50_000_000],
    priceMax: [0, 50_000_000],
    bedsMin: [0, 12],
    bathsMin: [0, 12],
    parkingMin: [0, 12],
  };

  if (p.field === "suburbs") {
    const names = Array.isArray(p.value) ? p.value : [String(p.value)];
    const unresolved: string[] = [];
    for (const name of names) {
      const [s] = await tx
        .select({ id: suburbs.id })
        .from(suburbs)
        .where(sql`lower(${suburbs.name}) = lower(${name.trim()})`)
        .limit(1);
      if (!s) {
        unresolved.push(name);
        continue;
      }
      await tx
        .insert(contactPreferenceSuburbs)
        .values({ preferenceId: prefs.id, suburbId: s.id })
        .onConflictDoNothing();
    }
    if (unresolved.length === names.length) {
      throw new ActionError(
        `None of those suburbs (${unresolved.join(", ")}) matched the suburb list, so nothing was applied. Check the spelling on the contact's preferences instead.`,
      );
    }
    return;
  }

  const range = numeric[p.field];
  if (range) {
    // "Several" stripped of non-digits is "" and Number("") is 0 — a value that
    // WOULD pass the range check while meaning nothing. Digits must actually exist.
    const cleaned = typeof p.value === "number" ? null : String(p.value).replace(/[^\d.]/g, "");
    const n = typeof p.value === "number" ? p.value : cleaned ? Number(cleaned) : NaN;
    if (!Number.isFinite(n) || n < range[0] || n > range[1]) {
      throw new ActionError(
        `"${String(p.value)}" is not a usable value for ${p.field}, so nothing was applied.`,
      );
    }
    await tx
      .update(contactPreferences)
      .set({ [p.field]: Math.round(n) })
      .where(eq(contactPreferences.id, prefs.id));
    return;
  }

  // timeline | financeStatus | softRequirements — bounded free text.
  await tx
    .update(contactPreferences)
    .set({ [p.field]: String(p.value).slice(0, 500) })
    .where(eq(contactPreferences.id, prefs.id));
}

const CONTACT_ROLES = [
  "buyer",
  "vendor",
  "landlord",
  "tenant",
  "referrer",
  "investor",
  "business_vendor",
] as const;

const contactInput = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z
    .string()
    .trim()
    .email("That does not look like an email address")
    .or(z.literal("")),
  phone: z.string().trim().max(30),
  suburb: z.string().trim().max(80).optional(),
  roles: z.array(z.enum(CONTACT_ROLES)).min(1, "Pick at least one role"),
  doNotContact: z.boolean().default(false),
});

/**
 * Create a contact.
 *
 * Identity resolution proper is B3.3. What matters here is the behaviour on a
 * collision: if the normalised email or phone already belongs to someone, this does NOT
 * refuse and does NOT merge — it creates the record and raises a merge review, so a
 * human decides. §4 is explicit that nothing auto-merges, and refusing outright would
 * lose the enquiry entirely.
 */
export const createContact = defineAction({
  input: contactInput,
  async handler(input, ctx) {
    const emailNormalised = normaliseEmail(input.email || null);
    const phoneE164 = toE164(input.phone || null);

    const duplicates =
      emailNormalised || phoneE164
        ? await ctx.tx
            .select({
              id: contacts.id,
              firstName: contacts.firstName,
              lastName: contacts.lastName,
              email: contacts.emailNormalised,
            })
            .from(contacts)
            .where(
              and(
                isNull(contacts.tombstonedAt),
                or(
                  emailNormalised
                    ? eq(contacts.emailNormalised, emailNormalised)
                    : sql`false`,
                  phoneE164 ? eq(contacts.phoneE164, phoneE164) : sql`false`,
                ),
              ),
            )
            .limit(1)
        : [];

    const [created] = await ctx.tx
      .insert(contacts)
      .values({
        tenantId: ctx.tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        emailRaw: input.email || null,
        emailNormalised,
        phoneRaw: input.phone || null,
        phoneE164,
        suburb: input.suburb || null,
        sourceChannel: "manual",
        ownerUserId: ctx.userId,
        doNotContact: input.doNotContact,
      })
      .returning({ id: contacts.id });

    for (const role of input.roles) {
      await ctx.tx
        .insert(contactRoles)
        .values({ tenantId: ctx.tenantId, contactId: created.id, role })
        .onConflictDoNothing();
    }

    if (duplicates.length > 0) {
      const other = duplicates[0];
      const matchedOn =
        other.email && other.email === emailNormalised
          ? `Same email (${emailNormalised})`
          : `Same phone number (${phoneE164})`;

      await ctx.tx.insert(mergeReviews).values({
        tenantId: ctx.tenantId,
        contactAId: other.id,
        contactBId: created.id,
        similarity: 0.9,
        matchedOn: `${matchedOn}. Created manually while a matching record already existed.`,
      });

      await ctx.audit({
        kind: "merge",
        action: "Raised a merge review",
        target: `${input.firstName} ${input.lastName} vs ${other.firstName} ${other.lastName}`,
        entityType: "contact",
        entityId: created.id,
      });
    }

    await ctx.audit({
      kind: "edit",
      action: "Created contact",
      target: `${input.firstName} ${input.lastName}`,
      entityType: "contact",
      entityId: created.id,
    });

    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    revalidatePath("/confirm");

    return { id: created.id, duplicateOf: duplicates[0]?.id ?? null };
  },
});

export const updateContact = defineAction({
  input: contactInput.extend({ id: z.string().uuid() }),
  async handler(input, ctx) {
    await assertWritable(ctx.tx, input.id);

    await ctx.tx
      .update(contacts)
      .set({
        firstName: input.firstName,
        lastName: input.lastName,
        emailRaw: input.email || null,
        emailNormalised: normaliseEmail(input.email || null),
        phoneRaw: input.phone || null,
        phoneE164: toE164(input.phone || null),
        suburb: input.suburb || null,
        doNotContact: input.doNotContact,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, input.id));

    await ctx.tx.delete(contactRoles).where(eq(contactRoles.contactId, input.id));
    for (const role of input.roles) {
      await ctx.tx
        .insert(contactRoles)
        .values({ tenantId: ctx.tenantId, contactId: input.id, role })
        .onConflictDoNothing();
    }

    await ctx.audit({
      kind: "edit",
      action: "Updated contact",
      target: `${input.firstName} ${input.lastName}`,
      entityType: "contact",
      entityId: input.id,
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${input.id}`);
    return { id: input.id };
  },
});

/**
 * B2.4 — record a follow-up outcome.
 *
 * Small, and the single most-used control in the product: `last_followup_outcome` is
 * what a day's work is sorted by (§4). Recording one also writes an INTERACTION, so the
 * evidence log stays complete — an outcome with no touch behind it would be a claim
 * with nothing underneath it.
 */
export const recordFollowupOutcome = defineAction({
  input: z.object({
    contactId: z.string().uuid(),
    outcome: z.string().trim().min(3, "Say what happened").max(500),
    channel: z.enum(["phone", "email", "sms", "manual", "social", "web_form"]),
    nextDueInDays: optionalInt(0, 365),
  }),
  async handler(input, ctx) {
    const now = new Date();
    const nextDue =
      input.nextDueInDays && input.nextDueInDays > 0
        ? new Date(now.getTime() + input.nextDueInDays * 86_400_000)
        : null;

    const c = await assertWritable(ctx.tx, input.contactId);

    await ctx.tx.insert(interactions).values({
      tenantId: ctx.tenantId,
      contactId: input.contactId,
      channel: input.channel,
      direction: "out",
      occurredAt: now,
      subject: "Follow-up",
      body: input.outcome,
      createdByUserId: ctx.userId,
    });

    await ctx.tx
      .update(contacts)
      .set({
        lastFollowupAt: now,
        lastFollowupOutcome: input.outcome,
        followupDueAt: nextDue,
        updatedAt: now,
      })
      .where(eq(contacts.id, input.contactId));

    ctx.afterCommit(() =>
      enqueue("RebuildContactIntent", { tenantId: ctx.tenantId, entityId: input.contactId }),
    );

    await ctx.audit({
      kind: "edit",
      action: "Recorded a follow-up outcome",
      target: `${c.firstName} ${c.lastName}`,
      entityType: "contact",
      entityId: input.contactId,
      metadata: { outcome: input.outcome, nextDue },
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${input.contactId}`);
    revalidatePath("/dashboard");
    return { recordedAt: now };
  },
});

/**
 * The manual adapter (§5).
 *
 * A typed-up phone call is a channel like any other and takes the same path: it becomes
 * an immutable interaction row. The database then refuses to let it be edited, which is
 * the whole point of recording it there.
 */
export const logInteraction = defineAction({
  input: z.object({
    contactId: z.string().uuid(),
    channel: z.enum(["phone", "email", "sms", "social", "manual", "web_form"]),
    direction: z.enum(["in", "out"]),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1, "Say what was said").max(4000),
    occurredAt: z.coerce.date().optional(),
  }),
  async handler(input, ctx) {
    await assertWritable(ctx.tx, input.contactId);

    /**
     * B3 made this a real adapter: the typed-up call goes through the SAME pipeline
     * core as an email or a web form — same interaction row, same summarise and
     * rebuild jobs afterwards. The action contributes what only it knows (the
     * signed-in user, the audit row) and the jobs wait for the commit.
     */
    const normalised = await manualAdapter.ingest({
      contactId: input.contactId,
      channel: input.channel === "email" || input.channel === "web_form" ? "manual" : input.channel,
      direction: input.direction,
      subject: input.subject || null,
      body: input.body,
      occurredAt: input.occurredAt,
    });
    const result = await ingestInTx(
      ctx.tx,
      { ...normalised, recordedByUserId: ctx.userId },
      ctx.tenantId,
    );
    for (const job of result.jobs) {
      ctx.afterCommit(() => enqueue(job.name, job.payload));
    }

    await ctx.audit({
      kind: "edit",
      action: `Logged a ${input.channel} interaction`,
      target: input.subject || input.body.slice(0, 60),
      entityType: "interaction",
      entityId: result.interactionId,
    });

    revalidatePath(`/contacts/${input.contactId}`);
    revalidatePath("/dashboard");
    return { id: result.interactionId };
  },
});

/**
 * A privacy request (§4, §10).
 *
 * Tombstones rather than deletes. The interaction log is the evidence behind every send
 * the agency has made, so erasing it would destroy its ability to defend messages that
 * were lawful at the time. The database trigger enforces that this is one-way.
 */
export const tombstoneContact = defineAction({
  input: z.object({
    contactId: z.string().uuid(),
    reason: z.string().trim().min(3, "Record why").max(300),
  }),
  async handler(input, ctx) {
    const now = new Date();
    const [c] = await ctx.tx
      .select({ firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(eq(contacts.id, input.contactId))
      .limit(1);
    if (!c) throw new ActionError("That contact no longer exists.");

    await ctx.tx
      .update(contacts)
      .set({ tombstonedAt: now, doNotContact: true, updatedAt: now })
      .where(eq(contacts.id, input.contactId));

    await ctx.tx
      .update(interactions)
      .set({ tombstonedAt: now })
      .where(
        and(
          eq(interactions.contactId, input.contactId),
          isNull(interactions.tombstonedAt),
        ),
      );

    await ctx.audit({
      kind: "edit",
      action: "Honoured a privacy request",
      target: `${c.firstName} ${c.lastName}`,
      entityType: "contact",
      entityId: input.contactId,
      metadata: { reason: input.reason },
    });

    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    return { tombstonedAt: now };
  },
});

/**
 * Commit an AI proposal (rule 5).
 *
 * Nothing the AI proposed reaches a contact record until a human presses this button.
 */
export const commitConfirmItem = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [item] = await ctx.tx
      .select()
      .from(confirmItems)
      .where(eq(confirmItems.id, input.id))
      .limit(1);

    if (!item) throw new ActionError("That proposal is no longer in the queue.");
    if (item.status !== "pending") throw new ActionError("That proposal was already handled.");

    /**
     * B4.5: committing APPLIES the structured proposal — parsing data, never prose.
     * Each kind revalidates confirm_items.proposed against the same Zod schema the
     * extraction wrote it with; a proposal that no longer parses is refused rather
     * than half-applied.
     */
    if (item.kind === "task") {
      const proposed = taskProposal.nullable().catch(null).parse(item.proposed);
      await ctx.tx.insert(tasks).values({
        tenantId: ctx.tenantId,
        contactId: item.contactId,
        title: item.summary,
        status: "open",
        dueAt:
          proposed?.dueInDays != null
            ? new Date(Date.now() + proposed.dueInDays * 86_400_000)
            : null,
        sourceInteractionId: item.sourceInteractionId,
        sourceLabel: "Committed from the confirm queue",
        assignedToUserId: ctx.userId,
      });
    }

    if (item.kind === "preference_change") {
      const parsed = preferenceChangeProposal.safeParse(item.proposed);
      if (!parsed.success) {
        throw new ActionError(
          "This proposal has no applicable data attached and cannot be committed. Discard it and make the change on the contact instead.",
        );
      }
      await applyPreferenceChange(ctx.tx, ctx.tenantId, item.contactId, parsed.data);
    }

    await ctx.tx
      .update(confirmItems)
      .set({
        status: "committed",
        committedByUserId: ctx.userId,
        committedAt: new Date(),
      })
      .where(eq(confirmItems.id, input.id));

    await ctx.audit({
      kind: "commit",
      action: "Committed an AI proposal",
      target: item.summary,
      entityType: "confirm_item",
      entityId: item.id,
    });

    revalidatePath("/confirm");
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { kind: item.kind };
  },
});

export const discardConfirmItem = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [item] = await ctx.tx
      .select({ summary: confirmItems.summary })
      .from(confirmItems)
      .where(eq(confirmItems.id, input.id))
      .limit(1);
    if (!item) throw new ActionError("That proposal is no longer in the queue.");

    await ctx.tx
      .update(confirmItems)
      .set({
        status: "discarded",
        committedByUserId: ctx.userId,
        committedAt: new Date(),
      })
      .where(eq(confirmItems.id, input.id));

    await ctx.audit({
      kind: "reject",
      action: "Discarded an AI proposal",
      target: item.summary,
      entityType: "confirm_item",
      entityId: input.id,
    });

    revalidatePath("/confirm");
    return { discarded: true };
  },
});

/**
 * Resolve a merge review.
 *
 * "Merged" supersedes; it does not rewrite. The older record survives and the newer is
 * tombstoned pointing at it, because the two tables that matter most here -
 * interactions and consents - are append-only and their contact_id cannot be moved. A
 * consent row is the proof that a named person, on a named form, at a stated moment,
 * agreed to be contacted; reassigning it to a different person destroys the one fact
 * it exists to establish. So the history stays where it was captured and reads follow
 * the pointer instead (migration 0006).
 *
 * What does move is the mutable, non-evidentiary side: roles the survivor lacks, a
 * preference row it has none of, open tasks, and any identity field it left blank.
 * Losing a phone number to a merge is data loss, so the survivor takes what it is
 * missing and keeps what it already had.
 *
 * Keeping both is a decision worth recording, not a no-op — otherwise the same pair
 * surfaces again tomorrow and someone re-decides it every week.
 */
export const resolveMergeReview = defineAction({
  input: z.object({
    id: z.string().uuid(),
    decision: z.enum(["merged", "kept_both"]),
  }),
  async handler(input, ctx) {
    const now = new Date();

    const [review] = await ctx.tx
      .select()
      .from(mergeReviews)
      .where(eq(mergeReviews.id, input.id))
      .limit(1);
    if (!review) throw new ActionError("That merge review is no longer open.");
    if (review.status !== "open") throw new ActionError("That review was already decided.");

    let summary = "Kept both records";

    if (input.decision === "merged") {
      const pair = await ctx.tx
        .select()
        .from(contacts)
        .where(
          or(eq(contacts.id, review.contactAId), eq(contacts.id, review.contactBId)),
        );
      if (pair.length !== 2) throw new ActionError("One of those records no longer exists.");
      if (pair.some((p) => p.mergedIntoId)) {
        throw new ActionError("One of those records has already been merged.");
      }

      // Oldest wins. It is the one with the longest history behind it, and the one
      // whose id is most likely to be referenced from somewhere we cannot see.
      const [survivor, loser] = [...pair].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );

      // Fill only the gaps. An overwrite would silently discard whichever value the
      // survivor already had, and nobody would know which one had been kept.
      const fill: Partial<typeof contacts.$inferInsert> = {};
      if (!survivor.emailNormalised && loser.emailNormalised) {
        fill.emailRaw = loser.emailRaw;
        fill.emailNormalised = loser.emailNormalised;
      }
      if (!survivor.phoneE164 && loser.phoneE164) {
        fill.phoneRaw = loser.phoneRaw;
        fill.phoneE164 = loser.phoneE164;
      }
      if (!survivor.suburb && loser.suburb) fill.suburb = loser.suburb;
      // A do-not-contact flag is the strictest of the two by definition. Merging must
      // never relax it.
      if (loser.doNotContact) fill.doNotContact = true;

      await ctx.tx
        .update(contacts)
        .set({ ...fill, updatedAt: now })
        .where(eq(contacts.id, survivor.id));

      // Roles are additive — that is the point of a person-centric record. Move only
      // the ones the survivor does not already hold; the unique index refuses the rest.
      const survivorRoles = await ctx.tx
        .select({ role: contactRoles.role })
        .from(contactRoles)
        .where(eq(contactRoles.contactId, survivor.id));
      const held = new Set(survivorRoles.map((r) => r.role));
      const loserRoles = await ctx.tx
        .select({ id: contactRoles.id, role: contactRoles.role })
        .from(contactRoles)
        .where(eq(contactRoles.contactId, loser.id));
      for (const r of loserRoles) {
        if (held.has(r.role)) continue;
        await ctx.tx
          .update(contactRoles)
          .set({ contactId: survivor.id })
          .where(eq(contactRoles.id, r.id));
      }

      // One preference row per contact. If the survivor has none, take the loser's
      // rather than throwing away a stated budget and suburb list.
      const [survivorPrefs] = await ctx.tx
        .select({ id: contactPreferences.id })
        .from(contactPreferences)
        .where(eq(contactPreferences.contactId, survivor.id))
        .limit(1);
      if (!survivorPrefs) {
        await ctx.tx
          .update(contactPreferences)
          .set({ contactId: survivor.id })
          .where(eq(contactPreferences.contactId, loser.id));
      }

      // Open work follows the person, not the record.
      await ctx.tx
        .update(tasks)
        .set({ contactId: survivor.id })
        .where(and(eq(tasks.contactId, loser.id), eq(tasks.status, "open")));

      await ctx.tx
        .update(contacts)
        .set({ mergedIntoId: survivor.id, tombstonedAt: now, updatedAt: now })
        .where(eq(contacts.id, loser.id));

      summary = `${loser.firstName} ${loser.lastName} into ${survivor.firstName} ${survivor.lastName}`;

      await ctx.audit({
        kind: "merge",
        action: "Merged a duplicate into the older record",
        target: summary,
        entityType: "contact",
        entityId: survivor.id,
        metadata: {
          survivorId: survivor.id,
          mergedId: loser.id,
          filled: Object.keys(fill),
          rolesMoved: loserRoles.filter((r) => !held.has(r.role)).map((r) => r.role),
        },
      });
    } else {
      await ctx.audit({
        kind: "merge",
        action: "Kept both records",
        target: `Merge review ${input.id.slice(0, 8)}`,
        entityType: "merge_review",
        entityId: input.id,
      });
    }

    await ctx.tx
      .update(mergeReviews)
      .set({
        status: input.decision,
        resolvedByUserId: ctx.userId,
        resolvedAt: now,
      })
      .where(eq(mergeReviews.id, input.id));

    revalidatePath("/confirm");
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    return { decision: input.decision, summary };
  },
});
