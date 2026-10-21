# BRAND BOOK : Proofseen, « le poinçon » (Vague 0 bis, Sumi, 2026-10-21)

> Proofseen : la preuve vérifiable de ce qu'un freelance a vraiment livré, et la mesure de sa visibilité dans les
> assistants IA. La marque doit rendre visibles trois choses : la preuve, la vérification, la trace.
> Ce document fixe chaque décision et sa raison. Les chiffres sont mesurés (scripts cités), jamais estimés.
> Planche : `.war-room/brand/PLANCHE.png`. Source unique des tokens : `packages/brand/src/`.

---

## 1. Ce que la base de design a proposé, ce que je garde, ce que je refuse

Requêtes lancées le 2026-10-21 sur `absorbed/ui-ux-pro-max` : `--design-system` (« verifiable proof trust marketplace
B2B freelancers evidence seal »), puis `--domain product`, `--domain typography`, `--domain color`, `--domain style`.

| Proposition de la base | Verdict | Raison |
|---|---|---|
| Style « Vibrant & Block-based » (marketplace P2P) | **refusé** | énergique, ludique, jeune : l'inverse d'un registre de preuves. C'est le style de mille marketplaces grand public. |
| Couleurs #2563EB + CTA #F97316 sur #F8FAFC | **refusé** | le bleu SaaS et l'orange d'appel sont la palette par défaut de l'industrie ; aucun lien avec la preuve. |
| Lexend + Source Sans 3 | **refusé** | correct mais anonyme (« corporate, accessible ») : ne porte ni l'idée de document ni celle de trace. |
| « Trust & Authority + Minimal » (B2B Service), « Swiss Modernism 2.0 » (plateforme de badges) | **gardé** | sobriété, hiérarchie stricte, grille : c'est le ton d'un registre. |
| « Authority navy + trust gold » (services juridiques) | **gardé comme idée, pas comme teinte** | l'idée d'une encre sombre et d'une seule couleur de garantie ; l'or est refusé (luxe, crypto). |
| Paires éditoriales (Newsreader, Source Serif) et paire « Developer Mono » | **gardé en partie** | un sérif de document pour les titres, une chasse fixe pour la trace. Pas de sans-serif servie : le texte courant est en police système. |
| Glassmorphism (SaaS général) | **refusé** | le mandat l'interdit ; un flou ne prouve rien. |
| Check-list « no emoji, focus visible, reduced-motion, 375 px » | **gardé** | reprise telle quelle dans les règles ci-dessous. |

Lus aussi : `references/signature-moves.md`, `references/masterpiece-gate.md`, `absorbed/apple-design/GUIDE.md` §15
(approche optique : approche négative qui grandit avec la taille, interlignage inverse de la taille, hiérarchie par
le couple graisse et taille, police système par défaut sauf raison).

## 2. La métaphore : le poinçon de garantie

Quand un objet en métal précieux est soumis à un bureau de garantie, le métal est essayé par un tiers, puis on y
**frappe un poinçon** : une petite marque dans un cartouche, qui atteste ce que l'objet est vraiment. Le poinçon de
garantie n'est pas celui du fabricant : il est frappé par le tiers qui a vérifié.

C'est exactement ce que fait Proofseen pour une mission : un tiers vérifie la pièce (facture, contrat, attestation du
client, accès au dépôt, paiement sur la plateforme), puis la mission porte une marque datée.

Pourquoi le poinçon plutôt que les autres pistes du mandat :

| Piste | Verdict | Raison |
|---|---|---|
| **Poinçon / tampon de vérification** | **retenu** | une forme simple et pleine, faite pour être lue en tout petit (un poinçon mesure quelques millimètres) ; il dit « vérifié par un tiers », pas « je l'affirme » ; il se frappe, ce qui donne un geste de mouvement naturel. |
| Sceau de cire | refusé | illisible à 16 px (relief, coulures), connotation notariale ancienne. |
| Empreinte digitale | refusé | biométrie, surveillance : interdit par `MARQUE.md` §5 (« rien qui évoque la surveillance »). |
| Signature manuscrite | refusé | se dégrade en gribouillis à 16 px, et une signature est une affirmation de soi, pas une vérification. |
| Horodatage seul | refusé comme logo, **gardé comme système** | trop abstrait pour un symbole ; il devient la règle « toute preuve affichée porte sa date » et la police mono de la trace. |
| Intervalle de confiance (ancien symbole) | retiré du logo | il dit « mesure », pas « preuve ». Il reste le motif des fourchettes dans les graphiques de mesure. |

Le cartouche à **coins concaves** (des quarts de cercle mordus dans les angles) est la silhouette des poinçons, des
tampons et des timbres. Il devient la forme réservée à ce qui est vérifié, dans le logo comme dans l'interface (§6).

## 3. Le logo

### 3.1 Construction

- Grille de 32 unités. Cartouche plein de 32 x 32, coins concaves de rayon 6.
- Le **P** est évidé (il prend la couleur du fond), dessiné à la main comme un poinçon de graveur : fût de 6 unités,
  panse de 4 unités, empattements plats. Toutes les arêtes horizontales et verticales tombent sur une unité **paire** :
  pixels entiers à 16, 32 et 48 px.
- Deux maîtres optiques, comme une fonte à tailles optiques :
  - **small** (16 à 48 px) : cartouche et P seuls ;
  - **large** (64 px et plus) : un filet frappé court à l'intérieur du cartouche (décalé de 1,5 et 2,25 unités, même
    rayon concave agrandi), et les empattements du P reçoivent des **congés concaves de rayon 2** : le même arc que
    les coins du cartouche. La lettre et son poinçon sont taillés du même geste.
- Logotype : « Proofseen » en PS Display (Source Serif 4, taille optique 48, graisse 600), approche -0,012 em, crénage
  de la police appliqué, converti en contours (aucun texte dans les SVG, vérifié par test).
- Lockup : le P du poinçon a **la même hauteur de capitale et la même ligne de base** que le P du logotype ;
  espace entre poinçon et mot : 0,30 fois la largeur du poinçon.

### 3.2 Ce que j'ai regardé et corrigé (rendus à 16, 32, 48, 64 et 512 px)

1. Premier jet : P sans empattement dans un carré. Rendu regardé : **il se lit comme un panneau de parking**. Rejeté.
2. P tiré de la police (Source Serif) : contours qui se chevauchent dans la fonte variable, donc des rayures en
   remplissage pair-impair, et des empattements trop fins à 16 px. Rejeté.
3. P à empattements plats dessiné à la main : lisible, lu comme un tampon. Retenu.
4. Ce P posé sur des demi-unités (7 à 25) : flou d'un pixel à 16 px sur toutes les arêtes horizontales. Recalé sur
   les unités paires (6 à 26) : net à 16, 32 et 48 px.
5. Avec le P recalé, l'empattement de tête touchait presque le filet intérieur (0,24 unité d'écart) : réduit de
   8 à 10 unités, écart porté à 1,75 unité.
6. Carte de partage : le poinçon touchait la fin du titre ; titre ramené de 70 à 64 px et poinçon de 292 à 250 px.
7. Planche : le rendu 512 masquait le rendu 64 et les ratios chevauchaient les noms de couleurs ; mise en page refaite.

### 3.3 Versions et fichiers (identiques dans `apps/web/public/brand/` et `apps/landing/public/brand/`)

| Fichier | Usage |
|---|---|
| `ps-monogram-{dark,light,mono}.svg` | poinçon, maître large (64 px et plus) |
| `ps-monogram-small-{dark,light,mono}.svg` | poinçon, maître small (16 à 48 px) |
| `ps-logotype-{dark,light,mono}.svg` | mot seul |
| `ps-lockup-{dark,light,mono}.svg` | poinçon small + mot : en-têtes, pieds de page |
| `ps-lockup-display-{dark,light,mono}.svg` | poinçon large + mot : quand le poinçon dépasse 64 px |
| `favicon.svg` | maître small, vert foncé par défaut, vert clair sous `prefers-color-scheme: dark` |
| `favicon.ico` | 16, 32, 48 px (PNG dans l'ICO), P plein couleur papier pour rester lisible sur un onglet clair ou sombre |
| `icon-192.png`, `icon-512.png` | PWA « any » : fond encre, poinçon à 72 % |
| `maskable-192.png`, `maskable-512.png` | PWA « maskable » : poinçon à 56 %, sa demi-diagonale (0,396) reste dans le cercle sûr de 0,40 |
| `apple-touch-icon.png` | 180 px, fond encre, poinçon à 64 % |
| `og-fr.png`, `og-en.png` | carte de partage 1200 x 630 ; sources SVG dans `packages/brand/assets/` |

`dark` = pour fond sombre (poinçon `#6fd690`, mot `#eeeae1`) ; `light` = pour fond clair (poinçon `#0c6a41`, mot
`#15140f`) ; `mono` = `currentColor` partout, à insérer en ligne (dans une balise `<img>`, `currentColor` vaut noir).

Poids : poinçon 356 o (small) et 685 o (large), logotype 6,2 Ko, lockup 6,5 Ko, favicon.svg 428 o, favicon.ico 1 260 o,
icônes 3,1 à 12,2 Ko, cartes de partage 46,5 et 47,9 Ko.

### 3.4 Règles d'usage

- Taille minimale : poinçon 16 px ; lockup 20 px de haut. Sous 48 px, toujours le maître small.
- Zone de protection : un quart de la largeur du poinçon tout autour, sans texte ni filet.
- Le poinçon est la seule chose verte d'une page avant toute preuve : c'est lui, la marque de vérification.
- **Interdits** : déformer, incliner, ombrer, contourer, poser sur une photo chargée, recolorer hors palette, remplir le
  P (sauf ICO et icônes opaques générés), mettre le logotype en italique ou dans une autre police, animer le poinçon
  en boucle, l'utiliser comme badge « vérifié » sur un profil (le badge réel d'une preuve est le cartouche d'interface
  du §6, avec sa date et sa source).

## 4. Typographie

Deux familles servies, une gratuite. Licences vérifiées : SIL OFL 1.1 pour les deux, fichiers de licence copiés à côté
des polices. Sources officielles d'Adobe (releases GitHub), voir `apps/web/CREDITS.md`.

| Rôle | Famille | Fichier | Poids mesuré | Réglages |
|---|---|---|---|---|
| Titres, chiffres clés, logotype | **PS Display** = Source Serif 4 | `apps/web/public/fonts/ps-display-v1.woff2` | **38 340 o (37,4 Ko)** | taille optique figée à 48, axe de graisse 400 à 700, 329 glyphes, latin + ponctuation française et € |
| La trace : références, dates, sources, montants, libellés | **PS Mono** = Source Code Pro | `apps/web/public/fonts/ps-mono-v1.woff2` | **11 260 o (11,0 Ko)** | graisse 500 figée, 290 glyphes, zéro barré disponible (`font-feature-settings: "zero"`) |
| Texte courant, interface | police système (`system-ui`, Segoe UI, SF Pro, Roboto) | aucun | 0 o | identique sur React et sur le hub |

Total servi : 49 600 o. Pourquoi :
- **Source Serif 4** descend des caractères de Pierre-Simon Fournier, typographe français qui a inventé le point
  typographique, une unité de mesure. Un sérif de document, sobre, rarement vu sur les landing pages, dont la taille
  optique 48 donne des titres tendus et nets. Newsreader (l'ancien choix) n'est pas mauvais, mais le changement doit
  se voir au premier écran.
- **Source Code Pro** est de la même famille de dessin : la trace et le titre parlent la même langue.
- **La police système pour le texte** : zéro octet, déjà réglée par chaque plateforme (`apple-design` §15), et c'est
  ce que le hub utilise déjà pour tenir Lighthouse à 100 (arbitrage 5 du Shogun). React s'aligne : un seul texte partout.
- Renommage : « Source » est un nom réservé ; un sous-ensemble est une version modifiée, d'où « PS Display » et
  « PS Mono » (table `name` réécrite par `scripts/fonts.py` hors dépôt, décrit au §10).

**Polices de repli calées** (mesurées le 2026-10-21 avec fontTools sur les copies Windows ; méthode de `next/font` :
avance moyenne pondérée d'un échantillon FR + EN, puis métriques verticales exprimées dans l'em du repli) :

| Repli | Graisse | size-adjust | ascent-override | descent-override |
|---|---|---|---|---|
| Georgia | 400 à 500 | 94 % | 110,21 % | 35,64 % |
| Georgia Bold | 600 à 700 | 82,22 % | 126,01 % | 40,74 % |
| Times New Roman | 400 à 500 | 101,93 % | 101,64 % | 32,86 % |
| Times New Roman Bold | 600 à 700 | 97,98 % | 105,74 % | 34,19 % |
| Consolas | 400 à 700 | 109,13 % | 90,17 % | 25,02 % |
| Courier New | 400 à 700 | 99,98 % | 98,42 % | 27,30 % |

`line-gap-override: 0%` partout. `font-display: swap` pour les deux. Non mesuré : macOS et Android (Georgia et Times
existent sur macOS avec des métriques proches mais pas vérifiées ; Android n'a ni l'une ni l'autre et tombera sur
`serif` sans ajustement). Le CLS réel est à mesurer en production (leçon de `references/performance.md`).

**Échelle** (tierce mineure 1,2 à 375 px, quarte 1,333 à 1440 px, corps de 16 à 17 px ; `clamp()` exact aux deux bornes) :

| Pas | 375 px | 1440 px | Approche | Interlignage | Usage |
|---|---|---|---|---|---|
| `--ps-step-5` | 39,8 | 71,6 | -0,028 em | 1,0 | titre d'accueil |
| `--ps-step-4` | 33,2 | 53,7 | -0,024 em | 1,05 | titre de page |
| `--ps-step-3` | 27,6 | 40,3 | -0,018 em | 1,1 | titre de section |
| `--ps-step-2` | 23,0 | 30,2 | -0,012 em | 1,18 | sous-titre, chiffre clé |
| `--ps-step-1` | 19,2 | 22,7 | -0,006 em | 1,3 | chapeau |
| `--ps-step-0` | 16 | 17 | 0 | 1,6 | texte courant (16 px minimum : champs de formulaire) |
| `--ps-step--1` | 14 | 14,5 | +0,005 em | 1,5 | légendes |
| `--ps-step--2` | 12 | 12,5 | +0,01 em | 1,45 | libellés mono en capitales (+0,06 em : `--ps-track-label`) |

Règles : titres en PS Display 600 (420 pour les très grands chiffres) ; **aucun italique** (aucun fichier italique
servi, donc jamais d'italique synthétisé : l'accent passe par la graisse) ; chiffres tabulaires (`tnum`) dans les
tableaux ; la mono ne sert qu'à la trace, jamais à un paragraphe ; mesure de lecture 66 caractères.

## 5. Couleurs

Deux encres, un accent, trois couleurs d'état. Sombre par défaut ; le clair suit `prefers-color-scheme: light` ou
`[data-theme="light"]` (arbitrage 3 du Shogun). Ratios WCAG 2.x calculés par `contrastRatio()` de
`packages/brand/src/palette.ts` et vérifiés par `packages/brand/test/tokens.test.ts` (11 tests verts le 2026-10-21).

### Sombre (`color-scheme: dark`, `theme-color` `#0e0e0c`)

| Token | Valeur | sur bg | sur surface | sur raised | Seuil |
|---|---|---|---|---|---|
| `--ps-bg` encre | `#0e0e0c` | | | | |
| `--ps-surface` | `#161613` | | | | |
| `--ps-raised` | `#1e1e1a` | | | | |
| `--ps-text` papier | `#eeeae1` | 16,09 | 15,10 | 13,93 | 4,5 |
| `--ps-muted` | `#aaa59a` | 7,87 | 7,39 | 6,81 | 4,5 |
| `--ps-faint` | `#8f8a7f` | 5,62 | 5,27 | 4,87 | 4,5 |
| `--ps-proof` vert poinçon | `#6fd690` | 10,76 | 10,10 | 9,31 | 4,5 |
| `--ps-signal` | `#f0b44c` | 10,43 | 9,79 | 9,03 | 4,5 |
| `--ps-danger` | `#f08a74` | 7,91 | 7,42 | 6,84 | 4,5 |
| `--ps-focus` | `#93b6ff` | 9,55 | 8,96 | 8,26 | 3 (anneau), 4,5 (lien) |
| `--ps-line-strong` (bords de contrôles) | `#77736a` | 4,09 | 3,84 | 3,54 | 3 |
| `--ps-line` (décor seulement) | `#2b2a26` | 1,35 | 1,26 | 1,16 | aucun : interdit sur un contrôle |

`--ps-on-proof` `#0b1a10` sur `--ps-proof` : 10,00. Fond vérifié `--ps-proof-wash` `#212d22` : texte 11,96, texte
secondaire 5,85, vert 7,99.

### Clair (`color-scheme: light`, `theme-color` `#f4f1ea`)

| Token | Valeur | sur bg | sur surface | sur raised | Seuil |
|---|---|---|---|---|---|
| `--ps-bg` papier | `#f4f1ea` | | | | |
| `--ps-surface` | `#fbf9f4` | | | | |
| `--ps-raised` | `#ffffff` | | | | |
| `--ps-text` encre | `#15140f` | 16,35 | 17,53 | 18,44 | 4,5 |
| `--ps-muted` | `#5c584e` | 6,29 | 6,74 | 7,09 | 4,5 |
| `--ps-faint` | `#6e695e` | 4,84 | 5,19 | 5,46 | 4,5 |
| `--ps-proof` | `#0c6a41` | 5,90 | 6,33 | 6,66 | 4,5 |
| `--ps-signal` | `#8a4b00` | 6,03 | 6,47 | 6,80 | 4,5 |
| `--ps-danger` | `#b0281c` | 5,88 | 6,30 | 6,63 | 4,5 |
| `--ps-focus` | `#2a55c8` | 5,76 | 6,18 | 6,50 | 3 / 4,5 |
| `--ps-line-strong` | `#8a8579` | 3,26 | 3,49 | 3,68 | 3 |
| `--ps-line` | `#dcd7cb` | 1,27 | 1,36 | 1,44 | décor seulement |

`--ps-on-proof` `#f4f1ea` sur `--ps-proof` : 5,90. `--ps-proof-wash` `#e3ebe2` : texte 15,14, secondaire 5,83, vert 5,47.

### Pourquoi ces couleurs, et la règle qui les tient

- **Encre et papier chauds**, pas le bleu nuit froid de l'ancienne charte : un document imprimé, pas un tableau de
  bord de trading. Le noir légèrement chaud (`#0e0e0c`) et le papier os (`#eeeae1`) se distinguent au premier écran
  de tous les sites « slate » générés.
- **Le vert ne se décore pas, il se mérite.** `--ps-proof` n'apparaît que sur ce qui est vérifié (une mission prouvée,
  une adresse dont la possession est prouvée, un paiement passé par Proofseen) et sur le poinçon lui-même. Jamais sur
  un bouton d'appel, un lien, un fond décoratif, une illustration. Une page sans preuve est en noir et blanc : le
  vert, quand il paraît, est une information.
- Les boutons principaux sont **papier sur encre** (`--ps-text` en fond, `--ps-bg` en texte) : le contraste maximal
  sans voler le vert.
- `--ps-signal` (ambre) : à corriger, non confirmé, disponibilité de plus de 30 jours. `--ps-danger` : bloquant. Ces
  états sont toujours doublés d'un mot ou d'une icône (daltonisme).
- `--ps-focus` (bleu) : anneau de focus de 2 px décalé de 2 px, et liens dans le texte. Pas une couleur de marque.
- Refusés : dégradé violet, halo vert en fond de page (présent aujourd'hui sur tout le hub, `html.ts:21`), lueurs
  colorées sous les boutons, `text-shadow` lumineux.

## 6. Grille, espace, forme, profondeur

- **Grille** : 12 colonnes, largeur max `--ps-max: 76rem`, gouttière `--ps-gutter` de 16 à 32 px (fluide), mesure
  de lecture `--ps-measure: 66ch`. Grilles CSS en `minmax(0, 1fr)` (leçon payée : débordement à 375 px).
- **Espace** : base 4 px, `--ps-space-1` (4 px) à `--ps-space-10` (128 px) : 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- **Rayons** : un seul rayon d'interface, `--ps-radius: 4px` (boutons, champs, cartes). Les pilules de 999 px
  disparaissent (le hub en compte 8 aujourd'hui). La forme réservée : **le coin de poinçon**
  `--ps-radius-seal: 10px` avec `corner-shape: scoop` (coins concaves), uniquement sur les éléments vérifiés (le
  cartouche « Vérifié le … · facture »). En amélioration progressive : `@supports (corner-shape: scoop)` ; sans support,
  le cartouche garde un rayon de 4 px et un filet vert, la preuve reste lisible. Le support navigateur de
  `corner-shape` n'a **pas** été vérifié ici : Tetsu le teste au lot a.
- **Profondeur** : portée par les trois fonds (`bg`, `surface`, `raised`) et un filet de 1 px. Deux ombres seulement :
  `--ps-shadow-1` (cartes au survol) et `--ps-shadow-2` (menus, dialogues). Aucune ombre colorée, aucun flou d'arrière-plan
  décoratif (l'en-tête en `backdrop-filter: blur` disparaît).
- **Icônes** : trait 1,5 px, grille de 24 px, extrémités carrées (cohérentes avec le poinçon) ; aucun emoji, aucune
  icône de robot, cerveau, loupe, œil, fusée (`MARQUE.md` §5).

## 7. Signature de mouvement : « frapper, encrer, tracer »

Tout mouvement de la marque est l'un de trois gestes. Rien ne flotte, rien ne rebondit.

| Token | Valeur | Geste |
|---|---|---|
| `--ps-ease-strike` | `cubic-bezier(.55, 0, 1, .45)` | **frapper** : accélère jusqu'à l'impact et s'arrête net, comme un poinçon |
| `--ps-ease-ink` | `cubic-bezier(.2, .8, .2, 1)` | **encrer** : l'encre s'étale vite puis se pose |
| `--ps-ease-out` | `cubic-bezier(.16, 1, .3, 1)` | entrées d'interface (menus, panneaux) |
| `--ps-ease-in-out` | `cubic-bezier(.65, 0, .35, 1)` | **tracer** : un fil qui se dessine |
| `--ps-dur-press` | 90 ms | appui sur un bouton |
| `--ps-dur-ui` | 160 ms | survol, ouverture de menu |
| `--ps-dur-strike` | 140 ms | descente du poinçon |
| `--ps-dur-ink` | 240 ms | étalement de l'encre après l'impact |
| `--ps-dur-reveal` | 320 ms | apparition d'un bloc |
| `--ps-dur-trace` | 640 ms | fil qui se dessine |

Sous `prefers-reduced-motion: reduce`, strike, ink, reveal et trace passent à 0 ms (l'état final s'affiche),
press et ui restent (retour d'état, pas de déplacement). Seules `transform` et `opacity` s'animent. Aucun contenu ne
part d'une opacité nulle (arbitrage 6) : on anime depuis l'état visible.

## 8. Trois moments signatures pour Kaze (liés à la preuve, à réinventer)

1. **La frappe.** Sur un profil, chaque mission prouvée porte son cartouche (coins de poinçon, vert, « Vérifiée le
   12 octobre 2026 · facture »). Au premier passage dans la vue, le cartouche est **déjà visible** ; il se frappe :
   `scale(1.06)` vers `scale(.97)` en 140 ms (`strike`), retour à 1 en 120 ms, puis un anneau d'encre (pseudo-élément,
   bordure verte qui s'élargit et passe à `transparent`) en 240 ms (`ink`). Une seule fois, décalé de 80 ms d'une
   mission à la suivante, plafonné à 6. Sans JS et sur le hub : CSS pur (`animation-timeline: view()` si supporté,
   sinon rien ne bouge). Reduced-motion : pas de frappe, le cartouche est là. Contrainte du hub : les tests refusent la
   chaîne `opacity:0` dans le CSS, d'où l'anneau en `border-color: transparent`.
2. **Le fil de trace.** Chaque affirmation d'un profil (une compétence, une mission) est reliée à sa pièce (facture,
   contrat, attestation, dépôt) par un filet de 1 px qui se dessine en 640 ms (`stroke-dashoffset`, `in-out`) quand la
   ligne entre dans la vue, et finit sur un carré vert de 8 px (le même que sur la carte de partage). Le code ne
   connaît pas de preuve au niveau du commit (AUDIT §6, point 7) : le fil va jusqu'à la **pièce**, pas jusqu'au commit.
   Sans JS : le fil est dessiné. Interruptible : c'est une animation CSS liée au défilement.
3. **Le registre des réponses.** La mesure de visibilité montrée comme un registre : une case par réponse d'assistant,
   grise par défaut ; les cases où le profil est cité s'encrent en vert une à une (`ink`, 24 ms d'écart, plafonné à
   1,2 s), le compteur mono suit. Avec les vraies données du founder (780 réponses, 0 citation, fourchette 0 à 1,9 %,
   `TEAM_MEMORY.md:367`), **rien ne s'allume** et la ligne dit « 0 sur 780 » : l'honnêteté est le spectacle. Toute
   autre série porte « exemple illustratif, données fictives ». SVG statique rendu côté serveur (arbitrage 7), mouvement
   chargé après le LCP.

## 9. Partager les tokens entre React et le hub

Constat (AUDIT §1.2) : React lit `apps/web/src/styles/tokens.css` (`--bg`, `--proof`...), le hub recopie la palette
sous d'autres noms dans une chaîne (`packages/hub/src/html.ts:16-18`), la landing a un troisième jeu.

Mécanisme livré : **un paquet `@proofseen/brand`** (`packages/brand/`), sans dépendance, exporté en TypeScript comme les
autres paquets du dépôt.
- Source unique : `src/palette.ts` (couleurs, paires de contraste, `contrastRatio`), `src/type.ts` (polices, replis,
  échelle), `src/tokens.ts` (assemble le CSS).
- `tokens.css` est **généré** (`pnpm exec tsx packages/brand/scripts/write-tokens.ts`) et le test échoue s'il diverge.
  5 402 o, 1 595 o en gzip, `@font-face` compris.
- **React** (lot a) : `import "@proofseen/brand/tokens.css"` dans `app/[lang]/layout.tsx`, puis migration des noms
  `--bg` vers `--ps-bg` ; préchargement `<link rel="preload" as="font" type="font/woff2" crossorigin>` de
  `FONT_FILES.display` sur les pages dont le LCP est un titre.
- **Hub** (lot a) : `import { TOKENS_CSS } from "@proofseen/brand"` et insertion dans `STYLES` à la place de la ligne
  `:root` actuelle (un seul `<style>`, aucun script : `marketplace-verify` reste vert). Le hub ne charge que
  PS Display (arbitrage 5) ; sa mono tombe sur Consolas ou Courier New calés.
- Pièges à connaître : `apps/web/test/pwa.test.ts` lit `apps/web/src/styles/tokens.css` par regex sur `--bg`,
  `--proof`... : il faut garder ces noms (ou mettre le test à jour) le temps de la migration. Les PWA actuelles
  (`public/icons/*`) restent en place ; les nouvelles sont dans `public/brand/` et le lot a repointe le manifeste.
  Les couleurs restent en hexadécimal (`#rrggbb`) : le contrôle de contraste de `audit-page.js` ne lit que `rgb()`.

## 10. Reproduire

Fichiers sources dans `packages/brand/scripts/` (Python : fontTools et brotli ; TypeScript : tsx et sharp d'apps/web) :
- `marks.py` : géométrie du poinçon ; `glyphs.py` : texte vers contours, avec le crénage GPOS ;
- `build_brand.py assets <tmp>` puis `pnpm exec tsx packages/brand/scripts/render.ts <tmp>/jobs-assets.json` ;
- `build_brand.py sheet <tmp>` puis `render.ts <tmp>/jobs-sheet.json` (planche) ; `build_brand.py mirror <tmp>` (copie
  vers la landing).
- Polices : instanciation et sous-ensemble faits avec `fontTools.varLib.instancer` et `fontTools.subset` à partir de
  `SourceSerif4Variable-Roman.ttf` (release 4.005R) et `SourceCodeVF-Upright.ttf` (release 1.026R-vf), table `name`
  réécrite. Le script n'est pas versionné (il lit des fichiers téléchargés) : réglages exacts au §4.

## 11. Ce qui n'est pas vérifié, et ce que le Shogun doit trancher

Non vérifié :
- Aucun écran n'utilise encore la charte : contrastes mesurés sur les paires, pas en situation.
- CLS réel du passage repli vers police : à mesurer en production (macOS et Android non mesurés).
- Support de `corner-shape: scoop` dans les navigateurs cibles.
- Rendu du favicon dans les onglets réels de Chrome, Firefox et Safari (vérifié en PNG sur fonds blanc et `#202124`).
- Antériorité du dessin : aucune recherche de marque figurative (EUIPO, INPI) faite sur le poinçon.

À trancher :
1. **Le vert réservé** : le bouton d'appel principal n'est plus vert (papier sur encre). Accepter cette règle, qui
   change l'habitude de l'ancienne charte.
2. **Hub : PS Display seule** (arbitrage 5) ou aussi PS Mono (11 Ko) sur les profils, là où la trace compte le plus.
3. **Phrase de la carte de partage** : « La preuve de ce qu'un freelance a vraiment livré. » reprend la phrase du
   mandat ; `llms.txt` décrit d'abord une marketplace (AUDIT §6, point 8). À aligner.
4. **`apps/landing`** reçoit les fichiers de marque mais n'est pas déployée : la garder synchronisée ou la retirer.
