#!/usr/bin/env bash
# Rebuilds a specimen from the code and captures it with headless Chrome: at device scale 1 (true pixels) and 2, and
# at 375 px wide for the primitives. Every capture is the whole page: taken tall, then the empty ground at the bottom
# is trimmed (L1-120 R5). Run from the root of the worktree:
#   bash .war-room/sprints/L1_specimens/tooling/shoot.sh fingerprint-mark
#   bash .war-room/sprints/L1_specimens/tooling/shoot.sh ui-primitives
set -euo pipefail
name="${1:-fingerprint-mark}"
dir=".war-room/sprints/L1_specimens"
case "$name" in
  fingerprint-mark) script="build-fingerprint-specimen.tsx" ;;
  ui-primitives) script="build-ui-specimen.tsx" ;;
  *) echo "unknown specimen: $name" >&2; exit 1 ;;
esac
TSX_TSCONFIG_PATH="$dir/tooling/tsconfig.json" node --import tsx/esm --import "./$dir/tooling/css-hook.mjs" "$dir/tooling/$script"
chrome="/c/Program Files/Google/Chrome/Application/chrome.exe"
page="file:///$(cygpath -m "$PWD/$dir/$name.html")"
shot() { "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor="$1" --window-size="$2" --screenshot="$(cygpath -w "$PWD/$dir/$3")" "$page" 2>/dev/null; }
# Trim the rows of plain ground under the last thing drawn, keeping a margin of 32 css px.
trim() { python -I -c "
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); scale = int(sys.argv[2]); w, h = im.size
ground = im.getpixel((w - 1, h - 1)); px = im.load(); last = 0
for y in range(h - 1, -1, -1):
    if any(px[x, y] != ground for x in range(0, w, 2)): last = y; break
im.crop((0, 0, w, min(h, last + 32 * scale))).save(sys.argv[1])
" "$1" "$2"; }
shot 1 "1280,4000" "$name@1x.png"; trim "$dir/$name@1x.png" 1
shot 2 "1280,4000" "$name@2x.png"; trim "$dir/$name@2x.png" 2
# Headless Chrome will not open a window under 500 px: the phone view is the page inside a 375 px frame, whose media
# queries answer to the frame's width.
if [ "$name" = "ui-primitives" ]; then
  frame="$dir/tooling/phone-frame.html"
  printf '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}iframe{border:0;display:block}</style><iframe src="../%s.html" width="375" height="3600"></iframe>' "$name" > "$frame"
  page="file:///$(cygpath -m "$PWD/$frame")"
  shot 2 "520,3600" "$name@375-raw.png"
  python -I -c "import sys; from PIL import Image; im=Image.open(sys.argv[1]); im.crop((0,0,750,im.height)).save(sys.argv[2])" "$dir/$name@375-raw.png" "$dir/$name@375.png"
  trim "$dir/$name@375.png" 2
  rm -f "$dir/$name@375-raw.png" "$frame"
fi
ls -la "$dir"/*.png
