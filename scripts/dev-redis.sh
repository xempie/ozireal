#!/usr/bin/env bash
# Start a local Redis for development, with no admin rights and no installer.
#
# Windows has no first-party Redis. The options were: Memurai (MSI wants UAC
# elevation), Docker (daemon not running on this box), WSL (no distro installed),
# or the portable Windows build. This uses the portable build - Redis 5.0.14 from
# tporadowski/redis, which satisfies BullMQ's hard minimum of 5.0.0 (BullMQ prints
# a recommendation warning for <6.2; harmless in dev). Production runs real Redis
# on the instance (B6), so nothing here ships.
#
# The binary lands in .tools/redis (gitignored), downloaded once.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/.tools/redis"
EXE="$DIR/redis-server.exe"
VERSION="5.0.14.1"
URL="https://github.com/tporadowski/redis/releases/download/v${VERSION}/Redis-x64-${VERSION}.zip"

if [ ! -f "$EXE" ]; then
  echo "downloading portable Redis ${VERSION}..."
  mkdir -p "$DIR"
  curl -sSL -o "$DIR/redis.zip" "$URL"
  (cd "$DIR" && unzip -oq redis.zip && rm redis.zip)
fi

# noeviction is BullMQ's stated requirement: evicting a queue key under memory
# pressure silently loses jobs, and an error beats a silent loss.
exec "$EXE" --port 6379 --maxmemory-policy noeviction --save "" --appendonly no
