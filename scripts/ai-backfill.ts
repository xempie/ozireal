import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, withTenant, systemTenantId } from "@/db";
import { contacts, contactRoles, contactIntent, interactions } from "@/db/schema";
import { loadPrompt } from "@/server/ai/prompts";
import { extraction, applyExtraction } from "@/server/ai/handlers";
import { extractJson } from "@/server/ai/run-task";
import { createBatch, getBatch, getBatchResults } from "@/server/ai/batch";
import { enqueue, getQueue } from "@/server/jobs/queues";
import { aiGenerations } from "@/db/schema";

/**
 * Backfill summaries for interactions the extraction job never reached — arrivals
 * before B4 existed, or during a window with no API key (the handlers skip
 * honestly rather than fail). The database is the source of truth, so repair is
 * always re-derivable from it (B3's principle, cashed in).
 *
 *   pnpm ai:backfill              enqueue as normal jobs (worker pace, full price)
 *   pnpm ai:backfill --batch      Message Batches API — half price, minutes-to-
 *                                 hours latency, applied here when results land
 *   pnpm ai:backfill --limit=200  cap either mode
 *
 * The batch path uses the SAME prompt, schema and apply step as the live handler.
 * A result that fails validation is recorded as a failed generation with the raw
 * response kept, exactly like the live path — the discount never buys different
 * behaviour, only different latency.
 */

async function main() {
  const args = process.argv.slice(2);
  const useBatch = args.includes("--batch");
  const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "500");
  
  const tenantId = await systemTenantId();
  
  const pending = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: interactions.id,
        contactId: interactions.contactId,
        channel: interactions.channel,
        direction: interactions.direction,
        subject: interactions.subject,
        body: interactions.body,
      })
      .from(interactions)
      .innerJoin(contacts, eq(contacts.id, interactions.contactId))
      .where(
        and(
          isNull(interactions.aiSummary),
          isNull(interactions.tombstonedAt),
          isNull(contacts.tombstonedAt),
        ),
      )
      .orderBy(interactions.occurredAt)
      .limit(limit),
  );
  
  console.log(`${pending.length} interaction(s) need a summary`);
  if (pending.length === 0) process.exit(0);
  
  if (!useBatch) {
    let queued = 0;
    for (const i of pending) {
      if (await enqueue("SummariseInteraction", { tenantId, entityId: i.id })) queued++;
    }
    console.log(`${queued}/${pending.length} enqueued for the worker.`);
    await getQueue().close();
    process.exit(0);
  }
  
  /* ------------------------------------------------------------- batch mode */
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is required for --batch.");
    process.exit(1);
  }
  
  const prompt = loadPrompt("extract-interaction.v1");
  
  // Context per interaction, gathered up front.
  const contactIds = [...new Set(pending.map((p) => p.contactId))];
  const contactRows = await withTenant(tenantId, async (tx) => {
    const cs = await tx
      .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(inArray(contacts.id, contactIds));
    const roles = await tx
      .select({ contactId: contactRoles.contactId, role: contactRoles.role })
      .from(contactRoles)
      .where(inArray(contactRoles.contactId, contactIds));
    const intents = await tx
      .select({ contactId: contactIntent.contactId, brief: contactIntent.rollingBrief })
      .from(contactIntent)
      .where(inArray(contactIntent.contactId, contactIds));
    return { cs, roles, intents };
  });
  const byId = new Map(contactRows.cs.map((c) => [c.id, c]));
  
  const requests = pending
    .filter((i) => byId.has(i.contactId))
    .map((i) => {
      const c = byId.get(i.contactId)!;
      return {
        customId: i.id.replace(/-/g, "").slice(0, 60),
        interactionId: i.id,
        contactId: i.contactId,
        model: "haiku" as const,
        system: [{ text: prompt.text }],
        maxTokens: 1200,
        messages: [
          {
            role: "user" as const,
            content: JSON.stringify({
              contact: {
                name: `${c.firstName} ${c.lastName}`,
                roles: contactRows.roles.filter((r) => r.contactId === c.id).map((r) => r.role),
                currentIntent:
                  contactRows.intents.find((x) => x.contactId === c.id)?.brief ?? null,
              },
              interaction: {
                channel: i.channel,
                direction: i.direction,
                subject: i.subject,
                body: (i.body ?? "").slice(0, 8000),
              },
            }),
          },
        ],
      };
    });
  
  const idMap = new Map(requests.map((r) => [r.customId, r]));

  /**
   * A submitted batch is money already spent, and results live for 29 days — so
   * the id must survive this process dying mid-poll. It is printed loudly and
   * written to .batches/, and --resume picks it up instead of paying twice.
   * Found by the B4 review.
   */
  const resumeId = args.find((a) => a.startsWith("--resume="))?.split("=")[1];
  let batchId: string;
  if (resumeId) {
    batchId = resumeId;
    console.log(`resuming batch ${batchId}`);
  } else {
    ({ id: batchId } = await createBatch(requests));
    mkdirSync(".batches", { recursive: true });
    writeFileSync(
      join(".batches", `${batchId}.json`),
      JSON.stringify({ batchId, submitted: new Date().toISOString(), count: requests.length }, null, 2),
    );
    console.log(`batch ${batchId} submitted with ${requests.length} request(s)`);
    console.log(`  if this process dies:  pnpm ai:backfill --batch --resume=${batchId}`);
  }

  let status = await getBatch(batchId);
  while (status.processingStatus === "in_progress") {
    await new Promise((r) => setTimeout(r, 30_000));
    status = await getBatch(batchId);
    console.log(`  ${JSON.stringify(status.counts)}`);
  }
  
  if (!status.resultsUrl) {
    console.error(`batch ended without results (${status.processingStatus})`);
    process.exit(1);
  }
  
  const results = await getBatchResults(status.resultsUrl);
  let applied = 0;
  let invalid = 0;
  let errored = 0;
  let superseded = 0;
  
  for (const r of results) {
    const req = idMap.get(r.customId);
    if (!req) continue;
  
    // The ledger gets a row per result, batch or not — spend is spend.
    const usage = r.usage ?? {
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
    };
    // Batch price is half of standard for this model tier.
    const usd =
      (usage.inputTokens * 0.5 + usage.outputTokens * 2.5 +
        usage.cacheWriteTokens * 0.625 + usage.cacheReadTokens * 0.05) / 1_000_000;
  
    const parsedJson = r.succeeded && r.text ? extractJson(r.text) : null;
    const parsed = parsedJson !== null ? extraction.safeParse(parsedJson) : null;
    const ok = !!parsed?.success;
  
    await withTenant(tenantId, (tx) =>
      tx.insert(aiGenerations).values({
        tenantId,
        task: "summarise-interaction:batch",
        model: "claude-haiku-4-5",
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cacheReadTokens,
        costAud: (usd * Number(process.env.AUD_PER_USD ?? "1.55")).toFixed(6),
        entityType: "interaction",
        entityId: req.interactionId,
        succeeded: ok,
        rawResponse: ok ? null : (r.text ?? r.error ?? "").slice(0, 20_000),
      }),
    );
  
    if (!r.succeeded) {
      errored++;
      continue;
    }
    if (!parsed?.success) {
      invalid++;
      continue;
    }

    /**
     * A batch can take hours, and the live handler may have summarised this
     * interaction in the meantime. Re-check before applying: two model runs word a
     * summary differently, so the proposal dedupe (which keys on the summary text)
     * would not catch it and the human would see the same proposal twice.
     * Found by the B4 review.
     */
    const [current] = await withTenant(tenantId, (tx) =>
      tx
        .select({ aiSummary: interactions.aiSummary })
        .from(interactions)
        .where(eq(interactions.id, req.interactionId))
        .limit(1),
    );
    if (current?.aiSummary) {
      superseded++;
      continue;
    }

    await applyExtraction(tenantId, req.contactId, req.interactionId, parsed.data);
    applied++;
  }
  
  // One rebuild per touched contact, at the end — not one per interaction.
  const touched = [...new Set(requests.map((r) => r.contactId))];
  for (const contactId of touched) {
    await enqueue("RebuildContactIntent", { tenantId, entityId: contactId });
  }
  
  console.log(
    `applied ${applied}, superseded ${superseded}, invalid ${invalid}, errored ${errored}; ${touched.length} rebuild(s) enqueued.`,
  );
  await getQueue().close();
  // db pool
  await (db as unknown as { $client: { end: () => Promise<void> } }).$client.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
