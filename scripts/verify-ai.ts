import "dotenv/config";
import postgres from "postgres";
import { systemTenantId } from "@/db";
import { hasApiKey } from "@/server/ai/claude";
import { summariseInteraction, rebuildContactIntent } from "@/server/ai/handlers";

/**
 * One REAL pass through the AI layer — actual Claude, actual database:
 * seed an interaction, run extraction, run the rebuild, show what landed and what
 * it cost. Total spend is a fraction of a cent.
 *
 *   pnpm verify:ai         (needs ANTHROPIC_API_KEY in .env.local)
 */

async function main() {
  if (!hasApiKey()) {
    console.log(
      "SKIP  ANTHROPIC_API_KEY is not set.\n" +
        "      Add it to .env.local, then: pnpm verify:ai\n" +
        "      Everything else in B4 is proven by the mocked suite (pnpm test).",
    );
    process.exit(0);
  }
  
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const tenantId = await systemTenantId();
  const stamp = Date.now().toString().slice(-6);
  
  let failures = 0;
  function check(label: string, ok: boolean, detail = "") {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
    if (!ok) failures++;
  }
  
  // A realistic enquiry with an explicit preference statement and a direct question.
  const [contact] = await sql<{ id: string }[]>`
    insert into contacts (tenant_id, first_name, last_name, email_raw, email_normalised, source_channel)
    values (${tenantId}, 'Verity', ${`Aicheck${stamp}`},
            ${`verity.${stamp}@example.com`}, ${`verity.${stamp}@example.com`}, 'web_form')
    returning id`;
  await sql`insert into contact_roles (tenant_id, contact_id, role)
            values (${tenantId}, ${contact.id}, 'buyer')`;
  const [interaction] = await sql<{ id: string }[]>`
    insert into interactions (tenant_id, contact_id, channel, direction, occurred_at, subject, body, message_id)
    values (${tenantId}, ${contact.id}, 'web_form', 'in', now(),
            'Enquiry — 12 Powell Street',
            'Hi, is the Powell St place still on the market? We are pre-approved to $680,000 and could move quickly. Could you send through the building inspection report before Saturday?',
            ${`verify-ai:${stamp}`})
    returning id`;
  
  console.log("\nExtraction (Haiku, live)");
  const ex = await summariseInteraction(tenantId, interaction.id);
  check("the job completed", "summarised" in (ex as object), JSON.stringify(ex));
  
  const [i] = await sql<{ ai_summary: string | null }[]>`
    select ai_summary from interactions where id = ${interaction.id}`;
  check("a factual summary landed on the interaction", !!i.ai_summary, i.ai_summary ?? "");
  
  const proposals = await sql<{ kind: string; summary: string }[]>`
    select kind, summary from confirm_items where source_interaction_id = ${interaction.id}`;
  check("proposals were queued for a human, not applied", proposals.length > 0,
    proposals.map((p) => `[${p.kind}] ${p.summary}`).join(" | "));
  
  const [prefsBefore] = await sql<{ n: number }[]>`
    select count(*)::int as n from contact_preferences where contact_id = ${contact.id}`;
  check("...and preferences were NOT touched directly (rule 5)", prefsBefore.n === 0);
  
  console.log("\nRolling brief (Sonnet, live)");
  const rb = await rebuildContactIntent(tenantId, contact.id);
  check("the rebuild completed", "rebuilt" in (rb as object), JSON.stringify(rb));
  
  const [intent] = await sql<
    { rolling_brief: string; intent_type: string | null; sentiment: string | null }[]
  >`select rolling_brief, intent_type, sentiment from contact_intent where contact_id = ${contact.id}`;
  check("the brief reads like a briefing", !!intent?.rolling_brief, intent?.rolling_brief ?? "");
  check("intent classified", intent?.intent_type === "buying", `intent=${intent?.intent_type} sentiment=${intent?.sentiment}`);
  
  console.log("\nThe ledger");
  const spend = await sql<
    { task: string; model: string; input_tokens: number; output_tokens: number; cost_aud: string; latency_ms: number }[]
  >`select task, model, input_tokens, output_tokens, cost_aud, latency_ms
     from ai_generations
     where entity_id in (${interaction.id}, ${contact.id})
     order by created_at`;
  for (const s of spend) {
    console.log(
      `        ${s.task}  ${s.model}  ${s.input_tokens}in/${s.output_tokens}out  $${Number(s.cost_aud).toFixed(4)} AUD  ${s.latency_ms}ms`,
    );
  }
  check("every call is on the ledger with its cost", spend.length === 2);
  
  await sql.end();
  console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}\n`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
