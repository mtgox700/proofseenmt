#!/bin/sh
# Proves the latest backup can be restored: loads it into a throwaway Postgres container (no network, removed at the
# end), then prints the number of tables and the row counts of a few core tables. Nothing touches the real database.
set -eu

DIR=/root/proofseen-backups
IMAGE=postgres:18-alpine
NAME=proofseen-restore-check

latest=$(ls -1t "$DIR"/proofseen-*.dump 2>/dev/null | head -1)
if [ -z "$latest" ]; then
  echo "restore-check: no dump in $DIR" >&2
  exit 1
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
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
