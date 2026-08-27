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
# Ship SOURCE, not a build: node_modules, .next and .git are excluded, and the
# instance installs and builds. Keeps the transfer small and the build honest.
cd "$ROOT"
tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=.tools \
    --exclude=.batches --exclude='infra/*.pem' --exclude='infra/.*' \
    --exclude=docs/screenshots \
    -czf /tmp/ozirealty-src.tgz .
ls -lh /tmp/ozirealty-src.tgz | awk '{print "  " $5}'

log "Uploading"
scp -i "$KEY" -o StrictHostKeyChecking=no /tmp/ozirealty-src.tgz ubuntu@"$IP":/tmp/

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
# STANDALONE=1 is what next.config.ts gates the standalone output behind.
STANDALONE=1 pnpm build
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
# Installed into a CLEAN directory first. npm cannot reconcile the standalone
# bundle's hand-built node_modules and dies on it, so it never sees that tree.
rm -rf /tmp/deps && mkdir -p /tmp/deps
cp /tmp/build/package.json /tmp/deps/
(cd /tmp/deps && npm install --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null 2>&1)
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
REMOTE

log "Restarting"
$SSH 'sudo systemctl daemon-reload && sudo systemctl enable --now ozirealty-web ozirealty-worker && sleep 4 && systemctl is-active ozirealty-web ozirealty-worker'

log "Health"
$SSH 'curl -s -o /dev/null -w "local app: %{http_code}\n" http://127.0.0.1:3000/login --max-time 15'
echo
