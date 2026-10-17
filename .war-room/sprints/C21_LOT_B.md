# C21 — lot B : parité de l'espace connecté

Branche `sprint/c21-connected` (non poussée, pas de PR). Migration `20261017100000_parity_connected`. Server Components
et actions serveur seulement : aucun JavaScript client ajouté.

## Livré

**Modifier un élément déclaré du profil** (`/[lang]/app/profil`)
- Expériences, formations, certifications, réalisations : chaque élément porte un lien « Modifier »
  (`?modifier=<id>#section`, rendu par le serveur) qui ouvre son formulaire pré-rempli à sa place dans la liste ;
  « Annuler » referme sans rien changer. Un formulaire unique par section sert à l'ajout et à la modification.
- Langues : « Modifier » ouvre le choix du niveau de cette langue (une ligne par langue, la langue elle-même ne change
  pas ; `setLanguage` fait déjà l'upsert).
- Dépôt (`packages/db/src/profile-sections.ts`) : `updateExperience`, `updateEducation`, `updateCertification`,
  `updatePortfolioItem`. Même schéma zod qu'à l'ajout (bornes, dates cohérentes, aucune coordonnée dans les textes,
  adresses https sans identifiants ni messagerie). L'identifiant et le compte de l'acteur sont dans la même requête :
  l'élément d'un autre est `absent`, comme un identifiant inconnu.
- Réalisation : l'image reste, est remplacée (nouveau dépôt, même contrôle et réencodage) ou retirée (case « Retirer
  l'image actuelle ») ; l'ancienne est supprimée, ligne et fichier. Ligne verrouillée (`FOR UPDATE`) le temps du
  changement ; une nouvelle image non posée est effacée.
- Actions limitées comme les ajouts (120 écritures/h, 30 dépôts/h). Une modification refusée revient sur son formulaire
  ouvert avec l'avis ; seuls un identifiant uuid ou un code de langue sont relus depuis l'adresse.

**Filtre « langues » dans la recherche des entreprises** (`/[lang]/app/recherche`)
- Trois langues au plus, chacune avec un niveau minimal (CECRL A1–C2 ou langue maternelle) ; « au moins B2 » retient
  B2, C1, C2 et langue maternelle (`levelsAtLeast`). Toutes les langues demandées sont exigées. C'est un filtre sur le
  niveau déclaré, jamais une note ni un ordre (AI Act).
- Adresse : paires `langue=en&niveau=b2` dans l'ordre du formulaire GET (aucun script) ; code hors liste ignoré, niveau
  illisible = tout niveau, une langue en double garde la première.
- Les cartes de résultat montrent les langues déclarées (« Anglais (C1) · Français (Langue maternelle) »).
- Brief : `languages` ajouté au schéma de filtres (`packages/db/src/brief-filters.ts`), au prompt du modèle
  (`packages/engines/src/brief.ts`) et à la revalidation ; la clé n'existe que si la phrase demande une langue. Tests
  avec un faux traducteur, aucun appel payant.
- Audience (C17) : une langue demandée compte comme filtre de type `language` (son code, sans le niveau). Valeur
  ajoutée à l'énumération `StatKeywordKind` et contrainte `ProfileStatSeen_scope_chk` élargie ; libellé « Langue »
  dans le tableau de bord.

**CV joint à une candidature**
- Formulaire `/[lang]/app/missions/[id]/postuler` : case « Joindre le CV de mon profil (déposé le …) », ou dépôt d'un
  PDF sur place (`saveCv` : type lu, 5 Mo, quota, lecture par le travailleur PDF contre le contenu actif). Le dépôt
  compte dans le budget de dépôts du profil. Un CV déposé ici devient le CV du profil une fois la candidature envoyée ;
  si la candidature est refusée, le fichier est effacé.
- `Application.cvFileId` (nullable, clé étrangère vers `StoredFile`, `ON DELETE SET NULL`, index partiel). Le dépôt
  vérifie dans la transaction que c'est un fichier `cv` du candidat (`cv_absent` sinon) ; un déclencheur le garantit en
  base et interdit de remplacer le CV joint (il peut seulement disparaître).
- Règle de lecture (`packages/db/src/stored-files.ts`, audience `recipient`) : le propriétaire, et les membres de
  l'entreprise qui publie la mission d'une candidature qui joint ce fichier, tant que la candidature n'est pas retirée,
  que la mission n'est pas masquée et que ni l'entreprise, ni le membre, ni le candidat ne sont suspendus. La route
  `/fichiers/<id>` refuse aussi l'audience `recipient` à un compte suspendu ; le CV est servi en pièce jointe, avec les
  en-têtes existants (`private, no-store`, `sandbox`, `nosniff`).
- Page de la candidature côté entreprise : « Télécharger le CV » (ou « Pas de CV joint »).
- Remplacer le CV du profil garde ceux déjà joints à une candidature vivante (`pruneCvs`) : l'entreprise garde ce
  qu'elle a reçu. Un retrait libère ensuite le CV qui n'était plus que là. « Supprimer le CV » du profil le retire
  aussi des candidatures (c'est écrit sous le bouton).
- RGPD : l'export liste `cvFileId` dans les candidatures (et le fichier dans `files`) ; retrait ou effacement ferment
  l'accès (effacement : fichier et candidature partent en cascade).

## Tests ajoutés

- `packages/db/test/application-cv.test.ts` : matrice d'accès (propriétaire, membre, collègue, autre entreprise,
  autre freelance, anonyme, membre suspendu, mission masquée, entreprise suspendue, candidat suspendu, retrait),
  déclencheur, remplacement et suppression, export et effacement.
- `packages/db/test/profile-sections.test.ts` : modification, refus (invalide, coordonnées), élément d'un autre,
  image de réalisation gardée, remplacée, retirée.
- `packages/db/test/profile-search.test.ts`, `brief-filters.test.ts`, `audience-stats.test.ts` : filtre langues.
- `apps/web/test/application-cv.test.ts` (dépôt sur place, refus du contenu actif, CV gardé ou effacé selon l'issue,
  retrait), `profile-edit.test.ts`, `freelancer-search.test.ts`, `brief.test.ts` ; `packages/engines/test/brief.test.ts`.

## Gate dans le worktree

- `pnpm typecheck`, `pnpm lint`, `tsc --noEmit -p .` de l'app web : verts.
- `vitest run packages/db/test` + fichiers web et engines touchés (`--maxWorkers=2`) : 69 fichiers, 641 tests sur
  642 ; le seul échec est un dépassement du délai de 60 s dans `company-api.test.ts` (parcours grands comptes) sous la
  charge, sans lien avec le lot : relancé seul, 12 sur 12. Suite complète à jouer sur le serveur.

## Non fait / à jouer en recette

- Pas de vérification dans un navigateur ni de `next build` dans le worktree (ni base ni session Clerk) : édition d'un
  élément, filtre langues et CV joint à jouer avec les comptes de test (définition de fini du sprint).
- La route JSON `POST /api/missions/[id]/applications` ne joint pas de CV (le dépôt passe par le formulaire).
- Le freelance ne voit pas, dans « Vos candidatures », quel CV il a joint.
