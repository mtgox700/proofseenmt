# DESIGN WEB — Direction d'art et budget de performance (Lena Sørensen + Elias Voss · 2026-09-19)

> Consigne du founder : **niveau elite, jamais « vibe coding »** — 3D, animations, images, vidéo quand elles servent le propos, UX exceptionnelle,
> sans surcharger les pages. Fondations : `MARQUE.md` (plateforme, tokens, contrastes). Ce document tranche **comment** on l'applique au web.

## 1. Concept : « du bruit à la preuve »

Le recruteur pose une question, les IA répondent des centaines de fois, et quelque part dans ce bruit, un profil apparaît… ou pas.
La page raconte ce passage : **un champ de points (les réponses des IA) d'où émerge un signal vert (le freelance trouvé), encadré par son
intervalle de confiance** — le motif signature de la marque.

| Principe | Application |
|---|---|
| Éditorial, pas « template SaaS » | Serif Newsreader en très grand corps, grille éditoriale asymétrique, filets fins, chiffres en chasse fixe |
| Une seule couleur de preuve | Vert preuve réservé à ce qui est mesuré et acquis ; tout le reste est encre et papier |
| Le mouvement a un sens | Chaque animation raconte la mesure : points qui s'allument, fourchettes qui se resserrent, funnel qui se remplit |
| Honnêteté visible | Toute donnée d'illustration porte « exemple illustratif — données fictives » |
| Interdits | Dégradés violets, glassmorphism décoratif, icônes génériques, stock photos, robots/cerveaux/loupes, faux témoignages, compteurs gonflés |

## 2. Moments forts

| Section | Traitement |
|---|---|
| **Hero** | Titre serif géant + champ de points **WebGL fait main** (shader de quelques Ko, pas de three.js) : ~2 000 points qui ondulent, un seul devient vert et se fixe entre deux butées. Poster SVG statique dessous (rien ne bloque l'affichage) |
| Le problème | Trois temps (recruteur → IA → shortlist), révélés au défilement (CSS scroll-driven animations, repli visible sans support) |
| La méthode | **Aperçu de rapport interactif** en HTML/CSS : funnel E1-E5, barres d'intervalle animées, moteur sélectionnable au clavier — données fictives étiquetées |
| La preuve | Chiffres de méthode réels (tirages répétés, 3 moteurs, 72 h, masquage) en chasse fixe, filets animés |
| Offres | Audit 49 € et clé en main 490 € ; boutons désactivés tant que les CGV ne sont pas validées (US-P01) |
| Entreprises (étage 2) | « Recrutez des freelances vérifiés » : contact pour le test des 3 entreprises (`MODELE_PASSERELLE.md`) |
| Charte + FAQ | Typographie seule, `<details>` natifs accessibles |

## 3. Budget de performance (Elias, non négociable)

| Poste | Budget |
|---|---|
| LCP | **Texte** (titre du hero), jamais une image ni le canvas |
| JS critique | 0 Ko bloquant ; îlots en `type=module` différés, **< 25 Ko gzip au total** |
| WebGL | **Dans un Web Worker (OffscreenCanvas), jamais sur le thread principal** : créer un contexte WebGL2 bloque 90-440 ms (mesuré le 2026-09-19). Démarré après `requestIdleCallback` ; en pause hors écran et onglet masqué ; **desktop uniquement** (≥ 900 px, pointeur fin, ≥ 4 cœurs) ; **désactivé** si `prefers-reduced-motion`, `Save-Data`, pas d'OffscreenCanvas, rendu logiciel (`failIfMajorPerformanceCaveat`) ; DPR plafonné à 1,5 |
| Polices | 2 familles auto-hébergées (Newsreader, Inter), sous-ensemble latin, woff2, `font-display: swap`, préchargement des deux fichiers latins, **polices de secours calées sur les métriques** (`size-adjust`, `ascent-override`… : Newsreader → Georgia, Inter → Arial) pour un CLS nul au remplacement |
| CSS | Inline pour le critique, < 20 Ko |
| Images / vidéo | SVG en priorité ; AVIF/WebP dimensionnés ; vidéo seulement sous un poster, `preload="none"`, jamais en autoplay avec son |
| CLS | 0 (dimensions réservées partout, canvas en position absolue) |
| Animations | **`transform` et `opacity` uniquement** (composées par le GPU) : jamais `width`, `box-shadow`, `top/left` en animation ; boucles infinies interdites sur des propriétés qui repeignent |
| Rendu | `content-visibility: auto` sur les sections sous la ligne de flottaison (le re-layout au remplacement de police coûtait 260-300 ms sur mobile émulé) |
| Accessibilité | AA, navigation clavier complète, focus visible, textes alternatifs, `aria-hidden` sur le décor |

## 4. Outils

- **Astro** (sortie statique, zéro JS par défaut, îlots) pour la landing — cohérent avec le GEO (HTML visible) et la performance.
- WebGL2 écrit à la main (aucune dépendance 3D).
- Mesure : build de production + **Lighthouse local indicatif** (mobile et desktop). Le score qui fait foi reste celui mesuré par le founder en production.

## 5. Décisions du 2026-09-19 (après le verdict « ligue amateur »)

- **Palette unique sombre « salle de mesure »** sur tout le site (demande du founder). Le thème clair n'existe plus. Chaque couple texte/fond
  est contrôlé à ≥ 4,5:1 (`--line-strong` relevé à `#7c8aa8` pour ça).
- **Motif de marque** : le glyphe « intervalle » ⊢–⊣ (logo, surtitres, puces).
- **Grilles** : jamais `1fr` nu quand une colonne peut contenir un élément insécable → `minmax(0, 1fr)`. Contrôle obligatoire :
  `scrollWidth === clientWidth` à 390 px.
- **`content-visibility: auto`** sur les sections, avec rendu complet au premier clic d'ancre (`anchors.ts`) : navigation exacte, coût nul
  au chargement.
- **Animations de démonstration** (simulateur) : démarrent à l'écran et au repos, jamais pendant le chargement.
- **`text-wrap: pretty`** seulement sur les quelques paragraphes où une veuve se voit (coût de mise en page mesuré), `balance` sur les titres.
- **Mesures Lighthouse** : seules les passes à `benchmarkIndex` ≥ 700 comptent (5 passes, médiane) ; sinon on note « non mesurable » plutôt qu’un chiffre.
