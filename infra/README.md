# Infrastructure

Account **606196119385**, region **ap-southeast-2**. Everything below was created
by the commands in this directory, not by hand in the console.

| Resource | Identifier |
|---|---|
| App instance | `i-0f9f0d36dcf57fbaa` — `t4g.small`, Ubuntu 24.04 arm64, 30GB encrypted |
| Elastic IP | `13.210.78.88` — static, so DNS survives a stop/start |
| Database | `ozirealty-db` — RDS PostgreSQL **18.6**, `db.t4g.micro`, 20GB gp3, encrypted, private |
| pgvector | **0.8.2**, installed — the vector columns and HNSW indexes are real |
| Backups | `s3://ozirealty-backups-606196119385/pg/` — private, encrypted, versioned, 30 days |
| Instance role | `ozirealty-instance` — that S3 prefix and Titan embeddings, nothing else |
| Budget | `ozirealty-monthly` — USD 100, alerts at 80% actual / 100% forecast |

## Security posture

- The database is **not publicly accessible** and its security group allows 5432
  from the app security group only — no CIDR, no internet.
- TLS to the database is **required** (`sslmode=require`). RDS refuses an
  unencrypted connection outright; `psql` negotiates it silently, the driver
  does not, which is worth knowing because the failure looks like a bad password.
- SSH is restricted to one address at the security group, and again at UFW.
- Redis binds to loopback and holds job payloads containing contact data; it has
  no authentication, so it must never be reachable off the box.
- `/etc/ozirealty/env` is `root:ozirealty 640`. It holds the database URL and
  `SECRETS_KEY`, which decrypts every credential stored in Settings.

## Scripts

| | |
|---|---|
| `provision.sh` | One-time host setup. §2 rules out Docker, so this script IS the reproducibility mechanism — it must stay idempotent and complete. |
| `deploy.sh` | Package source, build **on the instance**, install the standalone bundle, restart. |
| `backup.sh` | `pg_dump` to S3, run nightly by `ozirealty-backup.timer` at 01:00 Adelaide. |

## Restoring

RDS automated snapshots (7 days, PITR) cover "the instance died". The S3 dumps
cover what snapshots cannot: logical damage — a bad migration, a mistaken
DELETE. Restore into a **scratch database**, never over production:

```bash
aws s3 cp s3://ozirealty-backups-606196119385/pg/<key>.dump /tmp/r.dump --region ap-southeast-2
psql -h <host> -U ozirealty -d postgres -c 'create database restore_test;'
pg_restore -h <host> -U ozirealty -d restore_test --no-owner --no-privileges /tmp/r.dump
```

This has been performed, not merely written down: the 2026-08-26 dump restored
to 40 tables with the tenant, 24 suburbs, consent templates and both vector
columns intact. An untested backup is not a backup.

## Still required before anyone can use it

1. **DNS** — `crm.ozirealty.com.au` must become an **A record to 13.210.78.88**.
   It currently CNAMEs to the old CloudFront distribution serving the static
   prototype. Caddy obtains the certificate automatically once DNS resolves here.
2. **Google OAuth** — `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` in
   `/etc/ozirealty/env`. Without them the login page says "no sign-in method
   configured" and refuses everyone, which is the correct fail-closed behaviour
   and also means nobody can get in.
