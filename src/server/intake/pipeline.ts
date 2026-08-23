import { sql } from "drizzle-orm";
import { withTenant, type Tx } from "@/db";
import { interactions, consents, channelAdapters } from "@/db/schema";
import { enqueue, type JobName, type JobPayload } from "@/server/jobs/queues";
import { resolveContact, type Resolution } from "./resolve";
import { getAdapter, type Channel, type NormalisedInteraction } from "./types";

/**
 * THE pipeline (CLAUDE.md §5). Fixed for all channels:
 *
 *   adapter.ingest → normalise → identity resolve → interactions row
 *     → enqueue SummariseInteraction → enqueue RebuildContactIntent
 *
 * This code does not know which channel it is serving, and that is the design: if a
 * new channel needs it edited, the adapter interface is wrong — fix the interface.
 *
 * It is split at the transaction boundary on purpose:
 *
 *   ingestInTx      — every durable write (contact, interaction, consent), inside
 *                     a transaction the CALLER owns. A Server Action passes its own
 *                     tx so the audit row and the interaction commit or roll back
 *                     together; the public routes get a fresh one.
 *   ingestNormalised — wraps ingestInTx in withTenant and then, AFTER commit,
 *                     enqueues the jobs. Enqueue-after-commit is load-bearing: the
 *                     reverse order lets a worker race a transaction that might
 *                     still roll back. A dead Redis costs freshness, never data —
 *                     the interaction row is already down.
 */

export type IngestResult = {
  interactionId: string;
  contactId: string;
  resolution: Resolution["outcome"];
  /** True when the transport already delivered this exact message before. */
  duplicate: boolean;
  /** What ingestNormalised enqueues after commit. Callers that own their own
   *  transaction (Server Actions) enqueue these via their own after-commit hook. */
  jobs: { name: JobName; payload: JobPayload }[];
};

export async function ingestThrough(
  channel: Channel,
  raw: unknown,
  tenantId: string,
): Promise<IngestResult> {
  const adapter = getAdapter(channel);
  const normalised = await adapter.ingest(raw);
  return ingestNormalised(normalised, tenantId);
}

export async function ingestNormalised(
  n: NormalisedInteraction,
  tenantId: string,
): Promise<IngestResult> {
  const result = await withTenant(tenantId, (tx) => ingestInTx(tx, n, tenantId));
  for (const job of result.jobs) await enqueue(job.name, job.payload);
  return result;
}

export async function ingestInTx(
  tx: Tx,
  n: NormalisedInteraction,
  tenantId: string,
): Promise<IngestResult> {
  /**
   * Replay check FIRST — before a contact is created. SNS redelivers, browsers
   * resubmit; the second delivery of one message must be a no-op, not a duplicate
   * contact plus a spurious merge review.
   */
  if (n.messageId) {
    const existing = await findByMessageId(tx, tenantId, n);
    if (existing) {
      return { ...existing, resolution: "existing", duplicate: true, jobs: [] };
    }
  }

  const resolution = await resolveContact(tx, tenantId, n.identity, {
    channel: n.channel,
    summary: n.subject ?? n.body.slice(0, 80),
  });

  const [interaction] = await tx
    .insert(interactions)
    .values({
      tenantId,
      contactId: resolution.contactId,
      channel: n.channel,
      direction: n.direction,
      occurredAt: n.occurredAt,
      subject: n.subject,
      body: n.body,
      messageId: n.messageId,
      threadRef: n.threadRef,
      rawS3Key: n.rawS3Key,
      createdByUserId: n.recordedByUserId ?? null,
    })
    // The unique index still catches a race between the check above and here (two
    // SNS deliveries in flight together). Losing that race is fine.
    .onConflictDoNothing()
    .returning({ id: interactions.id });

  if (!interaction) {
    const winner = await findByMessageId(tx, tenantId, n);
    if (!winner) throw new Error("Replay conflict with no winning row — investigate.");
    return { ...winner, resolution: "existing", duplicate: true, jobs: [] };
  }

  /**
   * Consent rows ride in the same transaction: provenance is captured at the
   * moment of submission or not at all (§10). Append-only — a later withdrawal is
   * a new row, and the latest row per channel is the current state.
   */
  for (const c of n.consents) {
    await tx.insert(consents).values({
      tenantId,
      contactId: resolution.contactId,
      channel: c.channel,
      status: c.status,
      sourceForm: c.sourceForm,
      wordingShown: c.wordingShown,
      ipAddress: c.ipAddress,
      occurredAt: n.occurredAt,
    });
  }

  await touchAdapterHealth(tx, tenantId, n.channel);

  return {
    interactionId: interaction.id,
    contactId: resolution.contactId,
    resolution: resolution.outcome,
    duplicate: false,
    jobs: [
      { name: "SummariseInteraction", payload: { tenantId, entityId: interaction.id } },
      { name: "RebuildContactIntent", payload: { tenantId, entityId: resolution.contactId } },
    ],
  };
}

async function findByMessageId(tx: Tx, tenantId: string, n: NormalisedInteraction) {
  const [row] = await tx
    .select({ interactionId: interactions.id, contactId: interactions.contactId })
    .from(interactions)
    .where(
      sql`${interactions.tenantId} = ${tenantId}
          and ${interactions.channel} = ${n.channel}
          and ${interactions.messageId} = ${n.messageId}`,
    )
    .limit(1);
  return row ?? null;
}

/**
 * The /settings adapter table shows "last received" per channel. Kept as a cheap
 * upsert here so it is never a second write path someone forgets.
 */
async function touchAdapterHealth(tx: Tx, tenantId: string, channel: Channel) {
  await tx
    .insert(channelAdapters)
    .values({ tenantId, name: channel, status: "ok", lastReceivedAt: new Date(), receivedToday: 1 })
    .onConflictDoUpdate({
      target: [channelAdapters.tenantId, channelAdapters.name],
      set: {
        lastReceivedAt: new Date(),
        receivedToday: sql`${channelAdapters.receivedToday} + 1`,
      },
    });
}
