#!/usr/bin/env bash
# Apply migrations with psql rather than drizzle-kit.
#
# drizzle-kit splits SQL on ";" and does not understand dollar-quoted bodies, so it
# hangs on any migration containing a PL/pgSQL function or a DO block - which every
# one of our integrity guards needs. psql parses them correctly. We then record each
# file in drizzle's own journal table (sha256 of the contents, matching its format) so
# `drizzle-kit generate` still diffs correctly against the schema.
set -euo pipefail
PSQL="${PSQL:-/c/Program Files/PostgreSQL/18/bin/psql.exe}"
HOST=${PGHOST:-127.0.0.1}; PORT=${PGPORT:-5433}
USER=${PGUSER:-ozirealty}; DB=${PGDATABASE:-ozirealty}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

q() { "$PSQL" -w -U "$USER" -h "$HOST" -p "$PORT" -d "$DB" -tAc "$1"; }

q "create schema if not exists drizzle;" >/dev/null
q "create table if not exists drizzle.__drizzle_migrations (
     id serial primary key, hash text not null, created_at bigint);" >/dev/null

applied=0; skipped=0
for f in "$ROOT"/drizzle/*.sql; do
  name=$(basename "$f")
  hash=$(sha256sum "$f" | cut -d' ' -f1)
  if [ "$(q "select count(*) from drizzle.__drizzle_migrations where hash='$hash';")" != "0" ]; then
    printf "  skip   %s\n" "$name"; skipped=$((skipped+1)); continue
  fi
  # ON_ERROR_STOP so a failure is loud, not a silent partial apply.
  if "$PSQL" -w -U "$USER" -h "$HOST" -p "$PORT" -d "$DB" \
       -v ON_ERROR_STOP=1 -q -f "$f" > /tmp/mig.log 2>&1; then
    q "insert into drizzle.__drizzle_migrations (hash, created_at)
       values ('$hash', $(date +%s)000);" >/dev/null
    printf "  apply  %s\n" "$name"; applied=$((applied+1))
  else
    printf "  FAIL   %s\n" "$name"; grep -iE "^psql:|ERROR" /tmp/mig.log | head -4 | sed 's/^/         /'
    exit 1
  fi
done
printf "\n%d applied, %d already present\n" "$applied" "$skipped"
