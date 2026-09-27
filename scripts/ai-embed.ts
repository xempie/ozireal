import { systemTenantId } from "@/db";
import { pendingEmbeddings } from "@/server/ai/embed";
import { enqueue, getQueue } from "@/server/jobs/queues";

/**
 * Embed whatever is missing (B5.2).
 *
 * Migration 0010 tells operators this exists; the B5 review pointed out that it
 * did not. It does now. Safe to run repeatedly — it only enqueues rows with no
 * embedding, and both handlers are idempotent.
 *
 *   pnpm ai:embed
 */
async function main() {
  const tenantId = await systemTenantId();
  const pending = await pendingEmbeddings(tenantId);

  if (!pending.vectorAvailable) {
    console.log(
      "pgvector is not installed on this database.\n" +
        "  The embed jobs will still record WHAT they would embed, so pointing at a\n" +
        "  database that has the extension makes this a backfill rather than a\n" +
        "  re-derivation. Stage 2 of the matcher stays off until then.",
    );
  }

  let queued = 0;
  for (const id of pending.listings) {
    if (await enqueue("EmbedListing", { tenantId, entityId: id })) queued++;
  }
  for (const id of pending.contacts) {
    if (await enqueue("EmbedContactPreferences", { tenantId, entityId: id })) queued++;
  }

  console.log(
    `${pending.listings.length} listing(s) and ${pending.contacts.length} contact(s) need embedding; ${queued} enqueued.`,
  );
  await getQueue().close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
