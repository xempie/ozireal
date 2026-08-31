# CRUD and dead-link audit

An audit of every screen against the rule that a person must be able to **add, view,
edit and remove** each kind of record the console holds — and that no control on screen
may do nothing when pressed.

Status key: `[ ]` outstanding · `[x]` done

---

## What the audit found

Three distinct kinds of gap, not one:

1. **Actions written, never wired.** `updateContact` and `tombstoneContact` were built
   in B2 and are covered by tests, but no button anywhere calls them. The most-used
   record in the product could be created and read and nothing else.
2. **Create-only entities.** Nine tables had a "New …" button and no way to correct a
   typo or remove a mistake: properties, listings, inspections, tasks, calendar events,
   campaigns, proposals, articles, social posts.
3. **Inert controls.** Buttons rendered from the static prototype that were never given
   a handler. A control that does nothing is worse than a missing one — it tells the
   user the write landed.

---

## 1 · Actions that existed with no button

- [x] **1.1 Edit a contact** → `updateContact`
- [x] **1.2 Remove a contact (privacy request)** → `tombstoneContact`
- [x] **1.3 Retry a dead job.** `RetryJobButton` and the whole dead-letter card existed
      and rendered only on `/settings`, which is not where anyone looks after seeing a
      failure count on `/costs`. The inert per-row Retry there was never retryable
      anyway — those rows are counts per job *name*, and a retry needs a job id — so the
      real card now renders beneath the table

## 2 · Stock

- [x] **2.1 `updateProperty`** + Edit on the property detail screen
- [x] **2.2 `deleteProperty`** — refuses while any listing exists, because the listing
      history is the sold archive (§16) and a property row is what holds it together
- [x] **2.3 `updateListing`** + Edit, re-embedding when the public copy changes
- [x] **2.4 `setListingStatus`** — the Publish / Withdraw buttons on the listing screen
      were inert. Publishing checks the price wording and the one-live-per-property rule
      before the database does, so the refusal is a sentence rather than a constraint
      name, and it moves the property's own status with it
- [x] **2.5 `deleteListing`** — drafts only. A sold or leased campaign is never deleted
- [x] **2.6 `createInspection` / `cancelInspection`** — the table, the query and the
      dashboard panel all existed; there was no way to create one

## 3 · Assistant layer

- [x] **3.1 `updateTask`, `reopenTask`, `deleteTask`**
- [x] **3.2 `updateCalendarEvent`, `cancelCalendarEvent`** — both refuse on an event the
      external calendar owns (`our_write = false`), which is the rule the schema comment
      already stated and nothing enforced

## 4 · Engine and content

- [x] **4.1 `updateCampaign`, `deleteCampaign`** — delete refuses once anything has been
      sent, because a recipient row with a `sent_at` is evidence
- [x] **4.2 `updateProposal`, `submitProposalForApproval`, `setProposalOutcome`,
      `deleteProposal`**
- [x] **4.3 `updateBlogPost`, `setBlogPostStatus`, `deleteBlogPost`**
- [x] **4.4 `updateSocialPost`, `setSocialPostStatus`, `deleteSocialPost`**
- [x] **4.5 `setSeoIssueStatus`** — Accept / Dismiss on `/seo` were inert; the status
      enum for them was already in the schema
- [x] **4.6 Redirect map CRUD** (`createRedirect`, `updateRedirect`, `deleteRedirect`) —
      the Wix cutover map was read-only, which made the migration console unusable for
      the one job it exists to do

## 5 · Dead links given a destination

- [x] **5.1** `/voice` "Open in confirm queue" → `/confirm`
- [x] **5.2** `/content` "Review" → `/approvals`
- [x] **5.3** `/website` "View live site" → `https://www.ozirealty.com.au`
- [x] **5.4** `/campaigns` builder buttons — replaced with an honest note and a link,
      because draft generation is a real feature and a button that pretends to have it
      is not
- [x] **5.5** `/contacts` "Saved views" — the button opened nothing and duplicated the
      card below it. Replaced with the CSV export. The view chips and filter chips are
      now dashed spans rather than things that look pressable and are not
- [x] **5.6** `/seo` "Run a crawl" and `/voice` "Record" — removed rather than
      disabled. Both features are real and unbuilt; a dead button makes an empty
      findings list look like a clean site instead of a tool that never ran

## 6 · Two live bugs the audit turned up

- [x] **6.1 Settled rentals vanished from the listings board.** The kanban had columns
      for draft / live / under offer / sold / withdrawn — and no `leased`. Every leased
      campaign was in the database and on no screen.
- [x] **6.2 The development sign-in had been broken since password sign-in landed.**
      Its `<form>` contained only a button, so it posted an empty email, the provider
      refused it, and the page reloaded looking untouched. It now carries the
      allowlisted address in a hidden field — read from `AUTH_ALLOWED_EMAILS` rather
      than hardcoded, so with an empty allowlist the button does not render and sign-in
      still fails closed. `scripts/verify-writes.mjs` had been failing at step two ever
      since and nobody had re-run it; it and `verify-forms-responsive.mjs` now click
      that form by name instead of grabbing the first submit button on the page.

---

## How it is verified

| Command | What it covers |
|---|---|
| `pnpm test` | 317 tests. `tests/edit-delete.test.ts` adds 37, most asserting a refusal **and** that the row survived it — a delete that reports failure and deletes anyway is the bug worth catching |
| `pnpm db:guards` | 22 database-level guards, unchanged |
| `pnpm verify:crud` | 15 checks in a real browser: dialogs prefill from stored values, saves land, deletes remove the row, and a refusal appears in words beside the button |
| `pnpm verify:writes` | the create paths, working again |

---

## Deliberately still outstanding

These are phases, not gaps. Listing them here so the audit is not read as complete.

- [ ] **Public website (Phase 2B).** `src/app/(public)/` and `src/server/public/` do not
      exist. §12 puts it after Phase 2 and §16 specifies it in full. It is the largest
      single item left and it is not a CRUD fix.
- [ ] **Voice recorder (Phase 3).** `/voice` renders real rows and the transcription
      job and confirm-queue path are built; nothing captures audio. The button is gone
      and the header says which phase brings it.
- [ ] **Compliance retrieval (Phase 4).** `/compliance` has no corpus behind it yet.
- [ ] **SEO crawl (Phase 5).** Issues can now be accepted and dismissed; nothing
      produces new ones.
- [ ] **Campaign draft generation.** `MatchContacts → DraftCampaign → ApprovalQueue`
      (§8) exists as far as matching; the drafting step does not.
- [ ] **Proposal PDF.** CSV export shipped (`/api/export/[kind]`); generating the
      proposal document itself did not.
- [ ] **Suburb page authoring.** Read-only for now; it is Phase 2B content.
