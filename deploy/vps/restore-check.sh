#!/bin/sh
# Proves the latest backup can be restored: loads the dump into a throwaway Postgres container (no network, removed at the
# end), prints the number of tables and the row counts of a few core tables, then restores the uploads archive of the same
# night into a throwaway container too and checks it: the file count against the manifest written at backup time, a
# sample of files against their recorded SHA-256, and that every vault document of the restored database has its file.
# Nothing touches the real database or the real volume.
#
# To restore the volume for real (after stopping the application): create it empty, then
#   docker run --rm -i -v proofseen-uploads:/data postgres:18-alpine tar xzf - -C /data < /root/proofseen-backups/proofseen-<stamp>.uploads.tar.gz
set -eu

DIR=${PROOFSEEN_BACKUP_DIR:-/root/proofseen-backups}
IMAGE=postgres:18-alpine
NAME=proofseen-restore-check
# Files re-hashed from the restored archive.
SAMPLE=20
HERE=$(cd "$(dirname "$0")" && pwd)

latest=$(ls -1t "$DIR"/proofseen-*.dump 2>/dev/null | head -1)
if [ -z "$latest" ]; then
  echo "restore-check: no dump in $DIR" >&2
  exit 1
fi
# The archive and its manifest carry the dump's timestamp.
base=${latest%.dump}
archive="$base.uploads.tar.gz"
manifest="$base.uploads.sha256"
if [ ! -f "$archive" ] || [ ! -f "$manifest" ]; then
  echo "restore-check: $(basename "$latest") has no uploads archive and manifest (a backup made before the uploads volume was covered)" >&2
  exit 1
fi

keys=$(mktemp -d)
docker rm -f "$NAME" >/dev/null 2>&1 || true
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$keys"' EXIT
docker run -d --name "$NAME" --network none -e POSTGRES_PASSWORD=restore-check "$IMAGE" >/dev/null
for _ in $(seq 1 30); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

docker cp "$latest" "$NAME":/tmp/latest.dump
# Extensions the schema relies on (unaccent) are created by the dump itself.
docker exec "$NAME" pg_restore --no-owner --no-privileges --exit-on-error -U postgres -d postgres /tmp/latest.dump

count() {
  docker exec "$NAME" psql -U postgres -d postgres -At -c "$1"
}
echo "tables: $(count "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
echo "migrations: $(count 'SELECT count(*) FROM "_prisma_migrations"')"
echo "users: $(count 'SELECT count(*) FROM "User"')"
echo "profiles: $(count 'SELECT count(*) FROM "FreelanceProfile"')"
echo "organisations: $(count 'SELECT count(*) FROM "Organisation"')"
echo "restore-check: $(basename "$latest") restored"

# The files the restored database points at: vault document versions (fatal when missing) and stored files (reported).
# A dump from before the vault has no such table.
: >"$keys/documents"
if [ -n "$(count "SELECT to_regclass('public.\"DocumentVersion\"')")" ]; then
  count 'SELECT "storageKey" FROM "DocumentVersion"' >"$keys/documents"
fi
count 'SELECT "id" FROM "StoredFile"' >"$keys/files"

# The archive, extracted and checked in a throwaway container with no network.
docker run --rm -i --network none \
  -v "$HERE/uploads-verify.sh":/verify.sh:ro \
  -v "$manifest":/manifest:ro \
  -v "$keys":/keys:ro \
  "$IMAGE" sh /verify.sh check /manifest "$SAMPLE" /keys/documents /keys/files <"$archive"
echo "restore-check: $(basename "$archive") restored and verified"
