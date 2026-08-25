import { and, desc, eq, inArray } from "drizzle-orm";
import type { Tx } from "@/db";
import { contacts, consents } from "@/db/schema";

/**
 * The consent gate (B5.5, rules 1 and 2).
 *
 * This is the most important function in the product, and it is deliberately
 * small enough to read in one sitting.
 *
 * Rule 2 says consent is evaluated AT THE INSTANT OF SENDING, not at draft time.
 * The distinction is the whole point: a draft written on Monday and approved on
 * Thursday may be going to someone who unsubscribed on Wednesday. Checking at
 * draft time would produce a defensible-looking audit trail and an unlawful send.
 *
 * A refusal is never silent. `approval_items.block_reason` is populated with a
 * sentence a person can act on, and the database's approval_blocked_has_reason
 * constraint means a blocked row without one cannot exist.
 */

export type GateDecision =
  | { allowed: true; consentStatus: "granted"; grantedAt: Date; wording: string }
  | { allowed: false; reason: string; consentStatus: "revoked" | "never_given" | null };

/**
 * May we send to this contact on this channel, right now?
 *
 * Checks, in order of how absolute they are:
 *   1. the contact exists and is not tombstoned — a privacy deletion ends contact;
 *   2. do-not-contact, which is independent of channel consent and outranks it;
 *   3. the latest consent row for the channel, which must say granted.
 *
 * Consent from records MERGED INTO this one counts, because a withdrawal recorded
 * against a duplicate is still a withdrawal. The strictest state across the merged
 * identity wins — the union is deliberate, and B3's read layer already works this way.
 */
export async function checkConsent(
  tx: Tx,
  contactId: string,
  channel: "email" | "sms" | "phone",
): Promise<GateDecision> {
  const [contact] = await tx
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      doNotContact: contacts.doNotContact,
      tombstonedAt: contacts.tombstonedAt,
      mergedIntoId: contacts.mergedIntoId,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) {
    return { allowed: false, reason: "That contact no longer exists.", consentStatus: null };
  }
  if (contact.tombstonedAt) {
    return {
      allowed: false,
      reason: "The contact asked to be removed under a privacy request. No further messages may be sent.",
      consentStatus: null,
    };
  }
  if (contact.mergedIntoId) {
    return {
      allowed: false,
      reason: "That record was merged into another. Send from the surviving record so the history stays in one place.",
      consentStatus: null,
    };
  }
  if (contact.doNotContact) {
    return {
      allowed: false,
      reason: `${contact.firstName} ${contact.lastName} is marked do-not-contact. This flag is checked independently of channel consent.`,
      consentStatus: null,
    };
  }

  // Every identity that is this person: this record, plus anything merged into it.
  const mergedIn = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.mergedIntoId, contactId));
  const identityIds = [contactId, ...mergedIn.map((m) => m.id)];

  /**
   * Consents are append-only, so the CURRENT state is the latest row per channel.
   * Ordered by occurredAt — when the person actually acted — not createdAt, which
   * is when we got around to recording it.
   */
  const rows = await tx
    .select({
      contactId: consents.contactId,
      status: consents.status,
      occurredAt: consents.occurredAt,
      createdAt: consents.createdAt,
      wordingShown: consents.wordingShown,
    })
    .from(consents)
    .where(and(eq(consents.channel, channel), inArray(consents.contactId, identityIds)))
    // createdAt breaks ties: two rows can share an occurredAt (a caller-supplied
    // value), and "whichever the planner returned first" is not a consent policy.
    .orderBy(desc(consents.occurredAt), desc(consents.createdAt));

  /**
   * Latest state PER RECORD, then the strictest of those across the identity.
   *
   * Neither half alone is right, and the first two attempts each took one half:
   *
   *   - pure latest-wins over the union let a grant on the survivor override a
   *     revocation that arrived later on a duplicate — the merged record's
   *     unsubscribe simply lost, which is the bug the B5 review found;
   *   - pure strictest-wins fixed that and broke something worse: anyone who ever
   *     unsubscribed could never opt back in, because a historical revocation
   *     outranked every later grant. People DO re-subscribe, and a system that
   *     silently refuses to let them is losing real consent.
   *
   * So: within one record the most recent row wins (re-subscription works), and
   * across records any identity whose current state is not granted blocks the
   * send (a duplicate's unsubscribe still counts). Rows arrive newest-first, so
   * the first row seen per contactId IS that record's current state.
   */
  const currentPerRecord = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!currentPerRecord.has(r.contactId)) currentPerRecord.set(r.contactId, r);
  }

  const withheld = [...currentPerRecord.values()].find((r) => r.status !== "granted");
  if (withheld) {
    return {
      allowed: false,
      reason: `${channel} consent is currently ${withheld.status.replace("_", " ")} (recorded ${withheld.occurredAt.toISOString().slice(0, 10)})${
        withheld.contactId === contactId ? "" : " on a record since merged into this one"
      }. The current state of every record for this person has to allow it.`,
      consentStatus: withheld.status as "revoked" | "never_given",
    };
  }

  const latest = rows[0];

  if (!latest) {
    return {
      allowed: false,
      reason: `No ${channel} consent has ever been recorded for this contact. Under the Spam Act a send needs consent with provenance, and none exists.`,
      consentStatus: "never_given",
    };
  }

  return {
    allowed: true,
    consentStatus: "granted",
    grantedAt: latest.occurredAt,
    wording: latest.wordingShown,
  };
}

/**
 * Every marketing message must carry a working unsubscribe and identify the sender
 * (Spam Act 2003, §10). Composed here rather than left to a prompt, because a
 * model that forgets it produces an unlawful message that still looks fine.
 */
/**
 * The facility, as a discriminated union rather than a bag of optional fields.
 *
 * The first version took `channel` plus `{ url?, keyword? }`, and the only
 * production caller passed an SMS keyword for BOTH channels. Email therefore went
 * out with sender identification and no unsubscribe at all — unlawful under the
 * Spam Act, invisible to the type checker, and contradicted by the comment above
 * claiming no draft could omit one. Folding the channel into the union removes
 * the state where the channel and the facility disagree, so the mistake can no
 * longer be expressed. Found by the B5 review.
 */
export type UnsubscribeFacility =
  | { channel: "email"; url: string }
  | { channel: "sms"; keyword: string };

export function withComplianceFooter(
  body: string,
  agency: { name: string; licence: string | null },
  unsubscribe: UnsubscribeFacility,
): string {
  if (unsubscribe.channel === "sms") {
    // 160-char pressure is real, so this is terse — but never absent.
    return `${body.trim()}\n${agency.name}. Reply ${unsubscribe.keyword} to opt out.`;
  }
  return [
    body.trim(),
    "",
    "—",
    agency.licence ? `${agency.name} · ${agency.licence}` : agency.name,
    // Unconditional. There is no branch in which an email lacks this line.
    `Unsubscribe: ${unsubscribe.url}`,
  ].join("\n");
}
