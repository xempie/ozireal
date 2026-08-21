# AWS cost — target shape and the traps

Written 18 August 2026, before anything is provisioned, because the expensive decisions
are all made at provisioning time and are annoying to unwind afterwards.

All figures are **USD per month, ap-southeast-2 (Sydney), on-demand unless stated**, and
are order-of-magnitude estimates to sanity-check the design — not a quote. Confirm the
exact numbers in the AWS Pricing Calculator before committing, and re-check after the
first full month of real usage.

---

## The headline

At one office and one user, the baseline bill is small either way — roughly **$30–55/mo**.
The thing that actually blows up an AWS bill at this scale is not the baseline, it is a
**single line item nobody meant to create**. A NAT Gateway alone costs more per month than
the entire recommended architecture.

So this document is in two halves: pick the cheap shape, then avoid the traps.

---

## Two shapes

### Option A — one instance runs everything  *(recommended)*

Postgres, Redis, the Next.js server and the background worker all on one EC2 box.

| Item | Spec | Est. $/mo |
|---|---|---|
| EC2 | `t4g.medium` (2 vCPU, 4 GB, Graviton), 1-year Compute Savings Plan, no upfront | ~22 |
| EBS | 40 GB `gp3` | ~4 |
| Public IPv4 | 1 address | ~3.65 |
| S3 | media, voice notes, PDFs, backups — say 20 GB with lifecycle rules | ~1 |
| CloudFront | inside the always-free tier at this traffic | 0 |
| Route 53 | 1 hosted zone | 0.50 |
| SES | inbound + outbound at agency volume | <1 |
| **Total** | | **~$32** |

### Option B — the managed baseline (what §2 currently says)

RDS for Postgres and ElastiCache for Redis, as separately managed services.

| Item | Spec | Est. $/mo |
|---|---|---|
| EC2 | `t4g.small`, Savings Plan | ~11 |
| RDS | `db.t4g.micro` single-AZ + 20 GB `gp3` + backup storage | ~23 |
| ElastiCache | `cache.t4g.micro` | ~13 |
| EBS | 20 GB `gp3` | ~2 |
| Public IPv4, S3, CloudFront, Route 53, SES | as above | ~5 |
| **Total** | | **~$54** |

**Option A saves roughly $260/year.** That is real but not transformative — the stronger
arguments for A are that it is simpler to reason about and that §11's provisioning script
already has to install and configure everything anyway.

### What Option A gives up, honestly

| Lost | Consequence | Mitigation |
|---|---|---|
| Managed backups and point-in-time recovery | A failure could cost up to a day of data | **Ship WAL archiving to S3** (`pgBackRest` or `wal-g`) alongside the nightly dump. This restores point-in-time recovery on self-managed Postgres for the price of S3 storage — a few dollars a month. Do not skip it: `interactions` and `consents` are legal evidence, and "we lost Tuesday" is not an acceptable answer about a consent record. |
| Automatic failover | The box going down means the platform is down | At one user, an hour of downtime is survivable. Say so out loud rather than pretending otherwise. Uptime monitoring must be **external** (see traps). |
| Managed minor-version upgrades | Someone has to patch Postgres | Unattended security upgrades, and Postgres minor versions as a deliberate quarterly task recorded in `provision.sh`. |
| Resource contention | A heavy AI job and a page render compete for the same 4 GB | Keep the worker's concurrency low and watch memory. If contention shows up, the fix is a bigger instance long before it is a second service. |

### Why this is a cheap decision to reverse

Drizzle talks to Postgres over a connection string. Moving to RDS later is a dump, a
restore and one environment variable — a couple of hours, not a re-architecture. That
asymmetry is the actual argument: start cheap, and buy the managed service when the
business is paying for something that justifies it.

---

## The traps — where AWS bills actually go wrong

Ranked by how much they cost and how easily they happen by accident.

**1. NAT Gateway — about $43/mo, plus $0.059 per GB processed.**
Created without thinking whenever an instance goes in a private subnet and still needs
outbound internet (which ours does — Anthropic, Voyage, Deepgram, MessageMedia are all
external API calls). It would cost more than the entire recommended stack.
→ **Put the instance in a public subnet with a tight security group.** SSH stays closed
publicly (Tailscale, per §11); only 80/443 are open. There is no NAT Gateway in this
architecture and there should never be one. If a diagram or a Terraform module introduces
one, that is a bug.

**2. Multi-AZ RDS — roughly doubles the database line.**
The default in several setup wizards. Not needed at one office. (Moot under Option A.)

**3. An oversized or non-Graviton instance.**
`t4g` (ARM/Graviton) is meaningfully cheaper than `t3` for the same specs and Node and
Postgres both run fine on ARM. A 1-year Compute Savings Plan takes roughly another
quarter off, and is worth committing to once the shape is stable — not on day one.
→ **Build the Next.js bundle in CI or locally and deploy the artefact**, rather than
running `next build` on the server. Builds are the memory-hungry part; keeping them off
the box is what lets a 4 GB instance stay comfortable.

**4. Public IPv4 addresses — $3.65/mo each, since 2024.**
Small, but they accumulate: an unattached Elastic IP is billed at the same rate for doing
nothing. Audit for unattached addresses before they become permanent.

**5. CloudWatch Logs with no retention policy.**
Ingestion is charged and default retention is *forever*. The plan uses Sentry for errors,
so CloudWatch Logs should barely be used — but any log group that does get created needs
a retention period set on creation (7–30 days).

**6. S3 growth with no lifecycle rules.**
Listing photography and voice notes only ever accumulate. Set lifecycle rules from the
start:
- Nightly database dumps: keep 30 days in Standard, then Glacier Instant Retrieval, expire
  at 12 months.
- Voice notes: Standard for 90 days, then Standard-IA. They are almost never re-read after
  transcription.
- Listing media: leave in Standard — it is served to the public site and is small.

**7. A staging environment left running 24/7.**
If one is added later, stop it outside working hours. A second always-on instance doubles
the compute line for something used a few hours a week.

**8. Data transfer out of EC2 to the internet.**
Largely avoided by putting CloudFront in front of the public site: origin fetches from EC2
to CloudFront are not charged as internet egress, and CloudFront's always-free tier covers
an agency site's traffic comfortably. **CloudFront reduces this bill; it is not a luxury.**

---

## What is deliberately still paid for

Not everything cheap is worth it.

- **CloudFront** — free at this traffic and it lowers the EC2 transfer bill. Keep.
- **S3 for media** — do not serve listing photos off the instance's disk. The storage cost
  is cents and it keeps the box stateless enough to rebuild.
- **Route 53** — 50c/month. Not worth moving DNS elsewhere to save it.
- **Nightly dumps *and* WAL archiving** — both. This is the one place to spend rather than
  save, because it is the difference between an outage and a data loss.

---

## The cost that will actually dominate

At one user, AWS is roughly **$30–55/month**. The per-use vendors are the ones that scale
with the business:

| Vendor | What drives it |
|---|---|
| Anthropic (Claude) | Every brief, draft, match explanation, compliance answer |
| Voyage | Embeddings — mostly a one-off at ingest, then per new listing/preference |
| Deepgram | Per minute of voice note |
| MessageMedia | Per SMS |

This is exactly why §3.7 makes per-generation cost logging a launch requirement rather
than a later addition, and why §9's patterns are cost controls and not micro-optimisations:

- **Haiku for classification, extraction and reranking; Sonnet only for briefs, drafts,
  proposals and compliance answers.** Most calls by volume are the cheap kind.
- **Prompt caching** on the stable prefixes — legal corpus, brand voice, agency config.
- **Batch API** for anything not time-sensitive (nightly re-summarisation, the fortnightly
  SEO cycle, bulk briefs) at roughly half price.
- **Pinned answers for the ten most common compliance questions**, skipping retrieval
  entirely.

Budget these properly once there is a month of real `ai_generations` data. Estimating them
before launch is guesswork.

---

## Actions

- [ ] **Decision needed:** collapse Postgres and Redis onto the instance (Option A). This
      contradicts §2's "RDS" line, so it needs explicit sign-off under §15.
- [ ] Redis on-instance regardless — §2 already permits it, so this needs no decision.
- [ ] `provision.sh` installs Postgres 16 + pgvector, Redis, `pgBackRest` with WAL
      archiving to S3, and sets S3 lifecycle rules.
- [ ] Public subnet, tight security group, **no NAT Gateway**, ever.
- [ ] `t4g` instance family. Build artefacts off-box.
- [ ] External uptime monitoring — a monitor running on the box cannot report that the box
      is down. Uptime Kuma self-hosted on the same instance is worse than useless for
      this; use an external free-tier monitor, or host Kuma somewhere else.
- [ ] Set a **Billing Budget with an alert** on day one, before the first resource is
      created. The cheapest possible mistake is the one you hear about in week one.
- [ ] Revisit after one full month of real usage.
