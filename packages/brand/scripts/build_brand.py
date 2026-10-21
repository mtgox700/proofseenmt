"""Builds every brand file of Proofseen from the hand-drawn poincon (marks.py) and the brand fonts.

    python packages/brand/scripts/build_brand.py assets <tmpdir>    # SVG files + raster job list
    pnpm exec tsx packages/brand/scripts/render.ts <tmpdir>/jobs-assets.json
    python packages/brand/scripts/build_brand.py sheet <tmpdir>     # specimen sheet (needs the rasters)
    pnpm exec tsx packages/brand/scripts/render.ts <tmpdir>/jobs-sheet.json

Needs fontTools and brotli (pip install fonttools brotli). Every text is converted to outlines: no SVG of the brand
depends on a font installed on the machine that displays it. Colours mirror src/tokens.ts (checked by
test/brand-files.test.ts).
"""
from __future__ import annotations

import json
import os
import shutil
import sys

import glyphs
import marks

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
WEB_BRAND = os.path.join(ROOT, "apps", "web", "public", "brand")
LANDING_BRAND = os.path.join(ROOT, "apps", "landing", "public", "brand")
ASSETS = os.path.join(ROOT, "packages", "brand", "assets")
SHEET_PNG = os.path.join(ROOT, ".war-room", "brand", "PLANCHE.png")
DISPLAY = os.path.join(ROOT, "apps", "web", "public", "fonts", "ps-display-v1.woff2")
MONO = os.path.join(ROOT, "apps", "web", "public", "fonts", "ps-mono-v1.woff2")
SYSTEM_SANS = "C:/Windows/Fonts/segoeui.ttf"  # only to show system-ui on the specimen sheet

# Mirrors src/tokens.ts.
DARK = {"bg": "#0e0e0c", "surface": "#161613", "raised": "#1e1e1a", "text": "#eeeae1", "muted": "#aaa59a",
        "faint": "#8f8a7f", "line": "#2b2a26", "line-strong": "#77736a", "proof": "#6fd690", "on-proof": "#0b1a10", "proof-wash": "#212d22",
        "signal": "#f0b44c", "danger": "#f08a74", "focus": "#93b6ff"}
LIGHT = {"bg": "#f4f1ea", "surface": "#fbf9f4", "raised": "#ffffff", "text": "#15140f", "muted": "#5c584e",
         "faint": "#6e695e", "line": "#dcd7cb", "line-strong": "#8a8579", "proof": "#0c6a41", "on-proof": "#f4f1ea", "proof-wash": "#e3ebe2",
         "signal": "#8a4b00", "danger": "#b0281c", "focus": "#2a55c8"}

WORDMARK_WGHT = 600
WORDMARK_TRACKING = -0.012
WORD_SIZE = 100.0


def fmt(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")


class Type:
    def __init__(self) -> None:
        self.display = glyphs.Typesetter(glyphs.load(DISPLAY, {"wght": WORDMARK_WGHT}))
        self.display_regular = glyphs.Typesetter(glyphs.load(DISPLAY, {"wght": 420}))
        self.mono = glyphs.Typesetter(glyphs.load(MONO))
        self.sans = glyphs.Typesetter(glyphs.load(SYSTEM_SANS)) if os.path.exists(SYSTEM_SANS) else None


# ---------- marks ----------

def mono_group(master: str, x: float, y: float, size: float, fill: str, p_fill: str | None = None) -> str:
    """The poincon at (x, y), `size` px wide. p_fill fills the P (opaque icons) instead of knocking it out."""
    s = size / marks.GRID
    body = f'<path fill="{fill}" fill-rule="evenodd" d="{marks.monogram_path(master)}"/>'
    if p_fill:
        p = marks.P_LARGE if master == "large" else marks.P_SMALL
        body += f'<path fill="{p_fill}" fill-rule="evenodd" d="{p}{marks.P_COUNTER}"/>'
    return f'<g transform="translate({fmt(x)} {fmt(y)}) scale({s:.5f})">{body}</g>'


def svg_doc(w: float, h: float, inner: str, title: str | None = "Proofseen", extra: str = "") -> str:
    head = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w)} {fmt(h)}"'
    if title:
        head += f' role="img" aria-label="{title}"><title>{title}</title>'
    else:
        head += ' aria-hidden="true">'
    return head + extra + inner + "</svg>\n"


def wordmark(t: Type) -> tuple[str, float, float, float]:
    """Path of 'Proofseen' at WORD_SIZE with baseline at y=0; returns d, width, cap height, left bearing."""
    d, width = t.display.path("Proofseen", WORD_SIZE, 0, 0, WORDMARK_TRACKING)
    cap = t.display.metric("sCapHeight") * WORD_SIZE
    return d, width, cap, 0.0


def lockup_svg(t: Type, master: str, mark_fill: str, text_fill: str) -> str:
    d, width, cap, _ = wordmark(t)
    # The P of the poincon sits on the same baseline and has the same cap height as the P of the wordmark.
    size = cap * marks.GRID / (marks.P_BASELINE - marks.P_TOP)
    mark_top = -size * marks.P_BASELINE / marks.GRID
    gap = size * 0.30
    top, bottom = mark_top, mark_top + size
    total_w = size + gap + width
    inner = mono_group(master, 0, 0, size, mark_fill)
    inner += f'<path fill="{text_fill}" transform="translate({fmt(size + gap)} {fmt(-top)})" d="{d}"/>'
    return svg_doc(total_w, bottom - top, inner)


def logotype_svg(t: Type, fill: str) -> str:
    d, width, cap, _ = wordmark(t)
    asc = cap * 1.06  # round letters overshoot the cap height
    desc = WORD_SIZE * 0.02
    return svg_doc(width, asc + desc, f'<path fill="{fill}" transform="translate(0 {fmt(asc)})" d="{d}"/>')


def favicon_svg() -> str:
    style = (f"<style>path{{fill:{LIGHT['proof']}}}"
             f"@media (prefers-color-scheme:dark){{path{{fill:{DARK['proof']}}}}}</style>")
    return svg_doc(32, 32, f'<path fill-rule="evenodd" d="{marks.monogram_path("small")}"/>', extra=style)


def icon_svg(size: int, ratio: float, master: str) -> str:
    mark = size * ratio
    off = (size - mark) / 2
    inner = f'<rect width="{size}" height="{size}" fill="{DARK["bg"]}"/>' + mono_group(master, off, off, mark, DARK["proof"])
    return svg_doc(size, size, inner, title=None)


def solid_favicon_svg() -> str:
    """ICO: no media query in an ICO, so an opaque P keeps contrast on light and dark browser tabs."""
    return svg_doc(32, 32, mono_group("small", 0, 0, 32, LIGHT["proof"], p_fill=LIGHT["bg"]), title=None)


# ---------- share card ----------

OG_TEXT = {
    "fr": (["La preuve de ce qu\u2019un", "freelance a vraiment livr\u00e9."],
           "MISSIONS V\u00c9RIFI\u00c9ES \u00b7 VISIBILIT\u00c9 DANS LES ASSISTANTS IA"),
    "en": (["Proof of what a freelancer", "actually shipped."],
           "VERIFIED MISSIONS \u00b7 VISIBILITY IN AI ASSISTANTS"),
}


def og_svg(t: Type, lang: str) -> str:
    w, h = 1200, 630
    lines, kicker = OG_TEXT[lang]
    out = [f'<rect width="{w}" height="{h}" fill="{DARK["bg"]}"/>']
    # Lockup, top left (small master: the card is mostly seen at a third of its size).
    d, width, cap, _ = wordmark(t)
    scale = 30 / cap
    size = 30 * marks.GRID / (marks.P_BASELINE - marks.P_TOP)
    out.append(mono_group("small", 80, 70, size, DARK["proof"]))
    base_y = 70 + size * marks.P_BASELINE / marks.GRID
    out.append(f'<path fill="{DARK["text"]}" transform="translate({fmt(80 + size * 1.3)} {fmt(base_y)}) scale({scale:.5f})" d="{d}"/>')
    # Headline.
    y = 300
    for line in lines:
        p, _ = t.display.path(line, 64, 80, y, -0.02)
        out.append(f'<path fill="{DARK["text"]}" d="{p}"/>')
        y += 76
    # Trace: the kicker, then a hairline that runs to the struck poincon.
    k, kw = t.mono.path(kicker, 19, 80, 470, 0.06)
    out.append(f'<path fill="{DARK["muted"]}" d="{k}"/>')
    out.append(f'<path d="M80 512H{fmt(w - 80)}" stroke="{DARK["line-strong"]}" stroke-width="1.5"/>')
    out.append(f'<rect x="{w - 84}" y="508" width="8" height="8" fill="{DARK["proof"]}"/>')
    u, _ = t.mono.path("proofseen.com", 19, 80, 562, 0.02)
    out.append(f'<path fill="{DARK["faint"]}" d="{u}"/>')
    out.append(mono_group("large", 870, 150, 250, DARK["proof"]))
    title = "Proofseen : la preuve de ce qu\u2019un freelance a vraiment livr\u00e9" if lang == "fr" else \
        "Proofseen: proof of what a freelancer actually shipped"
    return svg_doc(w, h, "".join(out), title=title)


# ---------- assets ----------

def write(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def build_assets(tmp: str) -> None:
    t = Type()
    os.makedirs(WEB_BRAND, exist_ok=True)
    files: dict[str, str] = {}
    variants = {"dark": (DARK["proof"], DARK["text"]), "light": (LIGHT["proof"], LIGHT["text"]),
                "mono": ("currentColor", "currentColor")}
    for name, (mark_fill, text_fill) in variants.items():
        files[f"ps-monogram-{name}.svg"] = marks.monogram_svg(mark_fill, "large") + "\n"
        files[f"ps-monogram-small-{name}.svg"] = marks.monogram_svg(mark_fill, "small") + "\n"
        files[f"ps-logotype-{name}.svg"] = logotype_svg(t, text_fill)
        files[f"ps-lockup-{name}.svg"] = lockup_svg(t, "small", mark_fill, text_fill)
        files[f"ps-lockup-display-{name}.svg"] = lockup_svg(t, "large", mark_fill, text_fill)
    files["favicon.svg"] = favicon_svg()
    for name, text in files.items():
        write(os.path.join(WEB_BRAND, name), text)

    sources = {
        "og-fr.svg": og_svg(t, "fr"), "og-en.svg": og_svg(t, "en"),
        "icon.svg": icon_svg(512, 0.72, "large"), "maskable.svg": icon_svg(512, 0.56, "large"),
        "apple-touch-icon.svg": icon_svg(180, 0.64, "large"), "favicon-solid.svg": solid_favicon_svg(),
    }
    for name, text in sources.items():
        write(os.path.join(ASSETS, name), text)

    jobs = [
        {"svg": os.path.join(ASSETS, "og-fr.svg"), "png": os.path.join(WEB_BRAND, "og-fr.png"), "width": 1200, "height": 630},
        {"svg": os.path.join(ASSETS, "og-en.svg"), "png": os.path.join(WEB_BRAND, "og-en.png"), "width": 1200, "height": 630},
        {"svg": os.path.join(ASSETS, "icon.svg"), "png": os.path.join(WEB_BRAND, "icon-192.png"), "width": 192, "viewWidth": 512, "supersample": 4},
        {"svg": os.path.join(ASSETS, "icon.svg"), "png": os.path.join(WEB_BRAND, "icon-512.png"), "width": 512, "viewWidth": 512, "supersample": 2},
        {"svg": os.path.join(ASSETS, "maskable.svg"), "png": os.path.join(WEB_BRAND, "maskable-192.png"), "width": 192, "viewWidth": 512, "supersample": 4},
        {"svg": os.path.join(ASSETS, "maskable.svg"), "png": os.path.join(WEB_BRAND, "maskable-512.png"), "width": 512, "viewWidth": 512, "supersample": 2},
        {"svg": os.path.join(ASSETS, "apple-touch-icon.svg"), "png": os.path.join(WEB_BRAND, "apple-touch-icon.png"), "width": 180, "viewWidth": 180, "supersample": 4},
    ]
    icos = []
    for size in (16, 32, 48):
        png = os.path.join(tmp, f"favicon-{size}.png")
        jobs.append({"svg": os.path.join(ASSETS, "favicon-solid.svg"), "png": png, "width": size, "viewWidth": 32, "supersample": 8})
        icos.append(png)
        for theme in ("light", "dark"):
            jobs.append({"svg": os.path.join(WEB_BRAND, f"ps-monogram-small-{theme}.svg"), "png": os.path.join(tmp, f"mono-small-{theme}-{size}.png"),
                         "width": size, "viewWidth": 32, "supersample": 8, "flatten": (LIGHT if theme == "light" else DARK)["bg"]})
    for size in (64, 512):
        for theme in ("light", "dark"):
            jobs.append({"svg": os.path.join(WEB_BRAND, f"ps-monogram-{theme}.svg"), "png": os.path.join(tmp, f"mono-large-{theme}-{size}.png"),
                         "width": size, "viewWidth": 32, "supersample": 4, "flatten": (LIGHT if theme == "light" else DARK)["bg"]})
    for theme in ("light", "dark"):
        jobs.append({"svg": os.path.join(WEB_BRAND, f"ps-lockup-{theme}.svg"), "png": os.path.join(tmp, f"lockup-{theme}.png"),
                     "width": 560, "height": 0, "flatten": (LIGHT if theme == "light" else DARK)["bg"]})
    jobs.append({"ico": os.path.join(WEB_BRAND, "favicon.ico"), "pngs": icos})
    for job in jobs:
        if job.get("height") == 0:
            w, h = viewbox(job["svg"])
            job["height"] = round(job["width"] * h / w)
            job["viewWidth"] = w
            job["supersample"] = 2
    write(os.path.join(tmp, "jobs-assets.json"), json.dumps(jobs, indent=1))


def viewbox(path: str) -> tuple[float, float]:
    with open(path, encoding="utf-8") as fh:
        head = fh.read(400)
    vb = head.split('viewBox="', 1)[1].split('"', 1)[0].split()
    return float(vb[2]), float(vb[3])


def mirror_to_landing() -> None:
    os.makedirs(LANDING_BRAND, exist_ok=True)
    for name in os.listdir(WEB_BRAND):
        shutil.copyfile(os.path.join(WEB_BRAND, name), os.path.join(LANDING_BRAND, name))


if __name__ == "__main__":
    mode, tmpdir = sys.argv[1], sys.argv[2]
    os.makedirs(tmpdir, exist_ok=True)
    if mode == "assets":
        build_assets(tmpdir)
    elif mode == "sheet":
        import sheet
        sheet.build(Type(), tmpdir, DARK, LIGHT, SHEET_PNG)
    elif mode == "mirror":
        mirror_to_landing()
    else:
        raise SystemExit(f"unknown mode {mode}")
