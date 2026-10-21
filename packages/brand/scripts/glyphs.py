"""Turn text into SVG outlines with the brand fonts, so no SVG of the brand depends on an installed font.

Used by build_brand.py. Needs fontTools (pip install fonttools brotli). Kerning comes from the GPOS 'kern' pair
adjustments (formats 1 and 2, extension lookups included); no other shaping is applied, which is enough for the
Latin text of the logotype, the share cards and the specimen sheet.
"""
from __future__ import annotations

import io

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer


def load(path: str, axes: dict[str, float] | None = None) -> TTFont:
    font = TTFont(path, lazy=False)
    if axes and "fvar" in font:
        present = {a.axisTag for a in font["fvar"].axes}
        limits = {k: v for k, v in axes.items() if k in present}
        if limits:
            font = instancer.instantiateVariableFont(font, limits)
            buf = io.BytesIO()
            font.save(buf)
            buf.seek(0)
            font = TTFont(buf, lazy=False)
    return font


def _pair_tables(font: TTFont) -> list:
    if "GPOS" not in font:
        return []
    gpos = font["GPOS"].table
    indices: list[int] = []
    for rec in gpos.FeatureList.FeatureRecord:
        if rec.FeatureTag == "kern":
            indices.extend(rec.Feature.LookupListIndex)
    subtables = []
    for i in sorted(set(indices)):
        for st in gpos.LookupList.Lookup[i].SubTable:
            real = st.ExtSubTable if getattr(st, "ExtensionLookupType", None) else st
            if getattr(real, "LookupType", 2) == 2 or hasattr(real, "PairSet") or hasattr(real, "Class1Record"):
                subtables.append(real)
    return subtables


def kern(font: TTFont, cache: dict, left: str, right: str) -> int:
    key = (left, right)
    if key in cache:
        return cache[key]
    value = 0
    for st in cache.setdefault("__tables__", _pair_tables(font)):
        cov = st.Coverage.glyphs
        if left not in cov:
            continue
        if st.Format == 1:
            pset = st.PairSet[cov.index(left)]
            for rec in pset.PairValueRecord:
                if rec.SecondGlyph == right:
                    value = getattr(rec.Value1, "XAdvance", 0) or 0
                    break
        else:
            c1 = st.ClassDef1.classDefs.get(left, 0)
            c2 = st.ClassDef2.classDefs.get(right, 0)
            rec = st.Class1Record[c1].Class2Record[c2]
            value = getattr(rec.Value1, "XAdvance", 0) or 0
        if value:
            break
    cache[key] = value
    return value


class Typesetter:
    """Lays out one line of text at a size, returns an SVG path 'd' and the advance width."""

    def __init__(self, font: TTFont):
        self.font = font
        self.cmap = font.getBestCmap()
        self.glyphs = font.getGlyphSet()
        self.upm = font["head"].unitsPerEm
        self.cache: dict = {}

    def width(self, text: str, size: float, tracking: float = 0.0, extra: dict[int, float] | None = None) -> float:
        return self.path(text, size, 0, 0, tracking, extra)[1]

    def path(self, text: str, size: float, x: float, y: float, tracking: float = 0.0,
             extra: dict[int, float] | None = None) -> tuple[str, float]:
        """tracking in em; extra maps a character index to an additional advance in em after that character."""
        scale = size / self.upm
        pen = SVGPathPen(self.glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        cursor = 0.0
        names = [self.cmap.get(ord(ch), ".notdef") for ch in text]
        for i, name in enumerate(names):
            tpen = TransformPen(pen, (scale, 0, 0, -scale, x + cursor * scale, y))
            self.glyphs[name].draw(tpen)
            cursor += self.glyphs[name].width
            if i + 1 < len(names):
                cursor += kern(self.font, self.cache, name, names[i + 1])
                cursor += tracking * self.upm
                if extra and i in extra:
                    cursor += extra[i] * self.upm
        return pen.getCommands(), cursor * scale

    def metric(self, attr: str) -> float:
        return getattr(self.font["OS/2"], attr) / self.upm
