#!/bin/sh
# Reads a gzip tar of the uploads volume on standard input and either describes it or checks it. It runs inside a
# throwaway container (backup.sh, restore-check.sh) and has no network, no secret and no access to the real volume.
#
#   uploads-verify.sh manifest                                      < archive   one line per file: "<sha256>  ./<shard>/<id>", sorted
#   uploads-verify.sh check MANIFEST SAMPLE [DOCUMENT_KEYS [FILE_KEYS]] < archive
#
# `check` extracts the archive, then:
#   - the number of restored files must equal the number of lines of the MANIFEST (written by `manifest` at backup time,
#     from the archive itself, so it describes exactly what the archive holds);
#   - SAMPLE files, evenly spread over the manifest, must still hash to the recorded SHA-256;
#   - every key of DOCUMENT_KEYS (one per line: the storage key of each vault document version in the restored database)
#     must exist as a file: a vault document is a legal record, a missing file is an error;
#   - the keys of FILE_KEYS (stored files: photos, CVs, attachments) are counted and reported, not fatal: a file may
#     legitimately be gone between the database dump and the archive (an erased account).
# A file is stored at <first two characters of its id>/<id>, like the application writes it (apps/web/src/data/uploads.ts).
set -eu

mode=${1:-}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fail() {
  echo "uploads-verify: $*" >&2
  exit 1
}

tar xzf - -C "$work"

case "$mode" in
manifest)
  cd "$work"
  # "<sha256>  ./<shard>/<id>", always with two spaces: some sha256sum builds mark the file as binary with " *" instead.
  find . -type f | LC_ALL=C sort | xargs -r sha256sum | sed 's/^\([0-9a-f]\{64\}\) [ *]/\1  /'
  ;;
check)
  manifest=${2:?manifest file}
  sample=${3:?sample size}
  documents=${4:--}
  files=${5:--}
  expected=$(wc -l <"$manifest" | tr -d ' ')
  actual=$(cd "$work" && find . -type f | wc -l | tr -d ' ')
  [ "$expected" = "$actual" ] || fail "$actual files restored, the manifest lists $expected"
  echo "uploads: $actual files restored, the count matches the manifest"

  # Evenly spread lines of the manifest, at most SAMPLE of them.
  picked=$(awk -v n="$sample" '{ line[NR] = $0 } END { if (NR == 0 || n < 1) exit; step = NR / n; if (step < 1) step = 1; for (i = 1; i <= NR; i += step) print line[int(i)] }' "$manifest")
  if [ -n "$picked" ]; then
    checked=$(printf '%s\n' "$picked" | wc -l | tr -d ' ')
    (cd "$work" && printf '%s\n' "$picked" | sha256sum -c - >/dev/null) || fail "a sampled file does not match its recorded SHA-256"
    echo "uploads: $checked sampled files match their recorded SHA-256"
  else
    echo "uploads: empty volume, nothing to sample"
  fi

  missing() {
    lost=0
    [ "$1" = "-" ] && { echo 0; return; }
    while IFS= read -r key; do
      [ -n "$key" ] || continue
      shard=$(printf '%s' "$key" | cut -c1-2)
      [ -f "$work/$shard/$key" ] || lost=$((lost + 1))
    done <"$1"
    echo "$lost"
  }
  lost_documents=$(missing "$documents")
  [ "$lost_documents" = 0 ] || fail "$lost_documents vault document files are missing from the archive"
  echo "uploads: vault documents missing from the archive: 0"
  echo "uploads: other files missing from the archive (informational): $(missing "$files")"
  ;;
*)
  fail "usage: uploads-verify.sh manifest | check MANIFEST SAMPLE [DOCUMENT_KEYS [FILE_KEYS]]"
  ;;
esac
