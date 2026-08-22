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

## Phase B1 — Make the console read real data

The console currently imports arrays. This phase replaces that with queries and nothing
else — no new features, no new screens.

- [ ] **B1.1 Drop `output: "export"`,** add a `Dockerfile`-free Node target, confirm
      `pnpm build && pnpm start` serves every route.
- [ ] **B1.2 Query layer.** One module per area under `src/server/queries/`, each
      returning exactly the shape the existing screens already consume, so pages change
      one import line rather than being rewritten.
- [ ] **B1.3 Row-level security.** `forTenant()` is a guard rail, not a boundary.
      Enable RLS on every tenant-scoped table with a policy on
      `current_setting('app.tenant_id')`, set per connection. Then a missed `where`
      returns nothing instead of everything.
- [ ] **B1.4 Convert the read paths**, screen by screen, deleting the corresponding
      sample-data export as each one lands. **`sample-data.ts` reaching zero exports is
      the definition of done for this phase.**
- [ ] **B1.5 Vitest against a real database.** Migrate + seed into a scratch schema per
      run. The guard script becomes a test file.

**Closes when:** the console renders identically to the prototype with `sample-data.ts`
deleted, and `pnpm test` passes against a live database.

---

## Phase B2 — Auth and writes

- [ ] **B2.1 Auth.js v5**, Google + Microsoft Entra, single-address allowlist (D1).
      Session carries `tenantId` and role; the RLS setting is bound from the session.
- [ ] **B2.2 Server Actions with Zod on every input.** Every one — §13.
- [ ] **B2.3 Contact CRUD and the manual adapter.** The first real write path.
- [ ] **B2.4 Record a follow-up outcome.** Small, and the single most-used control in
      the product.
- [ ] **B2.5 Optimistic UI + error states.** The prototype's buttons are inert; they
      become real here, including what happens when a write fails.

---

## Phase B3 — Intake pipeline

- [ ] **B3.1 Redis + BullMQ**, `worker.service`, retry and backoff defaults, a
      dead-letter view. A failed AI call must never fail a user request (§8).
- [ ] **B3.2 The adapter interface and registry** from §5, plus the fixed pipeline as a
      single function. Written once; never edited per channel.
- [ ] **B3.3 Identity resolution.** `resolveContact()` → existing | new | ambiguous,
      feeding `merge_reviews`. Table-driven tests over phone formats, plus-addressed
      emails and name collisions are the deliverable as much as the code.
- [ ] **B3.4 Web form adapter.** Public Route Handler, per-tenant key, spam guard, and
      consent capture recording form, wording, IP and timestamp. **This provenance can
      only be captured at submission and can never be reconstructed.**
- [ ] **B3.5 Email adapter (SES).** MX on `in.ozirealty.com.au` → receipt rule → raw
      MIME to S3 → SNS → Route Handler. Verify SES inbound is available in
      ap-southeast-2 *before* building this.

---

## Phase B4 — AI

- [ ] **B4.1 `callClaude()`** over direct `fetch`, no SDK (§9). Every call writes an
      `ai_generations` row: model, prompt hash, tokens, cost, latency, related entity.
- [ ] **B4.2 `runTask(schema, prompt)`** — prompt for JSON, parse, Zod-validate. On
      failure, fail the job and store the raw response; never let malformed output reach
      the database.
- [ ] **B4.3 `/prompts` as versioned files,** not inline strings.
- [ ] **B4.4 SummariseInteraction → RebuildContactIntent.** Haiku extracts, Sonnet
      writes the rolling brief. Intent is derived so a direct write is fine; anything
      touching preferences or tasks goes to `confirm_items`.
- [ ] **B4.5 The confirm queue commit action.** The proposal becomes a real row only
      when a human presses the button (rule 5).
- [ ] **B4.6 Prompt caching and the Batch API** for the non-urgent jobs (§9).

---

## Phase B5 — Stock, matching, and the send gate

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
