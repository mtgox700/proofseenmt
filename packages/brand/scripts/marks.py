"""The Proofseen poincon (hallmark): geometry of the monogram, drawn by hand on a 32-unit grid.

Two optical masters, like a typeface with optical sizes:
- SMALL (16 to 48 px): the cartouche and the knocked-out P only, every edge on an even unit so it lands on whole
  pixels at 16 px;
- LARGE (64 px and up): the same, plus the struck keyline that runs inside the cartouche, as on a real punch.

The cartouche has concave corners: the outline of a hallmark punch, a stamp, a seal on a deed. The P is not set in
a font: it is drawn as a punch-cutter would, a heavy stem and a lighter bowl.
"""
from __future__ import annotations

import math

GRID = 32
CORNER = 6.0  # radius of the concave corner bites


def _fmt(v: float) -> str:
    return f"{v:.3f}".rstrip("0").rstrip(".")


def cartouche(inset: float = 0.0, size: float = GRID) -> str:
    """Concave-corner square, optionally inset (the offset of a concave arc keeps its centre, radius grows)."""
    r = CORNER + inset
    a = math.sqrt(r * r - inset * inset) if inset else CORNER
    lo, hi = inset, size - inset
    f = _fmt
    return (
        f"M{f(a)} {f(lo)}H{f(size - a)}"
        f"A{f(r)} {f(r)} 0 0 0 {f(hi)} {f(a)}V{f(size - a)}"
        f"A{f(r)} {f(r)} 0 0 0 {f(size - a)} {f(hi)}H{f(a)}"
        f"A{f(r)} {f(r)} 0 0 0 {f(lo)} {f(size - a)}V{f(a)}"
        f"A{f(r)} {f(r)} 0 0 0 {f(a)} {f(lo)}Z"
    )


# The P, drawn on the grid as a punch-cutter would: a 6-unit stem, 4-unit bowl strokes, slab serifs that a stamp
# keeps legible at 16 px. Every horizontal and vertical edge sits on an even unit: whole pixels at 16, 32 and 48 px. On the LARGE master the serifs get concave brackets of radius 2: the same concave arc as
# the corners of the cartouche, so the letter and its punch are cut from one gesture.
P_SMALL = "M8 6H18A6 6 0 0 1 24 12A6 6 0 0 1 18 18H16V24H20V26H8V24H10V8H8Z"
P_LARGE = (
    "M8 6H18A6 6 0 0 1 24 12A6 6 0 0 1 18 18H16V22A2 2 0 0 0 18 24H20V26H8V24"
    "A2 2 0 0 0 10 22V10A2 2 0 0 0 8 8Z"
)
P_COUNTER = "M16 10H18A2 2 0 0 1 20 12A2 2 0 0 1 18 14H16Z"

# The P spans 6 to 26: cap height 20 units, baseline at 26.
P_TOP = 6
P_BASELINE = 26

KEYLINE_OUT = 1.5
KEYLINE_IN = 2.25


def monogram_path(master: str) -> str:
    """One even-odd path: cartouche filled, P knocked out, counter filled, keyline knocked out on LARGE."""
    parts = [cartouche()]
    if master == "large":
        parts += [cartouche(KEYLINE_OUT), cartouche(KEYLINE_IN)]
    parts += [P_LARGE if master == "large" else P_SMALL, P_COUNTER]
    return "".join(parts)


def monogram_svg(fill: str, master: str = "large", size: int | None = None, title: str | None = "Proofseen") -> str:
    dims = f' width="{size}" height="{size}"' if size else ""
    label = f'<title>{title}</title>' if title else ""
    aria = ' role="img" aria-label="Proofseen"' if title else ' aria-hidden="true"'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {GRID} {GRID}"{dims}{aria}>{label}'
        f'<path fill="{fill}" fill-rule="evenodd" d="{monogram_path(master)}"/></svg>'
    )
