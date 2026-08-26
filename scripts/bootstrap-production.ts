import { randomUUID } from "node:crypto";
import postgres from "postgres";

/**
 * Bring a PRODUCTION database up to a usable empty state.
 *
 * Deliberately not the seed. `src/db/seed/index.ts` refuses any non-local URL,
 * and that guard is correct — it truncates every table and inserts sample
 * people. Running it against production would be a disaster with a friendly
 * name. This inserts only what the application cannot function without and
 * cannot invent:
 *
 *   the agency, the first user, the suburb reference list, the consent wording,
 *   the SA disclosure rules, and the LLM defaults.
 *
 * No contacts. No listings. No interactions. An empty CRM is the correct
 * starting state, and an honest one — the first real contact should be a real
 * enquiry, not a fixture someone later mistakes for one.
 *
 * Idempotent: every insert is ON CONFLICT DO NOTHING, so re-running it after a
 * restore or a schema change is safe.
 *
 *   tsx scripts/bootstrap-production.ts
 */

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");

const AGENCY = {
  name: process.env.AGENCY_NAME ?? "Ozi Realty",
  tradingName: process.env.AGENCY_TRADING_NAME ?? "Ozi Realty Adelaide",
  abn: process.env.AGENCY_ABN ?? null,
  licence: process.env.AGENCY_LICENCE ?? null,
};
const FIRST_USER = {
  email: process.env.AUTH_ALLOWED_EMAILS?.split(",")[0]?.trim() ?? "",
  name: process.env.FIRST_USER_NAME ?? "Principal",
};

/** Adelaide metro. Suburbs are a reference table with a real FK — the matcher's
 *  stage-1 filter is a suburb equality check, so a missing row silently drops a
 *  contact from every match. Extend by adding rows, never by free text. */
const SUBURBS: [string, string][] = [
  ["Adelaide", "5000"], ["North Adelaide", "5006"], ["Norwood", "5067"],
  ["Kent Town", "5067"], ["Prospect", "5082"], ["Glenelg", "5045"],
  ["Unley", "5061"], ["Mawson Lakes", "5095"], ["Greenacres", "5086"],
  ["Magill", "5072"], ["Henley Beach", "5022"], ["Payneham", "5070"],
  ["Modbury", "5092"], ["Brighton", "5048"], ["Salisbury", "5108"],
  ["Burnside", "5066"], ["Marion", "5043"], ["Port Adelaide", "5015"],
  ["Semaphore", "5019"], ["Woodville", "5011"], ["Campbelltown", "5074"],
  ["Tea Tree Gully", "5091"], ["Mitcham", "5062"], ["Hyde Park", "5061"],
];

const CONSENT_WORDING =
  "I agree to Ozi Realty contacting me about properties and services that match my enquiry. I can unsubscribe at any time.";

const CONSENT_FORMS: [string, string][] = [
  ["Website enquiry", CONSENT_WORDING],
  ["Listing enquiry", CONSENT_WORDING],
  [
    "Free property appraisal",
    CONSENT_WORDING.replace(
      "properties and services that match my enquiry",
      "the appraisal of my property and related services",
    ),
  ],
  [
    "Suburb insight report",
    "Send me the report and occasional market updates for this suburb. I can unsubscribe at any time.",
  ],
];

/** South Australia only (D2). Adding NSW later is a data load, not a rewrite. */
const DISCLOSURE_RULES: [string, string][] = [
  ["Vendor statement (Form 1)", "Served before the contract becomes binding"],
  ["Cooling-off notice", "Two clear business days, from the later of contract or Form 1"],
  ["Agent licence on marketing", "RLA number shown on every public listing and message"],
];

async function main() {
  const sql = postgres(url!, { max: 1, onnotice: () => {} });

  try {
    const [existing] = await sql<{ id: string; name: string }[]>`
      select id, name from tenants order by created_at limit 1`;

    let tenantId: string;
    if (existing) {
      tenantId = existing.id;
      console.log(`tenant already present: ${existing.name}`);
    } else {
      tenantId = randomUUID();
      await sql`
        insert into tenants (id, name, trading_name, abn, licence_number, jurisdiction, timezone)
        values (${tenantId}, ${AGENCY.name}, ${AGENCY.tradingName}, ${AGENCY.abn},
                ${AGENCY.licence}, 'SA', 'Australia/Adelaide')`;
      console.log(`tenant created: ${AGENCY.name}`);
    }

    if (!FIRST_USER.email) {
      console.warn(
        "  no AUTH_ALLOWED_EMAILS set, so no user was created — nobody can sign in yet.",
      );
    } else {
      const [u] = await sql<{ id: string }[]>`
        insert into users (id, tenant_id, email, name, role, provider)
        values (${randomUUID()}, ${tenantId}, ${FIRST_USER.email}, ${FIRST_USER.name},
                'principal', 'google')
        on conflict (email) do nothing
        returning id`;
      console.log(u ? `user created: ${FIRST_USER.email}` : `user already present: ${FIRST_USER.email}`);
    }

    let added = 0;
    for (const [name, postcode] of SUBURBS) {
      const [r] = await sql<{ id: string }[]>`
        insert into suburbs (id, name, state, postcode)
        values (${randomUUID()}, ${name}, 'SA', ${postcode})
        on conflict do nothing returning id`;
      if (r) added++;
    }
    console.log(`suburbs: ${added} added, ${SUBURBS.length - added} already present`);

    for (const [form, wording] of CONSENT_FORMS) {
      await sql`insert into consent_templates (tenant_id, form_name, wording)
                values (${tenantId}, ${form}, ${wording})
                on conflict (tenant_id, form_name) do nothing`;
    }
    console.log(`consent wording: ${CONSENT_FORMS.length} forms`);

    for (const [name, detail] of DISCLOSURE_RULES) {
      await sql`insert into disclosure_rules (tenant_id, jurisdiction, name, detail)
                values (${tenantId}, 'SA', ${name}, ${detail})
                on conflict (tenant_id, jurisdiction, name) do nothing`;
    }
    console.log(`disclosure rules: ${DISCLOSURE_RULES.length} (SA)`);

    await sql`insert into llm_settings (tenant_id) values (${tenantId})
              on conflict (tenant_id) do nothing`;
    console.log("llm settings: defaults in place");

    const [key] = await sql<{ form_key: string }[]>`
      select form_key from tenants where id = ${tenantId}`;
    console.log(`\npublic form endpoint: /api/forms/${key.form_key}`);
    console.log("counts:");
    const [c] = await sql<{ contacts: number; listings: number }[]>`
      select (select count(*)::int from contacts) as contacts,
             (select count(*)::int from listings) as listings`;
    console.log(`  contacts ${c.contacts}, listings ${c.listings}  (empty is correct)`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
