# BRAND BOOK V2 : Proofseen, « le poinçon dans la nuit » (Sumi, 2026-10-23)

> La v1 (`BRAND_BOOK.md`) a donné au site la rigueur d'un registre. Le founder l'a rejetée en production : trop
> austère, « journal de news », thème clair illisible, aucune lumière, aucune image. La v2 garde ce qui était juste
> (le poinçon, le vert qui se mérite, les deux polices, les trois gestes de mouvement) et change l'atmosphère : un site
> **sombre uniquement**, éclairé par une **lumière d'ambiance violette**, où **seul ce qui est vérifié brille en vert**,
> et peuplé de **vraies photos** de freelances au travail.
>
> Ce document remplace la v1 là où il la contredit (décisions du Shogun du 2026-10-23). Ce qui n'est pas repris ici
> reste valable dans la v1 : logo (§3), polices et replis calés (§4), gestes « frapper, encrer, tracer » (§7), partage
> des tokens (§9). Chaque ratio de contraste est **calculé** (formule WCAG 2.x, identique à `contrastRatio()` de
> `packages/brand/src/palette.ts`), jamais estimé. Planche des images : `.war-room/brand/PLANCHE_IMAGES_V2.jpg`.

---

## 1. Ce que la base de design a proposé, ce que je garde, ce que je refuse

Requêtes du 2026-10-23 sur `absorbed/ui-ux-pro-max` : `--design-system -p "Proofseen"` (« dark premium freelance
marketplace verified proof glow trust tech talent »), `--domain color` (« dark mode glow neon aurora electric violet
developer »), `--domain style` (« dark mode glow aurora bento »), `--domain typography`, `--domain landing`.

| Proposition de la base | Verdict | Raison |
|---|---|---|
| Système complet : « Vibrant & Block-based », #2563EB + CTA #F97316 sur #F8FAFC, Inter | **refusé** (comme en v1) | fond clair, bleu SaaS et orange d'appel par défaut : exactement ce que le founder rejette. |
| « Modern Dark (Cinema) » : fond presque noir sans noir pur, accent indigo #5E6AD2, halos d'ambiance lents à faible opacité (0,08 à 0,12), courbe `cubic-bezier(.16,1,.3,1)`, filets `rgba(255,255,255,.08)` | **gardé** | c'est le registre « pro, sombre, lumineux » demandé. La courbe est déjà notre `--ps-ease-out`. L'indigo devient notre aura, poussé vers un violet électrique plus lisible. |
| « Dark Mode (OLED) » : glow minimal, contraste 7:1 et plus | **gardé** | le texte principal est à 17,12:1 ; le glow reste rare. |
| Palette « Developer Tool / IDE » : fond code sombre + vert « run » | **gardé comme confirmation** | le vert sur sombre parle aux développeurs : notre vert de preuve est à sa place. |
| « Gradient Mesh / Aurora » multicolore (cyan, magenta, jaune) | **refusé en multicolore, gardé en bichromie** | un arc-en-ciel ne dit rien ; une aurore violet et azur, lente, derrière le héros, dit « lumière » sans voler le vert. |
| « Cyberpunk » : néons verts et magenta, scanlines, glitch | **refusé** | le vert néon partout tuerait le sens du vert ; le glitch dit « piratage », l'inverse de la preuve. |
| « Bento Grid Showcase » (landing) | **gardé** | grilles modulaires où photo et preuve alternent (§7). |
| Inter + Playfair, Calistoga, Orbitron | **refusé** | PS Display et PS Mono restent (décision du Shogun) ; la base confirme seulement le ratio « titre 5 fois le corps » pour les héros. |

## 2. Palette : sombre uniquement

**Décision.** Il n'y a plus de thème clair. `color-scheme: dark` partout, plus de bloc `prefers-color-scheme: light`,
plus de `[data-theme="light"]`, une seule `theme-color` : `#0a0b10`. Le public et l'espace connecté partagent la même palette.

**Pourquoi l'encre change.** La v1 utilisait une encre chaude (`#0e0e0c`). Sous une lumière violette et à côté de
photos d'écrans (bleues et froides), un noir chaud vire au brun boueux. L'encre v2 est un **noir de nuit très
légèrement bleuté** (`#0a0b10`), jamais noir pur (traînées sur OLED). Le papier reste chaud (`#f2efe8`) : le texte
garde l'idée du document imprimé, la nuit porte la lumière.

### 2.1 Tokens (valeurs v2) et contrastes mesurés

Colonnes : ratio du token sur chaque fond. Seuils : 4,5 pour du texte, 3 pour un contrôle ou un graphique utile.

| Token | v1 | **v2** | sur `deep` | sur `bg` | sur `surface` | sur `raised` | sur `overlay` | Seuil |
|---|---|---|---|---|---|---|---|---|
| `--ps-bg-deep` (nouveau : pied de page, fond du héros) | | `#06070a` | | | | | | |
| `--ps-bg` | `#0e0e0c` | `#0a0b10` | | | | | | |
| `--ps-surface` | `#161613` | `#11131a` | | | | | | |
| `--ps-raised` | `#1e1e1a` | `#191c25` | | | | | | |
| `--ps-overlay` (nouveau : menus, dialogues) | | `#222633` | | | | | | |
| `--ps-text` | `#eeeae1` | `#f2efe8` | 17,54 | 17,12 | 16,16 | 14,82 | 13,13 | 4,5 |
| `--ps-muted` | `#aaa59a` | `#b4b1aa` | 9,41 | 9,18 | 8,67 | 7,95 | 7,04 | 4,5 |
| `--ps-faint` | `#8f8a7f` | `#94918b` | 6,41 | 6,26 | 5,90 | 5,41 | 4,80 | 4,5 |
| `--ps-proof` | `#6fd690` | `#6fd690` (inchangé) | 11,22 | 10,95 | 10,33 | 9,48 | 8,40 | 4,5 |
| `--ps-aura-text` (nouveau : liens, focus) | | `#a99dff` | 8,59 | 8,38 | 7,91 | 7,26 | 6,43 | 4,5 |
| `--ps-aura` (nouveau : lumière, jamais du texte courant) | | `#7c6cff` | 5,22 | 5,10 | 4,81 | 4,41 | 3,91 | 3 (graphique) |
| `--ps-signal` | `#f0b44c` | `#f0b44c` (inchangé) | 10,88 | 10,61 | 10,02 | 9,19 | 8,14 | 4,5 |
| `--ps-danger` | `#f08a74` | `#f2907b` | 8,68 | 8,47 | 8,00 | 7,33 | 6,50 | 4,5 |
| `--ps-line-strong` (bords de contrôles) | `#77736a` | `#71768a` | 4,47 | 4,36 | 4,12 | 3,78 | 3,35 | 3 |
| `--ps-line` (décor seulement) | `#2b2a26` | `#262a36` | | 1,37 | 1,30 | | | aucun : interdit sur un contrôle |
| `--ps-focus` | `#93b6ff` | **= `--ps-aura-text`** `#a99dff` | | 8,38 | | | | 3 (anneau) |

Paires composées :

| Paire | Ratio |
|---|---|
| `--ps-on-proof` `#06140b` sur `--ps-proof` | 10,51 |
| `--ps-text` sur `--ps-proof-wash` `#0f2119` | 14,61 |
| `--ps-muted` sur `--ps-proof-wash` | 7,84 |
| `--ps-proof` sur `--ps-proof-wash` | 9,34 |
| Bouton principal : `--ps-bg` sur `--ps-text` (papier) | 17,12 |
| `--ps-bg` sur `--ps-aura` (si un fond violet plein porte du texte) | 5,10 |
| `--ps-text` sur `--ps-aura` | **3,36 : interdit** pour du texte |
| Carte survolée (surface + 10 % d'aura = `#1c1c31`) : text, muted, faint | 14,52 ; 7,79 ; 5,30 |

### 2.2 Ce que la lumière fait aux contrastes (mesuré)

La lumière d'ambiance éclaircit le fond sous le texte. Au point le plus lumineux de l'aurore, avec aura à 28 % et azur
à 18 % (mon premier jet), le fond devient `#2d3572` : `--ps-faint` tombe à **3,59** et `--ps-line-strong` à 2,50.
Échec. Plafonds retenus, mesurés au pire point (les deux halos superposés) :

| Aura max | Azur max | Fond obtenu | faint | muted | aura-text | line-strong | proof | text |
|---|---|---|---|---|---|---|---|---|
| 22 % | 12 % | `#262b5b` | 4,23 échec | 6,21 | 5,67 | 2,95 échec | 7,41 | 11,58 |
| 20 % | 10 % | `#242753` | 4,48 échec | 6,58 | 6,01 | 3,13 | 7,85 | 12,27 |
| **18 %** | **10 %** | `#22264f` | **4,58** | 6,73 | 6,14 | 3,20 | 8,02 | 12,54 |

**Règle : l'opacité cumulée de la lumière d'ambiance sous du texte ne dépasse jamais 18 % d'aura et 10 % d'azur.**
Au-delà (par exemple un halo plus fort derrière une image), aucun texte ni contrôle ne s'y pose.

En-tête translucide posé sur une photo blanche : à 72 % d'encre, `--ps-muted` tombe à 3,81 ; à 86 %, `--ps-faint` à
4,38. **L'en-tête est à 90 % d'encre minimum** (`rgb(10 11 16 / .9)`) : text 13,66, muted 7,33, faint 4,99,
aura-text 6,69.

### 2.3 Daltonisme (simulation Viénot 1999, mesurée)

| Vision | proof `#6fd690` | aura `#7c6cff` | signal `#f0b44c` |
|---|---|---|---|
| Protanopie | `#d6c88c` (beige) | `#0086ff` (bleu) | `#cbb640` |
| Deutéranopie | `#c7bd94` (beige) | `#007dfc` (bleu) | `#d9c450` |
| Tritanopie | `#58d3c4` (turquoise) | `#478eab` (bleu-gris) | `#ffa39e` |

Le vert et le violet ne se confondent dans aucune des trois. En revanche, en protanopie et deutéranopie, **le vert de
preuve et l'ambre de signal deviennent deux beiges proches** (c'était déjà vrai en v1). La règle v1 tient donc plus que
jamais : une preuve porte toujours la **forme** du poinçon et le **mot** « Vérifiée le … », un signal toujours son mot.

## 3. Le second accent : l'aura

**`--ps-aura` `#7c6cff`, violet électrique**, avec un partenaire de dégradé **`--ps-azur` `#3d7bff`** (jamais seul,
jamais du texte). Et **`--ps-aura-text` `#a99dff`**, sa version lisible pour le texte.

Le sens, en une phrase : **le violet est la lumière, le vert est la preuve.**
- Le violet éclaire : l'ambiance derrière le héros et les sections fortes, les liens, l'anneau de focus, le halo du
  bouton principal au survol, le bord lumineux des cartes au survol. Il dit « ici on peut agir, ici il se passe
  quelque chose ». C'est aussi la couleur de la **mesure** (la machine qui répond : registre des réponses d'IA,
  fourchettes), qui n'est pas une preuve.
- Le vert atteste : il ne paraît que sur ce qui est vérifié par un tiers (mission confirmée par son client ou payée sur
  Proofseen, possession d'une adresse prouvée) et sur le poinçon. Il ne sert jamais d'ambiance.
- Pourquoi ce violet : 108° d'écart de teinte avec le vert (vert 139°, violet 247°, azur 221°, calculés en TSL), il ne
  peut pas être pris pour une preuve ; il est assez saturé pour « briller » sur l'encre ; il n'est pas le bleu SaaS #2563EB que
  la base propose à tout le monde. Ratio vert/aura-text : 1,31, les deux ne servent donc jamais à se distinguer par la
  seule clarté (la forme et le mot le font).

Le focus devient violet (`--ps-aura-text`), anneau de 2 px **décalé de 2 px** : il se pose sur l'encre (8,38), pas
sur le bouton papier (où il ne ferait que 2,04).

## 4. Le système de glow

### 4.1 Tokens

```css
/* Preuve : halo vert. Seulement sur un élément vérifié et sur le poinçon. */
--ps-glow-proof: 0 0 0 1px rgb(111 214 144 / .55), 0 0 18px -2px rgb(111 214 144 / .45), 0 0 48px -8px rgb(111 214 144 / .30);
--ps-glow-proof-strike: 0 0 0 1px rgb(111 214 144 / .90), 0 0 28px 2px rgb(111 214 144 / .55), 0 0 80px -6px rgb(111 214 144 / .35);
--ps-halo-proof: radial-gradient(closest-side, rgb(111 214 144 / .28), rgb(111 214 144 / 0));

/* Lumière : aura violette. Ambiance, interaction. */
--ps-glow-aura: 0 0 0 1px rgb(124 108 255 / .45), 0 10px 40px -10px rgb(124 108 255 / .55);
--ps-glow-cta: 0 0 0 1px rgb(242 239 232 / .90), 0 8px 32px -8px rgb(124 108 255 / .65), 0 0 64px -16px rgb(124 108 255 / .50);
--ps-edge-spot: radial-gradient(260px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgb(124 108 255 / .70), rgb(124 108 255 / 0) 60%);
--ps-edge-spot-proof: radial-gradient(260px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgb(111 214 144 / .70), rgb(111 214 144 / 0) 60%);

/* Ambiance : plafonds du §2.2 (aura 18 %, azur 10 % au pire point). */
--ps-ambient-hero:
  radial-gradient(60% 55% at 18% 6%, rgb(124 108 255 / .18), rgb(124 108 255 / 0) 70%),
  radial-gradient(45% 45% at 88% 16%, rgb(61 123 255 / .10), rgb(61 123 255 / 0) 72%),
  radial-gradient(70% 60% at 50% 115%, rgb(124 108 255 / .10), rgb(124 108 255 / 0) 70%);
--ps-ambient-section: radial-gradient(55% 60% at 50% 0%, rgb(124 108 255 / .12), rgb(124 108 255 / 0) 70%);
--ps-ambient-deep: radial-gradient(80% 70% at 50% 100%, rgb(61 123 255 / .08), rgb(61 123 255 / 0) 70%);

/* Ombres de profondeur (inchangées dans leur rôle, plus sombres) */
--ps-shadow-1: 0 1px 0 rgb(0 0 0 / .5), 0 1px 3px rgb(0 0 0 / .4);
--ps-shadow-2: 0 18px 48px -16px rgb(0 0 0 / .8), 0 0 0 1px var(--ps-line);
```

Les couleurs des halos restent écrites en `rgb()` à partir des valeurs hexadécimales des tokens, pour que
`audit-page.js` (qui ne lit que `rgb()`) et les tests de palette restent cohérents.

### 4.2 Où le glow va, et ce qu'il dit

| Élément | Glow | Ce que ça dit |
|---|---|---|
| Cartouche « Vérifiée le … · facture » | `--ps-glow-proof` au repos, `--ps-glow-proof-strike` pendant la frappe (puis retour) | « ceci a été vérifié par un tiers » |
| Poinçon du héros | `--ps-halo-proof` derrière (pseudo-élément), aucune ombre sur le poinçon lui-même | la marque de garantie, seule chose verte avant toute preuve |
| Cases citées du registre des réponses | `--ps-glow-proof` sur chaque case qui s'encre | « ici le profil est cité » (avec les vraies données : 0 sur 780, rien ne s'allume) |
| Bouton principal (papier sur encre) | `--ps-glow-cta` au survol et au focus | « l'action principale » |
| Cartes (profils, missions, bento) | bord `--ps-edge-spot` qui suit le pointeur, souris seulement | « cette carte s'ouvre » |
| Carte d'une mission vérifiée | bord `--ps-edge-spot-proof` | même geste, mais c'est une preuve |
| Héros, section « La preuve », sortie | `--ps-ambient-hero` / `--ps-ambient-section` en fond | la lumière de la scène |
| Pied de page | `--ps-ambient-deep` sur `--ps-bg-deep` | la fin de la nuit |

### 4.3 Ce qui est interdit

- Le **vert en ambiance** : aucun dégradé, aucune aurore, aucun halo vert qui ne soit pas attaché à un élément vérifié.
- Un halo vert sur un bouton, un lien, un logo de technologie, une photo, un titre.
- Du **texte sur l'aura pleine** (`--ps-text` sur `--ps-aura` = 3,36).
- Le `text-shadow` lumineux sur du texte courant. Seule tolérance : le chiffre vérifié d'une preuve (par exemple le
  nombre de missions vérifiées) peut porter `text-shadow: 0 0 18px rgb(111 214 144 / .35)`.
- Plus de deux sources d'ambiance visibles dans un même écran, et toute ambiance au-delà des plafonds du §2.2 sous du texte.
- Le glassmorphism décoratif : le flou d'arrière-plan n'est permis que sur l'en-tête collant (petite surface, 90 %
  d'encre minimum, repli opaque sans `backdrop-filter`).
- Animer `box-shadow`, `filter` ou un `background` en boucle (coût de peinture) : voir §4.4.

### 4.4 Performance du glow (serment 3)

- Une ombre lumineuse ne s'anime pas : elle est posée sur un **pseudo-élément** dont on anime l'`opacity`.
- L'aurore est un pseudo-élément aux dégradés radiaux (aucun `filter: blur`), animé en `transform` seulement
  (`translate3d` et `rotate` lents, 24 à 40 s, `alternate`), `will-change: transform` limité à lui, `contain: paint`
  sur la section. Hors écran : `animation-play-state: paused` (IntersectionObserver ou `animation-timeline: view()`).
- `prefers-reduced-motion: reduce` : l'aurore est **figée** (la lumière reste, elle ne bouge plus), le bord lumineux
  ne suit plus le pointeur (il reste au survol, centré en haut), la frappe ne joue pas.
- Sans JavaScript : la lumière est là (CSS pur), seul le suivi du pointeur manque.

## 5. Typographie : plus audacieuse

PS Display (Source Serif 4, taille optique 48) et PS Mono restent, police système pour le texte (v1 §4). Ce qui change :
le héros et les titres de section prennent de la place, et le corps grandit d'un cran (un texte clair sur fond sombre
paraît plus fin et plus petit qu'en clair : on compense par la taille, pas par la graisse).

Échelle v2 (bornes 375 et 1440 px, même calcul que `fluid()` de `packages/brand/src/type.ts`) :

| Pas | 375 px | 1440 px | `clamp()` | Approche | Interlignage | Usage |
|---|---|---|---|---|---|---|
| `--ps-step-6` (nouveau) | 48 | 112 | `clamp(3rem, 1.592rem + 6.009vw, 7rem)` | -0,035 em | 0,98 | titre du héros, une phrase courte (trois à quatre lignes de 14 à 18 caractères) |
| `--ps-step-5` | 40 (v1 39,8) | 80 (v1 71,6) | `clamp(2.5rem, 1.62rem + 3.756vw, 5rem)` | -0,03 em | 1,02 | titre d'ouverture d'une section forte, grand chiffre vérifié |
| `--ps-step-4` | 34 | 60 | `clamp(2.125rem, 1.553rem + 2.441vw, 3.75rem)` | -0,024 em | 1,06 | titre de page |
| `--ps-step-3` | 28 | 44 | `clamp(1.75rem, 1.398rem + 1.502vw, 2.75rem)` | -0,018 em | 1,1 | titre de section |
| `--ps-step-2` | 23 | 30,2 | inchangé | -0,012 em | 1,18 | sous-titre, titre de carte bento |
| `--ps-step-1` | 19,2 | 22,7 | inchangé | -0,006 em | 1,35 | chapeau |
| `--ps-step-0` | 16 | 18 (v1 17) | `clamp(1rem, 0.956rem + 0.1878vw, 1.125rem)` | 0 | 1,65 | texte courant |
| `--ps-step--1`, `--ps-step--2` | inchangés | | | | | légendes, libellés mono |

Règles v2 :
- Héros : PS Display **600** à `--ps-step-6`, mesure 14 à 18 caractères par ligne au plus large, `text-wrap: balance`.
  Le mot qui porte la preuve (« vraiment livré ») peut passer en `--ps-text` plein tandis que le reste est en
  `--ps-muted` : la hiérarchie par la valeur, pas par l'italique (toujours aucun italique servi).
- Un seul dégradé de texte autorisé sur tout le site : le titre du héros, de `--ps-text` vers `--ps-aura-text`
  (`background-clip: text`), avec la couleur pleine `--ps-text` en repli. Les deux bornes sont mesurées
  (17,12 et 8,38 sur `bg`).
- Libellés de section (kicker) : PS Mono, capitales, `--ps-track-label`, en `--ps-aura-text` ; ils deviennent
  `--ps-proof` seulement dans la section « La preuve ».
- Texte courant : graisse 400, jamais 300 sur fond sombre ; mesure 62 à 66 caractères.
- Le LCP reste un titre : préchargement de `ps-display-v1.woff2` sur l'accueil (v1 §9), aucune animation d'opacité
  sur le H1.

## 6. Les images : où elles vont, ce qu'elles disent

12 photos réelles, Unsplash (licence Unsplash), auteurs et pages dans `apps/web/CREDITS.md`. Fichiers dans
`apps/web/public/images/v2/` : `<nom>-768.{avif,webp}` et `<nom>-1536.{avif,webp}`. Poids total des 48 fichiers :
**1 474 994 o** (WebP 881 600 o, AVIF 593 394 o). Un visiteur ne charge qu'un format et une largeur par image.

| Fichier | Ce qu'on voit | Ce qu'elle dit | Où elle va | Ratio | Poids 768 / 1536 (AVIF ; WebP) | Fond moyen, voile minimal |
|---|---|---|---|---|---|---|
| `freelance-code-night` | un développeur de nuit devant deux écrans de code, lumière bleue | le travail réel d'un freelance tech, celui qu'on va prouver | **Héros** de l'accueil, à droite du titre (sous le bouton sur mobile) | 3:2 | 13,3 / 26,5 Ko ; 14,9 / 37,5 Ko | 0,013 ; 0 % |
| `contract-signature` | une main signe un document, lumière turquoise | la **pièce** : le contrat, l'attestation, ce qui fait foi | section « La preuve » (`Piece`), à côté du cartouche vérifié | 2:3 (portrait) | 19,4 / 42,4 ; 27,3 / 68,5 | 0,212 ; 50 % |
| `code-screen-violet` | écran de code baigné de violet | la machine qui répond : la **mesure** de visibilité dans les IA (violet = mesure) | section « Une question, suivie jusqu'au compte » (`Journey`) | 3:2 | 11,8 / 24,2 ; 15,0 / 36,7 | 0,033 ; 40 % |
| `mission-scoping-whiteboard` | deux mains dessinent une maquette au tableau | cadrer une mission, étape par étape | section « La méthode » (`Method`) et page Entreprises | 3:2 | 16,5 / 34,9 ; 19,6 / 47,2 | 0,382 ; 46 % |
| `handshake-hiring-desk` | poignée de main par-dessus un bureau, dossier posé | un client engage un freelance | section Entreprises (`Companies`), tuile bento large | 3:2 | 14,3 / 35,2 ; 22,5 / 55,7 | 0,237 ; 58 % |
| `client-freelance-brief` | deux personnes échangent devant un portable | le binôme client et freelance au travail | section Entreprises, tuile bento ; page `/entreprises` | 3:2 | 17,7 / 40,2 ; 24,4 / 61,1 | 0,165 ; 55 % |
| `handshake-deal-dark` | poignée de main dans la pénombre | l'accord conclu, sur une base vérifiée | sortie « Par où commencer » : carte « Vous êtes une entreprise » | 3:2 | 8,8 / 27,2 ; 11,3 / 58,2 | 0,045 ; 33 % |
| `remote-freelance-coffee` | mains sur un portable, tasse, table en bois | l'indépendance du freelance, où qu'il travaille | sortie « Par où commencer » : carte « Vous êtes freelance » | 3:2 | 15,8 / 35,3 ; 20,7 / 55,5 | 0,121 ; 54 % |
| `developer-woman-office` | une développeuse devant deux écrans de code | les talents tech que Proofseen montre, pas seulement des hommes | page `/freelances`, en tête | 3:2 | 25,6 / 62,0 ; 39,7 / 98,6 | 0,367 ; 58 % |
| `developer-desk-overhead` | vue plongeante sur un bureau et trois écrans | l'atelier du freelance | page `/freelances`, bento ; panneau de `/inscription` | 3:2 | 9,7 / 23,7 ; 12,7 / 33,4 | 0,105 ; 60 % |
| `hands-keyboard-terminal` | mains qui tapent, terminal ouvert | le travail livré, ligne par ligne | page `/freelances` (« ce que vous avez livré ») ; état vide « aucune mission encore » dans l'espace | 20:17 | 13,0 / 26,3 ; 14,4 / 37,0 | 0,020 ; 15 % |
| `developer-focus-code` | un développeur de profil, flou, devant son code | la concentration, le métier | panneau de `/connexion` ; page `/metiers` | 1,68:1 | 14,3 / 35,4 ; 19,1 / 50,7 | 0,021 ; 0 % |

« Fond moyen » : luminance relative moyenne de l'image. « Voile minimal » : opacité minimale d'un voile `--ps-bg` pour
que `--ps-text` garde 4,5:1 sur le pixel le plus clair au 98e centile (mesuré par script sur les fichiers 1536). Un texte
ne se pose sur une photo qu'avec **au moins ce voile** sous lui ; sinon le texte va à côté de la photo.

### 6.1 Traitement

- Les photos **fondent dans la nuit** : `mask-image: linear-gradient(...)` ou un dégradé `--ps-bg` sur le bord qui
  touche le texte, jamais un cadre blanc. Rayon des photos : `--ps-radius-media: 16px` (nouveau), filet `--ps-line`.
- Une photo peut recevoir un **halo d'aura** derrière elle (pseudo-élément, `--ps-glow-aura`), jamais un halo vert.
- Aucun filtre de couleur sur les visages ; un léger `filter: saturate(.9)` est toléré sur les photos claires
  (`developer-woman-office`, `mission-scoping-whiteboard`) pour qu'elles ne crèvent pas l'écran.
- Apparition : `clip-path: inset()` qui s'ouvre et léger zoom (1,06 vers 1) liés au défilement (`view()`), en partant
  de l'image **visible** (jamais d'opacité nulle). Reduced-motion : image fixe.

### 6.2 Intégration (pour Tetsu)

```html
<picture>
  <source type="image/avif" srcset="/images/v2/freelance-code-night-768.avif 768w, /images/v2/freelance-code-night-1536.avif 1536w" sizes="(min-width: 1024px) 45vw, 100vw">
  <source type="image/webp" srcset="/images/v2/freelance-code-night-768.webp 768w, /images/v2/freelance-code-night-1536.webp 1536w" sizes="(min-width: 1024px) 45vw, 100vw">
  <img src="/images/v2/freelance-code-night-768.webp" width="1536" height="1024" alt="Un développeur travaille de nuit devant deux écrans de code." decoding="async">
</picture>
```

- `width` et `height` réels toujours posés (CLS). Dimensions : 768 x 512 et 1536 x 1024 pour les 3:2 ;
  `contract-signature` 768 x 1147 et 1536 x 2294 ; `hands-keyboard-terminal` 768 x 653 et 1536 x 1306 ;
  `developer-focus-code` 768 x 457 et 1536 x 914 ; `developer-woman-office` 768 x 512 et 1536 x 1025.
- Le H1 reste le LCP : la photo du héros est en `loading="eager"` sans `fetchpriority="high"` ; toutes les autres en
  `loading="lazy"`. Sur mobile la photo du héros se place après le bouton.
- Alt texte : décrire ce qu'on voit (colonne « Ce qu'on voit »), en français et en anglais selon la langue de la page.
  Une photo purement d'ambiance (`code-screen-violet`) peut avoir `alt=""`.
- `next/image` est possible mais le `<picture>` statique ci-dessus évite tout traitement serveur des fichiers déjà optimisés.

### 6.3 Interdits (vérité verrouillée)

- **Aucune photo ne représente un client, un freelance, un témoignage ou une mission de Proofseen.** Jamais de nom,
  de citation, de note ou de métier accolé à un visage. Une légende décrit une situation (« signer un contrat »), pas
  une personne.
- Jamais une photo à côté d'un chiffre comme si elle l'illustrait (« 780 réponses » ne reçoit pas de photo : le
  registre est l'image).
- Le rapport livré (`Deliverable`) garde ses vraies captures (`public/shots/`) : aucune photo d'écran tierce n'y
  remplace notre produit.
- Aucune autre source qu'Unsplash ou Pexels, aucune photo sans auteur et page relevés dans `CREDITS.md`.

## 7. Mise en page aérée

Le « journal de news » venait de colonnes de texte serrées, sans respiration ni image. La v2 compose en scènes.

- **Rythme vertical** : `--ps-section-y: clamp(6rem, 4.2rem + 7.7vw, 11rem)` (96 px à 375, 176 px à 1440) entre deux
  sections ; à l'intérieur, titre puis chapeau à `--ps-space-5` (24 px), chapeau puis contenu à `--ps-space-8` (64 px).
  Un écran ne porte qu'**une idée** : un titre, une phrase, une preuve ou une image.
- **Alternance** : une section à image, une section à preuve (cartouche, registre, chiffres), jamais deux sections de
  texte seul de suite. Les sections à image alternent image à gauche et image à droite (12 colonnes : 7 + 5 puis 5 + 7),
  l'image déborde légèrement de la grille (`margin-inline: calc(var(--ps-gutter) * -1)`) côté bord d'écran.
- **Bento** (Entreprises, `/freelances`, sortie) : grille de 12 colonnes, tuiles en `minmax(0, 1fr)`, rayon
  `--ps-radius-card: 20px` (nouveau), une tuile large (8 colonnes, photo) et deux tuiles hautes (4 colonnes : une preuve
  avec son cartouche vert, un chiffre en `--ps-step-5`). Toutes les tuiles sur `--ps-surface`, filet `--ps-line`, bord
  lumineux au survol (§4.2). Pas plus de 5 tuiles, jamais d'orpheline en dernière ligne.
- **Fonds** : les sections alternent `--ps-bg` et `--ps-bg-deep` ; seules trois scènes reçoivent une ambiance : le
  héros, « La preuve », la sortie.
- **Rayons** : la v1 n'avait qu'un rayon de 4 px, ce qui rendait l'ensemble sec. v2 : `--ps-radius: 6px` (contrôles),
  `--ps-radius-card: 20px` (cartes, bento), `--ps-radius-media: 16px` (photos), `--ps-radius-pill: 999px` permis pour
  les seuls filtres et puces de compétence. Le coin de poinçon (`--ps-radius-seal`, coins concaves) reste réservé au vérifié.
- **Mobile 375 px** : une colonne, photos en 4:3 recadrées par `object-fit: cover` et `object-position` choisi par
  image (visage ou mains au centre), bento empilé, rythme vertical à 96 px.

Séquence proposée pour l'accueil (les composants actuels, réordonnés seulement par Sensei s'il le décide) :
héros (photo nuit + poinçon + ambiance) ; `Study` (registre, aucune photo) ; `Piece` (signature + cartouche vert,
ambiance) ; `Journey` (écran violet) ; `Method` (tableau blanc) ; `Deliverable` (vraies captures) ; `Companies` (bento
deux photos) ; `Charter` (texte seul, fond profond) ; `Faq` ; `Exit` (deux cartes photo, ambiance).

## 8. Mouvement v2 (pour Kaze)

Les gestes v1 restent (frapper, encrer, tracer). S'ajoutent, tous en `transform` et `opacity`, tous coupés ou figés
sous reduced-motion :

| Token | Valeur | Geste |
|---|---|---|
| `--ps-dur-aurora` | 32 s | dérive de l'aurore (`alternate`, figée en reduced-motion) |
| `--ps-dur-glow` | 420 ms | montée d'un halo (opacité du pseudo-élément) |
| `--ps-dur-media` | 900 ms | ouverture `clip-path` d'une photo au défilement |
| `--ps-ease-glow` | `cubic-bezier(.22, 1, .36, 1)` | la lumière qui monte puis se pose |

La frappe du cartouche gagne son éclair : pendant les 140 ms de `strike`, le halo passe à `--ps-glow-proof-strike`
(opacité d'un pseudo-élément de 0,6 à 1), puis redescend à `--ps-glow-proof` en 240 ms (`ink`).

## 9. Ce que Tetsu doit changer dans `packages/brand`

1. `src/palette.ts` : `ThemeName` devient le seul `"dark"` ; valeurs du §2.1 ; nouvelles clés `bgDeep`, `overlay`,
   `aura`, `auraText`, `azur` ; `focus` = `auraText` ; paires de contraste ajoutées (`auraText` sur bg, surface,
   raised ; `aura` à 3 ; `faint` sur le pire point d'ambiance `#22264f`).
2. `src/tokens.ts` : suppression des blocs `light` et du `@media (prefers-color-scheme: light)` ; tokens de glow et
   d'ambiance du §4.1 ; rayons du §7 ; `--ps-section-y`.
3. `src/type.ts` : pas `6` ajouté, pas 5, 4, 3 et 0 aux valeurs du §5.
4. `test/tokens.test.ts` : retirer les assertions du thème clair, ajouter les nouvelles paires ; `apps/web/test/pwa.test.ts`
   lit `--bg` et `--proof` par regex (v1 §9) : à vérifier.
5. Favicon : la variante claire n'a plus de raison d'être côté site ; `favicon.svg` peut garder son bascule (l'onglet du
   navigateur, lui, peut être clair).

## 10. Ce qui n'est pas vérifié

- Aucun écran n'utilise encore la v2 : contrastes mesurés sur des paires et des mélanges calculés, pas sur des pages
  rendues. Le rendu réel des dégradés (bandes visibles sur certains écrans 8 bits) n'est pas vu.
- Le coût réel de l'aurore et des bords lumineux sur un téléphone d'entrée de gamme n'est pas mesuré (Lighthouse à
  repasser après intégration).
- La simulation de daltonisme est un modèle (Viénot 1999), pas un test avec des personnes.
- Les licences sont celles affichées le 2026-10-23 sur les pages des photos ; aucune autorisation de modèle
  (model release) n'est fournie par Unsplash, d'où la règle du §6.3.
- Le document de `contract-signature` est, d'après la description de l'auteur, un acte de vente de véhicule ; son texte
  (en polonais) n'est pas lisible aux tailles servies : vérifié à l'œil sur un recadrage du fichier 1536, flou de profondeur de champ.
- Pexels n'a pas été utilisé : les 12 photos viennent d'Unsplash.
