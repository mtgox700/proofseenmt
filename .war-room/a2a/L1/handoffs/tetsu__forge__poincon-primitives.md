# Passation : poinçon d'empreinte (prototype puis code) et primitives `components/ui/`
De : katana-tetsu (avec la casquette de Sumi pour le prototype) · Vers : Chancelier, katana-shogun (verdict), katana-kensa (revue), piste A documents (pied de page PDF), écrans L2 et suivants · Mission : L1 · Vague : 2 · Date : 2026-10-24

Arbre : `C:\Users\HP\AppData\Local\Temp\wt-l1`, branche `sprint/l1-coffre`, aucun commit (consigne). Concept suivi :
`wt-l0/.war-room/design/LEGENDS_P2_CONCEPT.md` §A.3, §A.4, §A.5, §B.4, §B.7, §C.0.

## Révision 3 (2026-10-25), après le PASS de Shogun (L1-120) et l'accord du Chancelier (L1-111)

Cette section fait foi sur la révision 2 là où elles diffèrent.

- **Déplacement** : `apps/web/src/lib/fingerprint-mark.ts` devient `packages/brand/src/fingerprint-mark.ts`, exporté par
  `"./fingerprint-mark"` (`packages/brand/package.json`, ajout ciblé). Sans dépendance : `fingerprintSchema` (zod)
  devient `parseFingerprint` (même règle, même message `FINGERPRINT_ERROR`) ; le composant garde son schéma zod autour.
  Imports mis à jour : `FingerprintMark.tsx`, `fingerprint-mark.test.ts` (resté dans `apps/web/test`, permis par le
  Chancelier), générateur de spécimen. Ancien fichier supprimé (test : il n'existe plus, et le module n'importe rien).
- **Géométrie inchangée, prouvée** : empreinte SHA-256 du JSON de toutes les sorties (6 empreintes x 7 tailles, SVG
  imprimable, `PENDING_FRAME`, `PRINT_LEVEL`) `e47e9b2ec308…eea052df` avant et après le déplacement.
- **Gel** : `keeps its reference drawing, FROZEN` porte l'empreinte
  `fc263696661c0bb21b6cad79776ef682d614565e97cdd2cbd8106d37975fe961` du dessin de l'empreinte vide aux 4 niveaux, du SVG
  imprimable et du cadre ouvert, avec la raison en commentaire (L1-120).
- **Règle du composant** : `FingerprintMark` refuse un état « à l'essai » sous 48 px (le mot doit être à côté :
  `FingerprintStamp`) ; test sur 16, 24, 32, 47 px.
- **R1** : `CardPlace` gagne `label` (la file en mono au-dessus de la carte) ; `SortBar` (« Trier par », mêmes liens GET,
  l'actif `aria-current` et dit en mots, visible sous 48 rem seulement) ; `thead` masqué sur téléphone.
- **R2** : `KpiTile` : `unit` (« en attente » par défaut, refusé s'il nomme un classement), « la plus ancienne » sur sa
  ligne (libellé et valeur séparés, valeur insécable ; sur téléphone, libellé au-dessus) ; tête de tuile à hauteur
  réservée (1,5 rem ; deux lignes sur téléphone) : comptes alignés dans la capture.
- **R3** : rien à changer, prouvé : la puce contient U+202F des deux côtés (sonde du DOM) ; la maison refuse U+00A0
  dans les guillemets (`french-spacing.test.ts:31`).
- **R4** : colonnes à leur contenu (`width: 1%`), la colonne qui cède prend le reste (`width: 100%; max-width: 0`) ;
  inspecteur 20 à 24 rem et marges de cellule de 12 px : « Sujet » passe de 126 px à 230 px (sonde à 1 280 px).
- **R5** : `shoot.sh` capture haut puis rogne le fond : pages entières ; en-têtes « 16 px » et « 32 px » sur une ligne.
- Piège : sous la charge de la machine (132 processus node), un `timeout` court coupe vitest et Chrome sans message ;
  deux captures étaient restées anciennes. Je relis désormais l'heure de chaque fichier avant de regarder.

## Révision 2 (2026-10-25), après la décision L1-090 et l'inspection L1-091 de Shogun

Cette section fait foi ; les sections suivantes décrivent la première livraison, et ce qui y est contredit ici est remplacé.

### L1-090, point par point
1. **16 px** : cadre et état seulement, aucune case (`detailed: false`, `lib/fingerprint-mark.ts`, niveau 16). Test : 64
   empreintes à 16 px, `cells` vide et un seul `<path>`. Impression : `PRINT_LEVEL = 64` (8 x 8), et
   `fingerprintMarkSvg(fingerprint, inks, size = 64)`, fonction pure qui rend une chaîne SVG autonome dans les encres
   données par l'appelant (pour le papier : `PAPER_INKS` de `@proofseen/brand`), même chemin qu'à l'écran (test).
2. **À l'essai** : le cadre lui-même, sur son propre chemin (`d` identique au cadre fermé, testé), interrompu au milieu
   de chaque côté par `pathLength="4"` et `stroke-dasharray` posés en attributs (`PENDING_FRAME`) ; entier à 16 px
   (testé). Test de géométrie : un seul jour par côté, centré, coins dessinés, au plus 30 %.
   **Écart chiffré, dans la règle** : 14 % et non 28 %. À 28 % (premier essai de cette révision), les quatre coins
   restaient lus comme quatre chevrons à 32, 64 et 128 px (capture regardée) ; à 14 % le losange garde sa silhouette et
   se lit « inachevé ». Capture : `fingerprint-mark@1x.png`, ligne « À l'essai ».
3. **Une seule liste du vert** : `apps/web/test/support/green-files.ts` (`GREEN_FILES`, `STRIKES_GREEN`), affirmée par
   `seal.test.ts` (dont la détection couvre désormais le cartouche et `kind: "sealed"`) et importée par
   `fingerprint-mark.test.ts`, qui échoue si un fichier qui construit un poinçonné n'y figure pas. **Écart de forme** :
   la liste est dans un module de support et non dans le corps de `seal.test.ts`, parce qu'importer un fichier de test
   depuis un autre y rejoue ses tests. Il n'y a toujours qu'une liste, et `seal.test.ts` est le test qui la tient.
4. **Phrase** : « Signé électroniquement sur Proofseen par les deux parties le … » dans les tests (`SENTENCE`) et les
   spécimens.
5. **Poinçonné à 64 et 128 px** : fond `--ps-proof-wash`, cadre et cases `--ps-proof`, halo ; plaque pleine à 16 et 32 px.
   Le halo est un `drop-shadow` fixe sur le SVG (un SVG ne porte pas le `box-shadow` de `--ps-glow-proof`) ; jamais
   animé (la garde de la marque refuse toute transition ou image clé de `filter`).
   Vecteurs de référence refaits une fois (`keeps its reference drawing` : grilles 4 x 4 et 8 x 8 de l'empreinte vide,
   comptes 0, 7, 28, 123) ; **à figer après le regard de Shogun** (L1-110).

### L1-091, K1 à K19
| K | Correction | Preuve |
|---|---|---|
| K1 | « Âge » court (`waited` : « 5 h », « 3 j », « 40 min », espace fine insécable), colonne `numeric` : à droite, `tabular-nums`, rien ne passe à la ligne | sonde Chrome sur le spécimen : 6 cellules « Âge » et « Échéance » sur 1 ligne à 1 280 px (lignes de 44 à 45 px) et à 375 px (cartes de 69 à 70 px) |
| K2 | cadre interrompu au milieu des côtés (L1-090 point 2) | capture, test de géométrie |
| K3 | case dessinée sur l'input natif : bord `--ps-line-strong`, fond transparent, cochée en `--ps-aura`, coche en `--ps-text`, cellule entière cible de 44 px | contrastes mesurés (fonction `contrastRatio` de la marque, testés) : bord 4,12:1 sur la surface, 3,85:1 au survol, 3,61:1 sur la ligne courante ; case cochée 4,81 / 4,50 / 4,21:1 ; coche 3,36:1 sur le violet |
| K4 | titre de page en `--ps-step-3`, fil « Tour de contrôle » au-dessus | `ui-primitives@1x.png` |
| K5 | tuile : marque ambre « 1 en retard » (losange et mot) en tête, compte en `--ps-step-3` avec « plus ancienne : 3 j » à côté, tuile à zéro en `--ps-muted` ; `KpiGrid` et `MeasuredAt` : « Mesuré le » une seule fois sous le titre | tests de rendu ; capture |
| K6 | lignes d'une ligne, 44 px, colonne `truncate` (points de suspension, texte entier en `title` et dans le DOM) | test CSS et rendu ; sonde : lignes de 44 à 45 px |
| K7 | données d'exemple qui se tiennent : recherche « FR-EX » (toutes les références), vue « Tout ce qui attend », tuile Versements « 1 en retard » avec sa ligne échue le 23 octobre, âges mesurés à l'heure affichée, « 1 à 3 sur 3 » sans « Page suivante » ; `pages.summary` ajouté à la DataTable | capture ; test « offers a next page only when there is one » |
| K8 | flèche visible sur la colonne triée seulement (`--ps-text`) ; ailleurs au survol et au focus ; dans une colonne de nombres la flèche passe avant le libellé, qui finit où finissent les chiffres | tests CSS ; capture 2x |
| K9 | `Timeline` : `status: { word, tone }` obligatoire avec son mot, plus de mot générique ; « Expirée » en `--ps-danger`, losange au même ton | tests |
| K10 | actions sous le titre de l'inspecteur ; annulation `btn ui-danger` dans un `<details class="ui-confirm">` qui ouvre le champ de motif avant d'agir | capture 1 280 et 375 |
| K11 | à 375 px : tuiles 2 x 2 compactes ; la même table devient des `QueueCard` (référence et échéance, puis sujet et âge ; colonne `card`), en-têtes triables en barre de tri ; aucun double du DOM | `ui-primitives@375.png` (vrai 375 px) |
| K12, K13 | L1-090 points 5 et 1 | ci-dessus |
| K14 | l'espace fine insécable était déjà là (U+202F avant « : ») ; prouvé par test sur le HTML de la puce | `writes each active filter as a chip … (K14)` |
| K15 | « Libre » | spécimen |
| K16 | plus de `placeholder` dans `FilterField` : `hint` sous le champ, lié par `aria-describedby` ; contraste mesuré 9,18:1 sur le fond, 8,67:1 sur la surface | tests |
| K17 | une seule règle d'alignement dans « En situation » (colonne de 17 rem, marques alignées à gauche) | `fingerprint-mark@1x.png` |
| K18 | capitales mono réservées aux en-têtes de colonnes et aux libellés de section (test qui liste les deux règles `uppercase` de `ui.css`) ; libellés de tuiles, de champs, méta de l'inspecteur et mots d'état en casse normale | test |
| K19 | acteur « Entreprise » | spécimen |

Ajouts de cette révision : `anyLabel` d'un `select` (« Toutes » pour « File ») ; `.btn.ui-danger` ; `.ui-confirm`.
Défauts trouvés en la faisant, corrigés : la coche cochée était peinte sous l'input (règle d'empilement de la ligne),
`z-index` ajouté ; en-têtes de colonnes de nombres décalés par la flèche invisible.

### Preuves de la révision 2
- `npx vitest run apps/web` → 96 fichiers, 1 071 tests verts (dernier passage, après `fingerprintMarkSvg` ; le
  nombre de fichiers inclut ceux des autres pistes) ; par fichier : `fingerprint-mark` 21, `ui-table` 23,
  `ui-panels` 25, `seal` 5, `brand-layer` 93 verts.
- `npx tsc -p apps/web/tsconfig.json --noEmit --incremental false` → 0.
- `eslint` sur mes fichiers, `seal.test.ts`, `brand-layer.test.ts`, `support/green-files.ts` → 0, sans remarque.
  Il a mis 8 minutes pour 0,2 s de processeur : 132 processus node tournaient sur la machine (autres pistes).
- `brand-layer.test.ts` : 3 lignes de plus dans la liste triée du vert (les règles du poinçonné à 64 et 128 px), même
  logique que la première fois.
- Mesures : écran composé 10 113 o de HTML, 2 805 o gzip, 193 éléments ; `ui.css` 22 686 o, 5 735 o gzip avec
  commentaires ; îlot inchangé (375 o gzip).
- Captures regardées : `fingerprint-mark@1x.png`, `@2x.png` ; `ui-primitives@1x.png`, `@2x.png`, `@375.png`.

### Pas vérifié (révision 2)
- Navigateurs autres que Chrome ; en particulier, la transformation des lignes en cartes (`display: grid` sur `tr`)
  peut faire perdre les rôles de tableau dans Safari : à contrôler par Mamori au lecteur d'écran, avec rôles ARIA
  explicites en repli si besoin.
- Clic et clavier non joués (Kensa les repasse) ; le `<details>` d'annulation n'est pas testé au clavier.
- `fingerprintMarkSvg` n'est pas encore dans un paquet importable hors `apps/web` (question au Chancelier, L1-111).

## Livré

Poinçon d'empreinte :
- `apps/web/src/lib/fingerprint-mark.ts` (197 lignes) : fonction pure, empreinte SHA-256 hexadécimale vers géométrie
  SVG (`fingerprintMark(hex, size)`), plus `fingerprintBits`, `fingerprintPrefix` (« 1404 E514 9452 DB7B »),
  `readingOrder`, `fullGrid`, `reduce`, `gridAt`, `levelFor`. Aucune horloge, aucun hasard, aucun DOM.
- `apps/web/src/components/ui/fingerprint/FingerprintMark.tsx` (137 lignes) : `FingerprintMark` (le dessin seul,
  `role="img"`, `aria-label` « Empreinte du document, E3B0 C442 98FC 1C14. Déposé ») et `FingerprintStamp` (dessin
  masqué aux lecteurs d'écran, seize caractères en PS Mono, état en mots, date dans `<time>`). Trois états validés par
  zod : `filed`, `pending` (mot obligatoire, échéance réelle facultative), `sealed` (phrase et date réelle
  obligatoires, sinon exception). Rendu serveur, zéro script.

Le dessin (règles tenues par les tests) :
1. Un emblème, pas un bruit : grille de petits losanges dans le losange, en miroir sur l'axe vertical.
2. Chaque bit compte : 16 x 16 cases à 128 px ; le bit k est replié (ou exclusif) dans la case k mod 136 de la moitié
   droite, lue comme une page. Un bit de l'empreinte qui change change exactement une case et son reflet (testé sur
   les 256 bits) ; une virgule changée dans le document change 124 cases sur 256 (moyenne sur 200 paires : entre 45 et
   55 %).
3. Plus petit = le même dessin vu de plus loin : 8 x 8 à 64 px, 4 x 4 à 32 px, 2 x 2 à 16 px, chaque case étant la
   majorité des quatre qu'elle couvre (égalité tranchée par la case du haut, ce qui garde le miroir). Chaque niveau sert
   à partir des trois quarts de sa taille : de 96 px on dessine la grille complète, comme §A.3 le demande.
4. États par la forme avant la couleur : déposé = filet fermé ; à l'essai = cadre ouvert, quatre équerres ambre
   (repères d'impression) ; poinçonné = plaque verte, cases percées en `--ps-on-proof`, halo `--ps-halo-proof` derrière
   (pseudo-élément, jamais d'ombre sur la marque, BRAND_BOOK_V2 §4.2).

Primitives (§B.7), toutes rendues par le serveur :
- `components/ui/table/DataTable.tsx` et `table-state.ts` : vrai `<table>`, `<caption>`, `scope="col"` et
  `scope="row"`, `aria-sort` sur la seule colonne triée, tri par lien GET (`?tri=cle`, `?tri=-cle`) choisi par le
  lecteur, tri stable ; une colonne triable dont la clé ou le libellé dit score, rang, classement, note, rating est
  refusée (exception) ; ligne entière ouverte par un lien étiré sur l'en-tête de ligne ; ligne courante marquée
  (`data-current`, `aria-current`) ; sélection par cases natives liées au `<form>` de la page par l'attribut `form` ;
  vide et erreur dans le tableau ; plus de 50 lignes refusées (paginer, liens `rel="prev"`/`rel="next"`) ; région
  étiquetée et focalisable qui défile dans son cadre sous 48 rem ; en-tête collant à la page au-dessus.
- `components/ui/filter/FilterBar.tsx` : formulaire GET `role="search"`, libellés liés, un `select` n'accepte que ses
  options, puces des filtres actifs qui retirent chacune leur filtre, « Tout effacer », paramètres conservés (tri),
  vues enregistrées = adresses avec `aria-current="page"`.
- `components/ui/inspector/Inspector.tsx`, `inspector-url.ts`, `InspectorKeys.tsx` : panneau `<aside>` nommé par son
  `h2` (`tabindex="-1"`), ouvert par `?voir=<id>` (identifiant validé, sinon ignoré), lien Fermer vers la même vue sans
  `voir`. Seul îlot client de `ui/` : `InspectorKeys` déplace le focus sur le titre seulement après une action (jamais au
  premier chargement d'une adresse partagée, pour laisser le lien d'évitement en tête) et fait suivre Échap au lien
  Fermer, sauf dans un champ, une `<dialog>` ouverte ou si un autre gestionnaire l'a pris.
- `components/ui/timeline/Timeline.tsx` : événements datés seulement (date invalide = exception), ordre chronologique ou
  journal, heure de Paris, `<time datetime>` ; une étape sans date en base va dans « À venir » avec ses mots
  (« à la relance »), jamais à une date déduite ; acteur = rôle ; aucune option pour masquer une ligne ; aucun vert.
- `components/ui/kpi/KpiTile.tsx` : un compte entier, sa définition, l'attente de la plus ancienne mesurée au moment de
  la mesure (aucune horloge), le retard en ambre et en mots, « Mesuré le … » ; aucune tendance (le type n'en a pas) ;
  libellé ou définition qui classe des personnes refusé.
- `components/ui/url.ts`, `when.ts` : adresses (`hrefWith`, `param`) et dates (réelles ou refusées, heure de Paris,
  espaces fines insécables).
- `apps/web/src/styles/ui.css` (157 lignes) : jetons de la marque seulement, aucune animation, aucune transition de
  `box-shadow` ou `filter`, survol sous `(hover: hover)`, focus en `--ps-focus`, cibles de 44 px (24 px pour les cases
  et puces), toutes les grilles en `minmax(0, 1fr)`.

Tests : `apps/web/test/fingerprint-mark.test.ts` (18), `ui-table.test.ts` (19), `ui-panels.test.ts` (16).

Spécimens et outillage (hors application) dans `.war-room/sprints/L1_specimens/` :
`fingerprint-mark.html` et `ui-primitives.html`, générés depuis les vrais composants et les vraies feuilles par
`tooling/shoot.sh fingerprint-mark` et `tooling/shoot.sh ui-primitives` (Chrome sans tête), avec les captures.

## Preuve

- `npx vitest run apps/web/test/fingerprint-mark.test.ts apps/web/test/ui-table.test.ts apps/web/test/ui-panels.test.ts`
  → 3 fichiers, 53 tests verts (18 + 19 + 16).
- `npx vitest run apps/web/test/brand-layer.test.ts` → 93 tests verts (après l'ajout ciblé ci-dessous ; avant : 1 échec,
  `expected [ Array(27) ] to deeply equal [ Array(24) ]`, celui que le backend a signalé en L1-034).
- `npx vitest run apps/web` → 94 fichiers, 1 020 tests verts (2026-10-24, après les dernières modifications).
- `npx tsc -p apps/web/tsconfig.json --noEmit --incremental false` → code 0.
- `npx eslint apps/web/src/components/ui apps/web/src/lib/fingerprint-mark.ts` et les 4 fichiers de test → code 0.
- Garde de grille prouvée rouge : la même vérification sur `ui.css` privé de `.ui-tl` dans la liste rend
  `uncovered: [ '.ui-tl' ]`.
- Mesures : îlot `InspectorKeys` 591 o minifié, 375 o gzip (esbuild 0.28.2, React externe ; budget §C.2 : 2 Ko) ;
  écran composé du spécimen (4 tuiles, filtres, table de 4 lignes, inspecteur avec frise et poinçon) 9 178 o de HTML,
  2 605 o gzip, 187 éléments ; un poinçon de 128 px : 2 `<path>`, 806 o gzip au plus sur les 11 du spécimen (test :
  sous 1,5 Ko) ; `ui.css` 16 194 o, 4 188 o gzip avec commentaires.
- Captures regardées (outil Read, recadrages 1:1 et agrandis au plus proche voisin) :
  `fingerprint-mark-v1.png` (premier jet rejeté), `fingerprint-mark-v2@1x.png` (miroir), `fingerprint-mark-v3@1x.png`
  (16 px renforcé), `fingerprint-mark@1x.png` et `@2x.png` (final), `ui-primitives@1x.png`, `@2x.png`,
  `ui-primitives@375.png` (vrai 375 px, voir les pièges).

Ce que j'ai changé au dessin, et pourquoi (vu sur les captures) :
1. v1 (grille de 256 cases sans miroir, cases espacées) : à 128 px un bruit de télévision, à 32 px des points perdus
   dans trop d'air, à 16 px un losange vide avec des poussières (la première empreinte d'exemple y était vide). Rejeté.
2. v2 : miroir sur l'axe vertical, chaque bit replié par ou exclusif pour qu'aucun ne soit perdu ; cases presque
   jointives (retrait 0,35 px) pour que des formes naissent ; encre pleine `--ps-text` sous 64 px. Résultat : à 64 et
   128 px chaque empreinte devient une figure qu'on retient (masque, insecte, blason), toutes différentes.
3. À l'essai : tirets un par rangée de cases, illisibles à 16 px (bouillie pointillée), remplacés par quatre équerres.
4. v3 : à 16 px, quatre quartiers agrandis (grille 6,5, retrait 0,5) qui remplissent presque le losange : au
   grossissement 6x, six figures de dé nettes et distinctes (côtés, sommet, sommet et base, vide, plein, base).
5. La marque ne quitte plus son texte quand la phrase datée est longue (le spécimen montrait la marque seule sur sa
   ligne), et le poinçonné gagne son halo derrière la marque.

## Pas fait, ou pas vérifié

- Aucun écran de l'application n'utilise encore ces primitives : First Load JS par route inchangé par construction,
  `next build` NON LANCÉ (d'autres pistes modifient l'arbre en même temps). Lighthouse NON MESURÉ.
- Rendu vérifié dans Chrome seulement (sans tête, Windows). Safari et Firefox NON VÉRIFIÉS, en particulier : le lien
  étiré sur `tr { position: relative }`, l'`outline` sur une ligne de tableau, `:has()` pour le focus de ligne.
- `InspectorKeys` : son comportement (focus, Échap) n'est testé que par lecture de sa source et son poids ; aucun test
  dans un navigateur (pas de jsdom dans le dépôt). À jouer en e2e quand la Tour existera.
- Aucun axe-core ni lecteur d'écran réel lancé ; l'accessibilité est tenue par les rôles, en-têtes et noms testés dans
  le HTML.
- Raccourcis `j`, `k`, `x`, `/` (§B.6), `BulkBar`, `SavedView` persistantes, `SplitView` en composant : hors de ce lot
  (une classe `.ui-split` suffit pour l'instant).
- Le poinçon dans le PDF (pied de page à 16 px, §D.2) : la géométrie est prête, son branchement dans pdfmake ne l'est
  pas (piste A).
- TDD : le prototype est venu avant les tests (consigne « prototype d'abord ») ; la garde de grille a été prouvée rouge
  par mutation, les autres tests n'ont pas été vus rouges avant le code.

## Au-delà de la demande (question du serment)

- Un poinçon qui se lit à toutes les distances, comme une carte : la pyramide de majorité fait du 16 px le même dessin
  que le 128 px vu de loin. Preuve : section « Le même dessin, vu de plus loin » de `fingerprint-mark@1x.png`, et le
  test `is, smaller, the same mark seen from further away` (règle de majorité, et moyenne de cases pleines entre 42 et
  58 % à chaque niveau sur 300 empreintes : aucun niveau ne tend vers le vide ou le plein).
- La garantie mathématique qu'aucun bit n'est décoratif : un seul bit changé change toujours le dessin à 128 px
  (testé sur les 256), alors que §A.3 ne demandait que l'effet d'avalanche.
- Un état « à l'essai » lisible sans couleur (cadre ouvert en équerres), qui tient la règle §C.0 (forme avant couleur)
  jusqu'à 16 px, et une plaque frappée pour le poinçonné qui reprend le geste du poinçon de maître.
- Des primitives qui refusent ce que la loi et la marque interdisent, par exception plutôt que par convention : tri ou
  tuile qui classerait des personnes (AI Act), date inventée, plus de 50 lignes, sceau vert sans date. Preuve : les
  tests `refuses a sortable column that ranks people`, `never places a step at a date the database does not hold`,
  `refuses what it cannot vouch for`.
- Le focus de l'inspecteur qui suit une action et jamais un chargement, et Échap qui ne perd jamais un motif à moitié
  écrit : deux pièges courants des tours de contrôle évités dans 375 o.
- Un piège de mise en page trouvé à l'oeil et verrouillé par un test : la grille à colonne implicite qui élargit une
  page de téléphone (garde prouvée rouge par mutation).
- Des spécimens régénérables depuis le code (`shoot.sh`), donc qui ne peuvent pas mentir sur le rendu réel.

## Pour le receveur

- Chancelier : `apps/web/test/brand-layer.test.ts` a reçu un ajout ciblé hors de mon périmètre, trois sélecteurs verts
  de `ui.css` dans la liste triée (le vert du poinçon frappé, selon la logique du test et §A.5). Rien d'autre n'y a
  changé. Annoncé en L1-081.
- Shogun : trois écarts à §A.3 à trancher (L1-082) : encoches remplacées par miroir et pyramide ; « à l'essai » en
  équerres et non en filet ambre plein ; fichier `lib/fingerprint-mark.ts` (nom imposé par le brief) au lieu de
  `lib/viz/hallmark.ts`, et liste des écrans « poinçonné » dans `fingerprint-mark.test.ts` plutôt que `seal.test.ts`.
- Écrans suivants (L2, Tour, coffre) : lire `searchParams`, puis `parseSort(params, columns)`, `inspectedId(params)` ;
  donner à `Inspector` un `id` dérivé de l'identifiant inspecté (sinon l'îlot ne redéplace pas le focus entre deux
  éléments) ; placer table et inspecteur dans `.ui-split`. Tout nouvel écran qui construit `kind: "sealed"` s'ajoute
  à la liste de `fingerprint-mark.test.ts` avec le fait lu en base (toutes signatures et horodatage enregistrés).
- Piste A : pour le pied de page PDF, `fingerprintMark(hex, 16).frame` et `.cells` sont des chemins SVG en unités de
  pixels (viewBox 0 0 16 16) ; sans feuille de style, peindre le cadre en `#71768a` (filet, `--ps-line-strong`) et
  les cases en `#f2efe8` (`--ps-text`) sur fond sombre, ou en encre sur papier blanc (à décider avec Sumi pour
  l'impression) ; jamais de vert dans un PDF qui n'est pas signé par toutes les parties.
- Pièges : Chrome sans tête refuse une fenêtre de moins de 500 px (la « capture 375 » était un 504 px rogné, mesuré par
  sonde : `innerWidth` 504) ; `shoot.sh` rend désormais la page dans un cadre de 375 px. L'outil Write a décodé des
  `\u202f` écrits dans le code en caractères réels (refusés par eslint `no-irregular-whitespace`) : les espaces fines
  sont écrites par `String.fromCharCode(0x202f)`.
