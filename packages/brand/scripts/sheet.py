"""Specimen sheet (.war-room/brand/PLANCHE.png): the poincon at real pixel sizes, lockups, colours with their
measured ratios, the type scale. Rendered from an SVG whose text is outlined, so what is shown is the brand font."""
from __future__ import annotations

import base64
import io
import json
import os

from PIL import Image

import marks

W = 2000
ORDER = ["bg", "surface", "raised", "text", "muted", "faint", "line", "line-strong", "proof", "on-proof",
         "proof-wash", "signal", "danger", "focus"]
USE = {"bg": "page", "surface": "cartes", "raised": "menus", "text": "texte", "muted": "texte secondaire",
       "faint": "texte tertiaire", "line": "filet (décor)", "line-strong": "bord de contrôle", "proof": "preuve",
       "on-proof": "texte sur preuve", "proof-wash": "fond vérifié", "signal": "à corriger", "danger": "bloquant",
       "focus": "focus, liens"}
SCALE = [("5", 39.81, 71.56, -0.028), ("4", 33.18, 53.68, -0.024), ("3", 27.65, 40.27, -0.018),
         ("2", 23.04, 30.21, -0.012), ("1", 19.2, 22.67, -0.006), ("0", 16, 17, 0), ("-1", 14, 14.5, 0.005),
         ("-2", 12, 12.5, 0.01)]


def lum(hex_: str) -> float:
    def ch(v: int) -> float:
        c = v / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def ratio(a: str, b: str) -> float:
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def data_uri(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


class Sheet:
    def __init__(self, t, dark: dict, light: dict):
        self.t, self.dark, self.light = t, dark, light
        self.out: list[str] = []

    def mono(self, text: str, size: float, x: float, y: float, fill: str, track: float = 0.04) -> float:
        d, w = self.t.mono.path(text, size, x, y, track)
        self.out.append(f'<path fill="{fill}" d="{d}"/>')
        return w

    def display(self, text: str, size: float, x: float, y: float, fill: str, track: float, light: bool = False) -> float:
        ts = self.t.display_regular if light else self.t.display
        d, w = ts.path(text, size, x, y, track)
        self.out.append(f'<path fill="{fill}" d="{d}"/>')
        return w

    def sans(self, text: str, size: float, x: float, y: float, fill: str) -> None:
        if self.t.sans:
            d, _ = self.t.sans.path(text, size, x, y)
            self.out.append(f'<path fill="{fill}" d="{d}"/>')

    def rect(self, x, y, w, h, fill, stroke=None) -> None:
        s = f' stroke="{stroke}"' if stroke else ""
        self.out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"{s}/>')

    def image(self, img: Image.Image, x: float, y: float) -> None:
        self.out.append(f'<image x="{x}" y="{y}" width="{img.width}" height="{img.height}" href="{data_uri(img)}"/>')

    def label(self, text: str, x: float, y: float, fill: str) -> None:
        self.mono(text.upper(), 15, x, y, fill, 0.08)


def poincon_panel(s: Sheet, tmp: str, theme: str, pal: dict, x: float, y: float, w: float) -> float:
    h = 640 if theme == "dark" else 330
    s.rect(x, y, w, h, pal["bg"])
    s.label(f"Poinçon, thème {'sombre' if theme == 'dark' else 'clair'} : rendus réels (maître small sous 48 px)", x + 30, y + 44, pal["muted"])
    cx = x + 30
    top = y + 80
    for size, zoom in ((16, 8), (32, 4), (48, 3)):
        img = Image.open(os.path.join(tmp, f"mono-small-{theme}-{size}.png")).convert("RGB")
        s.image(img.resize((size * zoom, size * zoom), Image.NEAREST), cx, top)
        s.image(img, cx, top + 150)
        s.mono(f"{size} px (x{zoom})", 14, cx, top + 150 + size + 26, pal["faint"])
        cx += 170
    img = Image.open(os.path.join(tmp, f"mono-large-{theme}-64.png")).convert("RGB")
    s.image(img, cx, top)
    s.mono("64 px", 14, cx, top + 64 + 26, pal["faint"])
    cx += 110
    if theme == "dark":
        big = Image.open(os.path.join(tmp, "mono-large-dark-512.png")).convert("RGB")
        s.image(big, x + w - 512 - 30, y + 70)
        s.mono("512 px, maître large", 14, x + w - 512 - 30, y + 70 + 512 + 24, pal["faint"])
    return y + h


def lockup_panel(s: Sheet, tmp: str, x: float, y: float, w: float) -> float:
    for theme, pal in (("dark", s.dark), ("light", s.light)):
        img = Image.open(os.path.join(tmp, f"lockup-{theme}.png")).convert("RGB")
        img = img.resize((420, round(img.height * 420 / img.width)), Image.LANCZOS)
        s.rect(x, y, w, 150, pal["bg"])
        s.image(img, x + 30, y + 75 - img.height // 2)
        s.mono("ps-lockup-" + theme + ".svg", 14, x + 500, y + 82, pal["faint"])
        y += 150
    return y


def colour_panel(s: Sheet, theme: str, pal: dict, x: float, y: float, w: float) -> float:
    rows = len(ORDER)
    h = 90 + rows * 50
    s.rect(x, y, w, h, pal["bg"])
    s.label(f"Couleurs {'sombre' if theme == 'dark' else 'clair'} : ratio sur bg / surface", x + 24, y + 44, pal["muted"])
    yy = y + 80
    for key in ORDER:
        hexv = pal[key]
        s.rect(x + 24, yy, 40, 34, hexv, pal["line-strong"])
        s.mono(f"--ps-{key}", 15, x + 80, yy + 15, pal["text"], 0.02)
        s.mono(f"{hexv}  {USE[key]}", 13, x + 80, yy + 33, pal["faint"], 0.02)
        if key not in ("bg", "surface", "raised", "on-proof", "proof-wash"):
            r1, r2 = ratio(hexv, pal["bg"]), ratio(hexv, pal["surface"])
            s.mono(f"{r1:.2f} / {r2:.2f}", 16, x + w - 230, yy + 23, pal["text"], 0.02)
        elif key == "on-proof":
            s.mono(f"{ratio(hexv, pal['proof']):.2f} sur proof", 16, x + w - 230, yy + 23, pal["text"], 0.02)
        elif key == "proof-wash":
            s.mono(f"texte {ratio(pal['text'], hexv):.2f}", 16, x + w - 230, yy + 23, pal["text"], 0.02)
        yy += 50
    return y + h


def type_panel(s: Sheet, x: float, y: float, w: float) -> float:
    pal = s.dark
    start = len(s.out)
    s.label("Échelle typographique : pas, taille de 375 à 1440 px, approche", x + 30, y + 44, pal["muted"])
    yy = y + 110
    samples = {"5": "Livré, vérifié, daté.", "4": "La preuve de ce qui a été livré.", "3": "Missions prouvées, faits datés.",
               "2": "Chaque fait porte sa source.", "1": "Une facture, un contrat, une attestation du client."}
    for name, lo, hi, track in SCALE:
        s.mono(f"step {name}", 14, x + 30, yy - 6, pal["faint"])
        s.mono(f"{lo:g} à {hi:g} px, {track:+g}em", 13, x + 30, yy + 14, pal["faint"])
        if name in samples:
            s.display(samples[name], hi, x + 330, yy, pal["text"], track)
            yy += hi * 1.25 + 14
        else:
            s.sans("Texte courant en system-ui (ici Segoe UI) : lisible, gratuit, le même partout.", hi, x + 330, yy, pal["muted"] if name != "0" else pal["text"])
            yy += 44
    s.mono("PS Mono 500, la trace", 14, x + 30, yy + 10, pal["faint"])
    s.mono("MISSION VÉRIFIÉE · FACTURE · 2026-10-21 · 0O 1lI", 22, x + 330, yy + 12, pal["proof"], 0.06)
    h = round(yy + 60 - y)
    s.out.insert(start, f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{pal["bg"]}"/>')
    return y + h


def build(t, tmp: str, dark: dict, light: dict, out_png: str) -> None:
    s = Sheet(t, dark, light)
    gap = 30
    full = W - 80
    half = (full - gap) // 2
    s.rect(0, 0, W, 4000, "#2b2a26")
    s.rect(40, 40, full, 110, dark["bg"])
    d, _ = t.display.path("Proofseen", 54, 70, 112, -0.012)
    s.out.append(f'<path fill="{dark["text"]}" d="{d}"/>')
    s.mono("PLANCHE DE MARQUE \u00b7 LE POIN\u00c7ON \u00b7 2026-10-21", 18, 400, 104, dark["muted"], 0.08)
    y = 40 + 110 + gap
    y = poincon_panel(s, tmp, "dark", dark, 40, y, full) + gap
    light_end = poincon_panel(s, tmp, "light", light, 40, y, half)
    lock_end = lockup_panel(s, tmp, 40 + half + gap, y, half)
    y = max(light_end, lock_end) + gap
    colour_panel(s, "dark", dark, 40, y, half)
    y = colour_panel(s, "light", light, 40 + half + gap, y, half) + gap
    y = type_panel(s, 40, y, W - 80) + 40
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {y}" width="{W}" height="{y}">' + "".join(s.out) + "</svg>"
    svg = svg.replace('height="4000"', f'height="{y}"', 1)
    path = os.path.join(tmp, "planche.svg")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(svg)
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    with open(os.path.join(tmp, "jobs-sheet.json"), "w", encoding="utf-8") as fh:
        json.dump([{"svg": path, "png": out_png, "width": W, "height": y}], fh)
