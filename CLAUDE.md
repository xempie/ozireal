# CLAUDE.md

Project context for Claude Code. Read this at the start of every session.

---

## 1. What this is

An AI-native CRM and operations platform for Australian real estate agencies. The
core of the business is a **contact list**: who the person is, what they want, and
what happened at the last follow-up. Every other channel terminates in that contact
list.

A second database holds **properties/stock** the business controls. The two are
matched so the agent can answer "which property suits this person" and "who should
hear about this property".

On top of that sit four assistant surfaces: a compliance advisor, a content/social
engine, a proposal generator, and a technical SEO agent.

In front of it sits the **public website** — buy and rent search, listing detail pages,
sold/leased archive, suburb pages, appraisal and enquiry forms. It is not a brochure
bolted on the side: it reads the same `properties`/`listings` tables the CRM writes, and
every form on it terminates in the contact list through the Phase 1 channel adapter. It
is also the surface the SEO agent (§3.4) proposes changes to and the blog publishes to.

**Working name:** `OziRealty` — confirm or replace before Phase 1 ends. Used for the
repo, the systemd units, and `/etc/ozirealty/env`.

### Launch scope — confirmed 2026-08-17

Read this before designing anything. It narrows the spec below without contradicting
it.

- **One office, one user.** No franchise hierarchy, no multi-user, no invites, no
  tenant switcher. §13's query-layer tenancy rule still holds: `tenant_id` on every
  table, every query through the scoped client, one tenant seeded by migration. The
  column and the wrapper are the only multi-tenant things that get built.
- **South Australia only.** `jurisdiction` columns and per-tenant disclosure config
  exist as §10 requires, seeded with SA alone. Never hardcode `'SA'` in logic — that
  is what turns adding NSW into a rewrite rather than a data load.
- **Inbound email is AWS SES receiving** on a dedicated subdomain. Reading the agent's
  own mailbox is a separate, later decision.
- **Two-way calendar sync** (Google + Microsoft Graph).
- **`ozirealty.com.au` is registered and already serves a live Wix site** — 22 pages, 51
  blog posts, 4 property pages, Wix Bookings. Phase 2B is a *migration*, not a launch.
  Inventory, redirect rules and risks: [docs/legacy-site.md](docs/legacy-site.md).
- **Hosts:** public site `www.ozirealty.com.au` (canonical — that is where the indexed
  equity is), CRM `app.ozirealty.com.au`, inbound mail `in.ozirealty.com.au`, apex 301s
  to `www`. Apex MX is never touched; the agency's existing email must keep working.
  Route 53 for DNS, one EC2 box behind Caddy, CloudFront over the public routes.
- **Public listings website is in scope** as Phase 2B — same Next.js app, separate
  route group and a separate read layer. See §16.
- **Rentals are advertised, not managed.** No leases, ledgers or routine inspections.
- **Rental listings render on the public site**, so §6's matching and §4's roles stay
  residential-sales-shaped for now even though the business also sells buyer's agency,
  overseas investment and business brokerage.
- **Deferred, and blocking their own items only:** G-NAF address matching, the legal
  corpus source list, social network selection, bulk data import.

Rationale and per-item detail: [docs/phases.md](docs/phases.md).

---

## 2. Stack — decided, do not re-litigate

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15, App Router | Server Components by default |
| Language | TypeScript, strict mode | No `any` without a comment justifying it |
| UI | React 19, shadcn/ui, Tailwind | TanStack Table for data grids |
| ORM | Drizzle | Chosen for first-class pgvector support |
| DB | PostgreSQL 16 + pgvector | RDS — **but see [docs/aws-cost.md](docs/aws-cost.md); moving this on-instance is proposed and awaiting sign-off** |
| Queue | BullMQ on Redis | **On-instance** — ElastiCache is not worth ~$13/mo at this scale |
| Auth | Auth.js (NextAuth v5) | Google + Microsoft Entra providers |
| Storage | S3 + CloudFront | Media, voice notes, generated PDFs |
| LLM | Anthropic Messages API | Direct `fetch`, no wrapper library |
| Embeddings | Voyage AI (`voyage-law-2` for legal, `voyage-3` for general) | Anthropic has no embeddings endpoint |
| STT | Deepgram | Handles Australian accents well |
| SMS | MessageMedia | AU sender IDs, better local deliverability |
| Proxy | Caddy | Auto TLS |
| Process mgmt | systemd | `web.service`, `worker.service` |

**Explicitly not used:** Docker, Kubernetes, Prisma, local/self-hosted models,
Python services, a separate REST API layer.

Server Actions and Route Handlers are the API. Do not build a parallel API surface.

---

## 3. Non-negotiable rules

These are product and legal requirements, not preferences. Never work around them.

1. **Human approval before any outbound message.** Every AI-drafted email, SMS,
   social post, or blog article enters an approval queue. There is no autonomous
   send path. No exceptions, no config flag to disable it.
2. **Consent is checked at send time**, not at queue time. A contact who
   unsubscribes between drafting and sending must not receive the message.
3. **The compliance advisor cites or stays silent.** Every answer carries the
   jurisdiction, instrument, and section it came from. If retrieval returns nothing
   relevant, it says so. It never renders a definitive legal ruling and always
   frames output as research support to be verified with a licensee or solicitor.
4. **The SEO agent proposes, never deploys.** It generates a reviewable change set.
   A human approves before anything touches a live site.
5. **AI never silently writes to the contact record.** Extracted tasks, updated
   preferences, and intent changes land in a confirm queue the agent commits.
6. **Data stays in ap-southeast-2.** No processing region outside Australia except
   the LLM/STT vendor APIs, which are disclosed to the end customer.
7. **Log every AI generation**: model version, prompt hash, input and output token
   counts, cost, latency, and the entity it relates to. Per-tenant cost visibility
   is a launch requirement, not a later addition.
8. **The public website reads through its own allow-listed layer.** Public pages never
   touch the authenticated tenant client and never select a table row wholesale. They
   go through explicit projections in `src/server/public/` that name every field
   returned. `properties` carries the owner's contact FK, internal price expectations
   and vendor notes — one `select *` on a public route publishes them. Treat any
   widening of a public projection as a change that needs review.

---

## 4. Domain model

### Core entities

**`contacts`** — person-centric, never deal-centric. One person accumulates roles
over time (buyer, vendor, landlord, tenant, referrer) via a `contact_roles` join.
Holds identity, channel handles, and `last_followup_outcome` as a first-class
column — not a note.

**`contact_preferences`** — structured wants: suburbs, price band, bed/bath/parking
minimums, property type, timeline, finance status, plus a free-text
`soft_requirements` field ("quiet street, no main road") that feeds the embedding.

**`interactions`** — append-only log of every touch across every channel. Immutable;
corrections are new rows. This is the only thing the AI reads from when building
briefs. Never delete, only tombstone for privacy requests.

**`contact_intent`** — derived, rebuilt on every new interaction. Intent type,
budget band, timeline, blockers, sentiment, confidence, and a one-paragraph rolling
brief. Never hand-edited; agents correct the underlying interaction instead.

**`properties`** — the stock database. GNAF-normalised address, land and floor area,
year built, beds/baths/parking, condition, features, status, linked owner contact.
Exists independently of whether it is currently listed.

**`listings`** — the sale or rental campaign over a property, and the only thing the
public site renders. A property may have many listings over its life (sold 2019, leased
2022, for sale again now); at most one is live. Holds listing type (sale / rent /
auction), method, price display (a *string* like "Offers above $750,000" plus separate
numeric `search_price_min`/`search_price_max` used only for filtering), campaign dates,
public status, and the public copy — which is deliberately not the internal property
description. `sold`/`leased` listings stay for the archive and the suburb pages.

**`inspections`** — open homes and private viewings on a listing. Public on the listing
page, and a registration writes an interaction plus a contact.

**`consents`** — one row per contact per channel per grant. Records source form,
timestamp, IP, and wording shown. Required by the Spam Act; without provenance you
cannot defend a send.

**`tasks`**, **`calendar_events`**, **`alarms`** — the personal assistant layer.

**`rag_chunks`** — legal corpus. See §7.

### Identity resolution

Inbound contacts dedupe on normalised email and E.164 phone. Ambiguous matches go to
a merge review queue — never auto-merge on name similarity alone.

---

## 5. Channel adapters

The brief is explicit that new input channels must be addable without touching core.
Implement adapters against one interface:

```ts
interface ChannelAdapter {
  id: string;
  ingest(raw: unknown): Promise<NormalisedInteraction>;
  canReply: boolean;
  send?(contactId: string, payload: OutboundPayload): Promise<SendResult>;
}
```

Pipeline is fixed for all channels:

```
adapter.ingest → normalise → identity resolve → interactions row
  → enqueue SummariseInteraction → enqueue RebuildContactIntent
```

Ship with: website forms, email, social DMs and comments, portal enquiry emails,
customer app, manual entry. Adding a channel means adding one class and registering
it. If you find yourself editing the pipeline to support a new channel, the
abstraction is wrong — fix the interface instead.

---

## 6. Matching engine

Bidirectional: property → ranked contacts, and contact → ranked properties.

1. **Hard filters first** — price band, beds, suburb, availability. SQL, cheap.
2. **Vector similarity** on the embedded preference summary against the embedded
   property description. Catches soft signals filters cannot express.
3. **Claude ranks** the top ~20 candidates and writes a one-sentence reason per
   match.

The reason string is not optional. Agents do not trust a bare score, and it is what
makes the feature adopted rather than ignored.

---

## 7. Compliance RAG

### Chunking

Chunk by **section**, never by character count. Every chunk carries:

```
jurisdiction | instrument | section | heading | version_date | text
```

Long sections split by subsection with the parent heading repeated. This metadata is
what the citation is built from, so it must be accurate at ingest.

### Contextual retrieval

Before embedding, have Claude Haiku write a one-sentence situating summary of each
chunk and prepend it to the embedded text. One-off cost at ingest, materially better
retrieval.

### Query path

1. Filter by jurisdiction **before** retrieval — SA rules must not surface for a NSW
   question.
2. Postgres FTS (`ts_rank`) for exact terminology — "Form 1", "cooling-off",
   "section 7".
3. pgvector cosine for paraphrase.
4. Merge with Reciprocal Rank Fusion.
5. Rerank top ~30 to ~8 with Haiku.
6. Answer with Sonnet, citations mandatory.

### Corpus

State and federal legislation registers, agency legislation, vendor disclosure
requirements (Form 1 in SA), state institute codes, ACCC and Consumer Affairs
guidance. Check licensing per jurisdiction before ingesting — most Australian
registers are CC-BY but confirm.

Store `version_date` per instrument and re-crawl monthly. Amendments are what
quietly make the advisor wrong.

### Optimisation

For the ten most common question types, pin the relevant sections into a cached
system prompt and skip retrieval. Faster, cheaper, more accurate.

---

## 8. Background jobs

All async work runs in BullMQ. Jobs are small, idempotent, and retryable with
exponential backoff. A failed AI call must never fail a user request.

```
IngestInteraction → SummariseThread → RebuildContactIntent
RecordVoiceNote   → Transcribe(Deepgram) → ExtractTasks → ConfirmQueue
NewProperty       → MatchContacts → DraftCampaign → ApprovalQueue
Scheduled         → DailyBrief, WeeklyBlogDraft, FortnightlySeoCycle
```

Use BullMQ repeatable jobs for scheduling. No separate cron.

---

## 9. AI integration patterns

- Direct `fetch` to the Messages API. No SDK wrapper — the surface is small enough
  that abstraction costs more than it saves.
- **Zod schema per task.** Prompt for JSON only, parse, validate. On validation
  failure, fail the job and log the raw response — you will need it for prompt
  tuning. Never let malformed output reach the database.
- **Prompt caching** on stable prefixes: the legal corpus, brand voice, agency
  configuration. Cuts cost substantially on high-volume calls.
- **Batch API** for anything not time-sensitive: nightly re-summarisation, the
  fortnightly SEO cycle, bulk contact briefs. Roughly half price.
- **Model selection**: Haiku for classification, reranking, and extraction. Sonnet
  for briefs, drafts, proposals, and compliance answers.
- Store prompts as versioned files under `/prompts`, not inline strings.

---

## 10. Australian regulatory requirements

- **Spam Act 2003** — consent provenance per contact per channel, functional
  unsubscribe in every message, sender identification. Design in, do not retrofit.
- **Privacy Act 1988 / APPs** — data residency, deletion on request cascading
  through the interaction log, and disclosure to end customers that AI processes
  their correspondence.
- **Do Not Call Register** — applies to calls, not marketing SMS, but build the
  washing check because agencies conflate the two.
- **State agency legislation** — disclosure obligations differ across SA, NSW, VIC.
  Make these per-tenant configurable; never hardcode one state's rules.

---

## 11. Infrastructure

AWS, ap-southeast-2 (Sydney). Data residency is a sales argument, not just a
compliance one.

Two systemd units on EC2: `web.service` (Next.js, :3000) and `worker.service`
(BullMQ consumer). Caddy in front for TLS. Both `Restart=always`, both running as a
dedicated non-login user, both reading from `/etc/ozirealty/env`.

Keep a `provision.sh` in the repo that could rebuild the box from scratch. Update it
whenever anything is installed. This is the discipline that replaces containers —
without it, server state drifts and nobody knows why production works.

Required regardless of scale: nightly `pg_dump` to S3 with a **tested** restore, WAL
archiving to S3 for point-in-time recovery, Tailscale for SSH with port 22 closed
publicly, UFW allowing only 80/443, Sentry for errors, and **external** uptime
monitoring — a monitor running on the box cannot tell you the box is down, so Uptime Kuma
belongs somewhere other than this instance or not at all.

### Cost discipline

Full analysis and the trap list: [docs/aws-cost.md](docs/aws-cost.md). The rules that
follow from it, which apply to every provisioning decision:

- **No NAT Gateway. Ever.** ~$43/mo — more than the rest of the architecture combined.
  The instance sits in a public subnet behind a tight security group; SSH is closed
  publicly via Tailscale. If something introduces a NAT Gateway, that is a bug.
- **`t4g` (Graviton) instance family**, `gp3` volumes, one public IPv4 address, and no
  unattached Elastic IPs.
- **Build off-box.** `next build` runs in CI or locally and the artefact is deployed.
  Builds are the memory-hungry part; keeping them off the instance is what lets a small
  box stay comfortable.
- **S3 lifecycle rules from day one** — dumps expire, voice notes tier down after 90 days.
  Storage that only ever grows is a slow leak.
- **Any CloudWatch log group gets a retention period at creation.** Default is forever.
- **A Billing Budget with an alert exists before the first resource is created.**
- CloudFront stays. It is inside the always-free tier at this traffic and it removes EC2
  egress charges — it lowers the bill rather than adding to it.

---

## 12. Build phases

Do not work ahead. Each phase must be demonstrable before the next begins.

| Phase | Scope |
|---|---|
| 1 | Schema, migrations, auth, contacts, adapters (web/email/manual), interaction log, AI briefs, dashboard shell |
| 2 | Properties, matching engine, opportunity campaigns, SMS, approval queue |
| 2B | Public website: buy/rent search, listing pages, sold archive, suburb pages, enquiry and appraisal forms |
| 3 | Voice-to-task, calendar, tasks, alarms, digital business card, PWA offline |
| 4 | Compliance RAG, proposal generator |
| 5 | Blog, social publishing, SEO agent, reporting |

Phase 1 + 2 is independently sellable. Treat it as the product, not a milestone.

The worked breakdown of each phase — modules, order, and the demo that closes it —
lives in [docs/phases.md](docs/phases.md).

---

## 13. Working conventions

- **Schema first.** Migrations before features so everything downstream is typed off
  real tables. Drizzle Kit for migrations, checked into the repo.
- **One module per session.** Read the relevant file in `/docs`, implement, run
  tests, stop. Do not attempt "build the CRM".
- **Plan mode before anything structural.** Propose, get approval, then write.
- **Tests are how you verify yourself.** Vitest for AI extraction logic and matching
  scores, Playwright for the main flows. Run them; do not assume.
- Server Components by default. `"use client"` only where interactivity demands it.
- Validate every Server Action input with Zod. Every one.
- Multi-tenancy enforced at the query layer via a tenant-scoped Drizzle client. Never
  rely on the UI to filter.
- Conventional commits. Small, reviewable diffs.

---

## 14. Out of scope

Do not build these, and do not suggest them:

- **Trust accounting** — regulated, audited, a different product entirely.
- **Portal feeds (REAXML to REA/Domain)** — deferred past Phase 5; certification
  takes months.
- Local or self-hosted models.
- A mobile app store build. The PWA is the mobile strategy.
- Any autonomous send, publish, or deploy path.

---

## 15. What needs a human

Claude Code does not decide these alone. Stop and ask:

- Architecture changes that contradict §2.
- Anything touching consent, sending, or compliance output.
- Legal corpus sources and their licensing.
- API keys, OAuth app registrations, DNS.
- Prompt changes to the compliance advisor.
- Widening a public read projection (§3.8) or publishing a new public field.

---

## 16. Public website

### One app, two route groups

The public site lives in the same Next.js project as the CRM: `src/app/(public)/` and
`src/app/(app)/`. Not a second application. §2 forbids a parallel API surface, and a
separate front end would immediately need one to read listings. One app also means the
listing that goes live in the CRM is live on the site with no sync step.

What separates them is not the deployment, it is the **read path**:

| | CRM routes | Public routes |
|---|---|---|
| Auth | required | none |
| DB access | tenant-scoped Drizzle client | `src/server/public/*` projections only |
| Fields | whatever the query needs | explicitly named, allow-listed |
| Caching | none, always fresh | ISR, revalidated on publish |
| Writes | Server Actions | enquiry forms only, through the channel adapter |

`src/server/public/` is the whole security boundary. Every function in it returns a
named projection and filters on public status. Nothing else in `(public)` imports
`db` directly. Vitest asserts that no public projection returns an owner contact id,
an internal note, or a numeric price on a listing whose price display is withheld.

### Content rules

- **Price display is a string, authored per listing.** "Offers above $750,000",
  "Contact agent", "$650,000 – $690,000". Never format a number into a price on the
  public site. Underquoting provisions make the displayed wording a legal artefact —
  the agent writes it, the app renders it verbatim. Numeric min/max exist separately
  and drive search filters only.
- **Public copy is its own field**, not the internal property description. Vendor
  motivation belongs in `interactions`, never in something rendered.
- **Sold and leased listings persist.** They are the archive, the suburb-page content,
  and the SEO surface. Removing them throws away the site's best organic asset.
- **Every form captures consent provenance** — source form, timestamp, IP, exact
  wording shown (§4). Reuse the Phase 1 web adapter; do not write a second form path.

### Property alerts and §3.1

"Email me new listings matching this search" is a standard feature and it is an
autonomous send path, which rule 1 forbids outright. It is therefore built as a
**batched draft**: matching runs nightly, produces one approval-queue item per digest,
and the agent approves the batch. Consent is re-checked at send (rule 2), so an
unsubscribe between match and send blocks delivery. If that workflow is unacceptable
in practice, the answer is to not ship alerts — not to add a bypass.

### Technical baseline

Server Components throughout; `"use client"` only for the search form, map and gallery.
ISR with on-publish revalidation. `schema.org` `RealEstateListing` JSON-LD on every
listing page, `sitemap.xml` generated from live and sold listings, canonical URLs, OG
images from the primary photo. Images through S3 + CloudFront with `next/image`.
Slugs are stable and never reused: `/for-sale/12-smith-street-norwood-sa-5067-1234`.
