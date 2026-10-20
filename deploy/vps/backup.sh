#!/bin/sh
# Nightly backup of the Proofseen database, independent of the database provider: a custom-format pg_dump written on
# the VPS, readable by root only, kept BACKUP_DAYS days. The connection string is read from the production env file and
# never printed. Installed in root's crontab once a night; `restore-check.sh` proves a dump can be restored.
#
# Retention: an account erased on Proofseen stays in these files until they age out (BACKUP_DAYS days). The privacy
# policy says so.
set -eu

ENV_FILE=/root/proofseen/app/.env.production
DIR=/root/proofseen-backups
BACKUP_DAYS=14
# pg_dump must be at least the server's major version (Railway runs PostgreSQL 18); a newer client dumps an older server.
IMAGE=postgres:18-alpine

umask 077
mkdir -p "$DIR"
chmod 700 "$DIR"

url=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')
if [ -z "$url" ]; then
  echo "$(date -u +%FT%TZ) backup: DATABASE_URL missing" >&2
  exit 1
fi

name="proofseen-$(date -u +%Y%m%d-%H%M).dump"
tmp="$DIR/.$name.part"
# The URL goes in through the environment, not the command line: it never shows in `ps`.
if docker run --rm -e PGURL="$url" "$IMAGE" sh -c 'pg_dump --format=custom --no-owner --no-privileges "$PGURL"' >"$tmp"; then
  mv "$tmp" "$DIR/$name"
else
  rm -f "$tmp"
  echo "$(date -u +%FT%TZ) backup: pg_dump failed" >&2
  exit 1
fi

# A dump smaller than a few kilobytes is an error page, not a database.
size=$(wc -c <"$DIR/$name")
if [ "$size" -lt 4096 ]; then
  echo "$(date -u +%FT%TZ) backup: $name is only $size bytes" >&2
  exit 1
fi

# -mtime +N keeps files up to N+1 full days old: BACKUP_DAYS - 1 makes the 14 days of the privacy policy exact.
find "$DIR" -name 'proofseen-*.dump' -type f -mtime +"$((BACKUP_DAYS - 1))" -delete
echo "$(date -u +%FT%TZ) backup: $name $size bytes"
