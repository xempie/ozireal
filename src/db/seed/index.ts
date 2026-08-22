/**
 * Seed the database from the prototype's sample data.
 *
 * This imports the SAME modules the console renders from, so the database and the UI
 * cannot drift: if a field exists on screen it has to land in a column here, and
 * anything that will not fit is a schema gap rather than a seeding detail.
 *
 *   pnpm db:seed
 *
 * Idempotent - it truncates first, so it is safe to run repeatedly in development.
 * It refuses to run against a non-local database.
 */

import "dotenv/config";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

import * as S from "../../lib/sample-data";
import * as S2 from "../../lib/sample-data-2";

const url =
  process.env.DATABASE_URL ?? "postgres://ozirealty@127.0.0.1:5433/ozirealty";

if (!/localhost|127\.0\.0\.1/.test(url)) {
  throw new Error(
    `Refusing to seed a non-local database: ${url.replace(/:[^:@]*@/, ":***@")}`,
  );
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

/** Sample string ids ("c1", "l3") mapped to the uuids the database actually uses. */
const id = {
  contact: new Map<string, string>(),
  property: new Map<string, string>(),
  listing: new Map<string, string>(),
  interaction: new Map<string, string>(),
  inspection: new Map<string, string>(),
  suburb: new Map<string, string>(),
  campaign: new Map<string, string>(),
};

const TENANT = randomUUID();
const USER = randomUUID();

/** Suburb + postcode pairs, taken from the properties and contacts in the sample set. */
const SUBURBS: [string, string][] = [
  ["Norwood", "5067"],
  ["Prospect", "5082"],
  ["Glenelg", "5045"],
  ["Unley", "5061"],
  ["Mawson Lakes", "5095"],
  ["Greenacres", "5086"],
  ["Magill", "5072"],
  ["Henley Beach", "5022"],
  ["Payneham", "5070"],
  ["Modbury", "5092"],
  ["Brighton", "5048"],
  ["Salisbury", "5108"],
];

const propTypeMap: Record<string, string> = {
  House: "house",
  Unit: "unit",
  Townhouse: "townhouse",
  Land: "land",
};

/** "12 Powell Street" -> { streetNumber: "12", street: "Powell Street" } */
function splitAddress(address: string) {
  const m = address.match(/^(\d+[a-zA-Z]?)\s+(.*)$/);
  return m
    ? { streetNumber: m[1], street: m[2] }
    : { streetNumber: null, street: address };
}

/** Australian mobile as stored -> E.164 with no spaces. */
function e164(phone: string) {
  return phone.replace(/\s+/g, "");
}

/** Lower-case and strip plus-addressing, which is what dedupe compares on. */
function normaliseEmail(email: string) {
  const [local, domain] = email.toLowerCase().split("@");
  return domain ? `${local.split("+")[0]}@${domain}` : email.toLowerCase();
}

async function main() {
  console.log("seeding from the prototype's sample data\n");

  // Order matters: children before parents. The append-only triggers block UPDATE and
  // DELETE on interactions and consents, so TRUNCATE (which they do not intercept) is
  // the only way to reset them - which is itself a small proof the guards are real.
  await sql.unsafe(`TRUNCATE TABLE
    inspection_registrations, inspections, listing_media, matches, approval_items,
    campaigns, proposals, confirm_items, merge_reviews, tasks, calendar_events,
    voice_notes, blog_posts, social_posts, seo_issues, redirects, suburb_pages,
    ai_generations, audit_log, channel_adapters, consent_templates, disclosure_rules,
    saved_views, consents, contact_intent, contact_preferences, contact_roles,
    interactions, listings, properties, contacts, suburbs, users, tenants,
    listing_agents
    RESTART IDENTITY CASCADE`);

  /* ------------------------------------------------------------- tenancy */
  await sql`
    insert into tenants (id, name, trading_name, abn, licence_number, jurisdiction, timezone)
    values (${TENANT}, ${S.agency.name}, ${S.agency.tradingName}, ${S.agency.abn},
            ${S.agency.licence}, 'SA', ${S.agency.timezone})`;

  await sql`
    insert into users (id, tenant_id, email, name, role, provider)
    values (${USER}, ${TENANT}, ${S.agency.user.email}, ${S.agency.user.name},
            'principal', 'google')`;

  for (const [name, postcode] of SUBURBS) {
    const sid = randomUUID();
    id.suburb.set(name, sid);
    await sql`insert into suburbs (id, name, state, postcode)
              values (${sid}, ${name}, 'SA', ${postcode})`;
  }

  /* ------------------------------------------------------------ contacts */
  for (const c of S.contacts) {
    const cid = randomUUID();
    id.contact.set(c.id, cid);

    await sql`
      insert into contacts (id, tenant_id, first_name, last_name, email_normalised,
        email_raw, phone_e164, phone_raw, suburb, source_channel, owner_user_id,
        last_followup_at, last_followup_outcome, followup_due_at, do_not_contact, created_at)
      values (${cid}, ${TENANT}, ${c.firstName}, ${c.lastName},
        ${normaliseEmail(c.email)}, ${c.email}, ${e164(c.phone)}, ${c.phone},
        ${c.suburb}, ${c.source}, ${USER}, ${c.lastFollowupAt},
        ${c.lastFollowupOutcome}, ${c.followupDueAt}, ${c.doNotContact}, ${c.createdAt})`;

    for (const role of c.roles) {
      await sql`insert into contact_roles (tenant_id, contact_id, role)
                values (${TENANT}, ${cid}, ${role})`;
    }

    if (c.preferences) {
      const p = c.preferences;
      const isRental = p.priceMax === 0;
      await sql`
        insert into contact_preferences (tenant_id, contact_id, suburbs, price_min,
          price_max, beds_min, baths_min, parking_min, property_types, timeline,
          finance_status, soft_requirements)
        values (${TENANT}, ${cid}, ${p.suburbs}, ${isRental ? null : p.priceMin},
          ${isRental ? null : p.priceMax}, ${p.bedsMin}, ${p.bathsMin}, ${p.parkingMin},
          ${p.propertyTypes}, ${p.timeline}, ${p.financeStatus}, ${p.softRequirements})`;
    }

    if (c.intent) {
      const i = c.intent;
      await sql`
        insert into contact_intent (contact_id, tenant_id, intent_type, budget_band,
          timeline, blockers, sentiment, confidence, rolling_brief,
          source_interaction_count, rebuilt_at)
        values (${cid}, ${TENANT}, ${i.type}, ${i.budgetBand}, ${i.timeline},
          ${i.blockers}, ${i.sentiment}, ${i.confidence}, ${i.brief},
          ${S.interactionsFor(c.id).length}, ${i.rebuiltAt})`;
    }

    for (const k of c.consents) {
      await sql`
        insert into consents (tenant_id, contact_id, channel, status, source_form,
          wording_shown, ip_address, occurred_at)
        values (${TENANT}, ${cid}, ${k.channel}, ${k.status}, ${k.sourceForm},
          ${k.wordingShown}, ${k.ip === "—" ? null : k.ip}, ${k.at})`;
    }
  }

  /* ------------------------------------------------------------ properties */
  for (const p of S.properties) {
    const pid = randomUUID();
    id.property.set(p.id, pid);
    const { streetNumber, street } = splitAddress(p.address);
    await sql`
      insert into properties (id, tenant_id, street_number, street, suburb_id, state,
        postcode, property_type, beds, baths, parking, land_area_sqm, floor_area_sqm,
        year_built, condition, features, owner_contact_id, internal_notes,
        internal_price_expectation)
      values (${pid}, ${TENANT}, ${streetNumber}, ${street},
        ${id.suburb.get(p.suburb) ?? null}, ${p.state}, ${p.postcode},
        ${propTypeMap[p.type] ?? "house"}, ${p.beds}, ${p.baths}, ${p.parking},
        ${p.landSqm || null}, ${p.floorSqm}, ${p.yearBuilt}, ${p.condition},
        ${p.features}, ${id.contact.get(p.ownerContactId) ?? null},
        ${p.internalNotes}, ${p.internalPriceExpectation})`;
  }

  /* -------------------------------------------------------------- listings */
  for (const l of S.listings) {
    const lid = randomUUID();
    id.listing.set(l.id, lid);
    await sql`
      insert into listings (id, tenant_id, property_id, listing_type, method, status,
        price_display, search_price_min, search_price_max, rent_pw, public_headline,
        public_copy, slug, listed_at, published_at, sold_at, result_display)
      values (${lid}, ${TENANT}, ${id.property.get(l.propertyId)!}, ${l.type},
        ${l.method}, ${l.status}, ${l.priceDisplay || null},
        ${l.type === "rent" ? null : l.searchMin},
        ${l.type === "rent" ? null : l.searchMax}, ${l.rentPw ?? null},
        ${l.headline || null}, ${l.copy || null}, ${l.slug}, ${l.listedAt},
        ${l.publishedAt}, ${l.soldAt ?? null}, ${l.resultDisplay ?? null})`;

    // The sample data records a photo COUNT, not files. Placeholder media rows keep
    // the count truthful without inventing S3 objects that do not exist.
    for (let i = 0; i < l.photos; i++) {
      await sql`insert into listing_media (tenant_id, listing_id, s3_key, kind, sort_order)
                values (${TENANT}, ${lid}, ${`placeholder/${l.slug}/${i + 1}.jpg`}, 'photo', ${i})`;
    }
    if (l.hasFloorplan) {
      await sql`insert into listing_media (tenant_id, listing_id, s3_key, kind, sort_order)
                values (${TENANT}, ${lid}, ${`placeholder/${l.slug}/floorplan.pdf`}, 'floorplan', 99)`;
    }
  }

  /* ---------------------------------------------------------- interactions */
  for (const i of S.interactions) {
    const iid = randomUUID();
    id.interaction.set(i.id, iid);
    await sql`
      insert into interactions (id, tenant_id, contact_id, channel, direction,
        occurred_at, subject, body, raw_s3_key, listing_id, created_by_user_id)
      values (${iid}, ${TENANT}, ${id.contact.get(i.contactId)!}, ${i.channel},
        ${i.direction}, ${i.at}, ${i.subject}, ${i.body},
        ${i.hasRaw ? `raw/${i.id}.eml` : null},
        ${i.listingId ? id.listing.get(i.listingId)! : null}, ${USER})`;
  }

  /* ----------------------------------------------------------- inspections */
  for (const n of S.inspections) {
    const nid = randomUUID();
    id.inspection.set(n.id, nid);
    await sql`
      insert into inspections (id, tenant_id, listing_id, starts_at, minutes, kind)
      values (${nid}, ${TENANT}, ${id.listing.get(n.listingId)!}, ${n.startsAt},
        ${n.minutes}, ${n.kind})`;
  }

  /* --------------------------------------------------------------- matches */
  for (const m of S.matches) {
    await sql`
      insert into matches (tenant_id, listing_id, contact_id, score, reason, stage)
      values (${TENANT}, ${id.listing.get(m.listingId)!},
        ${id.contact.get(m.contactId)!}, ${m.score}, ${m.reason}, ${m.stage})`;
  }

  /* ------------------------------------------------------------- campaigns */
  for (const c of S2.campaigns) {
    const cid = randomUUID();
    id.campaign.set(c.id, cid);
    await sql`
      insert into campaigns (id, tenant_id, listing_id, name, channel, status,
        created_by_user_id, created_at, sent_at)
      values (${cid}, ${TENANT}, ${id.listing.get(c.listingId) ?? null}, ${c.name},
        ${c.channel}, ${c.status}, ${USER}, ${c.createdAt}, ${c.sentAt ?? null})`;
  }

  /* -------------------------------------------------------- approval queue */
  for (const a of S.approvals) {
    // The check constraints refuse a sent row with no timestamp and a blocked or
    // rejected row with no reason - so derive what the sample data leaves implicit.
    const sentAt = a.status === "sent" ? (a.reviewedAt ?? a.createdAt) : null;
    await sql`
      insert into approval_items (tenant_id, kind, status, contact_id, listing_id,
        draft_subject, draft_body, consent_at_draft, consent_checked_at,
        reviewed_by_user_id, reviewed_at, reject_reason, sent_at, block_reason,
        model, cost_aud, created_at)
      values (${TENANT}, ${a.kind}, ${a.status},
        ${a.contactId ? id.contact.get(a.contactId)! : null},
        ${a.listingId ? id.listing.get(a.listingId)! : null},
        ${a.subject}, ${a.body}, ${a.consentAtDraft}, ${a.createdAt},
        ${a.reviewedBy ? USER : null}, ${a.reviewedAt ?? null},
        ${a.rejectReason ?? null}, ${sentAt}, ${a.blockReason ?? null},
        ${a.model}, ${a.costAud}, ${a.createdAt})`;
  }

  /* --------------------------------------------------------- confirm queue */
  for (const f of S.confirmItems) {
    await sql`
      insert into confirm_items (tenant_id, contact_id, source_interaction_id, kind,
        summary, before_text, after_text, confidence, status, created_at)
      values (${TENANT}, ${id.contact.get(f.contactId)!},
        ${id.interaction.get(f.sourceInteractionId) ?? null}, ${f.kind}, ${f.summary},
        ${f.before ?? null}, ${f.after}, ${f.confidence}, 'pending', ${f.createdAt})`;
  }

  for (const m of S.mergeReviews) {
    await sql`
      insert into merge_reviews (tenant_id, contact_a_id, contact_b_id, similarity,
        matched_on, status, created_at)
      values (${TENANT}, ${id.contact.get(m.aId)!}, ${id.contact.get(m.bId)!},
        ${m.similarity}, ${m.matchedOn}, 'open', ${m.createdAt})`;
  }

  /* --------------------------------------------------------------- tasks */
  for (const t of S.tasks) {
    await sql`
      insert into tasks (tenant_id, contact_id, title, due_at, status, source_label,
        assigned_to_user_id, completed_at)
      values (${TENANT}, ${id.contact.get(t.contactId)!}, ${t.title}, ${t.dueAt},
        ${t.done ? "done" : "open"}, ${t.source}, ${USER},
        ${t.done ? t.dueAt : null})`;
  }

  /* ------------------------------------------------------------- calendar */
  for (const e of S2.calendarEvents) {
    const ends = new Date(e.startsAt.getTime() + e.minutes * 60000);
    await sql`
      insert into calendar_events (tenant_id, user_id, provider, external_id, our_write,
        title, starts_at, ends_at, kind, contact_id, listing_id)
      values (${TENANT}, ${USER}, ${e.provider},
        ${e.ourWrite ? null : `ext-${e.id}`}, ${e.ourWrite}, ${e.title}, ${e.startsAt},
        ${ends}, ${e.kind}, ${e.contactId ? id.contact.get(e.contactId)! : null},
        ${e.listingId ? id.listing.get(e.listingId)! : null})`;
  }

  /* ---------------------------------------------------------- voice notes */
  for (const v of S2.voiceNotes) {
    await sql`
      insert into voice_notes (tenant_id, user_id, contact_id, s3_key,
        duration_seconds, transcript, status, recorded_at, transcribed_at)
      values (${TENANT}, ${USER}, ${v.contactId ? id.contact.get(v.contactId)! : null},
        ${`voice/${v.id}.webm`}, ${v.seconds}, ${v.transcript || null},
        ${v.status === "processing" ? "processing" : v.status === "confirmed" ? "confirmed" : "transcribed"},
        ${v.recordedAt}, ${v.status === "processing" ? null : v.recordedAt})`;
  }

  /* ------------------------------------------------------------ proposals */
  for (const p of S2.proposals) {
    await sql`
      insert into proposals (tenant_id, property_id, contact_id, status, estimate_low,
        estimate_high, comparables, pages, created_at)
      values (${TENANT}, ${id.property.get(p.propertyId) ?? null},
        ${id.contact.get(p.contactId)!}, ${p.status}, ${p.estimateLow},
        ${p.estimateHigh}, ${p.comparables}, ${p.pages}, ${p.createdAt})`;
  }

  /* -------------------------------------------------------------- content */
  for (const b of S2.blogPosts) {
    await sql`
      insert into blog_posts (tenant_id, slug, title, status, word_count, published_at,
        legacy_url, created_at)
      values (${TENANT}, ${b.slug}, ${b.title},
        ${b.status === "in_approval" ? "in_approval" : b.status},
        ${b.words}, ${b.publishedAt ?? null},
        ${b.legacy ? `https://www.ozirealty.com.au/post/${b.slug}` : null},
        ${b.createdAt})`;
  }

  for (const s of S2.socialPosts) {
    await sql`
      insert into social_posts (tenant_id, network, status, body, listing_id,
        engagement, created_at)
      values (${TENANT}, ${s.network.toLowerCase()}, ${s.status}, ${s.body},
        ${s.listingId ? id.listing.get(s.listingId)! : null}, ${s.engagement},
        ${s.createdAt})`;
  }

  for (const i of S2.seoIssues) {
    await sql`
      insert into seo_issues (tenant_id, severity, title, detail, proposal,
        affected_count, status)
      values (${TENANT}, ${i.severity}, ${i.title}, ${i.detail}, ${i.proposal},
        ${i.affected}, 'open')`;
  }

  for (const r of S2.redirects) {
    await sql`
      insert into redirects (tenant_id, from_path, to_path, status)
      values (${TENANT}, ${r.from}, ${r.to || null}, ${r.status})`;
  }

  for (const s of S2.suburbPages) {
    await sql`
      insert into suburb_pages (tenant_id, suburb_name, status)
      values (${TENANT}, ${s.suburb}, 'draft')`;
  }

  /* ------------------------------------------------------------------ ops */
  for (const g of S.aiGenerations) {
    // The sample data is aggregated per task. Expand to one row per call so the cost
    // dashboard aggregates from real rows rather than pre-summed ones.
    const perCall = {
      input: Math.round(g.inputTokens / g.calls),
      output: Math.round(g.outputTokens / g.calls),
      cost: g.costAud / g.calls,
    };
    const rows = Math.min(g.calls, 40); // enough to aggregate over, without 500 inserts
    for (let i = 0; i < rows; i++) {
      await sql`
        insert into ai_generations (tenant_id, task, model, prompt_hash, input_tokens,
          output_tokens, cost_aud, latency_ms, entity_type)
        values (${TENANT}, ${g.task}, ${g.model === "Sonnet" ? "claude-sonnet-5" : "claude-haiku-4-5"},
          ${`sha256:${g.task.replace(/\s+/g, "-").toLowerCase()}`},
          ${perCall.input}, ${perCall.output}, ${(perCall.cost * (g.calls / rows)).toFixed(6)},
          ${g.avgLatencyMs}, 'contact')`;
    }
  }

  for (const a of S2.auditLog) {
    await sql`
      insert into audit_log (tenant_id, actor_user_id, actor_label, kind, action,
        target, occurred_at)
      values (${TENANT}, ${a.actor === "System" ? null : USER}, ${a.actor}, ${a.kind},
        ${a.action}, ${a.target}, ${a.at})`;
  }

  for (const ad of S.adapters) {
    await sql`
      insert into channel_adapters (tenant_id, name, status, last_received_at, received_today)
      values (${TENANT}, ${ad.name}, ${ad.status}, ${ad.lastReceived}, ${ad.today})`;
  }

  for (const v of S2.savedViews) {
    await sql`
      insert into saved_views (tenant_id, name, description, filter, created_by_user_id)
      values (${TENANT}, ${v.name}, ${v.detail}, ${JSON.stringify({ note: v.detail })}, ${USER})`;
  }

  const consentWording =
    "I agree to Ozi Realty contacting me about properties and services that match my enquiry. I can unsubscribe at any time.";
  for (const [form, wording] of [
    ["Listing enquiry", consentWording],
    ["Free property appraisal", consentWording.replace("properties and services that match my enquiry", "the appraisal of my property and related services")],
    ["Suburb insight report", "Send me the report and occasional market updates for this suburb. I can unsubscribe at any time."],
  ] as [string, string][]) {
    await sql`insert into consent_templates (tenant_id, form_name, wording)
              values (${TENANT}, ${form}, ${wording})`;
  }

  for (const [name, detail] of [
    ["Vendor statement (Form 1)", "Served before the contract becomes binding"],
    ["Cooling-off notice", "Two clear business days, from the later of contract or Form 1"],
    ["Agent licence on marketing", "RLA number shown on every public listing and message"],
  ] as [string, string][]) {
    await sql`insert into disclosure_rules (tenant_id, jurisdiction, name, detail)
              values (${TENANT}, 'SA', ${name}, ${detail})`;
  }

  /* --------------------------------------------------------------- report */
  const counts = await sql<{ table_name: string; n: number }[]>`
    select relname as table_name, n_live_tup as n
    from pg_stat_user_tables where n_live_tup > 0 order by relname`;

  console.log("rows written:");
  let total = 0;
  for (const r of counts) {
    console.log(`  ${r.table_name.padEnd(26)} ${String(r.n).padStart(5)}`);
    total += Number(r.n);
  }
  console.log(`  ${"TOTAL".padEnd(26)} ${String(total).padStart(5)}`);
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error("\nSEED FAILED:", e.message);
    await sql.end();
    process.exit(1);
  });
