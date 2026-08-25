# Backend build plan

Companion to [phases.md](phases.md), which covers the whole product. This one is only
the backend: what runs on a server, in what order, and on what AWS shape.

Status key: `[ ]` not started · `[~]` in progress · `[x]` done and demonstrated

---

## The thing that changes first

**The current deployment cannot host a backend, and there is no way to bolt one on.**

The console is a **static export** on S3 + CloudFront. That was the right answer for a
prototype with no data: about a dollar a month, no server to patch, no attack surface.
But a static export has no server process, so it cannot run a Server Action, cannot open
a database connection, and cannot receive a webhook.

The options are only two, and §2 settles it:

| Option | Verdict |
|---|---|
| Keep the static site and add a separate API | **No.** §2: "Server Actions and Route Handlers are the API. Do not build a parallel API surface." |
| Serve Next.js from a Node process on EC2 | **Yes.** This is what §11 describes: `web.service` and `worker.service` behind Caddy. |

So the backend work begins by **removing `output: "export"`** and moving the site from
S3+CloudFront to a Node process. Practical consequences:

- `crm.ozirealty.com.au` stops pointing at CloudFront and points at the EC2 instance
  (still through CloudFront if we want caching, but with a dynamic origin).
- Hosting cost goes from ~$1/mo to ~$25–35/mo. That is the real price of having a
  backend at all, and it is in [aws-cost.md](aws-cost.md).
- The S3 bucket stays, but for media and backups rather than for the site.

**Nothing about the console's UI changes.** The screens were built against
`sample-data.ts`; they get rebuilt against Drizzle queries. The layout survives, the
data layer does not — which is exactly what the prototype was for.

---

## Phase B0 — Foundations *(done)*

- [x] **B0.1 Local Postgres.** A dedicated dev cluster on port 5433, isolated from any
      existing instance on 5432. Created with `initdb`, trust auth, no password to
      manage.
- [x] **B0.2 Drizzle + Zod + `postgres` driver.** `drizzle.config.ts`, `src/env.ts`
      that Zod-parses the environment at boot and throws on a missing key.
- [x] **B0.3 The schema.** 35 tables, 34 enums, across five modules:
      `tenancy · contacts · stock · engine · ops`.
- [x] **B0.4 Integrity in the database, not the codebase.** Migration `0001` adds
      append-only triggers on `interactions` and `consents`, plus check constraints for
      the outbound rules. `scripts/db-guards.sh` proves all twelve.
- [x] **B0.5 Seed from the prototype.** `src/db/seed` imports the same
      `sample-data.ts` the console renders from, so the database and the UI cannot
      drift. 556 rows.
- [x] **B0.6 Tenant-scoped client.** `forTenant()` composes the tenant predicate into
      every query (§13).

### What B0 already taught us

Seeding real data caught a schema error that reasoning had missed. The dedupe columns
were originally `UNIQUE` per tenant, which is the obvious design and is wrong: §4 says
ambiguous matches go to a **merge review queue** and are never auto-merged, so a
duplicate has to be able to *exist* while a human decides. A unique constraint means the
second record can never be written — the merge queue can never populate and the inbound
enquiry is silently dropped. Two sample contacts share a phone number precisely to
demonstrate this, and the insert failed. Fixed in migration `0002`.

---

## Phase B1 — Make the console read real data  *(done)*

The console currently imports arrays. This phase replaces that with queries and nothing
else — no new features, no new screens.

- [x] **B1.1 Dropped `output: "export"`.** add a `Dockerfile`-free Node target, confirm
      `pnpm build && pnpm start` serves every route.
- [x] **B1.2 Query layer.** One module per area under `src/server/queries/`, each
      returning exactly the shape the existing screens already consume, so pages change
      one import line rather than being rewritten.
- [x] **B1.3 Row-level security.** `forTenant()` is a guard rail, not a boundary.
      Enable RLS on every tenant-scoped table with a policy on
      `current_setting('app.tenant_id')`, set per connection. Then a missed `where`
      returns nothing instead of everything.
- [x] **B1.4 Converted the read paths**, screen by screen, deleting the corresponding
      sample-data export as each one lands. **`sample-data.ts` reaching zero exports is
      the definition of done for this phase.**
- [x] **B1.5 Vitest against a real database.** Migrate + seed into a scratch schema per
      run. The guard script becomes a test file.

**Closed.** 21 routes serve live data, `sample-data.ts` is out of the application, and
35 tests pass against a real database.

### What B1 taught us

- **A funnel that widens is measuring two things.** The first pipeline query counted
  inbound *interactions* at stage one and *contacts* at stage two, so it reported 8
  briefed from 6 enquiries. A test asserting each stage is a subset of the one above
  caught it; the query now counts one population throughout.
- **Next will happily prerender a CRM.** Without `force-dynamic` the console built at
  compile time and baked the build machine's data into static HTML - the dashboard
  would have shown yesterday's queue counts until the next deploy.
- **A pinned clock is fine for fixtures and a bug for real rows.** `relative()` measured
  against a hardcoded date; every timestamp would have drifted further from the truth
  each day the app ran.
- **Some charts should be empty.** Weekly trends return nothing until `hasHistory()`
  passes, because the seed holds current state rather than months of it. A chart drawn
  from invented history is worse than an empty one - nobody can tell it is wrong.

---

## Phase B2 — Auth and writes ✅ done

- [x] **B2.1 Auth.js v5**, Google + Microsoft Entra, single-address allowlist (D1).
      Session carries `tenantId` and role; the RLS setting is bound from the session.
      Providers register only when their credentials exist, so a missing secret is a
      missing button rather than a crash. Development sign-in needs `NODE_ENV` to not
      be production **and** `AUTH_DEV_LOGIN=1` **and** the allowlist. With an empty
      allowlist, sign-in fails closed.
- [x] **B2.2 Server Actions with Zod on every input.** Every one — §13. `defineAction`
      takes the schema as an argument, so an action cannot be written without one. It
      also refuses without a session, opens the transaction with `app.tenant_id` set,
      writes the audit row, and translates database constraint names into sentences.
      `ActionError` marks a refusal the handler phrased deliberately; anything else
      becomes a generic message rather than leaking a stack trace.
- [x] **B2.3 Contact CRUD and the manual adapter.** The first real write path. A
      collision neither refuses nor merges: it writes the record and opens a merge
      review, because refusing loses the enquiry and merging decides something only a
      person may decide.
- [x] **B2.4 Record a follow-up outcome.** Also writes an interaction, so the outcome
      has evidence behind it rather than being a claim on its own.
- [x] **B2.5 Forms wired into the screens, with error and pending states.** `useAction`
      surfaces three visible states — sending, failed with the server's reason, and
      done. Field errors come from the same Zod schema the server validated against,
      so the message under an input cannot drift out of step with the rule.
- [x] **Contact merge, for real** (migration 0006). The button in the confirm queue
      previously closed the review and merged nothing. It now supersedes: the older
      record survives, the newer is tombstoned pointing at it, roles and open tasks and
      any blank identity field move across, and do-not-contact can only tighten.
      Interactions and consents deliberately stay where they were captured — both are
      append-only, and reassigning a consent row would falsify the one fact it exists
      to prove — so reads follow the pointer instead and label what came from where. A
      trigger refuses chains, so following it is always exactly one hop.
- [x] **Writes are refused against superseded and tombstoned records** in the action,
      not just hidden in the interface.

Verified by `pnpm test` (69, against a real Postgres), `pnpm db:guards` (22),
`pnpm verify:writes` (11 checks driving the real browser against the real database)
and `pnpm verify:forms` (each dialog at 390/820/1440, overflow and tap-target size).

---

## Phase B3 — Intake pipeline ✅ done

- [x] **B3.1 Redis + BullMQ.** `src/server/jobs/` — one queue, 5 attempts with
      exponential backoff, failed jobs KEPT and shown in a dead-letter view on
      /settings with per-job retry. Enqueueing is best-effort and happens only after
      the transaction commits: a dead Redis costs freshness, never data (§8). Local
      dev uses a portable Redis via `pnpm redis` (Memurai's MSI needs elevation this
      box cannot grant); the instance gets real Redis + `infra/worker.service`.
- [x] **B3.2 The adapter interface and registry** (§5) and the fixed pipeline:
      `ingest → resolve → interaction row (+consents) → SummariseInteraction →
      RebuildContactIntent`. Split at the transaction boundary (`ingestInTx` /
      `ingestNormalised`) so Server Actions join with their own transaction and the
      B2 manual-entry action now rides the same pipeline instead of a parallel
      insert. Replay dedupe on (tenant, channel, message_id) — migration 0007 —
      because SNS redelivers and browsers resubmit.
- [x] **B3.3 Identity resolution.** `resolveContact()` → existing | new | ambiguous.
      Keys are normalised email (gmail-dot collapse, plus-strip, root-dot strip) and
      E.164 phone (never fabricated — an area-code-less number matches nothing).
      Personal keys (email, mobile) attach unless the name flatly conflicts; a
      landline is a household key and needs the name to agree; two candidates, or
      email-hits-A-phone-hits-B, is always ambiguous — the enquiry lands on a fresh
      record with merge reviews raised, nothing auto-merges. Tombstoned records are
      invisible (a returning enquirer starts fresh — attaching would resurrect what
      they asked to be forgotten); merged records resolve to their survivor. The
      table of 27 resolver cases + normalisation suites came from a generated
      37-case table that was adversarially reviewed before a line was written
      (docs/research/b3-identity-cases.json).
- [x] **B3.4 Web form adapter.** `POST /api/forms/[key]` — addressed by per-tenant
      key, defended by size caps → honeypot (silent-accept, logged) → Redis rate
      limits (fail OPEN: an outage never eats a lead) → a signed token that proves
      the form was fetched from us, ≥3s ago, ≤24h ago, once (single-use nonce = the
      replay key). The GET issues the token and the consent wording; the token pins
      the wording's hash, so the consent row records what was actually on screen.
      A tick without wording records nothing — it would be worthless as evidence.
- [x] **B3.5 Email adapter (SES).** SES inbound receiving verified available in
      ap-southeast-2 first (endpoints table row confirmed, adversarially
      re-checked). `POST /api/inbound/ses` verifies the SNS signature before
      parsing anything (cert URL must be Amazon's, canonical string per message
      type, SHA1/SHA256), auto-confirms subscriptions, takes MIME inline or from
      S3, and the adapter parses identity/thread-root/text with mailparser. SNS
      redelivery collapses via the same replay index. DNS + receipt-rule wiring is
      B6 (needs the AWS account).

Verified by `pnpm test` (163, real Postgres), `pnpm verify:intake` (18 live HTTP
checks against the running server: guards refuse, enquiries land with provenance,
replays collapse, jobs enqueue), and a running worker draining the queue.

---

## Phase B4 — AI ✅ done (live verification awaits an API key)

- [x] **B4.1 `callClaude()`** — direct fetch, no SDK. Tiers not model ids at call
      sites (haiku extracts, sonnet writes); ids and pricing in one place, checked
      against the current docs (Sonnet 5 $2/$10, Haiku 4.5 $1/$5). Every successful
      call writes `ai_generations`: model, tokens, cache reads, cost in AUD,
      latency, and the entity that caused the spend. 429/5xx throw retryable and
      ride BullMQ's backoff; 400/401 throw non-retryable — retrying our own bad
      request helps nobody.
- [x] **B4.2 `runTask(schema, prompt)`** — balanced-JSON extraction (fences and
      preambles tolerated, truncation refused), Zod-gated. On invalid output the
      generation row flips to failed WITH the raw response kept for prompt tuning,
      and the job fails into the retry train. Malformed output reaches no table —
      proven by a test that watches the tables.
- [x] **B4.3 `/prompts` as versioned files.** `extract-interaction.v1.md` and
      `rolling-brief.v1.md` — drafted by a design pass over the real schema and
      sample voice, vocabulary aligned to the DB enums. The version is the
      filename; the ledger's prompt hash ties every generation to it.
- [x] **B4.4 SummariseInteraction → RebuildContactIntent**, sequential as §8 draws
      it: the pipeline enqueues extraction; extraction enqueues the rebuild, so
      briefs read summaries (a fraction of the tokens of full bodies). Intent is
      derived → direct upsert. Tasks and preference changes → `confirm_items`
      with structured `proposed` JSON. Idempotent under at-least-once delivery:
      re-runs skip on the existing summary and dedupe proposals. No API key →
      honest skip, repaired later by `pnpm ai:backfill`. Merged-in history feeds
      the brief; tombstoned and merged-away records are skipped.
- [x] **B4.5 The commit action applies data, never prose.** Proposals revalidate
      against the same Zod schemas at commit: tasks carry their due date; numeric
      fields range-check (and "several" is refused, not silently applied as 0);
      suburbs resolve by name and ADD without removing; a suburb that resolves to
      nothing refuses loudly, because "committed" must mean "applied".
- [x] **B4.6 Caching + Batch.** The brief's stable prefix is marked cacheable
      (Sonnet's 1024-token minimum noted — below it the mark is silently inert).
      `pnpm ai:backfill` re-derives missing summaries either as normal jobs or via
      the Message Batches API at half price — same prompt, same schema, same apply
      function as the live path; the discount buys latency, never behaviour.

Four defects the B4 review found and this phase fixes:

- **The job queue silently dropped work.** BullMQ's `jobId` is not a debounce — it
  refuses an add whose id already exists, *including for finished jobs*. With
  `removeOnFail: false`, one failed `RebuildContactIntent` would have blocked that
  contact's brief **permanently**; with `removeOnComplete` at 24h, this afternoon's
  email produced no rebuild after this morning's. `enqueue()` now removes a
  finished job before adding, folds into a waiting one, and schedules a trailing
  run behind an active one (which has already read its rows).
- **Truncation burned money.** A `max_tokens` stop produced unparseable JSON and
  five paid retries of a deterministically identical failure. `stop_reason` is now
  read; truncation ledgers the (genuinely billed) tokens, keeps the partial text
  and fails non-retryably with the fix named.
- **The batch path could double-apply.** A batch can take hours, during which the
  live handler may summarise the same interaction; two runs word a summary
  differently, so the proposal dedupe would miss it and the human would see the
  same proposal twice. Batch results now re-check `ai_summary` before applying.
- **A submitted batch's id was only ever in stdout.** It is money already spent
  with results retrievable for 29 days, so it is now written to `.batches/` and
  resumable with `--resume=<id>` instead of being paid for twice.

Verified by `pnpm test` (191, Claude mocked at the fetch boundary, everything else
real Postgres and real Redis). `pnpm verify:ai` runs one REAL extraction + rebuild
end to end and prints the ledger — it needs `ANTHROPIC_API_KEY` in `.env.local`
and skips honestly until one is provided.

---

## Phase B5 — Stock, matching, and the send gate ✅ done

- [x] **B5.1 pgvector** — migration `0010` applies **with or without** the
      extension: real `vector(1024)` columns and HNSW indexes where it exists,
      text columns everywhere. Local installation was declined (no admin rights);
      AWS Postgres gets the full path with no code change. `match_runs` records
      the funnel and whether the vector stage actually ran.
- [x] **B5.2 Voyage embeddings** — `embedDocuments` / `embedQuery` are separate
      functions because `input_type` decides retrieval quality and a boolean
      nobody reads is how that gets inverted silently. Embeddings ride the same
      cost ledger as Claude. `pnpm ai:embed` backfills.
- [x] **B5.3 The three-stage matcher**, bidirectional. Filters → cosine → Sonnet
      writes one sentence per match, with a prompt that forbids restating the
      filters and permits an empty answer.
- [x] **B5.4 The approval queue** — approve, edit (keeping the AI's original on
      first edit), reject with a required reason.
- [x] **B5.5 The send gate** — `checkConsent()` at the instant of sending, writing
      `block_reason`, audited as a `block` event with actor system.
- [x] **B5.6 MessageMedia SMS** — send, delivery receipts, inbound replies through
      the ordinary pipeline, and STOP writing a consent revocation in our database.

Fourteen defects the B5 review found and this phase fixes. Four were serious:

- **The matcher never worked.** Stage-1 SQL used untyped `$n IS NULL` parameters
  and failed with 42P08 on every invocation — invisible because the API-key check
  returned before the SQL ran, so no test had ever executed the filter. Stage 1
  now runs first and reports its count without a key, and `tests/matching.test.ts`
  exercises it. Fixing that immediately exposed a second one: Drizzle renders a JS
  array in `= any(...)` as a tuple, which Postgres refuses with 42809.
- **Marketing email had no unsubscribe.** The only caller passed an SMS keyword
  for both channels, so the email footer carried sender identification and nothing
  else — unlawful, and contradicted by the comment above it. The facility is now a
  discriminated union, so a channel and its unsubscribe cannot disagree, and email
  refuses to send at all until the unsubscribe route exists.
- **STOP revoked one row out of several.** A number can sit on several records
  while a merge review is open; revoking on one left the others contactable. And
  the revocation ran BEFORE identity resolution, so an opt-out from an unknown
  number was dropped — then the contact was created seconds later without it.
- **Consent across merged identities was wrong in both directions.** Latest-wins
  over the union let a survivor's grant override a duplicate's later unsubscribe;
  the first fix (strictest-wins) broke re-subscription, barring anyone who ever
  opted out. The rule is now latest-wins *per record*, strictest *across records*.

Also fixed: the stage-2 cap only applied on one branch, so a run where the vector
query returned nothing sent all 200 candidates into a paid prompt; partial
embedding coverage silently discarded eligible candidates while recording a clean
vector run; rentals were matched on sale price; the reverse direction ignored
do-not-contact; `consentAtDraft` was fabricated at send time; the DLR handler
tested for any historical revocation rather than the current state; the webhook
reused the outbound API password and compared it non-timing-safely; the opt-out
matcher both missed real unsubscribes and fired on "no thanks"; inbound replies
discarded the provider id that the replay index exists for; and the pgvector check
was cached for the life of the process.

**Known gap, stated rather than hidden:** the provider HTTP call still runs inside
the action's transaction. An atomic claim closes the common double-send, but a
crash between the provider accepting a message and the transaction committing
would roll the row back to pending with the SMS already gone. Splitting the action
into two committed phases belongs with B6's transport work.

Verified by `pnpm test` (228, real Postgres and Redis) and a live browser run of
the gate refusing a lapsed-consent send.

---

## Phase B5 — original plan

- [ ] **B5.1 pgvector.** Install the extension, then migration `00xx` adds the
      `embedding` columns and HNSW indexes deliberately left out of Phase 1.
      **pgvector is not currently installed on the dev machine** — that is a
      prerequisite, not a surprise.
- [ ] **B5.2 Voyage embeddings** for preference summaries and property descriptions,
      with a re-embed job and a backfill command.
- [ ] **B5.3 The three-stage matcher** (§6): SQL filters → cosine → Sonnet ranks and
      writes one sentence per match. The `matches_reason_not_blank` constraint is
      already in the database.
- [ ] **B5.4 The approval queue, end to end.** Draft, edit, approve, reject.
- [ ] **B5.5 Send-time consent re-check.** The decisive one: consent is evaluated at the
      instant of sending, not at draft time, and a lapse writes `block_reason` rather
      than failing silently. The constraint already forces a reason to exist.
- [ ] **B5.6 MessageMedia SMS**, delivery receipts, inbound replies back through the
      pipeline, unsubscribe keywords writing a `consents` revocation row.

---

## Phase B6 — Deploy the backend

- [ ] **B6.1 `provision.sh`.** Node, Postgres 16 + pgvector, Redis, `pgBackRest` with
      WAL archiving to S3, Caddy, both systemd units, the non-login service user, UFW.
- [ ] **B6.2 EC2, `t4g`, public subnet, no NAT Gateway.** ~$43/mo for a NAT alone would
      exceed the entire rest of the bill.
- [ ] **B6.3 Cut `crm.ozirealty.com.au` over** from the static origin to the instance.
      Keep CloudFront in front for asset caching.
- [ ] **B6.4 Backups: nightly `pg_dump` AND WAL archiving,** with a restore actually
      performed into a scratch database. An untested backup is not a backup.
- [ ] **B6.5 Sentry, external uptime monitoring, a Billing Budget with an alert.**

**Closes when:** a website form submission on the live domain creates a deduped contact
with an AI brief, an extracted task waits in the confirm queue, and the whole thing runs
on the deployed instance rather than a laptop.

---

## Open decisions this plan depends on

| # | Decision | Blocks |
|---|---|---|
| 1 | **Postgres on-instance or RDS?** Still unsigned from [aws-cost.md](aws-cost.md). ~$260/yr and a simpler box against managed backups and failover. | B6.1 |
| 2 | **PostgreSQL version.** §2 says 16; the dev machine has **18**. Dev and production should match — pick one. | B6.1 |
| 3 | **pgvector install.** Not present locally. Needed before B5. | B5.1 |
| 4 | **SES inbound in ap-southeast-2.** One console lookup, still not done. | B3.5 |
| 5 | **Product name.** Everything is currently `ozirealty`, which is the *agency*, not the product. It gets baked into systemd units and `/etc/<name>/env`. | B6.1 |

---

## Deliberately not in this plan

- **No Docker.** §2. `provision.sh` is the reproducibility mechanism instead.
- **No separate API service.** Server Actions and Route Handlers are the API (§2).
- **No autonomous send, publish or deploy path.** Rules 1 and 4. There is no setting to
  add one, and the database constraints are written so that a send with no audit trail
  cannot be recorded at all.
