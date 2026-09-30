#!/usr/bin/env bash
#
# Build locally, ship the standalone bundle, restart the units (B6).
#
#   bash infra/deploy.sh
#
# Next's `output: "standalone"` produces a self-contained server.js plus only the
# node_modules it actually needs — roughly 40MB instead of 700MB. It builds via
# symlinks, which Windows refuses without developer mode, so the build runs on
# the INSTANCE rather than here. That is also the honest arrangement: the thing
# that runs in production was built on the platform it runs on.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
IP="$(cat "$HERE/.public-ip")"
KEY="$HERE/ozirealty.pem"
APP_DIR=/srv/ozirealty
SSH="ssh -i $KEY -o StrictHostKeyChecking=no ubuntu@$IP"

log() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

log "Packaging source"
# .env* is excluded deliberately. It used to ship, so the developer's .env.local
# -- a DATABASE_URL pointing at 127.0.0.1:5433, plus AUTH_SECRET and SECRETS_KEY --
# was unpacked on the production instance. Nothing copied it into the app directory
# so the running server was unaffected, but the BUILD read it, which is why the first
# statically generated public page failed to prerender: it tried to reach a Postgres
# on a laptop. Production credentials come from /etc/ozirealty/env and nowhere else.
#
# Ship SOURCE, not a build: node_modules, .next and .git are excluded, and the
# instance installs and builds. Keeps the transfer small and the build honest.
cd "$ROOT"
tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=.tools \
    --exclude=.batches --exclude='infra/*.pem' --exclude='infra/.*' \
    --exclude=docs/screenshots --exclude='.env' --exclude='.env.*' --exclude=.pgdata --exclude='.pgdata.log' --exclude=out \
    -czf /tmp/ozirealty-src.tgz .
ls -lh /tmp/ozirealty-src.tgz | awk '{print "  " $5}'

log "Uploading"
scp -i "$KEY" -o StrictHostKeyChecking=no /tmp/ozirealty-src.tgz ubuntu@"$IP":/tmp/

log "Applying database migrations"
# Deploys used to ship code without its migrations, which relied on someone running
# them by hand. 0013 was missed for weeks: the Settings page and every AI call selected
# a column production did not have. Same rules as scripts/db-apply.sh: each file once,
# recorded by sha256 in drizzle.__drizzle_migrations, each in ONE transaction with
# ON_ERROR_STOP. This runs BEFORE the services stop, so a failed migration aborts the
# deploy with the old version still serving.
#
# And BEFORE the build: the build pre-renders public pages from the database, so a
# page reading a new column fails to build unless the column already exists. Every
# migration here is additive and backward compatible, so the running version is
# unaffected if the build then fails.
$SSH bash -s <<'REMOTE'
set -euo pipefail
rm -rf /tmp/migrate && mkdir -p /tmp/migrate
tar -xzf /tmp/ozirealty-src.tgz -C /tmp/migrate ./drizzle
sudo bash -c '
  set -euo pipefail
  set -a; . /etc/ozirealty/env; set +a
  q() { psql "$DATABASE_URL" -tAc "$1"; }
  applied=0
  for f in /tmp/migrate/drizzle/*.sql; do
    h=$(sha256sum "$f" | cut -d" " -f1)
    if [ "$(q "select count(*) from drizzle.__drizzle_migrations where hash = '"'"'$h'"'"'")" != "0" ]; then
      continue
    fi
    echo "  apply  $(basename "$f")"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -q -f "$f"
    q "insert into drizzle.__drizzle_migrations (hash, created_at) values ('"'"'$h'"'"', extract(epoch from now())::bigint*1000)" >/dev/null
    applied=$((applied+1))
  done
  echo "  $applied applied"
'
REMOTE

log "Building on the instance"
$SSH bash -s <<'REMOTE'
set -euo pipefail
sudo rm -rf /tmp/build && mkdir -p /tmp/build
tar -xzf /tmp/ozirealty-src.tgz -C /tmp/build
cd /tmp/build
# COREPACK_ENABLE_DOWNLOAD_PROMPT: corepack otherwise stops to ask before
# fetching the pinned pnpm, which hangs a non-interactive deploy forever.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile --silent
# The public website is statically generated, so the BUILD now reads the database:
# it is prerendering real listings into HTML, which is the point of ISR. The console
# never needed this because every console route is force-dynamic.
#
# Next loads .env.production during a production build, so the runtime env is handed
# over under that name rather than exported into the shell, where it would leak into
# every subprocess. It is shredded immediately afterwards.
sudo cat /etc/ozirealty/env > /tmp/build/.env.production
chmod 600 /tmp/build/.env.production

# STANDALONE=1 is what next.config.ts gates the standalone output behind.
STANDALONE=1 pnpm build
shred -u /tmp/build/.env.production 2>/dev/null || rm -f /tmp/build/.env.production
REMOTE

log "Installing the build"
$SSH bash -s <<'REMOTE'
set -euo pipefail
APP_DIR=/srv/ozirealty
sudo systemctl stop ozirealty-web ozirealty-worker 2>/dev/null || true
# `rm -rf "$APP_DIR"/*` does NOT match .next — a glob skips dotfiles — so every
# previous deploy survived underneath the new one. Stale chunks accumulated and
# the nested static/static from an earlier bug kept coming back after it was
# supposedly fixed. Delete the contents including hidden entries.
sudo find "$APP_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
# The standalone bundle plus the two directories Next does not copy into it.
sudo cp -r /tmp/build/.next/standalone/. "$APP_DIR"/
# Trailing "/." again, and for the same reason src needed it: the standalone
# bundle already contains .next/static, so `cp -r a b` nests as b/a. That put
# every chunk at .next/static/static/chunks/, which 404s — the pages still
# server-render, so the site LOOKS fine until a client component tries to
# hydrate and the browser reports a MIME-type refusal instead of a missing file.
sudo mkdir -p "$APP_DIR"/.next/static
sudo cp -r /tmp/build/.next/static/. "$APP_DIR"/.next/static/
# systemd ProtectSystem=strict + ReadWritePaths refuses to start the unit if the
# path does not exist, so this must be created BEFORE the service is enabled.
sudo mkdir -p "$APP_DIR"/.next/cache
sudo mkdir -p "$APP_DIR"/public
sudo cp -r /tmp/build/public/. "$APP_DIR"/public/ 2>/dev/null || true
# The worker and the CLI scripts run from SOURCE through tsx, so the tree has to
# be there. Note the trailing "/." on src: the standalone bundle already creates
# its own src/, and `cp -r a b` where b exists nests it as b/a — which quietly
# produced src/src and a worker resolving half its imports from the wrong copy.
sudo mkdir -p "$APP_DIR"/src
sudo cp -r /tmp/build/src/. "$APP_DIR"/src/
sudo mkdir -p "$APP_DIR"/prompts "$APP_DIR"/drizzle "$APP_DIR"/scripts
sudo cp -r /tmp/build/prompts/. "$APP_DIR"/prompts/
sudo cp -r /tmp/build/drizzle/. "$APP_DIR"/drizzle/
sudo cp -r /tmp/build/scripts/. "$APP_DIR"/scripts/
sudo cp /tmp/build/package.json /tmp/build/tsconfig.json "$APP_DIR"/ 2>/dev/null || true
# tsx is installed globally by provision.sh. Fail loudly if it is missing rather
# than leaving the worker to crash-loop on a module that was never there.
command -v tsx >/dev/null || { echo "tsx is not installed; re-run provision.sh"; exit 1; }

# The WORKER runs from source, so it needs real packages on disk. Next's
# standalone bundle only traces what the compiled app imports and inlines the
# rest, so drizzle-orm and friends are absent from it. Installing production
# dependencies here gives the worker a normal node_modules; the web server keeps
# resolving its own bundled copies first and is unaffected.
# Installed into a CLEAN directory first, so the resolver never sees the
# standalone bundle's hand-built node_modules and try to reconcile it.
#
# pnpm, not npm, and the lockfile goes with the package.json. This step used to be
# `npm install --omit=dev` against package.json alone, which made npm resolve the
# whole tree from scratch every deploy. On 8 Sep 2026 that crashed outright with
# "Cannot read properties of null (reading 'edgesOut')", an arborist bug, and
# because the command ended in `>/dev/null 2>&1` the deploy reported nothing and
# failed twenty lines later on the drizzle-orm assertion with no clue why. The web
# service was already stopped by then, so the site stayed down until it was
# started by hand.
#
# Two things fixed. This is a pnpm project — packageManager pins pnpm@9.15.9 and
# pnpm-lock.yaml is what the build a few lines up installed from — so resolving it
# with a different package manager and no lockfile was inviting exactly this. And
# output is no longer discarded: a failure here has to be legible.
#
# --node-linker=hoisted because pnpm's default layout is symlinks into a global
# store, and this tree gets copied to another directory. Hoisted gives real
# directories that survive the copy.
rm -rf /tmp/deps && mkdir -p /tmp/deps
cp /tmp/build/package.json /tmp/build/pnpm-lock.yaml /tmp/deps/
(cd /tmp/deps && pnpm install --prod --frozen-lockfile --node-linker=hoisted --ignore-scripts)
# Merged with -n: anything the standalone bundle already provides WINS, so the
# web server keeps the exact next/react it was traced against.
# `|| true`: the standalone bundle's entries are symlinks, so cp reports
# "cannot overwrite non-directory" for each one and exits non-zero. That is the
# no-clobber working exactly as intended — the assertion below is what actually
# decides whether this step succeeded.
sudo cp -rn /tmp/deps/node_modules/. "$APP_DIR"/node_modules/ 2>/dev/null || true
sudo chown -R ozirealty:ozirealty "$APP_DIR"/node_modules
sudo test -d "$APP_DIR"/node_modules/drizzle-orm || { echo "worker dependencies missing"; exit 1; }
sudo chown -R ozirealty:ozirealty "$APP_DIR"

# The nightly backup, installed OUTSIDE $APP_DIR. It used to run from
# $APP_DIR/infra/backup.sh, which the wipe above deletes, so every backup after the
# first deploy failed with exit 127 and nobody saw it. Root-owned so the service user
# can run the script but not rewrite it.
sudo install -d -m 755 /usr/local/lib/ozirealty /var/log/ozirealty
sudo chown ozirealty:ozirealty /var/log/ozirealty
sudo install -m 755 -o root -g root /tmp/build/infra/backup.sh /usr/local/lib/ozirealty/backup.sh
sudo install -m 644 -o root -g root /tmp/build/infra/ozirealty-backup.service /etc/systemd/system/ozirealty-backup.service
sudo install -m 644 -o root -g root /tmp/build/infra/ozirealty-backup.timer /etc/systemd/system/ozirealty-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now ozirealty-backup.timer
REMOTE

log "Restarting"
$SSH 'sudo systemctl daemon-reload && sudo systemctl enable --now ozirealty-web ozirealty-worker && sleep 4 && systemctl is-active ozirealty-web ozirealty-worker'

log "Health"
$SSH 'curl -s -o /dev/null -w "local app: %{http_code}\n" http://127.0.0.1:3000/login --max-time 15'
echo
