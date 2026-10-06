# LANDING PROOFSEEN — Revue design et performance (2026-09-19)

> Directive du founder (2026-09-19) : **« ce n'est pas du vibe coding »**. Design d'élite, animations/3D si elles servent,
> UX exceptionnelle, **sans surcharger les pages**. Référence : `foundations/DESIGN_WEB.md`. Rien n'est publié : la landing
> reste locale jusqu'au nom définitif, au domaine et aux CGV validées (US-P01).

## 1. Livré

| Livrable | Où |
|---|---|
| Landing FR/EN statique (Astro 7), concept « du bruit à la preuve » : hero éditorial, méthode en 4 temps, aperçu de rapport (données **fictives et étiquetées**), preuves, offres, entreprises (étage 2), charte, FAQ | `apps/landing/` |
| Champ WebGL2 écrit à la main (aucune librairie 3D), **rendu dans un Web Worker** (OffscreenCanvas) | `src/scripts/field*.ts` |
| Signal CSS pur pour mobiles et appareils modestes (même histoire, coût nul) | `src/components/Hero.astro` |
| Onglets du rapport en CSS pur (`:has()`), zéro JS | `src/components/ReportPreview.astro` |
| 10 tests (règles de marque, parité FR/EN, maths du champ, garde-fous de performance) | `apps/landing/test/landing.test.ts` |

## 2. Revue de code (typescript-reviewer, lecture seule) et corrections

| Gravité | Constat | Correction |
|---|---|---|
| HAUTE | Boutons désactivés en `<span>` sans rôle | Vrais `<button disabled>` |
| HAUTE | Perte de contexte WebGL : observateurs et écouteurs laissés actifs | Démontage complet (observateurs, écouteurs, frame, worker) |
| HAUTE | Double numérotation de la liste des étapes | `list-style: none` |
| MOYENNE | Division par une largeur nulle (Infinity) | Garde dans `project()` + test dédié |
| MOYENNE | Aperçu du rapport couplé à la longueur du dictionnaire | Assertion **au build** (le build échoue plutôt que la page) |
| MOYENNE | Découpage du titre sur la virgule fragile | Logique explicite, rendu vérifié FR et EN |
| MOYENNE | Inter non préchargée | Préchargée |
| BASSE | Shaders et programme non libérés en cas d'échec | `deleteShader` / `deleteProgram` |

**2e revue (passage au Web Worker) : aucun constat critique ni haut.** Protocole de messages, ordre FIFO, démontage et perte de contexte validés.
- MOYENNE, `aria-live` autour de panneaux basculés en CSS (du bruit, sans effet) → **retiré**. Le motif d'onglets ARIA proposé n'est **pas** retenu :
  le groupe radio natif (`fieldset` + `legend`, « 1 sur 3 », flèches du clavier) est accessible sans JS, alors que des `role="tab"` sans JS
  promettraient une navigation clavier absente.
- BASSE, `sticky` à l'intérieur d'une section en `content-visibility: auto` → rendu vérifié sur l'ancre `#methode` ; **défilement rapide aller-retour
  à contrôler à la main** dans Chrome et Safari.
- Invariant du worker documenté dans le code.

## 3. Enquête de performance (Elias) — ce que les mesures ont montré

1. **Machine saturée = mesures invalides.** Premier passage : 57/57 avec `benchmarkIndex` ≈ 150 (normal ≈ 1 000). Mesures refaites machine au repos.
2. **Animations qui repeignent.** Halo du signal en `box-shadow` infini (repeint à chaque image, indéfiniment) et barres du rapport en `width`
   (layout à chaque image) → passés en `transform` / `opacity`.
3. **CLS 0,12 sur le titre (desktop).** Remplacement de police → polices de secours calées sur les métriques (capsize) → **CLS 0**.
4. **TBT desktop 260-440 ms.** Lighthouse attribuait la long task à `_lighthouse-eval.js`. La trace montre que c'est **notre**
   `requestIdleCallback` (Lighthouse l'enveloppe) : la création du contexte WebGL2 est un appel natif synchrone (GPU AMD réel, pas de
   rendu logiciel). Test contrôlé : WebGL coupé → 100/100, TBT 0. **Correction : tout le WebGL dans un Web Worker.**
5. **Long task mobile 260-300 ms** au remplacement de police (re-layout de toute la page) → `content-visibility: auto` sur les sections.

## 4. Mesures finales (Lighthouse 12 local, build de production, machine au repos)

| Page | Perf | Access. | Bonnes pratiques | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| FR desktop (3 passes + EN) | **100** | 100 | 100 | 100 | 0,3 s | 0 ms | 0 |
| FR mobile (3 passes) | **97-100** | 100 | 100 | 100 | 1,4 s | 60-130 ms | 0 |
| EN mobile | **97** | 100 | 100 | 100 | 1,4 s | 130 ms | 0 |

Poids : HTML ≈ 10 Ko gzip (CSS et script du hero en ligne), worker 1,9 Ko gzip (chargé **seulement** sur desktop capable),
polices woff2 latines. Vérifié par pilotage de Chrome (protocole DevTools) : champ vivant et crochet positionné sur desktop, **aucune long task
liée au WebGL** ; mobile : pas de worker, signal CSS affiché ; ancre `#methode`, rapport et barres rendus correctement.

> Indicatif : le score qui fait foi sera celui mesuré en production par le founder (DESIGN_WEB §4).

## 5. Vérification — sorties réelles

```
pnpm typecheck        → exit 0
pnpm landing:check    → exit 0   (tsc ; `astro check` cassé en 0.9.10 : @emnapi/runtime manquant)
pnpm lint             → exit 0   (~48 s : chargement de typescript-eslint lent sur ce poste, pas un fichier lourd)
pnpm test:coverage    → 12 fichiers, 140/140 tests, seuils 80 % tenus (exit 0)
pnpm build            → exit 0
pnpm landing:build    → exit 0
```

## 6. Ouvert

- Revue visuelle du founder (desktop + téléphone réel) : c'est lui qui juge le « pas vibe ».
- Médias (vidéo de démonstration du rapport, visuels) : **seulement** quand un vrai rapport existera (après J0), jamais de faux écran.
- Pages légales, formulaire de contact entreprises et Payment Links : après validation du juriste (boutons désactivés d'ici là).
- Mesure en production (Lighthouse + Core Web Vitals réels) dès la mise en ligne.

## 7. Itération « autre ligue » (2026-09-19, après la veille Malt n° 1)

Verdict du founder sur la version ci-dessus : **« ligue amateur »**. Référence à battre : Malt (`research/MALT_VEILLE_2026-09-19.md`).

| Décision | Réalisation |
|---|---|
| D1 — le hero montre le produit qui fonctionne | **Simulateur en direct** (`Simulator.astro`, `sim.ts`, `sim-math.ts`) : la demande du recruteur s'écrit, l'IA propose un top 5, « Vous » y est ou non ; 30 réponses, chaque point s'ajoute, l'intervalle de Wilson se resserre sous les yeux. Données **fictives**, étiquette visible, profils concurrents en initiales, résumé pour les lecteurs d'écran |
| D2 — « salle de mesure » | Header et hero toujours sombres (palette `.lab`), halos vert preuve et bleu info, bouton principal vert ; le reste de la page reste éditorial clair |
| Performance par construction | Rendu serveur = état final (complet sans JS et en mouvement réduit) ; animation = quelques mises à jour de texte/classes par seconde, mouvements en `transform` uniquement ; pause hors écran et onglet masqué ; rien avec Save-Data. Le champ WebGL devient une **ambiance** (dégradé vers l'instrument) : plus aucune boucle par image sur le thread principal |
| Honnêteté | Intervalle calculé par la même formule que le produit (test : 11/30 → 37 % [22–54 %]) ; aucun chiffre réel inventé |

**Mesures (Lighthouse 12 local, poste chargé : `benchmarkIndex` ≈ 450, donc pessimiste)** : mobile FR **96-99** / 100 / 100 / 100, EN 98 ;
desktop FR et EN **100** / 100 / 100 / 100 ; LCP 1,4 s (mobile) et 0,3 s (desktop) ; **CLS 0** ; accessibilité 100 sur la palette sombre.
Vérifié en pilotant Chrome : simulateur vivant (réponse 12/30 → 42 % [19–68 %] dessiné), CLS mesuré 0 pendant l'animation, mobile sans worker.

Vérification : typecheck 0, landing:check 0, lint 0, **141/141 tests** avec seuils de couverture, build 0.

**3e revue (simulateur, typescript-reviewer en lecture seule)** : aucun constat critique ni faille de sécurité.
- HAUTE (accessibilité), `--line-strong` de la palette sombre à 2,86:1 (numéros de rang, points « hors top 5 ») → **`#7c8aa8`, 5,22:1**
  sur la carte et 5,68:1 sur le fond. Contrôle recalculé : muted 8,09, signal 8,86, preuve 9,14, texte du bouton sur preuve 9,71.
- BASSE, pas de repli si `IntersectionObserver` manque (le rejeu resterait figé) → repli ajouté.
- BASSE, observateurs du simulateur sans démontage → accepté : page statique, aucun routage côté client.
- Vérifiés sans anomalie : honnêteté (étiquette « fictif » et résumé accessible cohérents avec `sim-math.ts`), shaders, CLS, aucun code mort.

## 8. Palette sombre sur tout le site (2026-09-19, demande du founder)

Retour du founder : « la palette dark est mega cool » → **une seule palette sombre pour tout le site** (plus de thème clair).

| Changement | Détail |
|---|---|
| Tokens | `:root` = palette « salle de mesure » (`--bg #070b14`, `--surface #0e1626`, `--ink #edf1f7`, `--proof #3fcf9c`…), `color-scheme: dark`, `theme-color` unique |
| Motif de marque | Le glyphe « intervalle » ⊢–⊣ devant chaque surtitre (même dessin que le logo et les puces d'offres) |
| Sections | Filets de séparation qui s'estompent aux bords ; numéros d'étapes en vert ; chiffres clés avec halo ; offres en cartes avec reflet et survol ; **Entreprises (étage 2) = le seul panneau surélevé et éclairé** ; charte en colonnes filetées |
| Boutons | Principal vert partout, secondaire filaire |

**Défauts trouvés en vérifiant (et corrigés) :**
1. **La page débordait sur mobile (509 px de large pour un écran de 390) : le téléphone la dézoomait.** Cause : colonne `1fr` de la
   section Méthode élargie par l'étiquette « données fictives » insécable. Correction : `minmax(0, 1fr)` et étiquette sécable.
   Vérifié : largeur = 390 px en FR et en EN. Ce défaut existait avant la palette sombre.
2. **Les ancres du header tombaient à côté** (hauteurs estimées par `content-visibility`). Retirer `content-visibility` doublait le
   travail de style/mise en page sur mobile (≈ 1 100 ms contre ≈ 530 ms) : gardé. Correction : `scripts/anchors.ts` rend toutes
   les sections **au premier clic** (jamais au chargement) puis laisse le défilement natif ; lien profond `/#offres` corrigé au
   chargement ; focus clavier déplacé sur la cible. Vérifié par clics réels : cible à 76 px (= hauteur du header) sur desktop,
   mobile et lien profond. `scroll-margin-top` ajouté.
3. Libellés des chiffres clés décalés sur mobile (marge par défaut de `<dd>`) → corrigé.
4. Le simulateur ne démarre plus qu'une fois à l'écran et la page au repos (sur téléphone : aucun coût au chargement).

**Mesures** : desktop FR et EN **100 / 100 / 100 / 100**, TBT 0, CLS 0 ; accessibilité **100** partout.
**Mobile : non certifié ce jour.** Le poste était saturé (Docker, Creative Cloud, Chrome ; `benchmarkIndex` 160-470 au lieu de ≈ 1 000).
Passes à `benchmarkIndex` ≈ 400-470 : 95, 98, 99 (une à 89) ; passes à ≈ 160-200 : 50-59, sans valeur. **À remesurer machine au repos**
(5 passes, médiane, `benchmarkIndex` ≥ 700) avant toute mise en ligne.

Vérification : typecheck 0, landing:check 0, lint 0, **141/141 tests** avec seuils de couverture, build 0.
5. Carte « Aperçu de rapport » rétrécie par la marge par défaut de `<figure>` (40 px de chaque côté) → `margin: 0` ; colonnes des barres
   resserrées sous 30rem. Vérifié à 390 px : carte pleine largeur, étiquette sur une ligne, `scrollWidth` = 390.

## 9. Hub (site profil, `packages/hub`) au niveau de la landing — 2026-09-19

Le hub est le prochain livrable à mettre en ligne (ROADMAP S2, A1) et le cœur de l'offre « clé en main 490 € » : il doit être au niveau.

| Changement | Détail |
|---|---|
| Identité | Palette « salle de mesure », motif ⊢–⊣ sur les titres de section, polices **système** uniquement (zéro requête réseau), icône SVG en ligne |
| Accueil | Pastille de disponibilité (orange si indisponible), nom en grand, **compteur de preuves calculé depuis les données** (« 4 missions · N faits vérifiables, chacun avec sa source »), cartes de mission qui affichent leur premier fait chiffré avant le texte |
| Page mission | Contexte / période / rôle en grille, **faits en tuiles : valeur en grand, ce qu'elle mesure, puis sa source** ; « Autres missions » = **uniquement celles de la même personne** (règle de la veille Malt, testée) |
| Garde-fous conservés | Zéro JavaScript, aucun texte caché (test), contenu intégral dans le HTML, JSON-LD échappé, pages < 50 Ko (10-15 Ko) |

**Mesures (Lighthouse 12 local, poste au repos, `benchmarkIndex` 830-1 000)** : accueil et page mission **100 / 100 / 100 / 100** sur mobile
et desktop, TBT 0, CLS 0, aucune erreur console (l'icône en ligne supprime la 404 de `/favicon.ico`). « Compression » à activer chez
l'hébergeur (le serveur local ne compresse pas).
**Landing, mobile enfin certifié poste au repos** : 5 passes valides (`benchmarkIndex` 800-1 093) → **95 à 97, médiane 96** ; accessibilité,
bonnes pratiques, SEO 100 ; CLS 0. Marge mince (EN à 95) : **à surveiller** (TBT 150-200 ms).

Point de vérité rappelé (déjà suivi, `A_CONFIRMER` G1) : plusieurs sources de faits citent un dépôt local (`MyOwnBangers/SEISME`) ;
avant publication, chaque source doit être vérifiable par un tiers (dépôt public ou page publique).

Vérification : typecheck 0, lint 0, **143/143 tests**, hub 100 % des lignes couvertes.

## 10. Marge mobile de la landing (2026-09-19, soir)

- Trace mobile (EN) : la long task qui pèse dans le TBT est la **première mise en page à froid** (222 ms pour 165 objets : préparation
  des glyphes des polices), pas une remise en page ordinaire.
- Banc de mise en page (même page, CPU ×4, variantes alternées) : une remise en page complète coûte 5-12 ms ; `text-wrap: pretty`
  sur tous les paragraphes la double à peu près (11,7 → 5,3 ms, mesure bruitée). **`pretty` est désormais limité au chapeau du hero et
  aux textes de tête de section.**
- Effet Lighthouse **non démontré** : poste chargé (`benchmarkIndex` 350-390, un plantage de Chrome) → passes 93-98, comparables aux
  passes d'avant dans les mêmes conditions. Référence certifiée inchangée : **médiane 96** (poste au repos, §9).
- Prochaine piste si la marge doit grandir : alléger le DOM visible au premier écran sur mobile (le simulateur y est sous la ligne de
  flottaison mais sa mise en page initiale compte), à mesurer poste au repos avant toute décision.
