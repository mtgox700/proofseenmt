"""Build the static TTF instances of the brand fonts that the PDF engine (pdfmake on pdfkit, fontkit 2) embeds.

Why: fontkit cannot read WOFF2 and only draws the default instance of a variable font, and the WOFF2 served by the site
are web subsets (3 of 336 Latin Extended A/B code points, no U+0178). So the PDF fonts are rebuilt from Adobe's
official variable TTF, pinned by SHA-256, with the same design axes as the site, a Latin Extended subset (French,
European and Vietnamese names), merged overlaps, no hinting, and fixed timestamps: the same inputs give the same bytes.

Licence: SIL Open Font License 1.1. "Source" is a Reserved Font Name, so every instance is renamed (PS Display, PS Text,
PS Mono); the copyright (name 0), trademark (7) and licence (13, 14) records of Adobe are kept.

Needs: fonttools 4.65.0, skia-pathops 0.9.2 (overlap removal), brotli 1.2.1. Run with python -I from outside the
repository, see README.md for the download and the exact command.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SERIF_SHA256 = "14d360ee1b76655da9276628b229e11671bc1f5d1083636144db6677d452cf55"  # SourceSerif4Variable-Roman.ttf 4.005
CODE_SHA256 = "c4066e584e995ec317a072f1777742861d3ce0bf210096b84450a249d0210198"  # SourceCodeVF-Upright.ttf 1.026

# Basic Latin, Latin-1, Latin Extended A and B, spacing and combining accents, Latin Extended Additional (Vietnamese),
# general punctuation (U+00A0 and U+202F included), currency, letterlike (U+2116), number forms, arrows, math,
# geometric shapes, ballot boxes, Latin ligatures. Code points absent from a font are simply not kept.
UNICODE_RANGES = (
    (0x0020, 0x007E), (0x00A0, 0x024F), (0x02B0, 0x02FF), (0x0300, 0x036F), (0x1E00, 0x1EFF),
    (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2100, 0x214F), (0x2150, 0x218F), (0x2190, 0x21FF),
    (0x2200, 0x22FF), (0x25A0, 0x25FF), (0x2610, 0x2612), (0xFB00, 0xFB06),
)

LAYOUT_FEATURES = (
    "ccmp", "locl", "mark", "mkmk", "kern", "liga", "case", "tnum", "pnum", "lnum", "onum",
    "frac", "numr", "dnom", "sups", "subs", "ordn", "smcp", "c2sc", "zero",
)

# Characters every instance must render: the French set, the money format of the templates (TEMPLATE_FORMAT.md 3.1),
# typographic quotes, and names of people who live and work in France.
REQUIRED = (
    "àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ«»‹›“”‘’„…–§°€£$%№"
    "\u00a0\u202f"  # U+2009 (thin space) is absent from Source Code Pro: the templates never emit it
    "ŁłŚśŻżŹźĆćŃńĘęĄą ȘșȚțĂăÂâ ŠšČčŘřŽžĎďŤťŇňŮů ĞğİıŞş ŐőŰű Nguyễn Trần Phạm Lê Đặng"
)

# Primary names that must not contain the Reserved Font Name "Source" (OFL condition 3).
PRIMARY_NAME_IDS = (1, 2, 3, 4, 6, 16, 17, 18, 21, 22, 25)

INSTANCES = (
    # file, source, axes, family, style, weight, bold
    ("ps-display-400.ttf", "serif", {"wght": 400, "opsz": 48}, "PS Display", "Regular", 400, False),
    ("ps-display-600.ttf", "serif", {"wght": 600, "opsz": 48}, "PS Display Semibold", "Regular", 600, False),
    ("ps-display-700.ttf", "serif", {"wght": 700, "opsz": 48}, "PS Display", "Bold", 700, True),
    ("ps-text-400.ttf", "serif", {"wght": 400, "opsz": 10}, "PS Text", "Regular", 400, False),
    ("ps-text-700.ttf", "serif", {"wght": 700, "opsz": 10}, "PS Text", "Bold", 700, True),
    ("ps-mono-500.ttf", "code", {"wght": 500}, "PS Mono", "Regular", 500, False),
)


def sha256(path: str) -> str:
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def check_source(path: str, expected: str) -> None:
    actual = sha256(path)
    if actual != expected:
        sys.exit(f"refused: {path} has SHA-256 {actual}, expected {expected} (not the pinned Adobe release)")


def rename(font: TTFont, family: str, style: str, weight: int, bold: bool, axes: dict[str, int]) -> None:
    name = font["name"]
    version = name.getName(5, 3, 1, 0x409).toUnicode().split(";")[0]
    semibold = family.endswith(" Semibold")
    base = family.removesuffix(" Semibold")
    postscript = f"{base.replace(' ', '')}-{'Semibold' if semibold else style}"
    full = family if style == "Regular" else f"{family} {style}"
    settings = " ".join(f"{k} {v}" for k, v in axes.items())
    keep = {0, 7, 8, 9, 11, 12, 13, 14}
    name.names = [r for r in name.names if r.nameID in keep and r.platformID == 3]
    for name_id, value in (
        (1, family), (2, style), (3, f"{version};PROOFSEEN;{postscript}"), (4, full),
        (5, f"{version}; PDF instance of the Adobe original, {settings}, Latin Extended subset"), (6, postscript),
    ):
        name.setName(value, name_id, 3, 1, 0x409)
    if semibold:  # four-style family plus a typographic family, so font menus group the weights
        name.setName(base, 16, 3, 1, 0x409)
        name.setName("Semibold", 17, 3, 1, 0x409)
    os2 = font["OS/2"]
    os2.usWeightClass = weight
    os2.fsSelection = (os2.fsSelection & ~0b1100001) | (0b100000 if bold else 0b1000000)
    font["head"].macStyle = 1 if bold else 0


def build_one(source: str, axes: dict[str, int], family: str, style: str, weight: int, bold: bool, out: str) -> None:
    varfont = TTFont(source, recalcTimestamp=False)
    modified = varfont["head"].modified
    font = instancer.instantiateVariableFont(varfont, axes, overlap=instancer.OverlapMode.REMOVE)
    for tag in ("STAT", "MVAR", "HVAR", "avar", "fvar", "gvar", "cvar"):
        if tag in font:
            del font[tag]
    options = subset.Options()
    options.layout_features = list(LAYOUT_FEATURES)
    options.hinting = False
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recalc_timestamp = False
    options.drop_tables += ["DSIG", "BASE"]
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[c for a, b in UNICODE_RANGES for c in range(a, b + 1)])
    subsetter.subset(font)
    rename(font, family, style, weight, bold, axes)
    font["head"].modified = modified
    font["head"].created = modified
    font.recalcTimestamp = False
    font.save(out)


def verify(path: str) -> dict:
    font = TTFont(path)
    cmap = font.getBestCmap()
    missing = sorted({ch for ch in REQUIRED if ch != " " and ord(ch) not in cmap})
    if missing:
        sys.exit(f"{path}: missing {' '.join(f'U+{ord(c):04X}' for c in missing)}")
    if "fvar" in font:
        sys.exit(f"{path}: still variable")
    for record in font["name"].names:
        if record.nameID in PRIMARY_NAME_IDS and "source" in record.toUnicode().lower():
            sys.exit(f"{path}: name {record.nameID} uses the Reserved Font Name: {record.toUnicode()}")
    return {"glyphs": len(font.getGlyphOrder()), "codepoints": len(cmap), "postscriptName": str(font["name"].getName(6, 3, 1, 0x409))}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--serif", required=True, help="SourceSerif4Variable-Roman.ttf from source-serif-4.005_Desktop.zip")
    parser.add_argument("--code", required=True, help="SourceCodeVF-Upright.ttf from VF-source-code-VF-1.026R.zip")
    parser.add_argument("--out", required=True, help="output folder (packages/brand/pdf-fonts)")
    args = parser.parse_args()
    check_source(args.serif, SERIF_SHA256)
    check_source(args.code, CODE_SHA256)
    sources = {"serif": args.serif, "code": args.code}
    manifest = []
    for file, src, axes, family, style, weight, bold in INSTANCES:
        out = os.path.join(args.out, file)
        build_one(sources[src], axes, family, style, weight, bold, out)
        facts = verify(out)
        manifest.append({"file": file, "family": family, "style": style, "weight": weight, "axes": axes,
                         "bytes": os.path.getsize(out), "sha256": sha256(out), **facts})
    with open(os.path.join(args.out, "manifest.json"), "w", encoding="utf-8", newline="\n") as handle:
        json.dump({"sources": {"serif": SERIF_SHA256, "code": CODE_SHA256}, "fonts": manifest}, handle, indent=2)
        handle.write("\n")
    for entry in manifest:
        print(f"{entry['file']:20} {entry['bytes']:>7} o  {entry['glyphs']:>4} glyphes  {entry['codepoints']:>4} cp  {entry['sha256']}")


if __name__ == "__main__":
    main()
