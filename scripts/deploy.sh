#!/usr/bin/env bash
#
# Deploy the console prototype to S3 + CloudFront.
#
#   ./scripts/deploy.sh
#
# Requires an `ozirealty` AWS profile with S3 + CloudFront permissions. Safe to run
# repeatedly: it rebuilds, syncs, and invalidates the edge cache.
#
# The prototype is a static export, so there is no server to restart and nothing to
# migrate. Phase 1 replaces this entirely - Server Actions need a running Node process.

set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-ozirealty}"
BUCKET="ozirealty-console-310792823958"
REGION="ap-southeast-2"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DIST_ID="$(cat infra/.dist-id)"

echo "==> building static export"
# A running dev server rewrites .next underneath the build and silently produces an
# export containing only the 404 page. Clean first; it costs seconds.
rm -rf .next out
pnpm build >/dev/null

PAGES=$(find out -name '*.html' | wc -l)
if [ "$PAGES" -lt 20 ]; then
  echo "ERROR: only $PAGES HTML pages exported - expected ~49." >&2
  echo "A dev server is probably running and fighting the build for .next." >&2
  exit 1
fi
echo "    $PAGES pages"

echo "==> uploading hashed assets (immutable, one year)"
aws s3 sync out/ "s3://$BUCKET/" --delete \
  --exclude "*.html" --exclude "*.txt" \
  --cache-control "public,max-age=31536000,immutable" --only-show-errors

echo "==> uploading HTML (must-revalidate, so a redeploy shows immediately)"
aws s3 sync out/ "s3://$BUCKET/" \
  --exclude "*" --include "*.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public,max-age=0,must-revalidate" --only-show-errors

echo "==> invalidating the edge cache"
INV=$(aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*' \
  --query 'Invalidation.Id' --output text)
aws cloudfront wait invalidation-completed --distribution-id "$DIST_ID" --id "$INV"

SITE="https://crm.ozirealty.com.au"
echo "==> deployed: $SITE"

# Smoke test. The site is public, so a 200 on the home page proves the origin and
# certificate are fine - and a 200 on a SUB-PATH proves the directory-index rewrite
# is still attached. Without that function every route except "/" returns 404, which
# is the failure most likely to slip out unnoticed.
for path in "/" "/dashboard/" "/contacts/c1/"; do
  CODE=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$SITE$path")
  if [ "$CODE" != "200" ]; then
    echo "ERROR: $path returned $CODE, expected 200." >&2
    [ "$path" != "/" ] && echo "The directory-index rewrite function may have fallen off." >&2
    exit 1
  fi
done
echo "    home, a sub-path and a detail page all return 200"
