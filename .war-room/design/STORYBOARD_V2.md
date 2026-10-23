# STORYBOARD V2 : la landing de Proofseen

> Sensei, Katana Forge, 2026-10-23. Destination : `.war-room/design/STORYBOARD_V2.md`.
> Page concernée : `apps/web/src/app/[lang]/page.tsx` et `apps/web/src/components/landing/*`.
> Décisions du Shogun appliquées : sombre seul, glow qui a un sens, vraies photos, composants React animés avec
> `motion` (déjà en dépendance, `apps/web/package.json:35`, `^12.43.0`), toute la plateforme pour les deux publics,
> peu de chiffres et tous sourcés, aucun score, aucune comparaison nominative non vérifiée.

---

## 0. Ce que j'ai lu, et ce qui manque

- Lu : `apps/web/src/app/[lang]/page.tsx` (9 sections empilées, lignes 26-34), `components/landing/Hero.tsx`,
  `Journey.tsx`, `Showcase.tsx`, `Companies.tsx`, `i18n/fr.ts` (textes v1, lignes 28-265), `styles/tokens.css`,
  `.war-room/design/AUDIT.md`, `21ST_SHORTLIST.md`, `sprints/DESIGN_HANDOFF.md`, `PROMPT_LEGENDS_REDESIGN.md`,
  `PROMPTS_CONQUETE.md` (tableaux C1 à C23, lignes 15-21, 470-474, 604-614), `TEAM_MEMORY.md` (lignes 625-689),
  `research/CONQUETE_PARITE.md` (§1-2), captures `design/after-b/home-1440-dark.png` et `hero-1440-dark.png`.
- **Introuvables dans l'arbre de travail** (`main`, `9aa7f5c`) : `.war-room/design/CONCEPT.md`, `STORYBOARD.md`,
  `VERDICT.md`, `.war-room/brand/BRAND_BOOK.md`, `packages/brand/`. `DESIGN_HANDOFF.md:12-13` les déclare faits :
  ils vivent probablement sur une branche non fusionnée ou n'ont pas été rapatriés. Ce storyboard n'en dépend pas :
  il nomme les couleurs par leurs tokens (`--bg`, `--surface`, `--ink`, `--muted`, `--proof`, `--signal`), pas par
  leurs valeurs. Sumi les branche sur la charte en vigueur.
- Diagnostic de la v1 (capture `after-b/home-1440-dark.png`, 1425x9640) : 11 bandes pleine largeur de même
  structure (titre serif à gauche, bloc à droite), 9 chiffres dans les deux premiers écrans, aucune photo, le
  produit raconté comme un service de mesure. Le founder a raison : c'est un journal.

---

## 1. Le concept de la v2 : « le fil de la preuve »

Une seule image mentale, de haut en bas : **deux points de lumière, le freelance et l'entreprise, reliés par un fil.
Sur ce fil voyage une mission. Quand la mission est confirmée par le client ou payée sur Proofseen, le fil devient
vert et la mission reçoit son sceau.**

Grammaire de la lumière, tenue sur toute la page (c'est ce qui donne un sens au glow) :

| Lumière | Couleur | Signifie | Jamais pour |
|---|---|---|---|
| Halo vert | `--proof` | un fait vérifié, une mission vérifiée | décorer un bouton, un titre, un fond |
| Halo ambre | `--signal` | en attente : fonds bloqués, à valider | une alerte d'erreur |
| Lumière neutre qui suit le pointeur | `--ink` à 6-10 % | l'attention du visiteur | indiquer un état |
| Faisceau qui circule | `--ink` puis `--proof` | un échange entre les deux parties | relier deux choses sans lien |

Règle dure : **le vert n'apparaît que sur ce qui est vérifiable**. Un bouton principal n'est pas vert. Un visiteur
qui a vu la page trois secondes comprend que vert = prouvé.

---

## 2. Menu

En-tête collant, 64 px desktop, 56 px mobile, fond transparent sur le héros puis `--scrim` après 24 px de défilement
(pas de `backdrop-filter`, interdit par l'audit §3.3 point 15).

- Gauche : monogramme + logotype (lien accueil).
- Centre (desktop) : **Missions** · **Freelances** · **Entreprises** · **Ressources** (menu déroulant : Blog,
  Baromètres, Simulateur, Métiers). Sections de base seulement, aucun nom de fonctionnalité, aucun nom de mission.
- Droite : « Se connecter » (lien), « Créer un compte » (bouton neutre `--ink` sur `--bg`, pas vert), « English ».
- Mobile 375 : monogramme, « Créer un compte » compact, bouton menu (48x48) qui ouvre une feuille plein écran
  (liste verticale, cibles de 56 px, fermeture par Échap, focus piégé, retour du focus au bouton). Corrige le menu
  coupé sur « Ent » relevé dans `DESIGN_HANDOFF.md:24-25`.
- Sans JS : la feuille est un `<details>` natif ; le menu reste utilisable.

---

## 3. Rythme d'ensemble

| # | Section | Intensité | Effet porteur | Actif seulement quand |
|---|---|---|---|---|
| S1 | Héros « deux côtés, une preuve » | **fort** | faisceaux + sceau du héros (CSS), lumière au pointeur | héros visible |
| S2 | Bande des capacités | respiration | marquee lente | toujours, pause hors écran |
| S3 | Côté freelance, bento | moyen | bordures lumineuses, une tuile animée à la fois | tuile à 60 % visible |
| S4 | Ce qui est vérifié, et par qui | respiration | coches qui s'allument au défilement (CSS) | défilement |
| S5 | **Le parcours d'une mission** (section phare) | **fort, le moment d'arrêt** | défilement collant, faisceaux, sceau | section visible |
| S6 | Couverture « Pour les entreprises » | respiration | photo qui s'ouvre au défilement (CSS) | défilement |
| S7 | Côté entreprise, bento | moyen | « une phrase devient des filtres », bordures lumineuses | tuile à 60 % visible |
| S8 | Manifeste « aucun score » | respiration | mots qui s'éclairent au défilement (CSS) | défilement |
| S9 | Le relevé des 780 réponses | fort (bref) | champ de 780 cases qui se remplit | section visible |
| S10 | Ressources ouvertes | respiration | aucune animation, survol lumineux | survol |
| S11 | Questions fréquentes | respiration | accordéon natif | clic |
| S12 | Les deux portes | moyen | lumière au pointeur, fil central | survol |

Aucune paire d'effets lourds n'est visible en même temps : S1 et S5 sont séparés par trois sections (S2 à S4,
environ 2,5 écrans à 1440x900), S5 et S9 par trois (S6 à S8). Toute boucle s'arrête hors écran
(IntersectionObserver) et onglet caché.

Grille desktop 1440 : 12 colonnes, `--max: 76rem` (1216 px), gouttière 24 px, marges latérales 112 px. Espacement
vertical entre sections : 160 px (respiration) ou 200 px (avant et après un moment fort). Mobile 375 : 1 colonne,
marges 20 px, espacement 96 px.

---

## 4. La maquette, section par section

Convention : **[Sans JS]** ce qu'on voit sans JavaScript ; **[Réduit]** avec `prefers-reduced-motion: reduce` ;
**[375]** au doigt sur téléphone. Toute donnée d'exemple porte « Exemple illustratif, données fictives »
(`DESIGN_WEB.md` §1, `apps/landing/test/landing.test.ts:31-33`).

### S1. Héros : « Deux côtés, une preuve »

**Rôle.** Dire en cinq secondes ce qu'est Proofseen (une marketplace freelance tech complète) et ce qui la distingue
(la mission prouvée), pour les deux publics à la fois.

**Disposition 1440.** Hauteur `min(100svh, 920px)`. Colonnes 1 à 6 : texte. Colonnes 7 à 12 : la composition.
- Texte, aligné en haut à 22 % de la hauteur : surtitre mono, H1 serif sur 3 lignes, sous-titre (max 56 caractères
  par ligne), deux boutons côte à côte, un lien tertiaire, puis une ligne de trois puces.
- Composition (560x560) : en haut à gauche, carte photo **Freelance** (220x280, coins `--radius`) ; en haut à droite,
  décalée de 64 px vers le bas, carte photo **Entreprise** (220x280) ; en bas au centre, chevauchant les deux de 40 px,
  la **carte mission** (360x220, fond `--surface`, bordure 1 px `--line`). Deux faisceaux SVG courbes partent du bas
  de chaque photo et entrent dans la carte mission.
- Fond : trame de points fins (`--line` à 40 %, pas de 24 px), masquée en dégradé radial, et une lumière neutre de
  480 px qui suit le pointeur.

**Texte.**
- Surtitre : `MARKETPLACE FREELANCE TECH · FRANCE`
- H1 : **« Le travail freelance, prouvé de bout en bout. »**
- Sous-titre : « Proofseen réunit freelances tech et entreprises : profils riches, missions, messagerie, devis,
  contrat et paiement sous séquestre. Une mission n'y est marquée vérifiée que si le client la confirme ou si elle
  est payée sur Proofseen. »
- Bouton principal : « Créer mon profil freelance » ; bouton secondaire : « Publier une mission ».
- Lien tertiaire : « Suivre une mission de bout en bout » (accès unique à S5, voir §5).
- Puces (point vert devant la seule puce qui parle de vérification) : « Aucune note sur les personnes » ·
  « Paiement sous séquestre » · « Mission vérifiée par le client ou le paiement ».

**Carte mission (exemple).** En-tête mono : `MISSION · EXEMPLE`. Titre : « API de facturation, TypeScript et
PostgreSQL ». Ligne : « 12 jours · à distance ». Trois lignes de faits, chacune avec une coche dessinée :
1. « Contrat signé des deux côtés »
2. « Fonds sous séquestre »
3. « Vérifiée par le paiement · 21 oct. 2026 »
Pied de carte, `--step--2`, `--muted` : « Exemple illustratif, données fictives. »

**Images (Sumi).** Freelance : mains sur un clavier, écran de code flou en arrière-plan, lumière de fin de journée,
visage absent ou hors champ. Entreprise : deux personnes vues de trois quarts dos devant un grand écran en salle de
réunion. Aucune légende nominative, aucune citation : ces photos illustrent des rôles, jamais des utilisateurs
(mandat `<images>`, `PROMPT_LEGENDS_REDESIGN.md:73-74`). AVIF, 440x560 (2x), 35 Ko au plus chacune.

**Composant animé.** « Faisceaux qui relient freelance, entreprise et preuve » + « héros à lumière qui suit le
pointeur ». **Les faisceaux et le sceau sont en CSS pur** (stroke-dashoffset et `offset-path`), donc sans hydratation
et joués même sans JS. Seule la lumière au pointeur est un îlot client (un écouteur, deux variables CSS).

**Chronologie (ms, depuis le premier rendu).**
- 0 : texte et composition peints. Les trois faits sont lisibles, en `--muted`, coches en contour.
- 600 à 1300 : une impulsion lumineuse parcourt le faisceau Freelance → mission.
- 1300 : fait 1 passe en `--ink`, coche pleine (ressort court, 180 ms).
- 1500 à 2200 : impulsion sur le faisceau Entreprise → mission.
- 2200 : fait 2 passe en `--signal` (ambre : en attente), petit halo ambre.
- 2600 à 3100 : les deux faisceaux pulsent ensemble.
- 3100 : **le sceau** : fait 3 en `--proof`, bordure de la carte en `--proof`, halo vert qui s'ouvre (0 → 40 px à
  18 %) puis se pose (24 px à 10 %) en 600 ms ; les deux faisceaux restent verts.
- 3700 : repos. Plus rien ne bouge sauf la lumière au pointeur. Pas de boucle.

**Sens.** Les deux parties alimentent la même preuve ; la vérification arrive à la fin, causée par le paiement.

**[Sans JS]** Identique (CSS), lumière au pointeur absente. **[Réduit]** État final directement : faisceaux verts
fixes, sceau posé, aucune impulsion, aucune lumière qui suit. **[375]** Une colonne : surtitre, H1 (`--step-4`,
environ 2,5 rem, 4 lignes), sous-titre, boutons pleine largeur empilés (52 px), lien tertiaire, puces en liste. Puis
la composition réduite à 335x300 : la carte mission pleine largeur en bas, deux pastilles photo rondes de 64 px au
dessus à gauche et à droite, faisceaux courts. Le héros tient en 2 écrans au plus. Pas de lumière au pointeur.

**LCP.** Le H1, jamais animé, jamais en `opacity: 0`. Photos en `fetchpriority="low"`, dimensions fixées.

---

### S2. Bande des capacités

**Rôle.** Montrer d'un coup d'œil l'étendue de la plateforme, sans paragraphe.

**Disposition 1440.** Bande pleine largeur, 96 px de haut, bordures haut et bas `--line`. Libellé fixe à gauche
(colonnes 1 à 3) : « Tout ce qu'une mission demande, au même endroit ». À droite, une frise qui défile.

**Texte de la frise** (chaque élément = petite icône de trait faite maison + mot) : Profil riche · Import de CV ·
Missions et alertes · Candidature suivie · Messagerie en direct · Devis · Contrat signé en ligne · Paiement sous
séquestre · Facture électronique · Validation à deux niveaux · Vivier privé · API · Application installable ·
Visibilité dans les IA mesurée.

**Composant animé.** « Marquee » qui ralentit sous le pointeur ou le focus (move 8 de l'arsenal, `LogoMarquee.tsx`),
40 px/s. **Sens** : tout passe par le même endroit, comme sur un fil.

**[Sans JS]** Liste qui passe à la ligne, statique. **[Réduit]** Statique, défilable au clavier. **[375]** Libellé au
dessus, frise sur une ligne, 28 px/s.

---

### S3. Côté freelance : bento

**Rôle.** Tout ce que le freelance obtient, montré par l'interface plutôt que décrit.

**Texte d'ouverture** (colonnes 1 à 7) :
- Surtitre : `POUR LES FREELANCES`
- H2 : **« Votre travail, montré tel qu'il est. »**
- Sous-titre : « Un profil que l'on peut vérifier, des missions qui disent pourquoi elles vous sont proposées, et
  chaque étape de la mission au même endroit. »
- Lien : « Créer mon profil ».

**Disposition 1440.** Bento de 12 colonnes, rangées de 220 px, espacement 16 px. Tuiles de tailles différentes, jamais
deux identiques côte à côte :

| Tuile | Place | Contenu visuel | Texte |
|---|---|---|---|
| A. Profil riche | col 1-7, rangées 1-2 | maquette du profil : expériences, formations, certifications, langues, portfolio, disponibilité | « **Un profil complet.** Expériences, formations, certifications, langues, portfolio. Importez votre CV : il devient un brouillon que vous relisez avant toute publication. » |
| B. Photo | col 8-12, rangée 1 | photo : freelance concentré, carnet et ordinateur | légende : « **Sous votre nom ou sous une référence.** Vous choisissez ce qui est public. » |
| C. Disponibilité datée | col 8-12, rangée 2 | pastille « Disponible · confirmé le 18 oct. » | « **Une disponibilité qui porte sa date.** Sans confirmation depuis 30 jours, elle s'affiche « non confirmée ». » |
| D. Missions pour vous | col 1-4, rangée 3 | carte mission avec la ligne « Proposée pour : TypeScript, Lyon, hybride » | « **Chaque proposition dit pourquoi.** Aucun pourcentage de compatibilité. » |
| E. Candidature suivie | col 5-8, rangée 3 | trois étapes : Envoyée → Lue → Retenue | « **Vous savez où en est votre candidature.** Lue, retenue ou non. » |
| F. Application | col 9-12, rangées 3-4 | téléphone en perspective, notification « Nouveau message » | « **Proofseen dans la poche.** S'installe depuis le navigateur. » |
| G. Messagerie | col 1-8, rangée 4 | fil de messages avec « Lu » et une pièce jointe PDF | « **Des messages en direct.** Pièces jointes, accusé de lecture. Les coordonnées ne s'échangent qu'une fois le paiement engagé. » |

**Composants animés.** « Bento à bordures lumineuses » : la bordure de chaque tuile s'éclaire à l'endroit du
pointeur (move 9 « cartes éclairées », un seul écouteur délégué). Lumière neutre, sauf sur les éléments vérifiés
(pastille de disponibilité confirmée) où elle prend la teinte `--proof`. Chaque tuile a une micro-animation qui ne
joue qu'une fois, à 60 % de visibilité, une tuile à la fois : A, les sections du profil se posent une à une (60 ms
d'écart, 240 ms chacune) : **sens**, le CV devient un profil ; C, le jour de confirmation se coche ; E, la pastille
avance de « Envoyée » à « Lue » ; G, deux bulles arrivent puis « Lu » s'affiche ; F, la notification descend.

**[Sans JS]** Toutes les tuiles dans leur état final. **[Réduit]** États finaux, bordure lumineuse remplacée par un
changement de couleur de bordure au survol. **[375]** Une colonne dans l'ordre A, B (photo 16:9), C, D, E, G, F ;
pas de lumière au pointeur (`hover: hover and pointer: fine` seulement) ; micro-animations conservées, déclenchées à
la visibilité.

**Réserves de vérité (Kage avant publication).** Tuile F : l'installation et une notification sur un vrai téléphone
ne sont **pas vérifiées** (`PROMPTS_CONQUETE.md:611`). Écrire « S'installe depuis le navigateur » seulement après ce
test ; « notifications » seulement après réception réelle. Captures de l'interface : celles de `/shots/*.webp`
montrent l'ancienne interface (`DESIGN_HANDOFF.md:26-27`) : maquettes redessinées en HTML ou captures refaites.

---

### S4. Ce qui est vérifié, et par qui

**Rôle.** Définir le mot « vérifié », qui porte toute la marque. Respiration : beaucoup d'air, une seule photo.

**Disposition 1440.** Alternance image et texte. Colonnes 1 à 5 : photo verticale (4:5, 480x600), décalée de 80 px
vers le bas par rapport au titre. Colonnes 7 à 12 : titre, puis liste en `<dl>`, six lignes séparées par des filets
`--line`, chaque ligne = coche + fait (serif) + « par qui » (sans, `--muted`).

**Texte.**
- H2 : **« Ce qui est vérifié, et par qui. »**
- Sous-titre : « Pas de badge à points. Des faits, datés, avec leur source. »
- Lignes :
  1. **Mission vérifiée** : confirmée par le client, par un lien signé et sans compte, ou payée sur Proofseen.
  2. **Entreprise active** : SIRET contrôlé au répertoire officiel, revérifié chaque mois, jamais publié.
  3. **Adresse prouvée** : la possession d'un site ou d'un dépôt de code est démontrée.
  4. **Attestation URSSAF vérifiée** : contrôlée par un opérateur de Proofseen.
  5. **Payé par plusieurs entreprises** : compté sur les paiements passés par Proofseen.
  6. **Identité vérifiée** : par le prestataire de paiement.
- Pied : « Le document lui-même n'est jamais montré. »

**Image.** Mains qui signent un contrat papier sur une table, ou paraphe sur tablette ; lumière latérale.
**Sens** : la preuve vient d'un acte, pas d'une déclaration.

**Composant animé.** « Frise de faits » : chaque coche passe du contour au vert avec un halo bref quand sa ligne
traverse le milieu de l'écran (CSS `animation-timeline: view()`, zéro JS). **Sens** : un fait se gagne, ligne par
ligne.

**[Sans JS]** Coches vertes. **[Réduit]** Coches vertes sans halo. **[375]** Photo en bandeau 16:9 au dessus, liste
dessous, « par qui » sous le fait.

**Réserve de vérité.** Ligne 6 : l'identité par Stripe est listée comme restante en C8 (`PROMPTS_CONQUETE.md:470`,
« restent l'identité Stripe ») alors que le rendu existe (`profile-page.ts:207-210`, AUDIT §5.1). À confirmer par
Kage ; sinon retirer la ligne.

---

### S5. Le parcours d'une mission (section phare)

**Rôle.** Raconter toute la plateforme en un seul geste : de l'annonce à la preuve. C'est ici que Proofseen dépasse
un job board (Free-Work n'a ni contrat ni séquestre, `CONQUETE_PARITE.md:74`, lu le 2026-10-05) sans le dire.

**Ouverture.**
- Surtitre : `LE PARCOURS`
- H2 : **« Une mission, de l'annonce à la preuve. »**
- Sous-titre : « Neuf étapes, un seul endroit. Suivez une mission d'exemple. »

**Disposition 1440.** Deux colonnes. Colonnes 1 à 7 : **la scène**, collante (`position: sticky`, `top: 64px`,
hauteur `calc(100svh - 64px)`), centrée verticalement. Colonnes 8 à 12 : **les étapes**, une `<ol>` de 9 entrées,
chacune de hauteur minimale 72svh, texte centré dans la hauteur. Bord droit : rail de 9 points cliquables (navigation
clavier, `aria-current="step"`).

La scène : nœud **Freelance** (haut gauche, pastille photo 96 px + libellé), nœud **Entreprise** (haut droite),
**carte mission** au centre bas (420x260), faisceaux entre les trois. Chaque étape change l'état de la scène :

| Étape | Texte (titre puis phrase) | Ce que fait la scène |
|---|---|---|
| 1 | **L'entreprise publie la mission.** Compétences, TJM, durée, télétravail. La mission a sa page publique, lisible par les moteurs. | le nœud Entreprise s'allume, la carte se compose (titre, compétences, TJM) |
| 2 | **Le freelance la trouve et postule.** Recherche plein texte, filtres, alertes. La candidature part avec le profil. | impulsion Freelance → carte |
| 3 | **La candidature est lue, puis retenue.** Le freelance voit chaque changement. | pastille « Lue » puis « Retenue » sur la carte |
| 4 | **Ils échangent en direct.** Messages, pièces jointes, accusé de lecture. | deux bulles glissent le long du faisceau entre les nœuds |
| 5 | **Le freelance envoie son devis.** L'entreprise l'accepte dans l'échange. | une feuille « Devis » sort de la carte, coche de l'entreprise |
| 6 | **Le contrat est signé des deux côtés.** Le SIRET de chaque partie est contrôlé ; l'identité du freelance n'est transmise qu'à sa signature. | deux signatures, une par nœud, coches pleines |
| 7 | **L'entreprise paie, les fonds sont bloqués.** Ils restent sous séquestre jusqu'à la validation. | un fermoir se referme sur la carte, halo ambre, libellé « Fonds bloqués » |
| 8 | **L'entreprise valide, le freelance est payé.** Validation par un ou deux administrateurs, facture électronique au format CII. Jamais de versement automatique. | le faisceau porte un flux vers le Freelance, icône facture |
| 9 | **La mission est vérifiée.** Elle rejoint le profil du freelance, datée, avec sa source. | **le sceau** (voir §6) |

Après l'étape 9, sous la scène, un bouton secondaire : **« Voir l'autre chemin : le client confirme une mission
passée hors de Proofseen »**. Il rejoue la fin : carte « Déclarée » en tirets gris, un lien signé part vers le nœud
Entreprise, la confirmation revient, sceau « Vérifiée par le client ». Libellé de la carte en état initial :
« Déclarée, non vérifiée ». **Sens** : il n'y a que deux chemins vers le vert, et le visiteur les voit tous les deux.

Ligne d'état honnête, au pied de l'étape 7, pilotée par la configuration (affichée tant que la clé publiable n'est
pas en mode réel) : « Les paiements réels ouvrent prochainement. » (`TEAM_MEMORY.md:686-689` : bac à sable seulement,
versement non joué, aucun paiement réel sans GO PAIEMENT LIVE.)

**Composant animé.** « Défilement collant qui raconte un parcours » + « faisceaux animés ». Contrôleur : l'étape
dont le centre est le plus proche du milieu de l'écran devient active (IntersectionObserver, seuils 0,5) ; la scène
interpole entre états avec `motion` (ressort `stiffness 260, damping 30`, 280 à 420 ms), interruptible : remonter
rejoue à l'envers, rien n'est figé. Les étapes inactives restent lisibles en `--muted` (jamais `opacity: 0`).

**[Sans JS]** La scène affiche l'état final (mission vérifiée, faisceaux verts) une fois, en haut, non collante ; la
liste des 9 étapes se lit en entier dessous. **[Réduit]** Scène collante conservée, changements d'état instantanés
(fondu de 0 ms), pas d'impulsions, sceau sans anneau (changement de couleur seul). **[375]** Pas de deux colonnes :
la scène devient une bande collante en haut (`top: 56px`, hauteur `clamp(220px, 36svh, 300px)`) qui ne montre que
la carte mission et un faisceau court entre deux pastilles de 40 px ; les étapes défilent dessous à 60svh chacune ;
rail remplacé par « 3 / 9 » dans la bande. Si la hauteur visible est inférieure à 600 px (paysage, petits écrans),
bande non collante : chaque étape porte une vignette statique de son état.

---

### S6. Couverture « Pour les entreprises »

**Rôle.** Bascule d'audience, respiration visuelle avant le second bento.

**Disposition 1440.** Photo pleine largeur, hauteur 78svh, dégradé vers `--bg` en bas sur 40 %. Texte en bas à
gauche (colonnes 1 à 6), à 96 px du bas.

**Texte.**
- Surtitre : `POUR LES ENTREPRISES`
- H2 : **« Recrutez sur des faits, pas sur une note. »**
- Sous-titre : « Décrivez votre besoin en une phrase : il devient des filtres que vous voyez et modifiez. Proofseen
  ne note personne. »
- Bouton : « Publier une mission » ; lien : « Voir les freelances ».

**Image.** Équipe tech de trois ou quatre personnes autour d'un écran, en discussion, lumière chaude, aucun visage
mis en avant. **Sens** : l'entreprise décide, à plusieurs.

**Composant animé.** « Couverture photo qui s'ouvre au défilement » (move 11) : `clip-path: inset(12% 8% round 6px)`
→ `inset(0)` et zoom 1,08 → 1, liés à `view()`, en CSS. **[Sans JS]** et **[Réduit]** : photo ouverte, fixe.
**[375]** Photo en 4:5, texte **sous** la photo (pas en surimpression, pour le contraste AA).

---

### S7. Côté entreprise : bento

**Disposition 1440.** Même grille que S3, composition **en miroir** (la grande tuile à droite) pour ne pas répéter S3.

| Tuile | Place | Contenu visuel | Texte |
|---|---|---|---|
| A. Une phrase, des filtres | col 6-12, rangées 1-2 | champ de saisie, puis puces de filtres | « **Votre besoin en une phrase.** Il devient des filtres visibles et modifiables. La liste suit l'ordre que vous choisissez, jamais une note. » |
| B. Faits sur chaque profil | col 1-5, rangée 1 | carte de profil avec trois faits verts, aucune note | « **Des faits, pas des étoiles.** Missions vérifiées, entreprise active, disponibilité datée. » |
| C. Missions et candidatures | col 1-5, rangée 2 | tableau en colonnes : Reçues, Lues, Retenues | « **Vos missions, vos candidatures, un tableau.** » |
| D. Contrat et séquestre | col 1-4, rangée 3 | carte contrat avec fermoir ambre | « **Vous payez, les fonds attendent.** Rien n'est versé sans votre validation. » |
| E. Facture électronique | col 5-8, rangée 3 | aperçu de facture, mention « CII · EN 16931 » | « **Facture électronique et export comptable.** » |
| F. Équipe et validations | col 9-12, rangée 3 | deux avatars d'initiales, double coche | « **Validation à deux niveaux, centres de coûts, vivier privé** de freelances déjà payés. » |
| G. API | col 1-12, rangée 4 (basse, 160 px) | bloc de code `GET /api/v1/contracts` avec en-tête de clé masqué et réponse JSON | « **Vos contrats et factures, lus par vos outils.** Clés d'API par entreprise, révocables. » |

**Composant animé principal (tuile A).** « Une phrase devient des filtres » : la phrase d'exemple s'écrit (32 ms par
caractère) : « Développeur React senior à Lyon, hybride, disponible en novembre, 650 € par jour au plus » ; puis
chaque fragment se détache et devient une puce (React · Lyon · Hybride · Disponible · ≤ 650 €/j), 90 ms d'écart.
Libellé « Exemple ». Aucun appel au modèle sur la landing. **Sens** : l'IA traduit, elle ne trie pas (AI Act,
`TEAM_MEMORY.md:652, 679`). Tuile G : la réponse JSON apparaît ligne par ligne une fois. Bordures lumineuses comme S3.

**[Sans JS]** Phrase complète et puces affichées. **[Réduit]** Idem, sans écriture. **[375]** Une colonne, ordre A, B,
D, C, E, F, G ; bloc de code G défilable horizontalement dans son cadre.

---

### S8. Manifeste « aucun score »

**Rôle.** La position éthique, dite une fois, grande, sans mur de texte. Remplace les 8 cartes de la charte v1.

**Disposition 1440.** Énoncé serif `--step-4` sur les colonnes 1 à 10, aligné à gauche, 2 lignes. 120 px plus bas,
trois colonnes de texte court (4 colonnes chacune), sans cadre, séparées par des filets verticaux `--line`. Lien
sous la troisième.

**Texte.**
- Énoncé : **« Aucune note sur les personnes. Aucun classement opaque. »**
- Colonne 1 : « **Chaque rapprochement affiche sa raison.** Une mission vous est proposée pour des faits que vous
  pouvez lire. »
- Colonne 2 : « **Les avis suivent une mission payée.** Affichés un par un, datés, sans moyenne. »
- Colonne 3 : « **Les données restent à vous.** Export et effacement depuis vos réglages. »
- Lien : « Lire notre charte d'honnêteté ».

**Composant animé.** « Texte qui s'éclaire au défilement » : chaque mot de l'énoncé passe de `--muted` à `--ink`
(lié à `view()`, CSS). **Sens** : lire, c'est voir clair. Jamais d'opacité nulle : `--muted` reste AA (8,80:1 sur
`--bg`, AUDIT §3.4 point 16). **[Sans JS]** et **[Réduit]** : tout en `--ink`. **[375]** Énoncé `--step-3`, 4 lignes,
colonnes empilées.

---

### S9. Le relevé des 780 réponses (un moment, pas la page)

**Rôle.** La visibilité dans les IA, fonction du produit, prouvée par la seule mesure publiable.

**Disposition 1440.** Colonnes 1 à 5 : texte. Colonnes 6 à 12 : le champ de 780 cases (3 colonnes de moteurs, une
ligne par offre, la ligne « Vous » en bas), puis les puces de sources.

**Texte.**
- Surtitre : `VISIBILITÉ DANS LES IA`
- H2 : **« Quand un recruteur demande à une IA, votre nom sort-il ? »**
- Sous-titre : « Depuis votre espace, Proofseen pose à OpenAI, Anthropic et Perplexity les questions d'un recruteur,
  plusieurs fois, et compte où vous apparaissez. Nous avons commencé par notre fondateur. »
- Fait, en grand : **« 0 citation sur 780 réponses »**
- Source dessous : « Vague J0, 23 et 24 septembre 2026, protocole figé avant la mesure. »
- Condition : « Mesure réservée aux profils publiés avec une adresse prouvée. »
- Lien : « Comment nous mesurons ».

**Composant animé.** « Champ de points » : à l'entrée, les colonnes se remplissent (une case = une vraie réponse,
couleur = source citée), 700 ms au total ; puis un curseur parcourt la ligne « Vous » et la laisse creuse. Puces :
isoler une source au survol ou au toucher. **Sens** : l'absence est le point de départ, mesurée et non cachée.

**Livraison.** Le champ devient un **SVG rendu côté serveur** à partir des données compactées (arbitrage 7 de l'AUDIT :
les 214 378 caractères de charge RSC disparaissent). L'îlot client ne porte que le filtre de source.

**[Sans JS]** SVG complet, puces en légende statique. **[Réduit]** Champ plein d'emblée, pas de curseur. **[375]**
Les trois moteurs empilés, cases de 4 px, puces défilables à l'horizontale, fait et source au dessus du champ.

---

### S10. Ressources ouvertes

**Rôle.** Ce que Proofseen donne à tous, sans compte. Respiration.

**Disposition 1440.** Trois cartes asymétriques : Baromètres (col 1-6, 360 px de haut), Simulateur (col 7-12, 172 px),
Blog et guides (col 7-12, 172 px, sous le simulateur). Illustrations SVG maison, pas de photo.

**Texte.**
- H2 : **« Des données ouvertes, et leurs sources. »**
- Baromètres : « **TJM et compétences.** Médiane et quartiles, nombre de réponses affiché, publiés seulement au-dessus
  d'un seuil. Données en CSV et JSON, sous licence CC BY. »
- Simulateur : « **Revenu net d'un freelance.** Chaque taux est daté et lié à sa source officielle. »
- Blog : « **Guides et articles.** Aucun chiffre sans sa source. »

**Composant.** Bordure lumineuse au survol uniquement. **[Sans JS]** identique. **[375]** Cartes empilées.

---

### S11. Questions fréquentes

**Disposition 1440.** Colonnes 1 à 4 : H2 collant « Questions fréquentes » + lien « Nous écrire ». Colonnes 6 à 12 :
accordéon en `<details>` natif (ouverture animée en CSS `interpolate-size` là où il est pris en charge).

**Questions et réponses.**
1. « Comment une mission devient-elle vérifiée ? » : « De deux façons seulement : le client la confirme par un lien
   signé, sans créer de compte, ou elle est payée sur Proofseen. »
2. « Pourquoi aucune note ni aucun score ? » : « Parce qu'un chiffre opaque sur une personne ne dit pas ce qu'elle a
   fait. Nous montrons des faits datés et la raison de chaque rapprochement. »
3. « Mon identité est-elle publique ? » : « Vous publiez sous votre nom ou sous une référence. L'identité légale n'est
   transmise à une entreprise qu'à la signature d'un contrat. »
4. « Comment fonctionne le séquestre ? » : « L'entreprise paie à la signature, les fonds restent bloqués, puis sont
   versés après sa validation. Aucun versement n'est automatique. »
5. « Que voient les IA de mon profil ? » : « Une page publique lisible sans JavaScript, avec ses données structurées.
   Vous pouvez mesurer si les IA la citent. »
6. « Que deviennent mes données ? » : « Vous les exportez et les effacez depuis vos réglages. »

**[Sans JS]** `<details>` natif. **[Réduit]** Ouverture instantanée. **[375]** Titre au dessus, non collant.

---

### S12. Les deux portes

**Rôle.** Fermer la boucle ouverte par le héros : les deux côtés se rejoignent.

**Disposition 1440.** Deux moitiés de 6 colonnes, 520 px de haut, chacune un grand lien entier, photo assombrie en
fond (60 % de `--bg`). Au centre, un fil vertical lumineux avec le monogramme à mi-hauteur.

**Texte.**
- Gauche : « **Je suis freelance** » / « Montrez ce que vous avez livré. » / bouton « Créer mon profil ».
- Droite : « **Je recrute** » / « Trouvez sur des faits. » / bouton « Publier une mission ».

**Images.** Gauche : bureau de freelance au crépuscule, écran allumé. Droite : open space vide le soir, un écran
allumé. **Sens** : deux lieux, un même fil.

**Composant animé.** Lumière qui suit le pointeur dans la moitié survolée ; le fil central se penche de 4° vers elle.
**[Sans JS]** et **[Réduit]** : fixe. **[375]** Moitiés empilées (300 px chacune), fil horizontal entre elles.

---

## 5. L'accès unique à la section phare

Le lien du héros « Suivre une mission de bout en bout » ne fait pas un simple saut d'ancre : **la carte mission du
héros s'envole et devient la carte de la scène de S5**. Mécanique : `document.startViewTransition` avec
`view-transition-name: mission-card` posé sur les deux cartes, défilement vers `#parcours` pendant la transition,
620 ms, courbe `--ease-in-out`. La carte arrive dans l'état de l'étape 1 (la mission vient d'être publiée) : le
visiteur assiste à la naissance de la mission qu'il vient de voir vérifiée, et la regarde se gagner étape par étape.

Repli : sans View Transitions, sans JS ou en mouvement réduit, ancre `#parcours` classique (`scroll-behavior` auto en
réduit). Focus déplacé sur le H2 de S5. Ne pas `pushState` si le hash est déjà `#parcours`
(`signature-moves.md:32`).

---

## 6. Le moment d'arrêt : le sceau de l'étape 9

**Ce que l'on voit (desktop, 1 400 ms).**
- 0 : la carte mission est en `--surface`, bordure `--line`, libellé « En cours ».
- 0 à 360 : le faisceau Entreprise → Freelance se remplit de vert de bout en bout (stroke-dashoffset).
- 360 : la bordure de la carte passe en `--proof`.
- 360 à 960 : un anneau vert part de la carte et s'étend à 1,6 fois sa taille en s'effaçant ; en même temps, la
  ligne « Vérifiée par le paiement · 21 oct. 2026 » s'inscrit, caractère par caractère, dans la police mono.
- 960 à 1 400 : la carte se détache de la scène, glisse vers le nœud Freelance et se range dans une pile de
  « missions vérifiées » sous sa pastille. Le halo vert reste posé, sans pulser.
- Remonter d'une étape défait le sceau dans l'ordre inverse : la vérification ne se décrète pas, elle se rejoue.

**Pourquoi c'est le bon geste pour Proofseen.** Toute la promesse tient dans la règle « une mission n'est vérifiée
que par la confirmation du client ou le paiement ». Le sceau ne tombe qu'à cette étape, jamais à la publication, ni à
la candidature, ni à la signature : le visiteur qui fait défiler en arrière et en avant **vérifie lui-même** que le
vert n'apparaît qu'au bon moment. Le bouton « Voir l'autre chemin » montre la seconde et dernière façon de l'obtenir.
On revient le voir parce qu'il est réversible et causé, pas parce qu'il brille. Et la carte rangée sous le
freelance raconte ce que Malt et Free-Work n'affichent pas : la mission devient une pièce du profil.

**[Sans JS]** État final peint. **[Réduit]** Bordure et ligne vertes, pas d'anneau, pas de déplacement. **[375]**
Même sceau dans la bande collante, anneau limité à 1,3 fois, pile non affichée (place).

---

## 7. Chiffres affichés : registre complet

La page entière affiche **cinq chiffres réels**, tous en S9 ou dans des règles du produit. Rien d'autre.

| Chiffre | Où | Source |
|---|---|---|
| 780 réponses | S9 | `TEAM_MEMORY.md:367`, `i18n/fr.ts:38` |
| 0 citation (sur 780) | S9 | idem, vague J0 |
| 23 et 24 septembre 2026 | S9 | `i18n/fr.ts:40` |
| 30 jours (disponibilité « non confirmée ») | S3 | `TEAM_MEMORY.md:682` |
| deux niveaux de validation | S7, S5 | `TEAM_MEMORY.md:658` |

Données d'exemple (12 jours, 650 €, 21 oct. 2026, noms de compétences) : toujours sous l'étiquette « Exemple
illustratif, données fictives ». Aucun nombre d'utilisateurs, de missions, de logos de clients, de témoignage, de
prix (décision du 2026-10-07, `TEAM_MEMORY.md:657`), de taux de commission (les conditions n'en publient aucun,
`TEAM_MEMORY.md:685`).

**Comparaison avec Malt et Free-Work : aucune comparaison nominative sur la landing v2.** Les faits Malt de la veille
sont pour la plupart « À VÉRIFIER (bloqué) », malt.fr ayant répondu 403 (`CONQUETE_PARITE.md:9-13`) ; une publicité
comparative doit porter sur des faits objectifs et vérifiables. La différence se lit sans nom : « Aucun pourcentage
de compatibilité » (S3), « contrat et séquestre » (S5). Si le founder vérifie à la main des faits datés, une ligne
discrète pourra s'ajouter en S8 ; pas avant.

---

## 8. Budgets

**Cibles (à mesurer, pas encore mesurées)** : Lighthouse mobile perf ≥ 0,95 ; a11y, BP, SEO = 1 ; LCP ≤ 2,5 s ;
CLS ≤ 0,05 ; HTML de `/fr` ≤ 45 Ko gzip (mesuré en v1 : 38 569 o gzip mais 240 875 o bruts, AUDIT §1.11).

**Charge en premier (chemin critique, aucun JS requis).**
- HTML serveur de toute la page, CSS de la landing seule (sortir `workspace.css` de `layout.tsx:5-6`, AUDIT point 23).
- Police d'affichage du H1 en sous-ensemble latin, préchargée seule ; Inter en `swap` avec métriques ajustées.
- Héros complet : texte, composition SVG en ligne, faisceaux et sceau en CSS, deux photos AVIF (≤ 35 Ko chacune,
  `fetchpriority="low"`, `width`/`height` posés).

**Différé après le LCP (`requestIdleCallback`, puis `next/dynamic` sans SSR).**
- Lumière au pointeur du héros et des portes (îlot de moins de 2 Ko).
- `motion` en `LazyMotion` + `domAnimation`, composants `m.*` seulement (pas le paquet complet).

**Différé à l'approche (IntersectionObserver, marge 400 px).**
- Contrôleur de S5 (scène, faisceaux, sceau, autre chemin).
- Micro-animations des bentos S3 et S7, démonstration « une phrase, des filtres », réponse de l'API.
- Filtre de source du champ S9.
- Photos sous la ligne de flottaison : `loading="lazy"`, `srcset` 640/960/1440, AVIF puis WebP.

**Jamais sur la landing.** Clerk (`ui.browser.js` préchargé en v1, AUDIT point 25), Stripe.js, vidéo, canvas 3D,
bibliothèque d'icônes, polices non latines (12 `@font-face` en v1, AUDIT point 24).

**Ce que voit un visiteur sans JS.** Toute la page, tout le texte, toutes les images ; héros animé en CSS ; S5 en
liste ordonnée sous une scène à l'état final ; S7 avec la phrase et ses filtres déjà posés ; S9 en SVG complet ;
FAQ en `<details>` ; menu mobile en `<details>`. Aucun contenu ne part d'une `opacity: 0` (arbitrage 6 de l'AUDIT).

**En mouvement réduit.** Plus aucune translation, impulsion, écriture caractère par caractère ni lumière qui suit :
les états changent instantanément, les verts restent (ils portent l'information).

**Hydratation.** Chaque section à îlot sous son propre `<Suspense>` (`performance.md` levier 2). Mesurer après chaque
signature : `curl` gzip, nombre d'éléments, « First Load JS » du build, Lighthouse en production (le CLS des polices
n'apparaît qu'en réseau réel).

---

## 9. Composants 21st.dev à chercher, par priorité

Rappel : licence lue avec `get_component`, réécrit à la charte, crédité dans `apps/web/NOTICE.md`. La présélection
du 2026-10-21 (`21ST_SHORTLIST.md:18-20`) écartait glow et 3D comme décoratifs ; la v2 les réintroduit **seulement**
sous la grammaire du §1 (vert = vérifié). Ce revirement vient du Shogun, il doit être noté dans le verdict.

1. `animated beam connect nodes svg` : faisceaux du héros et de S5 (type Magic UI « Animated Beam »).
2. `sticky scroll reveal steps` puis `scroll storytelling sticky section` : scène collante de S5.
3. `glowing border card pointer` puis `bento grid glowing effect` : bentos S3 et S7.
4. `spotlight hero background mouse follow` : lumière ambiante du héros et des portes.
5. `ai search input to filter chips` puis `typewriter input tags` : tuile « une phrase, des filtres ».
6. `marquee slow on hover` : bande des capacités S2.
7. `3d tilt card glare` : carte mission du héros (inclinaison légère au pointeur, desktop seulement).
8. `stamp seal animation` (id 3417 déjà repéré) : dessin du sceau, refait avec le monogramme.
9. `iphone mockup device frame` : tuile Application de S3.
10. `image reveal clip path scroll` : couverture S6.
11. `text reveal on scroll word by word` : manifeste S8.
12. `timeline vertical animated connector` (id 35051 déjà repéré) : rail des étapes de S5 sur mobile.

---

## 10. Photos à sourcer (pour Sumi)

| Section | Sujet | Ce qu'elle signifie | Format |
|---|---|---|---|
| S1 | mains sur clavier, code flou, lumière de fin de journée | le freelance au travail | 4:5, AVIF |
| S1 | deux personnes de trois quarts dos devant un écran en réunion | l'entreprise qui cherche | 4:5 |
| S3 | freelance concentré, carnet et ordinateur | le profil, c'est du travail réel | 16:10 |
| S4 | mains qui signent un contrat ou paraphent sur tablette | la preuve vient d'un acte | 4:5 |
| S6 | équipe tech autour d'un écran, lumière chaude | l'entreprise décide à plusieurs | 21:9 et 4:5 |
| S12 | bureau de freelance au crépuscule, écran allumé | une porte | 3:4 |
| S12 | open space le soir, un écran allumé | l'autre porte | 3:4 |

Sept photos au total, Unsplash ou Pexels, crédit dans `CREDITS.md`. Aucune légende nominative, aucun visage présenté
comme un utilisateur de Proofseen. Rien en S5, S7, S8, S9, S10, S11 : l'interface y est l'image.

---

## 11. Ce qui n'est pas vérifié, et à trancher avant le code

1. `CONCEPT.md`, `STORYBOARD.md` (v1), `VERDICT.md`, `BRAND_BOOK.md` absents de l'arbre de travail : ce storyboard ne
   les a pas lus. Le Shogun doit dire si la marque du lot a (après-b : fond chaud, crème, vert) est celle de la v2.
2. Routes des boutons : « Créer mon profil freelance » et « Publier une mission » vers `/[lang]/creer-un-compte`
   avec une intention de rôle ? Le passage d'une intention à l'inscription Clerk n'est pas vérifié dans le code.
3. Application installable et notification reçue sur un vrai téléphone : non vérifiées (`PROMPTS_CONQUETE.md:611`).
4. Identité vérifiée par le prestataire de paiement : affichée par le code, listée comme restante en C8.
5. Paiements réels fermés : la ligne d'état de S5 est obligatoire tant que GO PAIEMENT LIVE n'est pas donné.
6. Captures de l'interface : à refaire sur la nouvelle marque, ou maquettes redessinées en HTML (préféré : plus
   légères, nettes à toute taille, traduisibles).
7. Prise en charge de `animation-timeline: view()` : Chrome et Edge oui ; Safari et Firefox à vérifier au jour du
   code. Repli : état final statique, ce qui reste juste.
8. Aucun chiffre de poids ni de score Lighthouse de ce document n'est mesuré : ce sont des cibles.

---

## Décisions du Shogun (2026-10-23)

1. La marque v2 est celle de la v1 sans le thème clair : PS Display, PS Mono, le vert du vérifié ; plus le glow et l'aura violette de `.war-room/brand/BRAND_BOOK_V2.md`. Les fichiers v1 existent bien sur `main` (`BRAND_BOOK.md`, `CONCEPT.md`, `packages/brand/`) : la copie lue par Sensei était en retard.
2. Les composants animés viennent de 21st.dev (Aceternity UI et Magic UI), code récupéré dans le scratchpad `21st-v2/`, réécrit à la marque (pas de Tailwind dans l'app), crédités dans `apps/web/NOTICE.md`.
3. Vérité : pas d'affirmation sur une notification reçue sur un vrai téléphone ; l'étape de paiement porte sa ligne « mode test » tant que GO PAIEMENT LIVE n'est pas donné ; chaque bouton mène à une route qui existe.
