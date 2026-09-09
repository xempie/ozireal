/**
 * Insert any missing consent template.
 *
 * The seed writes these on a fresh database, but every existing one predates the Phase 2B
 * service forms. Without a row the endpoint serves its fallback wording, which is legally
 * honest but generic: a consent record is worth most when the text it stored is the text
 * that was actually on screen for that specific enquiry.
 *
 * Idempotent, and never updates an existing row. Changing wording that has already been
 * shown to people would rewrite the evidence for consents already given, which is the one
 * thing a consents table must not do. A reworded form gets a new row, by hand, with a
 * decision behind it.
 *
 *   node --env-file=.env.local scripts/sync-consent-templates.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

const base =
  "I agree to OziRealty contacting me about properties and services that match my enquiry. I can unsubscribe at any time.";

const TEMPLATES = [
  ["Website enquiry", base],
  ["Listing enquiry", base],
  [
    "Free property appraisal",
    base.replace(
      "properties and services that match my enquiry",
      "the appraisal of my property and related services",
    ),
  ],
  [
    "Suburb insight report",
    "Send me the report and occasional market updates for this suburb. I can unsubscribe at any time.",
  ],
  [
    "Property management enquiry",
    "Send me rental market updates and property management news by email. I can unsubscribe at any time.",
  ],
  [
    "Sell my property enquiry",
    base.replace(
      "properties and services that match my enquiry",
      "selling my property and the local sales market",
    ),
  ],
  [
    "Rent out my property enquiry",
    "Send me rental market updates relevant to letting my property. I can unsubscribe at any time.",
  ],
  [
    "Buyer agent enquiry",
    "Send me properties matching this brief, including off-market opportunities. I can unsubscribe at any time.",
  ],
  [
    "Property investment enquiry",
    "Send me investment opportunities and market analysis by email. I can unsubscribe at any time.",
  ],
  [
    "Land opportunities enquiry",
    "Send me land and development opportunities matching this brief. I can unsubscribe at any time.",
  ],
  [
    "Rental enquiry",
    "Send me rental properties matching these requirements before they are advertised. I can unsubscribe at any time.",
  ],
  [
    "Sell my business enquiry",
    "Send me business sale market updates by email. I can unsubscribe at any time.",
  ],
];

const tenants = await sql`select id, name from tenants order by created_at`;
if (!tenants.length) {
  console.error("No tenant rows. Nothing to do.");
  process.exit(1);
}

let added = 0;
for (const t of tenants) {
  for (const [formName, wording] of TEMPLATES) {
    const r = await sql`
      insert into consent_templates (tenant_id, form_name, wording)
      values (${t.id}, ${formName}, ${wording})
      on conflict (tenant_id, form_name) do nothing
      returning form_name`;
    if (r.length) {
      added++;
      console.log(`  + ${t.name}: ${formName}`);
    }
  }
}
console.log(added ? `\n${added} template(s) added.` : "\nAll templates already present.");
await sql.end();
