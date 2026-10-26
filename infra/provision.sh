#!/usr/bin/env bash
#
# Provision the OziRealty application instance (B6.1).
#
# Ubuntu 24.04 arm64. Run once, as a user with sudo, on a fresh instance:
#
#   scp -i infra/ozirealty.pem infra/provision.sh ubuntu@<ip>:/tmp/
#   ssh -i infra/ozirealty.pem ubuntu@<ip> 'sudo bash /tmp/provision.sh'
#
# §2 rules out Docker, so THIS SCRIPT is the reproducibility mechanism: it has to
# be re-runnable and it has to be complete, because there is no image to fall back
# on. Every step is idempotent — running it twice must be safe, since the second
# run is usually a repair rather than a build.
#
# The database is NOT installed here. It is RDS (see CLAUDE.md §2), reachable only
# from this instance's security group.
set -euo pipefail

APP_USER=ozirealty
APP_DIR=/srv/ozirealty
ENV_FILE=/etc/ozirealty/env
NODE_MAJOR=22

log() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

log "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl ca-certificates gnupg git unzip ufw \
  redis-server \
  debian-keyring debian-archive-keyring apt-transport-https

log "PostgreSQL 18 client (PGDG)"
# The database is RDS PostgreSQL 18, and pg_dump refuses to dump a server newer than
# itself, so Ubuntu's own client (16) cannot take the nightly backup. The first box
# had the PGDG client installed by hand and this script still said 16; found while
# rebuilding in account 310792823958 (2026-10-03).
if [ ! -f /etc/apt/sources.list.d/pgdg.list ]; then
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
  echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
fi
apt-get install -y -qq postgresql-client-18
pg_dump --version

log "AWS CLI v2"
# backup.sh uploads the nightly dump with `aws s3 cp`. The first box had the CLI
# installed by hand; a box built from this script alone failed every backup with
# "aws: command not found" (found 2026-10-03 rebuilding in 310792823958).
if ! command -v aws >/dev/null; then
  arch="$(uname -m)"   # aarch64 on t4g, x86_64 elsewhere
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${arch}.zip" -o /tmp/awscliv2.zip
  unzip -q -o /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install --update
  rm -rf /tmp/aws /tmp/awscliv2.zip
fi
aws --version

log "Node ${NODE_MAJOR} + pnpm"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" != "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
corepack enable
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack prepare pnpm@9.15.9 --activate
node -v && pnpm -v

# tsx runs the worker's TypeScript. Installed GLOBALLY rather than copied out of
# the build tree: pnpm stores dependencies symlinked under .pnpm and hoists only
# direct ones, so copying tsx by hand drags in transitive packages that are not
# where a naive cp expects them. A global install owns its own dependency tree.
npm install -g tsx@4 >/dev/null 2>&1
tsx --version

log "Swap"
# The instance has ~1.8GB of RAM and, until 8 Sep 2026, no swap at all. deploy.sh runs
# `next build` on the box (Windows cannot create the symlinks standalone output needs),
# and that build is the memory-hungry part of the whole system. With nowhere to spill,
# the kernel OOM-killed its way through the build and left the instance wedged: running,
# system status ok, instance reachability failed. No SSH, no HTTP, and the only way back
# was a forced stop/start from the AWS API.
#
# 2GB of swap is not a substitute for a bigger box, and it is not meant to be. It is the
# difference between a slow build and an unreachable instance, which is the difference
# that matters at 1.8GB.
#
# swappiness 10 so the kernel still prefers RAM for the running services and reaches for
# swap mainly under the build's pressure.
if ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q "^/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
  echo "vm.swappiness=10" > /etc/sysctl.d/99-swap.conf
  sysctl -q -w vm.swappiness=10
fi

log "Redis"
# BullMQ's stated requirement: evicting a queue key under memory pressure loses
# jobs silently, and an error is always better than a silent loss.
sed -i 's/^# *maxmemory-policy .*/maxmemory-policy noeviction/' /etc/redis/redis.conf
grep -q '^maxmemory-policy noeviction' /etc/redis/redis.conf || echo 'maxmemory-policy noeviction' >> /etc/redis/redis.conf
# Bind to loopback only. Redis holds job payloads with contact data in them and
# has no authentication here; it must never be reachable off the box.
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
systemctl enable --now redis-server
systemctl restart redis-server
redis-cli ping

log "Caddy (automatic TLS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

log "Caddyfile"
# Written here rather than by hand: the first box's was hand-made, which is drift.
# Three hosts, one app (src/lib/host-routing.ts decides what each serves):
#   CRM_HOST   the console            SITE_HOST  the public website (canonical)
#   APEX_HOST  301 to SITE_HOST
# Caddy obtains each certificate on first request once that name's DNS points here;
# until then it retries in the background and the other hosts are unaffected.
CRM_HOST="${CRM_HOST:-crm.ozirealty.com.au}"
SITE_HOST="${SITE_HOST:-www.ozirealty.com.au}"
APEX_HOST="${APEX_HOST:-ozirealty.com.au}"
mkdir -p /var/log/caddy
cat > /etc/caddy/Caddyfile <<CADDYEOF
# OziRealty. Caddy terminates TLS (certificates obtained and renewed
# automatically) and proxies to the Next.js server on loopback, which is why
# port 3000 is never exposed by the firewall or the security group.
(app) {
	encode zstd gzip

	# The public intake endpoints are rate-limited per IP in the app, which reads
	# this header, so it must be the hop CADDY appended, never one the client sent.
	reverse_proxy 127.0.0.1:3000 {
		header_up X-Forwarded-For {remote_host}
		header_up X-Real-IP {remote_host}
	}

	header {
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}
}

${CRM_HOST} {
	import app
	header Strict-Transport-Security "max-age=31536000; includeSubDomains"
	log {
		output file /var/log/caddy/crm.log {
			roll_size 20mb
			roll_keep 7
		}
	}
}

# No includeSubDomains on the public host: the agency's other names (mail and
# whatever else the domain carries) are not ours to force onto HTTPS.
${SITE_HOST} {
	import app
	header Strict-Transport-Security "max-age=31536000"
	log {
		output file /var/log/caddy/www.log {
			roll_size 20mb
			roll_keep 7
		}
	}
}

${APEX_HOST} {
	redir https://${SITE_HOST}{uri} permanent
}
CADDYEOF
chown caddy:caddy /var/log/caddy 2>/dev/null || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy

log "Service user and directories"
# No login shell and no password: this account exists to own files and run two
# units. A shell on it is only ever useful to someone who should not have one.
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
# .next/cache must exist before the unit starts: ReadWritePaths on a missing
# path fails the mount namespace and the service never runs.
mkdir -p "$APP_DIR"/.next/cache /etc/ozirealty /var/log/ozirealty
chown -R "$APP_USER:$APP_USER" "$APP_DIR" /var/log/ozirealty

log "Environment file"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'ENVEOF'
# Filled in by deploy.sh / by hand. NEVER committed.
NODE_ENV=production
PORT=3000
DATABASE_URL=
AUTH_SECRET=
SECRETS_KEY=
AUTH_ALLOWED_EMAILS=
REDIS_URL=redis://127.0.0.1:6379
AWS_REGION=ap-southeast-2
ENVEOF
fi
# The env file holds the database URL and the key that decrypts every stored
# credential. It is readable by the service account and root, and by nobody else.
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

log "systemd units"
cat > /etc/systemd/system/ozirealty-web.service <<UNITEOF
[Unit]
Description=OziRealty web (Next.js)
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=always
RestartSec=5
StandardOutput=append:/var/log/ozirealty/web.log
StandardError=append:/var/log/ozirealty/web.log
# The web process reads and writes the database and nothing else on this disk.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/ozirealty ${APP_DIR}/.next/cache

[Install]
WantedBy=multi-user.target
UNITEOF

cat > /etc/systemd/system/ozirealty-worker.service <<UNITEOF
[Unit]
Description=OziRealty background worker (BullMQ)
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/tsx ${APP_DIR}/src/server/jobs/worker.ts
Restart=always
RestartSec=5
# Yields to the web process on a small instance: a slow brief rebuild is
# invisible, a slow page is not.
Nice=10
MemoryMax=512M
StandardOutput=append:/var/log/ozirealty/worker.log
StandardError=append:/var/log/ozirealty/worker.log
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/ozirealty

[Install]
WantedBy=multi-user.target
UNITEOF

systemctl daemon-reload

# The nightly backup (ozirealty-backup.service/.timer and backup.sh) is installed by
# deploy.sh, not here, because it ships with the repo and must be refreshed on every
# deploy. It lives in /usr/local/lib/ozirealty, outside the app directory the deploy wipes.

log "Log rotation"
cat > /etc/logrotate.d/ozirealty <<'LOGEOF'
/var/log/ozirealty/*.log {
  daily
  rotate 14
  compress
  missingok
  notifempty
  copytruncate
}
LOGEOF

log "Firewall"
# Caddy terminates TLS and proxies to 127.0.0.1:3000, so the app port is never
# exposed. SSH stays open because the security group already restricts it to one
# address — belt and braces, but the braces are the security group.
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

log "Unattended security upgrades"
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

log "Done"
cat <<'NEXTEOF'

Provisioned. Still to do, in order:

  1. Fill /etc/ozirealty/env (DATABASE_URL, AUTH_SECRET, SECRETS_KEY,
     AUTH_ALLOWED_EMAILS). SECRETS_KEY decrypts every credential stored in
     Settings - losing it means re-entering them, changing it means the same.
  2. Deploy the build:            infra/deploy.sh
  3. Point Caddy at the domain:   /etc/caddy/Caddyfile
  4. systemctl enable --now ozirealty-web ozirealty-worker

NEXTEOF
