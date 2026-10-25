#!/usr/bin/env bash
# Rebuilds the specimens of the vault (T15) from the real components and captures each screen with headless Chrome:
# at 1280 px (device scale 1, whole page, trimmed) and at 375 px (inside a 375 px frame, device scale 2: headless
# Chrome will not open a window under 500 px). Run from the root of the worktree:
#   bash .war-room/sprints/L1_specimens/tooling/shoot-vault.sh [page ...]
set -euo pipefail
dir=".war-room/sprints/L1_specimens"
TSX_TSCONFIG_PATH="$dir/tooling/tsconfig.json" node --import tsx/esm --import "./$dir/tooling/css-hook.mjs" "$dir/tooling/build-vault-specimen.tsx"
chrome="/c/Program Files/Google/Chrome/Application/chrome.exe"
pages=("$@")
if [ ${#pages[@]} -eq 0 ]; then pages=(e1-s3 e1-s2a e1-s5 e2-errors e4 e5 e5-gris e6); fi
shot() { "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor="$1" --window-size="$2" --virtual-time-budget=2000 --screenshot="$(cygpath -w "$PWD/$3")" "$4" 2>/dev/null; }
trim() { python -I -c "
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); scale = int(sys.argv[2]); w, h = im.size
ground = im.getpixel((w - 1, h - 1)); px = im.load(); last = 0
for y in range(h - 1, -1, -1):
    if any(px[x, y] != ground for x in range(0, w, 2)): last = y; break
im.crop((0, 0, w, min(h, last + 32 * scale))).save(sys.argv[1])
" "$1" "$2"; }
for name in "${pages[@]}"; do
  page="file:///$(cygpath -m "$PWD/$dir/vault/$name.html")"
  shot 1 "1280,${H1280:-6000}" "$dir/vault/$name@1280.png" "$page"; trim "$dir/vault/$name@1280.png" 1
  frame="$dir/vault/frame-$name.html"
  printf '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}iframe{border:0;display:block}</style><iframe src="%s.html" width="375" height="%s"></iframe>' "$name" "${H375:-7000}" > "$frame"
  shot 2 "520,${H375:-7000}" "$dir/vault/$name@375-raw.png" "file:///$(cygpath -m "$PWD/$frame")"
  python -I -c "import sys; from PIL import Image; im=Image.open(sys.argv[1]); im.crop((0,0,750,im.height)).save(sys.argv[2])" "$dir/vault/$name@375-raw.png" "$dir/vault/$name@375.png"
  trim "$dir/vault/$name@375.png" 2
  rm -f "$dir/vault/$name@375-raw.png" "$frame"
done
ls -la --time-style=+%H:%M:%S "$dir"/vault/*.png
