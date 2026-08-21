# Management console — feature list

The internal console (`app.ozirealty.com.au`). The public website is a separate surface
with its own section in CLAUDE.md §16; nothing here is customer-facing.

Column **P** is the phase a feature genuinely belongs to. Column **Proto** marks what
exists in the sample-data prototype under `src/app/(app)`.

---

## 1. Shell and navigation

| # | Feature | P | Proto |
|---|---|---|---|
| 1.1 | Sidebar navigation grouped: Today, People, Stock, Queues, Assist, Ops | 1 | yes |
| 1.2 | Live queue badges in the nav — approvals, confirms, merge reviews | 1 | yes |
| 1.3 | Top bar with global search across contacts, properties and listings | 1 | yes |
| 1.4 | Command palette on Ctrl+K | 3 | yes |
| 1.5 | User menu, agency name, sign out | 1 | yes |
| 1.6 | Light and dark theme | 1 | yes |
| 1.7 | Agency switcher | — | never (D1, single office) |
| 1.8 | Sign-in screen (fake credentials in the prototype) | 1 | yes |

## 2. Today (dashboard)

| # | Feature | P | Proto |
|---|---|---|---|
| 2.1 | Follow-ups due today, sorted by how overdue they are | 1 | yes |
| 2.2 | Queue counters with direct links | 1 | yes |
| 2.3 | New enquiries not yet actioned, by channel | 1 | yes |
| 2.4 | Recent interaction feed across every channel | 1 | yes |
| 2.5 | AI spend today and month to date | 2 | yes |
| 2.6 | Upcoming inspections and appointments | 2 | yes |
| 2.7 | Listings needing attention — stale, no photos, price unset | 2 | yes |
| 2.8 | Overnight daily brief | 3 | later |

## 3. Contacts

| # | Feature | P | Proto |
|---|---|---|---|
| 3.1 | Contact list, sortable and dense | 1 | yes |
| 3.2 | Filters: role, intent, budget band, suburb, owner, last outcome, consent state | 1 | yes |
| 3.3 | Saved views — "hot buyers", "no contact in 30 days" | 2 | yes |
| 3.4 | Bulk select into a campaign | 2 | later |
| 3.5 | Contact detail: identity header, channels, roles, owner, do-not-contact flag | 1 | yes |
| 3.6 | AI rolling brief with intent panel — type, budget, timeline, blockers, sentiment, confidence | 1 | yes |
| 3.7 | Preferences panel: structured wants plus free-text soft requirements | 1 | yes |
| 3.8 | Interaction timeline, every channel, linking to the original message | 1 | yes |
| 3.9 | Consent panel showing provenance per channel: form, exact wording, IP, timestamp | 1 | yes |
| 3.10 | Matched properties for this person, each with its one-line reason | 2 | yes |
| 3.11 | Tasks attached to the contact | 3 | yes |
| 3.12 | Log an interaction manually — the manual adapter | 1 | yes |
| 3.13 | Create and edit a contact | 1 | yes |
| 3.14 | Record a follow-up outcome — the field the day is prioritised by | 1 | yes |
| 3.15 | Privacy request: tombstone a contact, cascading through the log | 1 | later |

## 4. Properties and listings

| # | Feature | P | Proto |
|---|---|---|---|
| 4.1 | Property list — the stock, whether or not it is advertised | 2 | yes |
| 4.2 | Property detail: structured address, attributes, features, condition | 2 | yes |
| 4.3 | Owner link through to the contact record | 2 | yes |
| 4.4 | Internal notes and price expectation, visibly marked internal only | 2 | yes |
| 4.5 | Listing history for a property — sold 2019, leased 2022, live now | 2 | yes |
| 4.6 | Listings board by status: draft, live, under offer, sold, leased, withdrawn | 2 | yes |
| 4.7 | Listing editor — public headline and copy, separate from internal notes | 2 | yes |
| 4.8 | Price display authored as text, with the under-quoting warning beside it | 2 | yes |
| 4.9 | Hidden search minimum and maximum that drive filters only | 2 | yes |
| 4.10 | Media manager — photo order, floorplan, alt text | 2 | later |
| 4.11 | Publish, withdraw, mark sold, with the website revalidation indicator | 2B | yes |
| 4.12 | Inspections and open homes, with registrations | 2B | yes |
| 4.13 | Matched contacts for this listing, leading into a campaign | 2 | yes |

## 5. Matching and campaigns

| # | Feature | P | Proto |
|---|---|---|---|
| 5.1 | Match explorer, property to contacts | 2 | yes |
| 5.2 | Match explorer, contact to properties | 2 | yes |
| 5.3 | The one-sentence reason on every match — never a bare score | 2 | yes |
| 5.4 | Stage breakdown: what filters cut, what similarity added, what the model ranked | 2 | yes |
| 5.5 | Campaign builder — pick matches, generate personalised drafts, send to approval | 2 | yes |

## 6. Approval queue — the single outbound door

| # | Feature | P | Proto |
|---|---|---|---|
| 6.1 | Pending items by kind: email, SMS, social, article, proposal, digest | 2 | yes |
| 6.2 | Review pane with the draft editable in place before approval | 2 | yes |
| 6.3 | Consent state shown at review time, per channel | 2 | yes |
| 6.4 | Approve, reject with a reason, or edit then approve | 2 | yes |
| 6.5 | Blocked items with the reason — consent lapsed between draft and send | 2 | yes |
| 6.6 | Batch approve for campaign digests | 2 | later |
| 6.7 | Sent history and audit trail | 2 | yes |
| 6.8 | No bulk send without review, and no setting that adds one | — | n/a |

## 7. Confirm queue — AI proposals

| # | Feature | P | Proto |
|---|---|---|---|
| 7.1 | Proposed tasks extracted from interactions and voice notes | 1 | yes |
| 7.2 | Proposed preference changes shown as before and after | 1 | yes |
| 7.3 | Proposed intent corrections | 1 | yes |
| 7.4 | The source interaction shown beside every proposal | 1 | yes |
| 7.5 | Accept, edit then accept, or discard | 1 | yes |
| 7.6 | Merge review — two possible duplicates, resolved by a human | 1 | yes |

## 8. Assistant surfaces

| # | Feature | P | Proto |
|---|---|---|---|
| 8.1 | Compliance advisor — ask, and get an answer with the section cited | 4 | yes |
| 8.2 | Jurisdiction selector, South Australia only at launch | 4 | yes |
| 8.3 | The explicit "nothing relevant found" state | 4 | yes |
| 8.4 | Citation cards linking instrument, section and version date | 4 | yes |
| 8.5 | Corpus browser with version date and last re-crawl per instrument | 4 | later |
| 8.6 | Proposal generator — property, comparables, output into approval | 4 | yes |
| 8.7 | Blog and social drafts into approval | 5 | yes |
| 8.8 | SEO change sets shown as a reviewable diff | 5 | yes |

## 9. Tasks, calendar and voice

| # | Feature | P | Proto |
|---|---|---|---|
| 9.1 | Task list by due date, linked to contacts | 3 | yes |
| 9.2 | Calendar with two-way sync state per event | 3 | yes |
| 9.3 | Voice note recorder, transcript, extracted tasks | 3 | yes |
| 9.4 | Alarms and reminders | 3 | later |

## 10. Operations

| # | Feature | P | Proto |
|---|---|---|---|
| 10.1 | AI cost dashboard — spend by day, task and model | 2 | yes |
| 10.2 | Token counts and latency per task type | 2 | yes |
| 10.3 | Cost attributed to the record that caused it | 2 | yes |
| 10.4 | Job queue health: pending, failed, dead letter, with retry | 1 | yes |
| 10.5 | Audit log — who approved, edited, merged, published | 2 | yes |
| 10.6 | Channel adapter status and last received time | 1 | yes |

## 11. Settings

| # | Feature | P | Proto |
|---|---|---|---|
| 11.1 | Agency profile, licence number, jurisdiction | 1 | yes |
| 11.2 | Consent wording templates per form | 1 | yes |
| 11.3 | State disclosure configuration — SA at launch, never hardcoded | 1 | yes |
| 11.4 | Brand voice for the content engine | 5 | later |
| 11.5 | Users and roles | — | deferred (D1) |
| 11.6 | Model selection and spend caps per task type | 2 | later |

---

## Counts

- **87 features** across 11 areas.
- **75 built** in the prototype with sample data.
- **9 still later** — overnight daily brief (2.8), bulk select into a campaign (3.4),
  privacy tombstone (3.15), media manager (4.10), batch approve (6.6), corpus browser
  (8.5), alarms (9.4), brand voice config (11.4), model spend caps (11.6).
- **3 never, deferred, or not-a-feature** — agency switcher and users/roles are
  both deferred by D1; "no bulk send without review" is the deliberate *absence* of a
  feature.

Screenshots of every screen in both themes: `docs/screenshots/`.

## What the prototype deliberately is not

No database, no authentication, no server actions, no AI calls. Every figure on screen
comes from `src/lib/sample-data.ts`. Controls that would mutate state are inert and
labelled as such.

This inverts §13's "schema first" convention on purpose: the prototype exists so the
shape of the product can be argued about before the schema is committed to. The screens
get rebuilt against real tables in Phase 1 — the layout survives, the data layer does not.
