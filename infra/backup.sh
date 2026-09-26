#!/usr/bin/env bash
#
# Nightly logical backup to S3 (B6.4).
#
# RDS already takes automated snapshots with point-in-time recovery, and those
# are the first line for "the instance died". This is the SECOND line, for the
# failure RDS snapshots cannot help with: logical damage. A bad migration, a
# mistaken DELETE, a corrupted import — PITR can rewind to a moment, but a
# pg_dump is portable, inspectable, and restorable into a scratch database on
# any box without touching production.
#
# Installed by deploy.sh to /usr/local/lib/ozirealty/backup.sh, run nightly by
# ozirealty-backup.timer (units in this directory). Run by hand with:
#   sudo systemctl start ozirealty-backup.service && tail /var/log/ozirealty/backup.log
set -euo pipefail

BUCKET="${BACKUP_BUCKET:-ozirealty-backups-606196119385}"
REGION="${AWS_REGION:-ap-southeast-2}"
STAMP="$(date -u +%Y/%m/%d/%H%M%SZ)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

: "${DATABASE_URL:?DATABASE_URL is not set}"

DUMP="$TMP/ozirealty-$(date -u +%Y%m%dT%H%M%SZ).dump"

# Custom format: compressed, and restorable table-by-table with pg_restore,
# which is what you actually want at 2am when one table is wrong.
pg_dump --format=custom --no-owner --no-privileges --file="$DUMP" "$DATABASE_URL"

SIZE=$(stat -c%s "$DUMP")
# A dump that is suspiciously small is a failure that succeeded. 50KB is far
# below any real database here and far above an empty file.
if [ "$SIZE" -lt 51200 ]; then
  echo "backup refused: dump is only ${SIZE} bytes, which cannot be a full database" >&2
  exit 1
fi

aws s3 cp "$DUMP" "s3://$BUCKET/pg/$STAMP.dump" --region "$REGION" --only-show-errors
echo "backed up $(numfmt --to=iec "$SIZE") to s3://$BUCKET/pg/$STAMP.dump"
