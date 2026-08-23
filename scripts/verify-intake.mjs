/**
 * Drive the intake surface over real HTTP against the running dev server —
 * the two public routes, exactly as the outside world reaches them.
 *
 *   pnpm dev      (terminal 1)
 *   pnpm redis    (terminal 2, optional — rate limiting fails open without it)
 *   INGEST_TEST_SECRET must match the server's env for the SES leg.
 *
 * Checks the guards refuse what they should refuse, that a legitimate submission
 * lands in Postgres with its consent provenance, and that replays collapse.
 */
import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:3200";
const DB = process.env.DATABASE_URL ?? "postgres://ozirealty@127.0.0.1:5433/ozirealty";
const SECRET = process.env.INGEST_TEST_SECRET ?? "dev-ingest-secret";
const stamp = Date.now().toString().slice(-6);

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}

const sql = postgres(DB, { max: 1, onnotice: () => {} });
const [tenant] = await sql`select id, form_key from tenants limit 1`;

/* ------------------------------------------------------------- form: GET */

console.log("\nThe public form");
const g = await fetch(`${BASE}/api/forms/${tenant.form_key}`);
const form = await g.json();
check("GET issues a token and the consent wording", g.ok && !!form.token && !!form.consentWording);

// The wording must be THE TEMPLATE, not the fallback. Serving the fallback means the
// template read came back empty — which is what happens if that query ever runs
// outside withTenant again (RLS returns zero rows for the app role, silently).
const [tpl] = await sql`
  select wording from consent_templates
  where tenant_id = ${tenant.id} and form_name = ${form.formName}`;
if (tpl) {
  check("the wording served is the tenant's template, not the fallback", form.consentWording === tpl.wording);
} else {
  console.log("  SKIP  no template seeded for this form name");
}

const bogus = await fetch(`${BASE}/api/forms/00000000-0000-4000-8000-000000000000`);
check("an unknown form key is a 404", bogus.status === 404);

/* ------------------------------------------------- form: POST guard rails */

async function post(body, key = tenant.form_key) {
  const res = await fetch(`${BASE}/api/forms/${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const base = {
  token: form.token,
  website: "",
  firstName: "Intake",
  lastName: `Verify${stamp}`,
  email: `intake.${stamp}@example.com`,
  phone: `04${stamp}99`,
  message: "Saw 12 Powell St on the site - is Saturday's open still on?",
  formName: form.formName,
  marketingOptIn: true,
  consentWording: form.consentWording,
};

const tooFast = await post(base);
check("a submit faster than a human can type is refused", tooFast.status === 403);

console.log("  ....  waiting out the minimum fill time");
await new Promise((r) => setTimeout(r, 3200));

const honeypot = await post({ ...base, website: "http://spam.example" });
check(
  "the honeypot swallows a bot silently — success on the surface",
  honeypot.status === 200 && honeypot.json.ok === true,
);
const [botRow] = await sql`
  select count(*)::int as n from contacts where last_name = ${`Verify${stamp}`}`;
check("...and nothing was written", botRow.n === 0);

const ok1 = await post(base);
check("a legitimate enquiry is accepted", ok1.status === 200 && ok1.json.ok === true, JSON.stringify(ok1.json));

const replay = await post(base);
check(
  "replaying the same token collapses into the first submission",
  replay.status === 200 && replay.json.received === "already",
);

const [row] = await sql`
  select c.id, c.first_name, c.source_channel, i.channel, i.body
  from contacts c join interactions i on i.contact_id = c.id
  where c.last_name = ${`Verify${stamp}`}`;
check("one contact + one interaction landed in Postgres", !!row && row.channel === "web_form");
check("the contact carries its source channel", row?.source_channel === "web_form");

const [consent] = await sql`
  select status, source_form, wording_shown, ip_address
  from consents where contact_id = ${row.id}`;
check(
  "consent recorded with the wording that was actually on screen",
  consent?.status === "granted" && consent.wording_shown === form.consentWording,
);

const forged = await post({ ...base, token: form.token.slice(0, -6) + "XXXXXX" });
check("a tampered token is refused", forged.status === 403);

const oversized = await post({ ...base, message: "x".repeat(6000) });
check("an oversized field is refused with a field error", oversized.status === 422 || oversized.status === 413);

/* --------------------------------------------------------------- SES leg */

console.log("\nInbound email (SES route, test-secret path)");
const mime = [
  `From: E2e Sender <e2e.${stamp}@example.com>`,
  "To: enquiries@in.ozirealty.com.au",
  `Subject: Live intake check ${stamp}`,
  `Message-ID: <live-${stamp}@mail.example.com>`,
  "Content-Type: text/plain; charset=utf-8",
  "",
  `Testing the inbound pipe end to end. [${stamp}]`,
].join("\r\n");

async function postSes() {
  const res = await fetch(`${BASE}/api/inbound/ses`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ozi-ingest-secret": SECRET },
    body: JSON.stringify({
      Type: "Notification",
      MessageId: `sns-${stamp}`,
      TopicArn: "arn:aws:sns:ap-southeast-2:000000000000:test",
      Timestamp: new Date().toISOString(),
      SignatureVersion: "1",
      Signature: "unused-on-test-path",
      SigningCertURL: "https://sns.ap-southeast-2.amazonaws.com/test.pem",
      Message: JSON.stringify({
        notificationType: "Received",
        mail: { messageId: `live-${stamp}` },
        receipt: { action: { type: "SNS", encoding: "UTF8" } },
        content: mime,
      }),
    }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const ses1 = await postSes();
check("a notification ingests", ses1.status === 200 && ses1.json.ok === true, JSON.stringify(ses1.json));

const ses2 = await postSes();
check("SNS redelivery collapses into the same interaction", ses2.json.duplicate === true);

const noSecret = await fetch(`${BASE}/api/inbound/ses`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ Type: "Notification", Message: "{}", SigningCertURL: "https://evil.example/x.pem", Signature: "x", SignatureVersion: "1", MessageId: "x", Timestamp: "x", TopicArn: "x" }),
});
check("without the secret, a forged envelope is refused", noSecret.status === 403);

const [mailRow] = await sql`
  select i.channel, i.thread_ref, c.first_name, c.last_name
  from interactions i join contacts c on c.id = i.contact_id
  where i.message_id = ${`<live-${stamp}@mail.example.com>`}`;
check(
  "the email landed as an interaction on a resolved contact",
  mailRow?.channel === "email" && mailRow.first_name === "E2e",
);

/* ------------------------------------------------------------ job queue */

console.log("\nJobs");
const { Queue } = await import("bullmq");
const q = new Queue("ozirealty", { connection: { host: "127.0.0.1", port: 6379 } });
try {
  const counts = await q.getJobCounts("waiting", "completed", "failed");
  const total = (counts.waiting ?? 0) + (counts.completed ?? 0) + (counts.failed ?? 0);
  check("the pipeline enqueued summarise/rebuild jobs", total > 0, JSON.stringify(counts));
} catch (e) {
  check("the pipeline enqueued summarise/rebuild jobs", false, `queue unreachable: ${e.message}`);
} finally {
  await q.close();
}

await sql.end();
console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}\n`);
process.exit(failures ? 1 : 0);
