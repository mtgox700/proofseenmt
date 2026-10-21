# STORYBOARD : lots b, c, d (Sensei, Vague 1, 2026-10-21)

> Concept : `.war-room/design/CONCEPT.md` (le bureau de garantie). Charte : `.war-room/brand/BRAND_BOOK.md`.
> Faits et contraintes : `.war-room/design/AUDIT.md`. Chemins relatifs au worktree `sprint/design-legends-a`.
> Ce document décrit ce que voit le visiteur ; Kaze fixe les courbes exactes, Tetsu le code, Mamori vérifie.
> Les textes proposés entre guillemets sont des propositions de copie : ils passent par les dictionnaires
> (`apps/web/src/i18n/fr.ts`, `en.ts`, libellés du hub) et par les tests de vocabulaire (`pseudonymous-copy.test.ts`,
> `visibility-dictionary.test.ts`) avant d'exister.

---

## 0. Règles communes aux trois lots

| Règle | Application |
|---|---|
| Menu | Celui du lot a, une seule source (`packages/hub/src/market-shell.ts:21-29`, rendu aussi par `SiteHeader.tsx`) : Missions, Freelances, Entreprises, Métiers, Postes, Simulateur, Blog, puis Se connecter, Créer un compte, English. Des sections de base, aucun nom de profil, d'entreprise ou de projet. Sur 375 px : seconde ligne qui défile, rien de replié (`market-shell.ts:62`). Inchangé ici. |
| Vert | `--ps-proof` seulement sur un fait vérifié par un tiers et sur le poinçon de la marque. Boutons principaux papier sur encre. |
| Rien de caché | Aucun `[data-armed]:not([data-in])` qui met un contenu à `opacity: 0` ; aucune section en `content-visibility: auto` sur la vitrine (`landing.css:4`, cause probable des zones vides des captures, AUDIT §3.5 point 27). Un mouvement part de l'état final visible. |
| Sans JS | L'état final complet est dans le HTML. Sur le hub : aucun script hors JSON-LD, aucune chaîne `display:none`, `visibility:hidden`, `opacity:0`, `font-size:0` (AUDIT §4.2-4.3). |
| Mouvement réduit | `prefers-reduced-motion: reduce` : strike, ink, reveal, trace à 0 ms (BRAND_BOOK §7) ; transition entre documents désactivée. Retours d'état (90 et 160 ms) conservés. |
| 375 px | Grilles en `minmax(0, 1fr)`, cibles de 44 px, champs à 16 px, `:hover` sous `(hover: hover) and (pointer: fine)`, `100dvh` jamais pour du contenu, zones sûres sur l'en-tête. |
| Un effet lourd à la fois | Les trois moments signatures ne sont jamais visibles ensemble ; chacun joue une fois. |

Les trois moments (CONCEPT §3) : **M1 le relevé**, **M2 l'essai et la frappe**, **M3 le passage au guichet**.

---

## Lot b. La vitrine `/[lang]` (`apps/web/src/app/[lang]/page.tsx`)

### b.0 Ordre des sections et rythme

| # | Section (id) | Composant aujourd'hui | Intensité | Décision |
|---|---|---|---|---|
| 1 | Ouverture (`#hero`) | `Hero` + `AnswerField` (client) | **fort** (M1) | refondue ; `AnswerField` remplacé par une figure serveur |
| 2 | Le relevé (`#mesure`) | `Study` | respiration | remonte en 2 ; plus de `CountUp`, barres statiques |
| 3 | La pièce (`#preuve`) | aucun | **fort** (M2) | nouvelle section |
| 4 | L'essai (`#trajet`) | `Journey` + `Simulator` | moyen | gardée telle quelle sur le fond |
| 5 | Les cinq étapes (`#methode`) | `Method` | respiration | visible sans défilement préalable |
| 6 | Ce que vous recevez (`#livrable`) | `Deliverable` + `Showcase` | respiration | gardée, sans inclinaison |
| 7 | Pour les entreprises (`#entreprises`) | `Companies` | respiration | gardée, chemin vers l'annuaire |
| 8 | La charte (`#charte`) | `Charter` | respiration | statique |
| 9 | Questions (`#faq`) | `Faq` | respiration | `<details>` natif, inchangé |
| 10 | Sortie | `SiteFooter` + bandeau final | calme | bandeau à deux portes ajouté |
| retiré | Offres | `Offers` (`page.tsx:48`) | | arbitrage 4 : plus de prix publics |

Fort, respiration, fort, moyen, respiration... : jamais deux moments forts dans le même écran (à 1440 x 900, la section 3
commence sous la ligne de flottaison ; à 375 x 812, deux écrans plus bas).

### b.1 Ouverture, seconde par seconde (1440 x 900, réseau normal)

**Hiérarchie** (grille 12 colonnes ; texte sur 5, figure sur 7) :
1. En-tête du lot a (poinçon et mot en image de taille fixe, menu, Créer un compte, English).
2. H1 en PS Display 600, `--ps-step-5`, sans italique : proposition « La preuve de ce qu'un freelance a vraiment livré. »
   (phrase du mandat et de la carte de partage, BRAND_BOOK §11 point 3). Remplace `hero.titleStart`/`titleEmphasis`
   (`fr.ts:30-31`) et l'italique synthétisé (AUDIT §3.4 point 20).
3. Chapeau (`--ps-step-1`, 2 phrases) : « Chaque mission est vérifiée sur pièce par un tiers, puis datée. Nous mesurons
   aussi si un freelance ressort quand un recruteur interroge une IA, et nous avons commencé par nous-mêmes. »
4. Deux boutons : principal « Faire mesurer ma visibilité » (`/[lang]/inscription`, `fr.ts:33`), secondaire « Voir les
   freelances » (`/[lang]/freelances`). « Voir les missions ouvertes » (`fr.ts:34`) sort de l'ouverture : la liste des
   missions est vide aujourd'hui (AUDIT §5.1) ; la mener là en premier serait une porte sur une pièce vide.
5. Figure **le registre** (M1), à droite.

**La figure « registre »** (remplace `AnswerField`, garde son sens, perd ses 214 Ko) :
- Titre de figure (`figcaption`, PS Display 600 `--ps-step-1`) : « 780 réponses d'IA, une case chacune. » Ligne de trace
  en mono : « Vague J0 · 23 et 24 septembre 2026 · OpenAI, Anthropic, Perplexity » (`fr.ts:40`).
- Trois colonnes, une par moteur. Dans chaque colonne, **une ligne par offre** (13 : 10 offres cibles, puis un filet et
  3 offres témoins) et **20 cases par ligne** (4 formulations x 5 tirages) : 13 x 20 = 260 cases par moteur, 780 au total
  (MEASUREMENT_SPEC, correction 3). Les données disent déjà moteur, offre et témoin pour chaque point
  (`AnswerField.tsx:8-15`, fichier `j0-answers.json` lu par `data/file-source.ts:12`). Mise en page à confirmer par
  Tetsu sur l'ordre réel des points.
- Chaque case prend un **ton d'encre** selon la source citée, jamais une teinte : malt.fr encre pleine, linkedin.com
  encre secondaire, dépôts de code et autres plateformes en tons plus clairs, « aucune source » en case vide au filet.
  Ton **et** forme distinguent les catégories (WCAG 1.4.11 ; les anciennes `--src-other` et `--src-none` étaient sous
  3:1, AUDIT §3.4 point 16). La colonne Anthropic se lit d'un coup d'œil presque vide : 90,8 % de ses réponses ne citent
  aucune source (`fr.ts:43`). La texture dit la vérité.
- **Aucune case verte.** Sous la figure, la ligne « Vous » devient la ligne du fondateur : un cartouche vide (filet,
  pas de remplissage) et « Notre fondateur : cité 0 fois sur 780 » (`fr.ts:41-42`, TEAM_MEMORY:342).
- Légende : les catégories avec leur **compte réel** calculé sur le serveur. Filtre « Isoler une source » sans script :
  boutons radio stylés, `:has()` atténue les autres catégories (page React, l'opacité y est permise ; jamais sur le texte).
- Tableau de lecture : `<details>` « Lire le relevé en tableau » contenant un `<table>` moteur x source (comptes réels),
  alternative pour lecteurs d'écran, robots et sans JS. Le résumé actuel (`fr.ts:60-61`) reste en tête du tableau.
- Perdu volontairement : l'infobulle par réponse (offre, domaines). C'est elle qui obligeait à sérialiser 780 objets.

**Budget de la figure** : composant serveur, aucune prop vers le client, aucune donnée de réponse dans `self.__next_f`
(contrôle : 0 occurrence de `"control"` dans le HTML, contre 783 aujourd'hui, AUDIT §1.11). SVG d'au plus 8 `<path>`
(un par catégorie, cases contiguës fusionnées en segments). Poids de la figure : 8 Ko bruts au plus dans le HTML ; le
rendu serveur étant recopié dans la charge RSC, 16 Ko bruts au plus au total. Si Tetsu mesure plus, repli : fichier
statique `/registre/j0.svg` généré au build (la vague J0 est figée, TEAM_MEMORY:352) en `<img>` avec `width`/`height`,
filtre abandonné. Objectif de page : HTML de `/fr` sous 60 Ko bruts (240 875 o aujourd'hui).

**Chronologie**
| Temps | Ce que voit le visiteur |
|---|---|
| 0 ms | Le HTML complet arrive : en-tête, titre, chapeau, boutons, figure entière avec ses 780 cases, légende. Rien ne bouge. |
| 0 à ~600 ms | Le titre est le LCP (PS Display préchargée, repli Georgia calé, BRAND_BOOK §4). Aucune animation ne court. |
| 800 ms | **M1** : en haut de chaque colonne, le filet de tête (visible depuis 0 ms) se détache. C'est la règle de lecture, terminée par les deux taquets de l'intervalle (motif de la marque). |
| 800 à 2 000 ms | Les trois règles descendent leur colonne (1 200 ms, `--ps-ease-in-out`, décalage de 120 ms entre colonnes). Elles passent sur chaque ligne d'offre ; **aucune case ne change de couleur**. |
| 2 000 à 2 240 ms | Les règles se posent sur le filet de pied de colonne. Fin. Le cartouche « Notre fondateur » reste vide. |
| ensuite | Page immobile. Survol, filtre et tableau répondent ; rien ne rejoue. |

Déclenchement : îlot client minuscule (un `IntersectionObserver` qui pose un attribut, sans donnée) pour que la règle
descende quand la figure est vue, y compris sur téléphone où elle est sous le pli. Seuls `transform` et `opacity` du
trait décoratif bougent. Interruption : sans objet (aucune interaction bloquée).

**Sans JS** : la figure complète, immobile, règles posées en pied de colonne ; filtre par radios fonctionnel ; tableau.
**Mouvement réduit** : identique au sans JS. **375 px** : en-tête sur deux lignes ; H1 sur 4 à 5 lignes à 39,8 px ;
chapeau ; boutons pleine largeur, 48 px de haut, empilés ; la figure suit, ses trois colonnes côte à côte (cases de 4 px,
pas de 5 px : 20 x 5 = 100 px par colonne, 332 px au total avec deux gouttières de 16 px) ; la légende passe sous la
figure en liste à deux colonnes ; le tableau reste replié. La règle descend quand la figure entre dans la vue.

### b.2 Le relevé (`#mesure`, respiration)

Le lecteur vient de voir le registre ; cette section en est la légende chiffrée, comme le pied d'une page de registre.
- H2 : « 780 réponses d'IA. Notre fondateur n'y apparaît pas une seule fois. » (`fr.ts:106`, inchangé).
- Bloc principal : « 0 % » en PS Display 420 `--ps-step-5`, fourchette « [0 % ; 1,9 %] » en mono (`fr.ts:111`).
- Liste de faits, chiffres **écrits, jamais comptés** (on retire `CountUp`, qui affiche 0 pendant 1,1 s,
  `CountUp.tsx:28`) : 780 réponses pour 15,79 $ ; 90,8 % des réponses d'Anthropic sans source ; 20/20 d'accord entre API
  et applications (`fr.ts:110-114`).
- Parts des sources citées : malt.fr 39 %, linkedin.com 26,5 %, github.com 2,9 % (`fr.ts:116-120`) en barres
  **statiques** à leur longueur réelle (plus de `scaleX(0)` en attente, `landing.css:148`).
- Pied de section en mono : source et protocole, empreinte 1bc9f85f (`fr.ts:121`), puis la limite (`fr.ts:122-123`).
- Optionnel, **à faire valider par le founder avant publication** : la mesure du 2026-10-07 sur proofseen.com, « 0
  citation de proofseen.com parmi les 872 sources citées dans 312 réponses » (TEAM_MEMORY:647 ; `conquete/CONQ-2026-10-07.md:29`
  dit bien 872 **citations**, pas 872 réponses). Les dictionnaires ne contiennent aujourd'hui que des chiffres J0
  approuvés (`fr.ts:1-5`).

Mouvement : aucun. Sans JS, mouvement réduit, 375 px : identiques ; à 375 px, une colonne, les barres pleine largeur.

### b.3 La pièce (`#preuve`, fort, M2)

Le pivot du récit : de la mesure à la preuve, cœur de la marketplace.
- H2 : « Une mission n'est vérifiée que sur pièce. » Chapeau : « Le freelance déclare. Un tiers vérifie la pièce. Alors
  seulement, la mission porte sa marque, avec sa date. »
- À droite (7 colonnes), **un spécimen** de mission dessiné exactement comme sur un profil (même gabarit que le lot d,
  même CSS), surmonté d'un bandeau mono : « Spécimen. Exemple illustratif, données fictives. » Contenu fictif et
  générique (rôle, type de client, durée, une phrase), aucune entreprise réelle, aucun nom. Ligne de trace : « Pièce :
  facture » relié par le fil au cartouche vert « Vérifiée le 12 octobre 2026 · facture ».
- À gauche, sous le chapeau, en mono, la liste réelle de ce qui peut faire preuve (`profile-page.ts:89`) : facture,
  contrat, attestation du client, accès au dépôt de code, livrable public ; puis les trois façons de confirmer
  (`profile-page.ts:90-91`) : confirmée par le client, par un contact chez le client par lien signé et sans compte
  (`app/[lang]/confirmer-mission/[id]/page.tsx`), payée sur Proofseen. Puis les faits vérifiés possibles
  (`profile-page.ts:82-85`) : entreprise active au répertoire officiel (le SIRET est contrôlé, jamais publié), identité
  vérifiée par le prestataire de paiement, attestation URSSAF, payé par N entreprises.
- Une ligne qui fixe la règle : « Nous montrons la méthode de vérification, jamais le document. » (`fr.ts:169`).
- Lien discret : « Voir un profil publié » vers `/[lang]/freelances`.

**Chronologie de M2** (quand le spécimen est à moitié dans la vue, une fois) :
| Temps | Geste |
|---|---|
| 0 ms | Tout est visible : texte, pièce, cartouche vert. Le fil n'est pas encore tracé (trait décoratif, `aria-hidden`). |
| 0 à 640 ms | **tracer** : le fil de 1 px part de l'affirmation (le rôle) et descend jusqu'à « Pièce : facture », finit sur le carré vert de 8 px (`stroke-dashoffset`, `--ps-ease-in-out`). |
| 640 à 780 ms | **frapper** : le cartouche passe de `scale(1.06)` à `scale(.97)` (`--ps-ease-strike`, 140 ms). |
| 780 à 900 ms | retour à `scale(1)` (120 ms). |
| 780 à 1 020 ms | **encrer** : anneau vert autour du cartouche qui s'élargit et dont la bordure passe à `transparent` (240 ms). |
| ensuite | Immobile. Bouton texte « Rejouer la frappe » (seul rejeu de la page, sous `(prefers-reduced-motion: no-preference)`). |

**Sans JS** : fil dessiné, cartouche posé (même CSS que le hub, voir d.3). **Mouvement réduit** : idem, sans bouton
« Rejouer ». **375 px** : le spécimen passe sous le texte, pleine largeur ; le fil devient vertical à gauche du bloc ;
les listes de pièces en une colonne. Pendant M2, aucun autre mouvement n'est en cours (M1 est loin au-dessus, le
simulateur de la section 4 n'est pas encore vu).

### b.4 L'essai (`#trajet`, moyen)

`Journey` et `Simulator` gardés : le serveur rend déjà l'état final complet et vrai (`Simulator.tsx:16-19`), le texte de
réponse est étiqueté comme exemple (`fr.ts:83-84`), les comptes sont réels (0 sur 200 par moteur, offres cibles :
10 x 4 x 5, `lib/sim.ts:9`). Restylé à la charte : fenêtre en `--ps-surface`, trace en mono, fourchette en filet.
Démarre à la vue, bouton « Rejouer » existant. Sans JS et mouvement réduit : état final. 375 px : une colonne, texte puis
fenêtre.

### b.5 Les cinq étapes (`#methode`, respiration) : la section invisible

Constat : la liste E1 à E5 est à `opacity: 0` tant que `InView` n'a pas posé `data-in` (`Method.tsx:21`,
`landing.css:121-122`), et la section est en `content-visibility: auto` (`landing.css:4`). Une capture pleine page, un
lecteur pressé ou un robot qui ne défile pas voient un trou (captures `before/desktop-01-accueil.png`,
`mobile-01-accueil.png`).

Décision : **la liste est rendue dans son état final, toujours.** On retire `InView` de cette liste et les règles
`[data-armed]:not([data-in])` de la vitrine (mêmes motifs pour la charte, `landing.css:222`, et les barres du relevé,
`landing.css:148` ; celle des offres part avec la section). On retire `content-visibility` des sections de la vitrine.
Pas de mouvement : c'est une respiration.

Forme : une règle verticale (la trace) avec cinq encoches ; pour chaque étape, le code en mono (« E1 »), le nom en PS
Display (« Indexé »), la question (`fr.ts:90-96`). Le rétrécissement reste un schéma, dit comme tel (`fr.ts:97`), dessiné
en largeur décroissante des encoches, statique. Les trois règles de méthode (`fr.ts:98-102`) suivent en trois colonnes
(une à 375 px). Sans JS, mouvement réduit, 375 px : identiques.

### b.6 Ce que vous recevez (`#livrable`, respiration)

Captures réelles de l'application (`Deliverable.tsx:6-11`, légende honnête `fr.ts:136`) et les six contenus du rapport.
On retire l'inclinaison au pointeur (`Showcase.tsx:39-46`). Onglets ARIA conservés. Une seule image visible à la fois,
dimensions fixées. Sans JS : à vérifier par Mamori que les deux captures restent atteignables (non vérifié ici ; si
l'onglet inactif n'est pas rendu, rendre les deux captures empilées sans JS). 375 px : capture pleine largeur, onglets
au-dessus, 44 px.

### b.7 Pour les entreprises (`#entreprises`, respiration)

Texte et points existants (`fr.ts:167-170`). Aucune carte de profil (le composant le refuse déjà à juste titre,
`Companies.tsx:8-11`), aucun compteur. Bouton secondaire « Voir les freelances ». Un lien texte « Publier une mission »
vers `/[lang]/app/missions/nouvelle` (demande un compte).

### b.8 La charte (`#charte`) et b.9 Questions (`#faq`)

Charte : huit engagements (`fr.ts:172-184`) numérotés 01 à 08 en mono, deux colonnes, statiques, visibles. Questions :
`<details>` natifs (`Faq.tsx:10`), lisibles et ouvrables sans JS, cibles de 44 px.

### b.10 Sortie

Bandeau final sur `--ps-surface`, deux portes côte à côte (empilées à 375 px) : « Vous êtes freelance » avec « Faire
mesurer ma visibilité » ; « Vous recrutez » avec « Voir les freelances ». Puis le pied de page du lot a. Rien ne bouge.
À trancher hors de ce lot : la ligne du pied « Conditions de vente... sur la page Commander » (`fr.ts:268`) renvoie à
une page de prix alors que la vitrine n'en montre plus (arbitrage 4).

### b.11 Transitions entre sections et sortie de la vitrine

Pas de transition entre sections : on défile un document. Les ancres (`#preuve`, `#mesure`) défilent en
`scroll-behavior: smooth` sous `(prefers-reduced-motion: no-preference)` seulement. Vers l'annuaire (lien `<a>` vers un
document du hub) : la règle `@view-transition { navigation: auto; }` est posée sur les deux surfaces ; l'en-tête, identique
des deux côtés, porte le même `view-transition-name` et ne bouge pas ; le reste fond en 250 ms. Désactivée en mouvement
réduit.

---

## Lot c. L'accueil de la marketplace : annuaire `/[lang]/freelances` et recherche

Fichiers : `packages/hub/src/profile-directory.ts`, `directory-cards.ts` (hub, HTML pur). Recherche connectée :
`apps/web/src/app/[lang]/app/recherche/page.tsx` (`discovery.css`), qui recopie aujourd'hui `.pcard` avec d'autres valeurs
(AUDIT §3.2 point 11).

### c.1 Hiérarchie (1440 px)

1. En-tête commun, « Freelances » en `aria-current="page"` (test `profile-directory.test.ts:156`).
2. H1 `class="title"` « Freelances publiés sur Proofseen » et chapeau (`profile-directory.ts:86-87`), inchangés.
3. Sous le chapeau, **la légende du registre**, en une ligne : un carré vert de 8 px, « vérifié par un tiers, daté » ;
   un carré au filet, « déclaré par le freelance ». C'est la clé de lecture de toute la page.
4. Deux colonnes (`profile-directory.ts:357`, grille `17rem minmax(0,1fr)`) :
   - à gauche, le panneau de filtres (formulaire GET, `profile-directory.ts:288-309`) ;
   - à droite, l'en-tête de résultats : « Profils », le **compte réel** de la page quand il n'y a ni filtre ni page
     suivante (« 1 profil publié », tiré de `items.length`), et la règle d'ordre (`profile-directory.ts:88`) en mono,
     bien visible : « Ordre : du profil le plus récemment mis à jour au plus ancien. Aucun score, aucun classement de
     personnes. »
   - puis la grille de cartes.

### c.2 Les filtres (la recherche publique)

Ordre dans le panneau : Compétences, Ville (l'intention de recherche d'abord), puis **Faits vérifiés** (adresse web
prouvée, mission vérifiée sur pièce, SIRET actif, URSSAF ; `profile-directory.ts:100-103`), puis Mode de travail, Poste,
Disponibilité. Le groupe « Faits vérifiés » porte un filet supérieur et le petit carré au filet (pas vert : un filtre
n'est pas un fait vérifié). Bouton « Filtrer » papier sur encre (fini la pilule verte, capture `desktop-02`).
Filtres actifs : au-dessus des résultats, une ligne de liens « Compétence : TypeScript ✕ » qui mènent chacun à l'adresse
sans ce filtre (GET pur, chaque recherche a son adresse), plus « Effacer les filtres » (`profile-directory.ts:306`).
Pages filtrées en `noindex, follow`, inchangé (`profile-directory.ts:346`).

### c.3 La carte de profil (une seule définition)

Même balisage et même CSS sur le hub et dans la recherche connectée : la carte du hub devient la référence, React
l'importe (même classe, mêmes valeurs). De haut en bas :
1. **Ligne de trace** en mono `--ps-step--2` : la référence (« FR-RVVUA ») et « mis à jour le 20 octobre 2026 »
   (`profile-directory.ts:133`, `pc-ref`). Elle remonte en tête : c'est le numéro du dossier.
2. **Identité** : avatar 56 px (photo si profil nominatif, sinon monogramme `<span class="avatar tone-N" aria-hidden="true">`,
   balisage figé par `profile-directory.test.ts:75`), nom en PS Display 600 `--ps-step-1`, titre du poste.
3. **Contexte** : ville · mode · TJM déclaré (`profile-directory.ts:268,276`).
4. **Disponibilité** : « Disponible · confirmée le 18 octobre 2026 » en encre, jamais en vert (c'est une déclaration) ;
   « Disponibilité non confirmée » en `--ps-signal` avec son mot (`profile-directory.ts:128`).
5. **Le registre de la carte** : les faits vérifiés (`profile-directory.ts:224-235`), chacun précédé du carré vert de
   8 px (remplace le « ✓ », `directory-cards.ts:84`). **S'il n'y en a aucun**, une ligne mono au carré vide : « Pas
   encore de pièce vérifiée. » (aujourd'hui la carte n'affiche rien, `profile-directory.ts:278`). Ainsi le vert d'une
   grille se lit d'un coup d'œil, sans jamais trier ni noter.
6. **Déclaré** : compétences (6 au plus, puis « +N », `profile-directory.ts:81,277`) en étiquettes mono au filet, et
   langues.
7. **Pied** : « Voir le profil » ; toute la carte est cliquable par le `::after` du lien du nom
   (`directory-cards.ts:74`), le lien du pied reste `aria-hidden` et hors tabulation (un seul arrêt par carte).

États : survol (souris seulement) filet `--ps-line-strong` ; focus : anneau `--ps-focus` 2 px sur la carte entière
(`directory-cards.ts:75`). Aucune ombre colorée, aucune inclinaison (écartées : 8563, 25283, 9890 de la présélection).

### c.4 Les états vides, honnêtes

| Cas | Ce qu'on montre |
|---|---|
| Aucun profil publié, sans filtre | « Aucun profil n'est encore publié. » (`profile-directory.ts:108`) puis un encart « Comment un profil arrive ici » en trois lignes mono : le freelance publie ; ses pièces sont vérifiées une à une et datées ; l'ordre est la date de mise à jour. Puis les liens existants (`profile-directory.ts:110-114`). **Aucun spécimen** dans l'annuaire : on ne montre jamais une fausse personne là où l'on en cherche une. |
| Peu de profils (1 à 2, aujourd'hui 1) | La ou les cartes, puis le même encart « Comment un profil arrive ici » à côté (desktop) ou dessous (375 px), au lieu d'une grande zone vide (capture `desktop-02`). |
| Filtres sans résultat | « Aucun profil publié ne correspond à ces filtres. » (`profile-directory.ts:107`), la ligne des filtres actifs avec leurs liens de retrait, puis « Retirer les filtres » et « Voir les missions ouvertes » (`profile-directory.ts:115-118`). |

### c.5 Sans JS, mouvement réduit, 375 px

Sans JS : c'est l'état normal du hub, rien ne change. Mouvement réduit : aucun mouvement dans l'annuaire de toute façon,
sauf M3 désactivé. 375 px : lien d'évitement ; en-tête sur deux lignes ; H1, chapeau, légende ; panneau de filtres en
`<details>` replié (« Filtres · aucun actif », 48 px, `profile-directory.ts:292`), ouvert d'office à partir de 62 rem
sans script (`directory-cards.ts:43`) ; cartes pleine largeur ; pagination en deux liens de 44 px.

### c.6 Sortie de l'annuaire : M3, le passage au guichet

| Temps | Ce que voit le visiteur |
|---|---|
| clic | Navigation normale vers `/[lang]/profils/[slug]` (lien `<a>`, aucun script). |
| 0 à 320 ms | Dans les navigateurs qui gèrent `@view-transition` entre documents : l'avatar, le nom et le registre de la carte glissent et s'agrandissent jusqu'à leur place dans l'en-tête de la page de preuve (`--ps-ease-ink`, `--ps-dur-reveal`) ; le reste fond. La carte devient le dossier. |
| ailleurs | Les autres navigateurs naviguent sans transition. Rien ne manque. |

Mise en œuvre : `@view-transition { navigation: auto; }` dans la CSS du hub ; noms uniques par profil
(`view-transition-name` lié au slug, sur la carte et sur l'en-tête du profil). Points que Tetsu doit vérifier : que la
politique de sécurité du contenu permet un attribut `style` en ligne pour porter ce nom (non vérifié ici), et le support
réel dans Chrome, Safari et Firefox. Mouvement réduit : `@media (prefers-reduced-motion: reduce) { @view-transition {
navigation: none; } }`. Retour arrière : même transition à l'envers, gratuite.

---

## Lot d. Le profil public, page de preuve (`/[lang]/profils/[slug]`)

Fichiers : `packages/hub/src/profile-page.ts`, `profile-sections.ts`, `nearby.ts`. HTML pur, un seul script (JSON-LD
`ProfilePage`, aucune note agrégée, `profile-page.ts:165-181`), mêmes octets pour tous, robots compris.

### d.1 Hiérarchie (1440 px, colonne de 66 caractères plus un rail à partir de 62 rem)

**A. La fiche (en-tête du dossier)**
1. Ligne de trace en mono : « Profil FR-RVVUA · mis à jour le 20 octobre 2026 » (`profile-page.ts:249`, remonte en tête).
2. Photo 120 px si et seulement si le profil est nominatif (`profile-page.ts:212-213`), au format photo d'identité
   (rayon de 4 px, plus de cercle) ; sinon rien (pas de faux visage, pas de monogramme géant).
3. H1 `class="title"` (test `profile-page.test.ts:50`) : le nom, ou « Freelance FR-RVVUA » pour un profil pseudonyme
   (`profile-page.ts:163`). Puis le titre du poste.
4. Contexte (`profile-page.ts:193-200`) : TJM, lieu, disponibilité, date de confirmation, en une rangée de cellules
   séparées par des filets, libellés mono en capitales (plus de boîtes arrondies, capture `desktop-03`).
5. Bouton « Contacter ce freelance sur Proofseen » (`profile-page.ts:86`), papier sur encre, **dans la fiche** (rail à
   droite sur desktop, sous le contexte à 375 px), répété en fin de page.

**B. Le résumé** (`profile-page.ts:240`), un paragraphe.

**C. Ce qui est vérifié** (le registre des preuves, structure inspirée d'Audit Log 25163 : fait, source, date)
H2 « Ce qui est vérifié », toujours présent, même vide. Trois groupes, dans cet ordre :
1. **Missions vérifiées** (`profile-page.ts:145-151,201`). Chaque mission est une pièce : rôle en H3 ; client (son type,
   ou son nom seulement s'il l'a autorisé, `profile-page.ts:147`) ; durée ; résumé s'il existe ; puis la **ligne de
   preuve** : à gauche « Pièce : facture » (ou contrat, attestation du client, accès au dépôt de code, livrable public),
   à droite le **cartouche** vert à coins de poinçon : « Vérifiée le 12 octobre 2026 », « Confirmée par le client le... »,
   « Confirmée par un contact chez le client le... » ou « Payée sur Proofseen, vérifiée le... » (libellés réels,
   `profile-page.ts:90-91`). Le fil relie l'affirmation à la pièce. Chaque mission reçoit une ancre (`id`) pour être
   citée seule.
2. **Adresses dont la possession est prouvée** (`profile-page.ts:202-205`) : liens `rel="me"`, chacun avec le carré
   vert et « possession prouvée ». La vue publique ne porte pas de date de preuve (`provenUrls` est une liste de chaînes,
   `profile-page.ts:37`) : Tetsu vérifie si la base la connaît ; sinon on n'en affiche pas et l'écart est noté, on n'en
   invente pas.
3. **Faits vérifiés** (`profile-page.ts:206-214`) : entreprise active au répertoire (avec la date de contrôle), identité
   vérifiée par le prestataire de paiement, attestation URSSAF (valable jusqu'au...), payé sur Proofseen par N
   entreprises. Chaque ligne : carré vert, fait, date quand la donnée l'a.

Sur desktop, le rail droit résume ce registre sous le bouton de contact : « 2 missions vérifiées · 1 adresse prouvée ·
3 faits vérifiés » (comptes réels de la page), ou « Aucune pièce vérifiée pour l'instant ». Position collante en CSS.

**D. Déclaré par le freelance** (aucun vert, en-tête de groupe en mono « Déclaré par le freelance ») : compétences
(`profile-page.ts:242`), expériences déclarées, formation déclarée, certifications avec leur lien « Vérifier la
certification » (le lecteur vérifie lui-même : pas de vert, ce n'est pas nous qui avons vérifié), langues, réalisations
(`profile-sections.ts:44-52`).

**E. Avis de missions payées sur Proofseen** (`profile-page.ts:215-220`) : un par un, « 4 / 5 · date », sans moyenne.
Le paiement est un fait vérifié, l'avis est une opinion : la ligne de trace dit « mission payée sur Proofseen », le
poinçon ne se pose jamais sur une note.

**F. Publications récentes** (`recentPostsSection`), **G.** contact répété et date de mise à jour, **H.** profils proches,
chacun avec la raison factuelle du rapprochement (`nearby.ts`, `profile-page.ts:250`).

### d.2 Ce qu'on montre quand il n'y a encore aucune preuve (le cas d'aujourd'hui)

Le seul profil publié (FR-RVVUA, capture `desktop-03`) n'a aucune adresse prouvée et aucune mission vérifiée affichée.
La section C reste là, comme un registre ouvert à une page blanche :
- un cadre au filet `--ps-line-strong`, sans vert ;
- en mono : « Aucune pièce vérifiée pour l'instant. Les informations de ce profil sont déclarées par le freelance. » ;
- une ligne d'explication : « Une pièce vérifiée apparaît ici avec sa date et sa source : facture, contrat, attestation
  du client, accès au dépôt de code, livrable public. » et un lien « Comment une mission est vérifiée » vers
  `/[lang]#preuve` (la section b.3).
Pas de bouton « vérifiez votre profil » : la page est la même pour tout le monde, propriétaire compris (aucun contenu
variant, AUDIT §4.2). Le rail dit « Aucune pièce vérifiée pour l'instant ». Toute la page est en noir et blanc, sauf le
poinçon du logo : c'est exactement l'information.

### d.3 Mouvement sur le hub (M2 en CSS pur)

- **Arrivée** : M3 si l'on vient de l'annuaire (c.6). Rien d'autre au chargement.
- **M2 sur chaque mission vérifiée** : même chronologie que b.3 (fil 640 ms, frappe 140 + 120 ms, anneau 240 ms), mais
  pilotée par le défilement : `animation-timeline: view()` avec une plage courte (`animation-range` d'environ
  `entry 60%` à `entry 100%`) pour que le geste tienne en une centaine de pixels de défilement. Plafonné aux 6 premières
  missions, décalage de 80 ms (en plage) de l'une à la suivante. Sans support de `animation-timeline` : rien ne bouge,
  tout est posé. Compromis assumé : un geste lié au défilement se rejoue à l'envers si l'on remonte ; Kaze tranche entre
  ce compromis et un geste joué seulement pour les missions déjà dans le premier écran.
- Adresses et faits : carré vert statique, pas de frappe (une page qui frappe vingt fois ne frappe plus rien).
- Contraintes : aucune chaîne `opacity:0` (l'anneau finit en `border-color: transparent`, BRAND_BOOK §8.1) ; le fil est
  un SVG ou une bordure décorative `aria-hidden`, dessiné dans l'état sans animation ; CSS du moment sous 1,5 Ko.
- Mouvement réduit : rien ne bouge, état final. Sans JS : c'est le seul mode du hub, état final ou geste CSS.

### d.4 375 px

Ligne de trace ; photo 96 px (nominatif) ; H1 `--ps-step-4` ; titre du poste ; contexte en grille de deux cellules par
ligne ; bouton de contact pleine largeur 48 px ; résumé ; registre : chaque mission en bloc, la ligne de preuve passe sur
deux lignes (« Pièce : facture » puis le cartouche), le fil devient vertical à gauche ; le rail disparaît, son résumé
s'insère sous le bouton ; déclaré ; avis ; proches ; contact répété. Aucun débordement : URLs prouvées en
`overflow-wrap: anywhere`.

### d.5 Accessibilité et robots

- Ordre des titres : H1 nom ; H2 « Ce qui est vérifié », « Déclaré par le freelance », « Avis... » ; H3 par mission.
- Le cartouche est du texte (« Vérifiée le 12 octobre 2026 »), pas une image ; le carré vert est `aria-hidden` et
  toujours doublé d'un mot (daltonisme, BRAND_BOOK §5).
- Contraste : vert sur fond vérifié 7,99 (sombre) et 5,47 (clair) (BRAND_BOOK §5).
- JSON-LD inchangé (`ProfilePage`, `Person`, `knowsAbout`, `sameAs` des seules adresses prouvées) ; aucune note agrégée.
- `marketplace-verify` : chaque fait de la base reste présent en texte décodé ; attention aux fragments (un fait coupé
  en deux balises par le gabarit casse la comparaison de chaînes, SKILL §7).
- Polices : le hub charge PS Display seule (arbitrage 5). Recommandation de Sensei au Shogun (BRAND_BOOK §11 point 2) :
  servir aussi PS Mono (11 Ko) **sur le profil seulement**, parce que la trace y est le contenu. À trancher, Lighthouse à
  mesurer.

---

## Ce qui n'est pas vérifié ici

- Aucun écran n'a été rendu ni capturé par Sensei ; tout ce qui précède est tiré du code et des captures `before/`.
- L'ordre réel des 780 points dans `j0-answers.json` (moteur, offre, témoin) pour la grille 13 x 20 par moteur.
- Le poids réel de la figure serveur dans la charge RSC.
- Le support de `@view-transition` entre documents, de `animation-timeline: view()` et de `corner-shape: scoop` dans les
  navigateurs cibles ; la politique de sécurité du contenu pour un `style` en ligne sur le hub.
- La présence d'une date de preuve des adresses dans la base.
- Le rendu sans JS de l'onglet inactif de `Showcase`.
- Les tests qui figent des textes de la vitrine (`pseudonymous-copy.test.ts`, `visibility-dictionary.test.ts`) face aux
  nouvelles copies proposées.
