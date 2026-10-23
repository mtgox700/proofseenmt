# Notice : composants tiers de la refonte

Ce fichier liste les composants tiers repris ou consultés pour les refontes, ce qu'on en a gardé, où et pourquoi. Les
ressources servies telles quelles (polices, logo, photos) sont dans `CREDITS.md`.

## Accueil v2 (2026-10-23) : composants 21st.dev réécrits pour Proofseen

Décision du Shogun du 2026-10-23 (`.war-room/design/STORYBOARD_V2.md`, fin du fichier) : la page d'accueil reprend
des composants animés de deux bibliothèques publiées sur 21st.dev, **Magic UI** et **Aceternity UI**. Le code a été
récupéré le 2026-10-23 puis **réécrit** : aucun fichier n'est collé tel quel. Ce qui change à chaque fois : pas de
Tailwind (l'application n'en a pas), styles dans les feuilles de l'accueil (`src/styles/home*.css`) aux jetons de la
marque, `motion` (paquet `motion`, version exacte 12.43.0, imports `motion/react` et `motion/react-m`, en
`LazyMotion` avec `domAnimation` chargé à part) à la place de `framer-motion` là où un ressort est nécessaire (la scène
du parcours, chargée seulement quand la section approche : rien de `motion` dans le premier chargement), CSS seul
partout où il suffit. Règles ajoutées par la réécriture : le texte est rendu par le serveur dans son état final (lisible sans
JavaScript), les animations n'ajoutent que de la lumière ou du mouvement, elles sont coupées sous
`prefers-reduced-motion: reduce`, les boucles ne bougent que `transform` et s'arrêtent hors écran, le vert n'éclaire
que ce qui est vérifié.

Auteurs : Magic UI est publié sur 21st.dev par Dillion Verma (`@dillionverma`), Aceternity UI par Manu Arora
(`@manuarora700`) ; les pages `21st.dev/magicui/…` et `21st.dev/aceternity/…` redirigent vers ces comptes (relevé le
2026-10-23 par la redirection HTTP, pages non ouvertes dans un navigateur). Licences : Magic UI est distribué sous
licence MIT (dépôt `magicuidesign/magicui`) ; Aceternity UI publie ses composants gratuits pour un usage personnel et
commercial. **Non vérifié ce jour** : le texte exact des deux licences n'a pas été relu, le founder doit le confirmer
avant la mise en production (le juridique est traité à la fin).

| Composant (bibliothèque) | Page 21st.dev | Où sur l'accueil | Ce qu'il dit, ce qu'on a réécrit |
|---|---|---|---|
| Animated Beam (Magic UI) | https://21st.dev/@dillionverma/components/animated-beam | Héros (`HeroScene.tsx`), parcours (`MissionScene.tsx`) | Le freelance et l'entreprise nourrissent la même mission. Héros : chemins fixes et impulsion en CSS (`stroke-dashoffset`), sans mesure ni hydratation. Parcours : `m.path` (`pathOffset`) au lieu d'un dégradé animé. |
| Marquee (Magic UI) | https://21st.dev/@dillionverma/components/marquee | Bande des capacités (`Capabilities.tsx`) | Tout passe par le même fil. Piste en CSS (`transform`), copie `aria-hidden`, ralentissement doux sous le pointeur ou le focus (`LandingFx.tsx`) au lieu d'un arrêt, liste statique en mouvement réduit. |
| Bento Grid (Magic UI) | https://21st.dev/@dillionverma/components/bento-grid | Côtés freelance et entreprise (`FreelanceBento.tsx`, `CompanyBento.tsx`) | Montrer l'interface plutôt que la décrire. Grille de 12 colonnes en `minmax(0, 1fr)`, composition en miroir pour l'entreprise, maquettes dessinées en HTML. |
| Magic Card (Magic UI) | https://21st.dev/@dillionverma/components/magic-card | Tuiles des deux bentos, cartes des ressources | La carte s'éclaire là où l'on regarde. Un seul écouteur délégué écrit `--spot-x` et `--spot-y`, bord violet (`--ps-edge-spot`), souris seulement. |
| Shimmer Button (Magic UI) | https://21st.dev/@dillionverma/components/shimmer-button | Bouton principal du héros | L'action principale. Comète violette autour du bouton papier, rotation en `transform`, arrêtée hors écran. |
| Shine Border (Magic UI) | https://21st.dev/@dillionverma/components/shine-border | Champ « une phrase devient des filtres » (`PhraseToFilters.tsx`) | La machine lit la phrase (violet = mesure, jamais preuve). Le bord brille seulement pendant l'écriture ; les filtres s'allument ensuite un à un (transition CSS). |
| Dot Pattern (Magic UI) | https://21st.dev/@dillionverma/components/dot-pattern | Fond du héros | Trame de points en CSS (`radial-gradient`) au lieu d'un motif SVG, masquée en ellipse. |
| Blur Fade (Magic UI) | https://21st.dev/@dillionverma/components/blur-fade | Titres de section (`.reveal`) | Entrée liée au défilement (CSS `animation-timeline: view()`), en montée seule : ni flou (un filtre ne s'anime pas, brand book v2 §4.4) ni fondu (un texte ne passe jamais sous son contraste, relevé par Lighthouse). |
| Sticky Scroll Reveal (Aceternity UI) | https://21st.dev/@manuarora700/components/sticky-scroll-reveal | Parcours d'une mission (`MissionStage.tsx`) | Toute la plateforme en un geste. La page défile (pas une boîte interne), les neuf étapes sont du HTML serveur, l'étape au milieu de l'écran pilote la scène ; remonter rejoue à l'envers. |
| Tracing Beam (Aceternity UI) | https://21st.dev/@manuarora700/components/tracing-beam | Rail des étapes du parcours | Le chemin parcouru. Remplissage en CSS (`view-timeline`) au lieu de `useScroll`, vert seulement à l'étape 9. |
| Spotlight (Aceternity UI) | https://21st.dev/@manuarora700/components/spotlight | Héros | Une lumière se pose une fois sur la scène. Dégradé radial sans filtre de flou SVG. |
| Aurora Background (Aceternity UI) | https://21st.dev/@manuarora700/components/aurora-background | Héros | L'ambiance violette et azur du brand book v2, deux couches qui dérivent en `transform`, sans `filter: blur` ni `mix-blend-mode`, plafonnées sous le texte. |
| Hero Highlight (Aceternity UI) | https://21st.dev/@manuarora700/components/hero-highlight | Héros | Les points s'allument sous le pointeur : l'attention du visiteur. Masque radial piloté par deux variables CSS. |
| Card Spotlight (Aceternity UI) | https://21st.dev/@manuarora700/components/card-spotlight | Les deux portes (`Doors.tsx`) | La lumière suit le pointeur dans la porte survolée ; le fil central penche vers elle (CSS `:has()`). Sans l'effet de canevas d'origine. |
| Lamp (Aceternity UI) | https://21st.dev/@manuarora700/components/lamp | Manifeste « aucune note » (`Manifesto.tsx`) | Lire, c'est voir clair. Deux cônes et une barre de lumière en CSS qui s'ouvrent au défilement, mots qui passent de l'encre secondaire à l'encre principale. |
| Container Scroll Animation (Aceternity UI) | https://21st.dev/@manuarora700/components/container-scroll-animation | Couverture « Pour les entreprises » (`CompanyCover.tsx`) | L'écran de l'entreprise se redresse face au visiteur. Inclinaison, cadre et zoom liés au défilement en CSS, sans `useScroll`. |

Récupérés mais non utilisés : Background Beams et Timeline (Aceternity UI), redondants avec Animated Beam et Tracing
Beam.

## Refonte « Legends League » (2026-10-21) : idées reprises sans code

Consulté avec le compte du founder (offre payante), le 2026-10-21. Règle suivie : un composant n'entre que s'il sert
l'idée de preuve, et il est réécrit à la charte, jamais collé. Le registre n'indique pas de licence pour ces trois
composants ; nous n'en avons repris que l'idée, réécrite en HTML et CSS sans script, et nous la créditons quand même.

| Composant | Auteur sur 21st.dev | Idée reprise | Où, et comment |
|---|---|---|---|
| Timeline (id 35051) | kuratlielia | Un fil vertical daté dont le connecteur se dessine d'une étape à la suivante. | Trace de preuve de la fiche profil (`packages/hub/src/profile-styles.ts`) : ligne en CSS, visible sans animation, dessinée seulement sous `prefers-reduced-motion: no-preference`. |
| Stamp (id 3417) | designali-in | Le tampon comme geste de validation. | Le poinçon de garantie de la marque, dessiné pour Proofseen (`packages/brand/scripts/marks.py`) ; la frappe sur un fait vérifié est écrite en CSS. Ni tracé ni code repris. |
| Audit Log (id 25163) | corr | Un journal horodaté avec acteur, type et statut. | Structure des faits vérifiés : la source, la date et qui a vérifié, en HTML serveur. |

Écartés (badges lumineux, cartes en verre ou inclinées, grilles d'équipe) : voir `.war-room/design/21ST_SHORTLIST.md`.
