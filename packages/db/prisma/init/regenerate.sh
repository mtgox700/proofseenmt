#!/usr/bin/env bash
# Régénère la migration initiale : SQL généré depuis schema.prisma, suivi de appendix.sql (contraintes CHECK et
# déclencheurs que Prisma ne sait pas exprimer), puis le client Prisma.
#
# Valable UNIQUEMENT tant que 20261005000000_init n'a été appliquée sur aucune base. Dès le premier `migrate deploy`,
# toute évolution passe par une nouvelle migration (`prisma migrate dev --create-only`) et ce dossier est supprimé.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here/../.."
out=prisma/migrations/20261005000000_init/migration.sql
tmp="$(mktemp)"
# URL factice limitée à cette commande : le moteur de schéma en exige une même hors ligne, sinon il échoue en silence
# (code 0, sortie vide). Elle n'est jamais écrite dans la configuration.
DATABASE_URL="postgresql://offline:offline@localhost:5432/offline" npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > "$tmp"
lines=$(wc -l < "$tmp")
if [ "$lines" -lt 400 ]; then echo "génération suspecte ($lines lignes)"; exit 1; fi
cat "$tmp" prisma/init/appendix.sql > "$out"
rm -f "$tmp"
echo "lines=$(wc -l < "$out") tables=$(grep -c '^CREATE TABLE' "$out") triggers=$(grep -c '^CREATE TRIGGER' "$out")"
npx prisma generate
