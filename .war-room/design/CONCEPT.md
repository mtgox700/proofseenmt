# CONCEPT : le bureau de garantie (Shogun, Vague 1, 2026-10-21)

> Rédigé par Sensei au nom du Shogun, à partir de `.war-room/brand/BRAND_BOOK.md` (métaphore, palette, mouvement),
> `.war-room/design/AUDIT.md` (faits, contraintes, arbitrages 1 à 8) et `.war-room/design/21ST_SHORTLIST.md`.
> Le storyboard qui en découle : `.war-room/design/STORYBOARD.md`.

## 1. La métaphore

Un objet en métal précieux n'a de valeur garantie qu'après son passage au **bureau de garantie** : un tiers essaie le
métal, puis frappe un **poinçon**, une petite marque datée dans un cartouche. Le fabricant ne poinçonne pas lui-même.

Proofseen est ce bureau pour le travail des freelances. Le freelance déclare ; un tiers vérifie une pièce (facture,
contrat, attestation du client, accès au dépôt de code, livrable public, paiement passé par Proofseen) ; alors seulement
la mission porte sa marque, avec sa date et sa source (`packages/hub/src/profile-page.ts:89-91`).

Le site entier est imprimé à l'encre sur papier, en noir et blanc. **Le vert est le poinçon** : il n'apparaît que sur un
fait vérifié par un tiers (BRAND_BOOK §5). Une page sans preuve n'a pas de vert, et c'est une information.

## 2. L'histoire d'une visite

1. **On entre au bureau.** Première page : sobre, typographiée comme un registre, sans rideau ni effet d'entrée. Le
   titre dit ce que fait la maison : la preuve de ce qu'un freelance a vraiment livré.
2. **Le bureau s'essaie lui-même.** À côté du titre, le registre de notre propre mesure : 780 réponses d'IA, une case
   chacune. Une règle de lecture parcourt les trois colonnes. Aucune case ne passe au vert : notre fondateur n'est cité
   dans aucune (TEAM_MEMORY:342). Nous ne frappons pas ce que nous n'avons pas vérifié, pas même pour nous.
3. **On voit ce qu'est une pièce.** Un spécimen de mission, étiqueté comme tel, montre le geste : le fil va de
   l'affirmation à sa pièce, puis le poinçon tombe sur le cartouche daté.
4. **On ouvre le registre public.** L'annuaire : chaque fiche sépare ce qui est déclaré (encre) de ce qui est
   poinçonné (vert, daté). Ordre neutre et dit, aucun score.
5. **On passe au guichet.** Un clic sur une fiche : la carte devient l'en-tête de la page de preuve (transition entre
   documents, CSS seul). Là, chaque fait vérifié porte sa date et sa source, et seulement eux. Quand il n'y en a aucun,
   la page le dit, calmement.

## 3. Trois moments signatures, pas un de plus

| Moment | Où | Sens | Geste (BRAND_BOOK §7) |
|---|---|---|---|
| **Le relevé** | vitrine, figure d'ouverture | L'honnêteté est le spectacle : on cherche notre propre nom dans 780 réponses réelles et rien ne s'allume. | **tracer** : une règle de lecture descend chaque colonne (1,2 s, une fois) ; aucune case ne change. |
| **L'essai et la frappe** | vitrine (spécimen), profil (missions vérifiées) | Une affirmation ne vaut que reliée à sa pièce ; la marque vient après l'essai, jamais avant. | **tracer puis frapper** : le fil se dessine jusqu'à la pièce (640 ms), le cartouche déjà visible se frappe (140 + 120 ms), l'anneau d'encre s'étale (240 ms). |
| **Le passage au guichet** | annuaire vers profil | Ouvrir une fiche, c'est demander à voir les pièces : la carte devient le dossier. | **encrer** : transition de vue entre documents (`@view-transition`), 320 ms, sans script. |

Sources des idées : Stamp (21st.dev 3417) pour la frappe, Timeline (35051) pour le fil, Audit Log (25163) pour la
structure « fait, source, date » du registre des preuves. Idées seulement : tout est redessiné à la charte, et sur le hub
écrit en CSS pur.

## 4. Les règles qui tiennent le concept

- **Le vert se mérite.** Jamais sur un bouton, un lien, une compétence déclarée, une disponibilité, une note d'avis, une
  illustration. Le poinçon de la marque n'est jamais un badge « vérifié ».
- **Toute marque porte sa date et sa source.** Quand la base n'expose pas la date d'un fait, on l'écrit (voir
  STORYBOARD, lot d) au lieu d'en inventer une.
- **Spécimen toujours étiqueté** « Spécimen. Exemple illustratif, données fictives. » et **jamais là où l'on cherche une
  personne** (annuaire, profil, recherche).
- **Rien n'est caché en attendant une animation** (arbitrage 6). Chaque mouvement part de l'état final visible.
- **Un seul effet lourd à l'écran à la fois.** Entre deux moments forts, une respiration typographique.

## 5. Ce qu'on refuse, et pourquoi

| Refusé | Raison |
|---|---|
| Splash ou ouverture cinématographique | Un bureau de garantie n'a pas de rideau. Le LCP est le titre ; rien ne passe devant. |
| 3D, verre, halo, dégradé, lueur au pointeur, inclinaison des captures (`Showcase.tsx:39-46`) | Un flou ne prouve rien (BRAND_BOOK §5-6). |
| Compteurs qui roulent depuis zéro (`motion/CountUp.tsx:28`) | Pendant une seconde, la page affiche un chiffre faux. Un registre n'a pas de chiffres qui tournent. |
| Révélation depuis `opacity: 0` (`landing.css:121,190,222`) | C'est la cause des pages vides des captures `before/`. |
| Faux profil, faux logo client, faux témoignage, photo présentée comme un utilisateur | Vérité verrouillée (AUDIT §5.2). |
| Score, étoiles agrégées, « top », « % compatible », tri par nombre de preuves | AI Act : des filtres et des faits, jamais un classement de personnes. |
| Prix publics (49 €, 490 €) | Arbitrage 4. |
| Compteur de profils ou de missions « en direct » sur la vitrine | La vitrine est statique ; un nombre figé au build serait faux le lendemain. L'annuaire montre le vrai compte. |
| Poinçon animé en boucle, poinçon comme décor | BRAND_BOOK §3.4. |
| Bento, frise de logos, carrousel, italique | Mille landing pages ; aucun fichier italique servi. |

## 6. Pourquoi c'est juste pour qui arrive

Un CTO, un recruteur, un freelance senior ont vu les étoiles et les badges des autres plateformes. Ici, ils voient une
date, une source, une pièce, et un vendeur qui publie sa propre mesure à zéro. Le sérieux se lit en cinq secondes parce
qu'il n'y a rien à croire sur parole.
