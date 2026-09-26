# Build phases — worked breakdown

Companion to [CLAUDE.md](../CLAUDE.md) §12. Each numbered item is one session's work:
read it, implement it, run the tests, stop. Items inside a phase are ordered; the
order matters where a later item is typed off an earlier item's tables.

Nothing in a phase may start until the previous phase's **closing demo** has been run
end to end against a real database.

Status key: `[ ]` not started · `[~]` in progress · `[x]` demonstrable

---

## Phase 0 — Foundations (not in CLAUDE.md, but Phase 1 cannot start without it)

Small, mechanical, and one session total. It exists so Phase 1 items don't each
re-invent project setup.

- [~] **0.1 Repo skeleton.** Next 15 App Router, React 19, TS strict, Tailwind v4 and
      UI primitives in shadcn's idiom are **done** — see the console prototype below.
      Still to add: Vitest + Playwright each running one trivial passing test,
      ESLint/Prettier, conventional-commit hook.
- [ ] **0.2 Config and secrets.** A single `src/env.ts` that Zod-parses
      `process.env` at boot and throws on a missing key, so a misconfigured box
      fails loudly at start rather than mid-request. `.env.example` committed;
      `.env.local` never.
- [ ] **0.3 Local Postgres 16 + pgvector.** Since Docker is out (§2), document the
      native install in `provision.sh` and use the same script locally. Drizzle Kit
      wired up, `db:generate` / `db:migrate` / `db:studio` scripts.
- [ ] **0.4 `provision.sh` v1.** Node, Postgres 16 + pgvector, Redis, `pgBackRest` with
      WAL archiving to S3, Caddy, the two systemd unit files, the non-login service user,
      UFW rules. It will be wrong in places until Phase 1 deploys; commit it anyway and
      amend it every time anything is installed. The cost constraints it must respect —
      no NAT Gateway, `t4g` family, `gp3` volumes, S3 lifecycle rules, build off-box —
      are in [aws-cost.md](aws-cost.md).

**Closes when:** `pnpm test`, `pnpm test:e2e`, and `pnpm db:migrate` all pass on a
clean clone, and `provision.sh` has been read line by line by a human.

### Console prototype (out of sequence, deliberately)

Built ahead of the schema at the owner's request: the full management console UI over
`src/lib/sample-data.ts`, with no database, auth, server actions or AI calls. Feature
inventory in [console-features.md](console-features.md); 44 of 68 listed features are
present.

This inverts §13's schema-first convention on purpose — it exists so the product's
shape can be argued about before migrations are committed to. The screens are rebuilt
against real tables in Phase 1: **the layout survives, the data layer does not.** Treat
every screen as a design artefact, not as code to extend.

---

## Phase 1 — Contacts, ingestion, briefs

The whole product hangs off this. Getting the schema right here is worth more than
anything else in the plan.

- [ ] **1.1 Tenancy and the scoped client.** Launch is one office, one user (D1), but
      §13 still applies: every table carries `tenant_id` and every query goes through
      a `db.forTenant(tenantId)` wrapper. One tenant row is seeded by migration; there
      is no tenant management UI, no invites, no `tenant_memberships` table yet. The
      column and the wrapper are near-free now and effectively unaddable later, which
      is the whole reason they ship on day one. Vitest still asserts that a query
      issued through tenant A's client cannot read a tenant B row — seed a second
      tenant in tests only.
- [ ] **1.2 Auth.** Auth.js v5, Google + Microsoft Entra. Session carries `tenantId`
      and role. Route/action guards. Access is a single-address allowlist in env — no
      signup, no invite flow, no user admin. The `users` table exists with a real
      shape so multi-user is a feature later, not a migration of everything.
- [ ] **1.3 Contacts schema.** `contacts`, `contact_roles`, `contact_preferences`,
      `consents`. `last_followup_outcome` as a real column on `contacts` (§4).
      Normalised-email and E.164-phone columns with unique-per-tenant indexes, since
      dedupe depends on them.
- [ ] **1.4 Interaction log.** `interactions`, append-only. A DB-level guard against
      UPDATE/DELETE, plus a `tombstoned_at` for privacy requests. `contact_intent`
      table created here too, though nothing writes it yet.
- [ ] **1.5 Contact CRUD UI.** TanStack Table list with filters, contact detail page,
      manual create/edit. Server Actions, every input Zod-validated. This is the
      first thing a customer sees — it is worth polishing.
- [ ] **1.6 Identity resolution.** `resolveContact(normalised)` → existing | new |
      ambiguous. `merge_reviews` table and a review queue UI. Never auto-merge on
      name similarity (§4). Vitest is the deliverable here as much as the code:
      table-driven cases for phone formats, plus/aliased emails, name collisions.
- [ ] **1.7 Adapter interface + manual adapter.** The `ChannelAdapter` interface and
      registry from §5, the fixed pipeline as a single function, and manual entry as
      the first implementation. The pipeline is written once and never edited per
      channel.
- [ ] **1.8 BullMQ runtime.** Redis connection, worker entrypoint, `worker.service`,
      job registry, retry/backoff defaults, a dead-letter view. One trivial job
      proves the loop before real jobs land on it.
- [ ] **1.9 AI plumbing.** `callClaude()` over direct `fetch` — no SDK (§2).
      `ai_generations` table logging model version, prompt hash, in/out tokens, cost,
      latency, related entity (§3.7). `/prompts` directory with versioned files. A
      `runTask(schema, prompt)` helper that parses and Zod-validates, failing the job
      and storing the raw response on mismatch.
- [ ] **1.10 SummariseInteraction + RebuildContactIntent.** The two jobs from §8.
      Haiku extracts, Sonnet writes the rolling brief. Output goes to
      `contact_intent` (derived, so a direct write is fine) — but anything that would
      change `contact_preferences` or create a task goes to the confirm queue (§3.5).
- [ ] **1.11 Confirm queue.** Table, UI, and the commit action. Small, but it is a
      non-negotiable rule, so it ships in Phase 1 rather than being retrofitted.
- [ ] **1.12 Web form adapter.** A public Route Handler with a per-tenant key, spam
      guard, and consent capture that records source form, timestamp, IP, and the
      exact wording shown (§4). Consent provenance is only capturable at this moment
      — miss it here and it cannot be reconstructed.
- [ ] **1.13 Email adapter (inbound) — SES receiving.** MX on a dedicated subdomain
      (`in.ozirealty.com.au`) → SES receipt rule → raw MIME to S3 → SNS → Route
      Handler. Parse MIME, thread on `Message-ID`/`References`, resolve the contact
      off the From address, write the interaction. Keep the S3 object key on the row —
      the raw message is the evidence for an append-only log. SES gives SPF/DKIM/spam
      verdicts, so drop or quarantine on those before ingest. This covers machine mail
      only: portal enquiries forwarded in, replies to our own campaign sends (set
      `Reply-To` on the subdomain), and anything the agent forwards deliberately.
      Reading the agent's *own* mailbox is 3.7a, not this item. See D3 for why.
- [ ] **1.14 Dashboard shell.** Nav, today's follow-ups, recent interactions, the two
      queues (merge review, confirm) as badge counts. No tenant switcher (D1).
- [ ] **1.15 First deploy.** EC2 (`t4g`, public subnet, no NAT), Caddy, both systemd
      units, Sentry, external uptime monitoring, nightly `pg_dump` to S3 **and a restore
      actually performed** into a scratch database (§11 — an untested backup is not a
      backup), plus WAL archiving verified by a point-in-time restore. A Billing Budget
      with an alert is created *before* the first resource. Database is on-instance or
      RDS per the pending decision in [aws-cost.md](aws-cost.md).

**Closing demo:** a website form submission and an inbound email both land on the
same deduped contact, an AI brief appears on the contact record, an extracted task
sits in the confirm queue until a human commits it, and the whole flow runs on the
deployed box, not localhost.

---

## Phase 2 — Properties, matching, campaigns

Phase 1 + 2 is the sellable product (§12), so this phase ends with a paying-customer
bar, not a demo bar.

- [ ] **2.1 Properties schema.** `properties` plus `property_features`,
      `property_media`. Independent of listing status (§4). Owner FK to `contacts`.
- [ ] **2.2 Address normalisation — interim.** G-NAF is deferred (D4), so: structured
      columns (unit, street number, street, suburb, state, postcode) with a
      normalisation pass on entry, plus a nullable `gnaf_pid` and `gnaf_matched_at` so
      a backfill is a job and not a migration. Suburb is a FK to a seeded SA suburb
      table rather than free text — the matching engine's hard filter (§6) is a suburb
      equality check, and free-text suburbs quietly break it.
- [ ] **2.3 Property CRUD + media.** S3 presigned uploads, CloudFront delivery.
- [ ] **2.4 Embeddings.** Voyage `voyage-3` for preference summaries and property
      descriptions. pgvector columns, HNSW indexes, a re-embed job triggered on the
      fields that feed the text, and a backfill command.
- [ ] **2.5 Matching engine.** The three stages from §6 in order: SQL hard filters →
      pgvector cosine → Sonnet ranks the top ~20 and writes one sentence per match.
      Vitest with fixtures asserting that hard filters are never violated by the
      vector stage, and that every returned match carries a non-empty reason.
- [ ] **2.6 Match UI both directions.** Property → ranked contacts, contact → ranked
      properties, reason shown inline.
- [ ] **2.7 Approval queue.** The single chokepoint every outbound draft passes
      through (§3.1). Draft, diff-able edit, approve, reject-with-reason, audit trail.
      It ships **before** any send capability exists so there is never a window where
      a send path has no gate.
- [ ] **2.8 Send-time consent + DNC check.** Re-checked at the moment of send, not at
      queue time (§3.2). A contact who unsubscribed after drafting is blocked and the
      draft is marked. DNC washing built even though it does not apply to marketing
      SMS (§10).
- [ ] **2.9 SMS via MessageMedia.** Send, delivery receipts, inbound replies routed
      back through the adapter pipeline as interactions. Unsubscribe keyword handling
      writes a `consents` revocation.
- [ ] **2.10 Opportunity campaigns.** `NewProperty → MatchContacts → DraftCampaign →
      ApprovalQueue` (§8). Per-contact personalised drafts, batch approve, staggered
      send.
- [ ] **2.11 Per-tenant cost dashboard.** Reads `ai_generations`. A launch
      requirement (§3.7), so it closes Phase 2.

**Closing demo:** a new listing is added; within a minute the agent sees a ranked
list of contacts each with a reason; they batch-approve personalised SMS drafts; one
contact who unsubscribed in between is visibly blocked at send time; the tenant's AI
spend for the day is on screen.

---

## Phase 2B — Public website

Added after the fact (D9); see CLAUDE.md §16 for the architecture and the rules it must
respect. It sits here rather than earlier because a listings search over an empty
`properties` table is not demonstrable, and because 1.12's consent-capturing form path
and 2.3's media pipeline are both prerequisites.

The earlier suggestion of shipping a brochure site early is withdrawn: a live Wix site
already exists (D12), so there is no gap to fill and no reason to rush a partial
replacement. Leave Wix serving traffic until 2B is complete, then cut over once. The only
thing that should happen early is 2B.0.

- [ ] **2B.0 Legacy site audit and redirect map.** The domain already serves a live Wix
      site: 22 pages, 51 blog posts, 4 property pages, Wix Bookings. Full inventory and
      the risks in [legacy-site.md](legacy-site.md). Deliverables: a destination decided
      for every existing URL, Search Console verified and current performance captured
      *before* any cutover, and a content-freeze plan for the blog. Do this first — a
      redirect map is cheap now and archaeology later.
- [ ] **2B.1 `listings` + `inspections` schema.** As described in §4. The important
      shapes: `price_display` is a string the agent authors, `search_price_min/max` are
      numerics used only by filters, public copy is a separate field from the internal
      description, and `sold`/`leased` rows persist forever. A partial unique index
      enforces at most one live listing per property.
- [ ] **2B.2 Public read layer.** `src/server/public/` — named projections, public-status
      filters, and nothing else in `(public)` importing `db`. Vitest is the deliverable
      as much as the code: assert no projection can return an owner contact id, an
      internal note, or a numeric price where the display price is withheld. This lands
      before the first public page exists, so there is never a page reading raw tables.
- [ ] **2B.3 Public shell.** `(public)` route group, its own layout and nav, home page,
      about, contact, agent profile (reuse 3.5's card data if it exists yet), 404.
      Tailwind theme separate from the CRM's — the public site is brand-led, the CRM is
      dense and functional. They should not look like the same product.
- [ ] **2B.4 Listing management in the CRM.** Create a listing against a property,
      author the public copy and price display, order photos, set floorplan, set
      inspection times, publish / withdraw / mark sold. Publishing triggers ISR
      revalidation of the listing, the search pages and the sitemap.
- [ ] **2B.5 Search — filters and results.** Buy and rent as separate routes over one
      query builder: suburb (multi-select off the seeded SA suburb table), price
      min/max, beds, baths, parking, property type, land size, keyword. Sort by price
      / newest. Server-rendered, filters in the URL so results are linkable and
      indexable. Pagination, not infinite scroll — crawlers need the links.
- [ ] **2B.6 Listing detail page.** Gallery, floorplan, features, public copy,
      inspection times with registration, agent card, enquiry form, share, similar
      listings via the Phase 2 matching engine run in reverse. JSON-LD, canonical, OG
      image.
- [ ] **2B.7 Enquiry and appraisal forms.** All of them go through the 1.12 web adapter
      so consent provenance is captured once, in one place: listing enquiry, book an
      inspection, general contact, and "what's my home worth" — which is the highest
      value lead form on any agency site and should get its own landing page. Each
      records which listing or page it came from.
- [ ] **2B.8 Sold / leased archive.** Filterable, per-suburb, with the sale result
      shown where the agent has authored it as displayable.
- [ ] **2B.9 Suburb pages.** One per suburb the agency works, assembled from live
      listings, sold history and agent-authored copy. This is the organic search asset
      and the thing the Phase 5 SEO agent will have opinions about.
- [ ] **2B.9a Blog migration.** 51 posts at `/post/<slug>`. Keep that URL pattern
      verbatim — a tidier path is not worth 51 redirects. Export from Wix Blog, pull the
      media, re-host on S3/CloudFront, import into the Phase 5 blog schema. This means a
      minimal blog *read* path ships in 2B even though authoring is Phase 5; the posts
      cannot sit unreachable through the cutover.
- [ ] **2B.10 Map view — deferred (D11).** No geocoding provider yet. Reserve
      `latitude`, `longitude`, `geocoded_at`, `geocode_source` as nullable columns in
      2B.1 and write the geocode job with its provider call stubbed, so enabling the map
      later is credentials plus a backfill run rather than a schema change. No map UI
      until then; search stays list-only.
- [ ] **2B.11 Saved search alerts.** Only if wanted: nightly match → one digest per
      subscriber → approval queue → send with a consent re-check (§16). Not an
      autonomous send.
- [ ] **2B.12 Cutover.** Not a launch — a migration off Wix. `www.ozirealty.com.au` is
      the canonical host (that is where the indexed equity is), apex 301s to `www`, CRM
      stays on `app.`, mail stays on `in.`. Route 53, CloudFront over the public routes,
      Caddy origin, invalidation on publish, `robots.txt` and a generated `sitemap.xml`.
      Then: redirects verified with a crawl of every URL in
      [legacy-site.md](legacy-site.md) asserting 301-to-200 and no chains, new sitemap
      submitted, and rankings watched for a fortnight. Lower the DNS TTL a day ahead.
      **Apex MX is never touched** — the agency's existing email must survive the move
      untouched.

**Closing demo:** the agent creates a listing in the CRM, publishes it, and it appears
in a buy search on the live domain within seconds; a visitor enquires from the listing
page and that person is a deduped contact with an AI brief and consent provenance
before the agent has looked at their inbox.

---

## Phase 3 — The personal assistant layer

Mobile-first. The PWA is the mobile strategy (§14) — there is no app store build.

- [ ] **3.1 Tasks + calendar_events + alarms schema and UI.**
- [ ] **3.2 Voice note capture.** PWA recorder, S3 upload, `RecordVoiceNote` job.
- [ ] **3.3 Deepgram transcription.** Then `ExtractTasks` → confirm queue (§8) —
      never a direct write.
- [ ] **3.4 Daily brief.** BullMQ repeatable job, Batch API since it is not
      time-sensitive (§9). Delivered in-app; email delivery is an outbound message
      and therefore gated.
- [ ] **3.5 Digital business card.** Public profile page, QR, vCard download, and an
      enquiry form that feeds the Phase 1 web adapter with its own consent wording.
- [ ] **3.6 PWA offline.** Service worker, offline contact read, queued writes that
      reconcile on reconnect. Conflict rules need care — an interaction written
      offline is still append-only, so replay is safe; a preference edit is not.
- [ ] **3.7 Calendar sync — two-way** (D5). Google Calendar API + Microsoft Graph,
      reusing the Auth.js provider app registrations with calendar scopes added.
      Rules, because two-way sync is where this kind of feature usually breaks:
      - The external calendar is the source of truth for anything it owns. We never
        edit or delete an event we did not create.
      - Events we create carry our id in extended properties / `singleValueExtendedProperties`
        so we can recognise our own writes and not echo them back in as new events.
      - Incremental sync only: Google sync tokens, Graph delta queries. Never a full
        re-list on a schedule.
      - Webhooks for inbound change (Google push channels, Graph subscriptions), with
        a repeatable reconcile job as the safety net — subscriptions expire and
        silently stop.
      - Deletes from us are soft: cancel our event, never hard-delete a series.
- [ ] **3.7a Mailbox sync (optional, decide at 3.7).** Once calendar OAuth exists, the
      Gmail / Graph Mail read scope is a small increment on the same app registration
      and would give real two-way email threading that SES receiving cannot. It also
      means reading a personal mailbox, which is an APP disclosure question (§10), so
      it is a deliberate decision at that point, not an automatic follow-on.

**Closing demo:** an agent records a voice note in the car with patchy signal, and on
reconnect the transcript, the extracted tasks in the confirm queue, and the
interaction on the contact all appear.

---

## Phase 4 — Compliance RAG and proposals

The highest-risk phase legally. §3.3 and §15 both apply: prompt changes to the
advisor need a human, and corpus sources need licensing sign-off **before** any
crawler runs.

- [ ] **4.1 Corpus licensing sign-off.** Not a coding task. A written list of
      instruments, their registers, and the licence for each, approved by a human
      (D6, still open). Nothing else in Phase 4 starts first.
- [ ] **4.2 `rag_chunks` schema.** `jurisdiction | instrument | section | heading |
      version_date | text` plus FTS `tsvector` and a pgvector column (§7).
- [ ] **4.3 Section-aware ingester.** Chunk by section, never by character count.
      Long sections split by subsection with the parent heading repeated. Per-source
      parsers; citation accuracy is decided here.
- [ ] **4.4 Contextual retrieval.** Haiku writes a one-sentence situating summary per
      chunk, prepended before embedding with `voyage-law-2` (§7).
- [ ] **4.5 Hybrid retrieval.** Jurisdiction filter **before** retrieval → FTS
      `ts_rank` → pgvector cosine → RRF merge → Haiku rerank ~30 to ~8 (§7). Vitest
      on a golden set: an SA-only instrument must never appear for a NSW query.
- [ ] **4.6 Advisor answer path.** Sonnet, citations mandatory, explicit "nothing
      relevant found" path, research-support framing on every answer. Prompt reviewed
      by a human before merge (§15).
- [ ] **4.7 Cached hot paths.** Ten most common question types pinned into a cached
      system prompt, retrieval skipped (§7).
- [ ] **4.8 Monthly re-crawl.** Repeatable job, `version_date` diffing, an alert when
      a cited instrument changed — amendments are what quietly make the advisor
      wrong.
- [ ] **4.9 Proposal generator.** Agency data + property + comparables → Sonnet →
      PDF to S3. It is outbound, so it goes through the approval queue.

**Closing demo:** the same question asked with jurisdiction set to SA and then NSW
returns different, correctly cited answers; a deliberately out-of-corpus question
returns a clean "nothing relevant"; a proposal PDF is generated and sits awaiting
approval.

---

## Phase 5 — Content, social, SEO, reporting

- [ ] **5.1 Brand voice config per tenant.** Cached prompt prefix (§9).
- [ ] **5.2 Blog.** Schema, `WeeklyBlogDraft` repeatable job, editor, approval queue,
      publish.
- [ ] **5.3 Social adapters (outbound).** Per-network. Every post gated. **Needs
      human input** — see D7, still open.
- [ ] **5.4 Social adapters (inbound).** DMs and comments through the same Phase 1
      pipeline, becoming interactions on contacts.
- [ ] **5.5 SEO crawler + audit.** Read-only technical crawl, findings stored.
- [ ] **5.6 SEO change-set generator.** `FortnightlySeoCycle` via the Batch API.
      Produces a reviewable diff and stops (§3.4). No deploy path exists, not even a
      disabled one.
- [ ] **5.7 Reporting.** Pipeline, follow-up compliance, campaign performance, AI
      cost per tenant over time.

**Closing demo:** a blog post drafts itself, is edited and approved, and publishes; an
SEO cycle produces a change set that a human can read and approve with nothing
touching a live site automatically.

---

## Cross-cutting, every phase

Not separate work items — the definition of done for each item above.

- Migration written before the feature that uses it.
- Every Server Action input Zod-validated.
- Every query through the tenant-scoped client.
- Every AI call logged to `ai_generations`.
- Every outbound draft through the approval queue.
- Tests actually run, with output, before an item is called done.
- `provision.sh` amended if anything new was installed.

---

## Decisions (2026-08-17)

**D1 — Scope: one office, one user.** No franchise hierarchy, no multi-user. But
`tenant_id` on every table and the scoped client still ship in 1.1, and `users` gets a
real shape in 1.2 — those two are cheap now and near-impossible to retrofit. Nothing
else multi-tenant gets built: no tenant switcher, no invites, no org admin, no
membership table.

**D2 — Jurisdiction: SA only.** `jurisdiction` columns and per-tenant disclosure
config exist as §10 requires, seeded with SA and only SA. The Phase 4 corpus is SA +
federal. Do not hardcode `'SA'` in logic anywhere — that is the one thing that makes
NSW a rewrite instead of a data load.

**D3 — Inbound email: AWS SES receiving.** Recommended and adopted; detail in 1.13,
rationale below.

**D4 — G-NAF: deferred.** Interim structured-address approach in 2.2, with a
`gnaf_pid` column reserved.

**D5 — Calendar: two-way.** Google + Graph, rules in 3.7.

**D6 — Legal corpus sources: deferred.** Still blocks all of Phase 4 (4.1).

**D7 — Social networks: deferred.** Still blocks 5.3.

**D9 — Public website in scope, as Phase 2B.** `ozirealty.com.au` is registered and
moving to AWS. Same Next.js app, `(public)` route group, isolated read layer. Rationale
and rules in CLAUDE.md §16; breakdown in Phase 2B above. Hosts, corrected by D12: public
site on `www`, CRM on `app.`, inbound mail on `in.`, apex 301s to `www`.

**D10 — Rentals: advertise only.** Rental listings render on the public site; the platform
does not manage tenancies. No leases, ledgers, maintenance or routine inspections. Trust
accounting stays out of scope (§14). Note that the existing site markets property
management on four pages — see the spec-gaps note in [legacy-site.md](legacy-site.md).

**D11 — Geocoding: deferred, access promised later.** Columns and a stubbed job ship in
2B.1/2B.10 so switching it on is credentials plus a backfill. No map UI until then.

**D12 — Existing site: live Wix, migrate it.** 22 pages, 51 blog posts, 4 property pages,
Wix Bookings in use. Canonical host is `www` and stays `www`. Inventory, redirect rules
and risks: [legacy-site.md](legacy-site.md). Public site cuts over in 2B.12; Phase 1 and 2
never touch the live site, since the CRM sits on `app.` and mail on `in.`.

**D13 — Brand assets exist.** Drop them into `assets/brand/` per the README there before
2B.3. The CRM ships on shadcn defaults regardless.

**D14 — Minimise AWS cost.** Redis moves on-instance (§2 already permitted it), no NAT
Gateway ever, `t4g` + `gp3`, builds off-box, S3 lifecycle rules, CloudWatch retention set
at creation, a Billing Budget before the first resource, and external uptime monitoring.
Full analysis and the trap list: [aws-cost.md](aws-cost.md). **Still open:** collapsing
Postgres onto the instance as well — that contradicts §2 and needs sign-off under §15.

**D8 — Data import: not now.** 1.6's identity resolution is therefore designed for
enquiry-rate volume, not bulk-import volume. Revisit before any import work — dedupe
across thousands of rows at once is a different problem.

*Amended 2026-09-26:* a **small-batch property import** is approved — JSON, Markdown or
PDF, at most 200 rows, preview then an explicit Import press. It creates properties
(status off market), owners as landlords and tenants as tenants, through the ordinary
identity resolver. Rent, arrears, leases and trust figures are ignored (D10, §14). Bulk
contact import stays deferred. Format: [property-import.md](property-import.md).

### Why SES receiving (D3)

Ranked against the alternatives for a one-user AU deployment:

- **No credentials to hold.** IMAP polling means storing a mailbox password or app
  password; OAuth means a Google Cloud / Entra app plus consent screens. SES needs one
  MX record.
- **Push, not poll.** SES → SNS → Route Handler arrives in seconds. IMAP polling is a
  loop that either burns quota or lags. §8 says a failed AI call must never fail a user
  request; SNS retries into the queue, which fits that shape.
- **Raw MIME in S3 is the right artefact for an append-only log** (§4). Storage is
  already S3 + CloudFront (§2), so nothing new is introduced.
- **Auth verdicts for free.** SES hands over SPF/DKIM/DMARC and spam verdicts, so a
  spoofed enquiry can be dropped before it becomes a contact.
- **Residency.** Stays in-region, no third-party mail vendor to disclose (§3.6).

Two things to settle before building 1.13:

1. **Verify SES inbound receiving is available in ap-southeast-2.** SES *sending* is
   everywhere; *receiving* is a shorter region list. If Sydney is not on it, the
   choice is a non-AU receiving region — which contradicts §3.6 and needs a human
   decision (§15) — or a different mechanism. Check first, build second.
2. **Use a dedicated subdomain** (`in.ozirealty.com.au`), never the apex. Pointing
   the main domain's MX at SES takes over the agency's real email. The subdomain is
   also what goes in `Reply-To` on campaign sends so replies thread back in.

The honest limitation: SES receiving sees mail *addressed to us*. It does not see the
agent's own inbox, so a conversation happening directly between agent and client in
Outlook is invisible unless forwarded. If that turns out to matter, 3.7a adds the
mailbox scope onto the calendar OAuth app that D5 already requires — which is exactly
why the mail decision is worth splitting in two rather than committing now.

---

## Still open

- **4.1 corpus sources and licences** — blocks all of Phase 4 (D6).
- **5.3 social networks** — blocks 5.3 only (D7).
- **Postgres on-instance instead of RDS** — saves ~$260/yr and simplifies the box, at the
  cost of self-managed backups (mitigated by WAL archiving to S3) and no automatic
  failover. Contradicts §2, so it needs explicit sign-off. Blocks 0.4 and 1.15;
  reasoning in [aws-cost.md](aws-cost.md).
- **SES region check** — blocks 1.13, above.
- **`/book-online` replacement.** Wix Bookings takes real appointments today. Phase 2B
  has no public booking feature and the calendar is Phase 3. Either 2B.7 grows an
  appraisal/inspection booking form, or `/book-online` keeps pointing at Wix past
  cutover. Blocks 2B.12, and it is a live revenue path — decide deliberately.
- **AWS account access.** Needed for 1.15 onward: account, region ap-southeast-2, IAM for
  RDS/S3/SES/Route 53/CloudFront, and whether the domain's registration moves to Route 53
  or only its DNS. §15 puts this on the human side.
- **Wix export access.** Needed for 2B.9a — admin login or an exported CSV plus media for
  the 51 posts and 4 property records.
- **Contact roles beyond residential.** The live site sells buyer's agency, overseas
  investment, land, and business brokerage. Seed roles are cheap; the matching engine
  (§6) has nothing to say about a business sale. Noted, not blocking.
