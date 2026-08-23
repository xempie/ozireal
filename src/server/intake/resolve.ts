import { and, eq, isNull, or } from "drizzle-orm";
import type { Tx } from "@/db";
import { contacts, contactRoles, mergeReviews } from "@/db/schema";
import {
  toE164,
  normaliseEmail,
  isAuMobile,
  compareNames,
} from "@/lib/normalise";
import type { InboundIdentity, Channel } from "./types";

/**
 * Identity resolution (B3.3): who is this enquiry from?
 *
 * Three answers, and the shape of the product hangs on which is allowed when:
 *
 *   existing  — safe to attach to a record automatically. Requires a KEY match
 *               (normalised email or E.164 phone), never name similarity: a name is
 *               demographic coincidence, keys are identity (§4).
 *   new       — no plausible match. The enquiry lands on a fresh record, because
 *               losing it is the one failure intake is not allowed to have.
 *   ambiguous — a plausible match a machine must not act on. A NEW record is still
 *               created — the enquiry has to land somewhere — and a merge review is
 *               raised so a person decides. Nothing auto-merges, ever.
 *
 * The dangerous quadrant is a key that matches but describes a HOUSEHOLD rather
 * than a person: the shared landline, the family mailbox. Attaching one spouse's
 * enquiry to the other's record cross-contaminates two people's histories — every
 * brief, match and consent decision after that is built on a lie. So a key match
 * with conflicting evidence goes to review, and the tie-break a human would want
 * to make from the phone column is deliberately not made for them (a tie-break
 * between unresolved duplicates is an auto-merge in disguise).
 */

export type Resolution = {
  contactId: string;
  outcome: "existing" | "new" | "ambiguous";
  /** Which key(s) decided it — for the audit trail and the review row. */
  matchedOn: string | null;
  reviewIds: string[];
};

type Candidate = typeof contacts.$inferSelect & {
  via: "email" | "secondary_email" | "phone";
};

export async function resolveContact(
  tx: Tx,
  tenantId: string,
  identity: InboundIdentity,
  source: { channel: Channel; summary: string },
): Promise<Resolution> {
  if (identity.kind === "resolved") {
    // The channel already knows (manual entry happens on a contact's screen).
    // Trust but verify — a stale id must fail loudly, not create a ghost.
    const [c] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.id, identity.contactId))
      .limit(1);
    if (!c) throw new Error(`Contact ${identity.contactId} does not exist.`);
    return { contactId: c.id, outcome: "existing", matchedOn: "resolved by channel", reviewIds: [] };
  }

  const email = normaliseEmail(identity.email);
  const phone = toE164(identity.phone);

  const candidates = email || phone ? await findCandidates(tx, email, phone) : [];

  if (candidates.length === 0) {
    const id = await createRecord(tx, tenantId, identity, email, phone, source.channel);
    return { contactId: id, outcome: "new", matchedOn: null, reviewIds: [] };
  }

  if (candidates.length === 1) {
    const c = candidates[0];
    const names = compareNames(
      identity.firstName,
      identity.lastName,
      c.firstName,
      c.lastName,
    );

    /**
     * One candidate. Whether the machine may attach depends on how PERSONAL the
     * matched key is, corroborated or undermined by the name:
     *
     *   email / secondary email — personal, unless the name flatly conflicts
     *     (both names differ: the family-mailbox pattern → review).
     *   mobile — personal, same rule (mobiles are recycled and shared in families).
     *   landline — a household key. It needs the name to positively AGREE;
     *     absence of conflict is not enough.
     */
    const personalKey = c.via !== "phone" || isAuMobile(phone);
    const safe = personalKey ? names !== "conflicts" : names === "agrees";

    if (safe) {
      return {
        contactId: c.id,
        outcome: "existing",
        matchedOn: describeMatch(c, email, phone),
        reviewIds: [],
      };
    }
  }

  // Plausible but not safe: two candidates, or one the evidence undermines.
  // The enquiry still lands — on its own record — and a person decides the rest.
  const id = await createRecord(tx, tenantId, identity, email, phone, source.channel);
  const reviewIds: string[] = [];
  for (const c of candidates.slice(0, 3)) {
    const [review] = await tx
      .insert(mergeReviews)
      .values({
        tenantId,
        contactAId: c.id,
        contactBId: id,
        similarity: c.via === "phone" && !isAuMobile(phone) ? 0.7 : 0.9,
        matchedOn: `${describeMatch(c, email, phone)} — ${source.summary}`,
      })
      .returning({ id: mergeReviews.id });
    reviewIds.push(review.id);
  }
  return {
    contactId: id,
    outcome: "ambiguous",
    matchedOn: candidates.map((c) => describeMatch(c, email, phone)).join("; "),
    reviewIds,
  };
}

/**
 * Every live record either key hits — with two adjustments that are the point:
 *
 *   - A record merged away is not a separate person: follow `merged_into_id` to the
 *     survivor (one hop — the schema's no-chain trigger guarantees depth).
 *   - A tombstoned record is invisible. A privacy deletion means the relationship
 *     starts over if the person returns: attaching their new enquiry to the record
 *     they asked to be forgotten would resurrect exactly the history they ended,
 *     and raising a review against it would surface that history to a screen.
 *
 * Order matters: merged losers ARE tombstoned (the 0006 constraint), so the pointer
 * is followed first and only dead-end tombstones are dropped.
 */
async function findCandidates(
  tx: Tx,
  email: string | null,
  phone: string | null,
): Promise<Candidate[]> {
  const conditions = [];
  if (email) {
    conditions.push(eq(contacts.emailNormalised, email));
    conditions.push(eq(contacts.secondaryEmail, email));
  }
  if (phone) conditions.push(eq(contacts.phoneE164, phone));

  const hits = await tx
    .select()
    .from(contacts)
    .where(or(...conditions));

  const resolved = new Map<string, Candidate>();
  for (const hit of hits) {
    const via: Candidate["via"] =
      email && hit.emailNormalised === email
        ? "email"
        : email && hit.secondaryEmail === email
          ? "secondary_email"
          : "phone";

    let record = hit;
    if (record.mergedIntoId) {
      const [survivor] = await tx
        .select()
        .from(contacts)
        .where(eq(contacts.id, record.mergedIntoId))
        .limit(1);
      if (!survivor) continue;
      record = survivor;
    }
    if (record.tombstonedAt) continue;

    // Both keys landing on one record (directly or via a merged loser) is ONE
    // candidate and the strongest possible signal — not a conflict.
    if (!resolved.has(record.id)) resolved.set(record.id, { ...record, via });
  }
  return [...resolved.values()];
}

async function createRecord(
  tx: Tx,
  tenantId: string,
  identity: Extract<InboundIdentity, { kind: "claimed" }>,
  email: string | null,
  phone: string | null,
  channel: Channel,
): Promise<string> {
  const [created] = await tx
    .insert(contacts)
    .values({
      tenantId,
      // An enquiry with no name still has to land; "Unknown" is honest and greppable.
      firstName: identity.firstName?.trim() || "Unknown",
      lastName: identity.lastName?.trim() || "Enquirer",
      emailRaw: identity.email?.trim() || null,
      emailNormalised: email,
      phoneRaw: identity.phone?.trim() || null,
      phoneE164: phone,
      sourceChannel: channel,
    })
    .returning({ id: contacts.id });

  await tx
    .insert(contactRoles)
    .values({ tenantId, contactId: created.id, role: "buyer" })
    .onConflictDoNothing();

  return created.id;
}

function describeMatch(c: Candidate, email: string | null, phone: string | null) {
  switch (c.via) {
    case "email":
      return `Same email (${email})`;
    case "secondary_email":
      return `Same secondary email (${email})`;
    case "phone":
      return isAuMobile(phone) ? `Same mobile (${phone})` : `Same phone number (${phone})`;
  }
}

/** Exported for the resolver tests — not part of the adapter surface. */
export const _internals = { findCandidates };
