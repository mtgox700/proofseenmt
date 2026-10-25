# Polices PDF de la marque

Instances TTF statiques des polices de Proofseen, pour le moteur de documents (pdfmake 0.3.12 sur pdfkit 0.20.2,
décision L1-006). Générées une fois, versionnées, vérifiées par empreinte. Le site, lui, garde ses WOFF2
(`apps/web/public/fonts/`) : rien ne change côté web.

## Pourquoi pas les WOFF2 du site

1. fontkit 2 (sous pdfkit) ne lit pas le WOFF2 et ne dessine que l'instance par défaut d'une police variable
   (`.war-room/sprints/L1_PDF_ENGINE.md`, section 4).
2. Les WOFF2 du site sont des sous-ensembles web : 246 points de code, **3 sur 336** du Latin étendu A et B, et pas de
   `Ÿ` (U+0178). Convertis tels quels, ils impriment un carré vide dans « Łukasz », « Ștefan », « Nguyễn », « Dvořák »,
   « Çağrı » ou « L'HAŸ-LES-ROSES » (voir `specimen.png`, ligne « La même ligne avec la police du site »). Dans un
   contrat, le nom d'une partie ne peut pas sortir en carré.

Les instances sont donc refaites depuis les polices variables originales d'Adobe, avec les mêmes axes que le site.

## Les fichiers

| Fichier | Rôle | Origine, axes | Octets | Glyphes | SHA-256 |
|---|---|---|---|---|---|
| `ps-display-400.ttf` | titres, graisse normale | Source Serif 4, wght 400, opsz 48 | 150 016 | 1 093 | `f5f1f6dda0d049035f8903af01608cba755ed54c87da5edf76bd938b2d45f3eb` |
| `ps-display-600.ttf` | titres (graisse de la marque) | Source Serif 4, wght 600, opsz 48 | 150 592 | 1 093 | `7fd1b539f72b3b1e6afc3ad286f38f19d9c8651ce02911df19ba5ee83484eb27` |
| `ps-display-700.ttf` | titres, gras | Source Serif 4, wght 700, opsz 48 | 150 336 | 1 093 | `3d9028a212fe09c8ed901085f75b85297288340f13715fd7e8e8d0a92d0c69dd` |
| `ps-text-400.ttf` | corps du document | Source Serif 4, wght 400, opsz 10 | 149 136 | 1 093 | `c3bb0c89b01f4f728fa9b389eacbd25bba6980d32ae9d78c1ea32b80f131d20f` |
| `ps-text-700.ttf` | corps, gras | Source Serif 4, wght 700, opsz 10 | 148 936 | 1 093 | `4d32f0806deee75f58d8c612b7839b0707795f928af229f2d9fbc99691e9e317` |
| `ps-mono-500.ttf` | la trace : références, dates, empreintes, montants | Source Code Pro, wght 500 | 65 160 | 948 | `4d968306aff168040ed8cf9d796d8c355c314072717b0b4a6617e1f5d678d121` |

Total 814 176 octets au dépôt ; un PDF n'embarque que les glyphes qu'il emploie (spécimen complet : 43 068 octets,
contrat court rendu par pdfmake : 14 400 octets).

- **PS Display** (opsz 48) reprend exactement le dessin du site : sur les 246 points de code communs, avances et boîtes
  identiques à 0 unité près en 400, à 2 unités sur 1 000 au plus en 600 et 700 (arrondi d'interpolation).
- **PS Mono** 500 est identique au site sur ses 244 points de code communs (0 unité d'écart). Pas de gras : la marque
  fige la mono à 500 (`BRAND_BOOK.md` §4).
- **PS Text** (opsz 10) est une **proposition** : le texte courant du site est la police système (`system-ui`, Segoe UI,
  SF Pro, Roboto), qui n'existe pas dans l'image Docker du serveur (`node:22-bookworm-slim`) et n'est pas à nous ; un
  PDF déterministe ne peut embarquer qu'une police versionnée. À 10 pt, le dessin opsz 48 du titre est trop fin et trop
  serré (`specimen.png`, bloc « Corps de contrat à 10 pt ») ; la taille optique 10 de la même famille est faite pour ce
  corps. Si la marque préfère un corps sans empattement, l'équivalent libre est Source Sans 3 (Adobe, OFL 1.1), à
  générer de la même façon : décision du Shogun.

Couverture de chaque instance : français complet, `«` `»` `‹` `›` `“` `”` `‘` `’` `„` `…` `–` `§` `°` `€` `£` `№`,
U+00A0 et U+202F (le format `money` des gabarits : `1 250,00 EUR`), Latin étendu A (Source Serif : 122 sur 128 ; manquent
Ĭ ĭ Ĳ ĳ Ŧ ŧ), roumain (Ș ș Ț ț), vietnamien, accents combinants, flèches, opérateurs, cases à cocher U+2610 à U+2612.
Manquent partout : U+2011 (trait d'union insécable) ; dans la mono seulement, U+2009 (espace fine). Les gabarits
n'emploient ni l'un ni l'autre.

Fonctionnalités OpenType conservées : `kern`, `liga`, `ccmp`, `locl`, `mark`, `mkmk`, `case`, `tnum`, `pnum`, `lnum`,
`onum`, `frac`, `numr`, `dnom`, `sups`, `subs`, `ordn`, `smcp`, `c2sc`, `zero`. Sans hinting (inutile dans un PDF),
contours superposés fusionnés (skia-pathops), dates `head` fixées à celles de l'original d'Adobe.

## Licence

SIL Open Font License 1.1, texte complet dans `OFL-source-serif-4.txt` et `OFL-source-code-pro.txt` (mêmes textes que
dans les archives d'Adobe, à la fin de ligne près). L'OFL permet l'embarquement dans un document, la modification et la
redistribution, à deux conditions tenues ici : la licence accompagne les fichiers ; « Source » est un nom de fonte
réservé, donc une version modifiée (instance, sous-ensemble) ne le porte pas en nom principal. Les tables `name` disent
PS Display, PS Text, PS Mono (identifiants 1 à 6, 16, 17) ; les mentions d'Adobe (0 copyright, 7 marque, 13 et 14
licence) sont conservées. La licence ne s'applique pas aux documents produits avec ces polices (OFL, condition 5).

## Origine

| Archive officielle | SHA-256 de l'archive | Fichier utilisé | SHA-256 du fichier (vérifié par le script) |
|---|---|---|---|
| https://github.com/adobe-fonts/source-serif/releases/download/4.005R/source-serif-4.005_Desktop.zip (publiée le 2023-01-20) | `549fdb8f9a682bd06944298621404969f6de77c2e422ff3b8244a1dcd6a0c425` | `source-serif-4.005_Desktop/VAR/SourceSerif4Variable-Roman.ttf` | `14d360ee1b76655da9276628b229e11671bc1f5d1083636144db6677d452cf55` |
| https://github.com/adobe-fonts/source-code-pro/releases/download/2.042R-u/1.062R-i/1.026R-vf/VF-source-code-VF-1.026R.zip (publiée le 2023-04-12) | `0660ba0cd1478f92cfcf2ad790b7aa29f8adb2daf15598f452a65ae61c9c9fb1` | `VF/SourceCodeVF-Upright.ttf` | `c4066e584e995ec317a072f1777742861d3ce0bf210096b84450a249d0210198` |

Ce sont les mêmes publications que celles des WOFF2 du site (`apps/web/CREDITS.md`).

## Régénérer

Hors du dépôt, dans un environnement isolé (Python 3.10, fonttools 4.65.0, skia-pathops 0.9.2, brotli 1.2.1) :

```sh
python -m venv fontvenv
fontvenv/Scripts/python -I -m pip install fonttools==4.65.0 skia-pathops==0.9.2 brotli==1.2.1
mkdir dl-serif dl-code
curl -sSL -o dl-serif/serif.zip https://github.com/adobe-fonts/source-serif/releases/download/4.005R/source-serif-4.005_Desktop.zip
curl -sSL -o dl-code/code.zip "https://github.com/adobe-fonts/source-code-pro/releases/download/2.042R-u/1.062R-i/1.026R-vf/VF-source-code-VF-1.026R.zip"
sha256sum dl-serif/serif.zip dl-code/code.zip   # comparer au tableau ci-dessus
(cd dl-serif && unzip -q serif.zip) && (cd dl-code && unzip -q code.zip)
fontvenv/Scripts/python -I <dépôt>/packages/brand/pdf-fonts/build_pdf_fonts.py \
  --serif dl-serif/source-serif-4.005_Desktop/VAR/SourceSerif4Variable-Roman.ttf \
  --code dl-code/VF/SourceCodeVF-Upright.ttf \
  --out <dépôt>/packages/brand/pdf-fonts
```

Le script refuse une source dont l'empreinte diffère, échoue si un caractère exigé manque ou si « Source » reste dans
un nom principal, et réécrit `manifest.json`. Environ 3 minutes sur le poste du founder (3 min 4 s mesurées ; la fusion des contours est lente). Deux générations
indépendantes du 2026-10-24 ont donné les mêmes octets pour les 7 fichiers.

## Contrôler

- `node packages/brand/pdf-fonts/verify.mjs` : taille et SHA-256 de chaque TTF contre `manifest.json` (sortie 0 ou 1,
  aucune dépendance). À brancher dans la CI à côté du test d'empreinte du document de référence.
- `PDFKIT_FROM=<dossier avec pdfkit> node packages/brand/pdf-fonts/specimen.mjs packages/brand/pdf-fonts out.pdf [web.ttf]`
  rend le spécimen ; `specimen.png` en est la page à 110 dpi (rendu poppler `pdftoppm`).

## Brancher dans pdfmake

```js
import { join, resolve, sep } from 'node:path';
const FONTS = resolve('packages/brand/pdf-fonts');
const f = (name) => join(FONTS, name);
pdfmake.setFonts({
  PSText: { normal: f('ps-text-400.ttf'), bold: f('ps-text-700.ttf'), italics: f('ps-text-400.ttf'), bolditalics: f('ps-text-700.ttf') },
  PSDisplay: { normal: f('ps-display-600.ttf'), bold: f('ps-display-700.ttf'), italics: f('ps-display-600.ttf'), bolditalics: f('ps-display-700.ttf') },
  PSMono: { normal: f('ps-mono-500.ttf'), bold: f('ps-mono-500.ttf'), italics: f('ps-mono-500.ttf'), bolditalics: f('ps-mono-500.ttf') },
});
pdfmake.setLocalAccessPolicy((p) => resolve(p).startsWith(FONTS + sep));
pdfmake.setUrlAccessPolicy(() => false);
```

Pièges mesurés :
- Sous Windows, pdfmake passe à la politique d'accès un chemin à barres inverses : un `startsWith` sur un chemin à
  barres obliques refuse toutes les polices (`Access to local file denied by resource access policy`). Comparer des
  chemins passés par `resolve`.
- Aucun italique n'existe (règle de la marque) : `italics` pointe sur le romain, rien n'est penché.
- Les chiffres par défaut de Source Serif 4 sont **déjà tabulaires** (avance unique) : les colonnes de montants
  s'alignent sans rien faire. `fontFeatures: ['pnum']` pour des chiffres proportionnels dans un paragraphe.
- Zéro barré de la trace : `fontFeatures: ['zero']` (pdfmake) ou `features: ['zero']` (pdfkit). Sans lui, le zéro de
  Source Code Pro est pointé.
- fontkit forme les fractions seulement autour de U+2044 : « 1/2 » et « 2026/10 » restent tels quels (vérifié).
- Normaliser les noms en NFC avant le rendu ; les accents combinants sont couverts mais le NFC donne un glyphe précomposé.
