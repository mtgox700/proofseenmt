#!/bin/sh
# Nightly backup of Proofseen: the database, and the uploads volume. Both are written on the VPS, readable by root only,
# under the same timestamp, and kept BACKUP_DAYS days. The connection string is read from the production env file and
# never printed. Installed in root's crontab once a night; `restore-check.sh` proves a backup can be restored.
#
#   proofseen-<stamp>.dump               custom-format pg_dump, independent of the database provider
#   proofseen-<stamp>.uploads.tar.gz     the uploads volume (photos, portfolio images, CVs, attachments, and the vault's PDF
#                                        documents), read-only, partial `.part` files left out
#   proofseen-<stamp>.uploads.sha256     the SHA-256 of every file in that archive, read back from the archive itself
#
# Consistency: the database is dumped FIRST, the volume archived SECOND. A file is written to the volume before its row is
# recorded, and a recorded file is never removed except by an account erasure, so every row of the dump has its file in the
# archive. The reverse order could leave a row without a file. `restore-check.sh` checks exactly that for the vault.
#
# Retention: an account erased on Proofseen stays in these files until they age out (BACKUP_DAYS days). The privacy
# policy says so. A document of a contract is kept by the database for its legal term; the backup is not that archive.
set -eu

ENV_FILE=${PROOFSEEN_ENV_FILE:-/root/proofseen/app/.env.production}
DIR=${PROOFSEEN_BACKUP_DIR:-/root/proofseen-backups}
BACKUP_DAYS=14
# pg_dump must be at least the server's major version (Railway runs PostgreSQL 18); a newer client dumps an older server.
IMAGE=postgres:18-alpine
# The running application container: the uploads volume is found from its mount, so the name does not depend on the
# Compose project prefix. UPLOADS_VOLUME names it explicitly instead.
APP_CONTAINER=proofseen-web
UPLOADS_MOUNT=/data/uploads
HERE=$(cd "$(dirname "$0")" && pwd)

umask 077
mkdir -p "$DIR"
chmod 700 "$DIR"

stamp=$(date -u +%Y%m%d-%H%M)
name="proofseen-$stamp.dump"
uploads="proofseen-$stamp.uploads.tar.gz"
manifest="proofseen-$stamp.uploads.sha256"

url=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')
if [ -z "$url" ]; then
  echo "$(date -u +%FT%TZ) backup: DATABASE_URL missing" >&2
  exit 1
fi

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
echo "$(date -u +%FT%TZ) backup: $name $size bytes"

# The uploads volume, read-only, streamed through the shell so that the archive takes this script's umask (077): a file
# written by the container itself would take the container's. A failure here is reported after the rotation below, so a
# broken night never lets old backups pile up; the dump above is kept either way.
status=0
volume=${UPLOADS_VOLUME:-$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "'"$UPLOADS_MOUNT"'"}}{{.Name}}{{end}}{{end}}' "$APP_CONTAINER" 2>/dev/null || true)}
if [ -z "$volume" ]; then
  echo "$(date -u +%FT%TZ) backup: uploads volume not found (is $APP_CONTAINER running with a named volume on $UPLOADS_MOUNT?)" >&2
  status=1
else
  part="$DIR/.$uploads.part"
  mpart="$DIR/.$manifest.part"
  if docker run --rm -v "$volume":/data:ro "$IMAGE" tar czf - --exclude='*.part' -C /data . >"$part" &&
    mv "$part" "$DIR/$uploads" &&
    docker run --rm -i -v "$HERE/uploads-verify.sh":/verify.sh:ro "$IMAGE" sh /verify.sh manifest <"$DIR/$uploads" >"$mpart" &&
    mv "$mpart" "$DIR/$manifest"; then
    files=$(wc -l <"$DIR/$manifest" | tr -d ' ')
    echo "$(date -u +%FT%TZ) backup: $uploads $(wc -c <"$DIR/$uploads" | tr -d ' ') bytes, $files files"
  else
    # An archive that cannot be read back, or that has no manifest, proves nothing: none of its pieces is kept.
    rm -f "$part" "$mpart" "$DIR/$uploads" "$DIR/$manifest"
    echo "$(date -u +%FT%TZ) backup: uploads archive failed" >&2
    status=1
  fi
fi

# -mtime +N keeps files up to N+1 full days old: BACKUP_DAYS - 1 makes the 14 days of the privacy policy exact.
find "$DIR" \( -name 'proofseen-*.dump' -o -name 'proofseen-*.uploads.tar.gz' -o -name 'proofseen-*.uploads.sha256' \) -type f -mtime +"$((BACKUP_DAYS - 1))" -delete
exit "$status"
