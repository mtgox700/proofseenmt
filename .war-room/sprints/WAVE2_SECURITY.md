# Revue de sécurité vague 2 — corrections

Branche `sprint/wave2-security`, à partir de `main` (28655fb, H1 déjà corrigé). Chaque constat a d'abord reçu un test
qui échoue, puis la correction. Rien n'est poussé.

## M1 — Extraction de texte PDF dans le processus web

- **Constat** : `apps/web/src/data/pdf-text.ts` faisait tourner PDF.js (unpdf) dans le processus Next, sans délai ni
  plafond mémoire ; le nombre de pages n'était vérifié qu'après l'analyse.
- **Correction** : chaque lecture tourne dans un `worker_threads` (`apps/web/src/data/pdf-worker.mjs`) avec
  `resourceLimits` (tas 256 Mo, jeune génération 32 Mo, pile 4 Mo), un délai dur de 10 s suivi de `terminate()`, un
  environnement vide (`env: {}` : aucun secret du processus web dans le thread qui lit un fichier hostile), deux lectures
  au plus en même temps (au-delà : `busy`, rendu « réessayez plus tard » sans appel payant). Un fichier de plus de 5 Mo
  est refusé avant tout thread ; le texte rendu est plafonné à 60 000 caractères (dans le worker et de nouveau côté
  processus web, réponse validée par zod).
- **Livraison du worker** : fichier `.mjs` en JavaScript simple, chargé par chemin à l'exécution
  (`pdfWorkerFile()` : `<cwd>/src/data/pdf-worker.mjs`, sinon `<cwd>/apps/web/src/data/pdf-worker.mjs`). Le bundler Next
  ne le voit pas (pas de `new Worker(new URL(...))`, que webpack réécrirait). L'image Docker copie tout le dépôt
  (`COPY . .`), construit avec `pnpm --filter @proofseen/web build`, puis lance `next start` depuis `apps/web` : le
  fichier est en `/app/apps/web/src/data/pdf-worker.mjs`, et `unpdf` se résout depuis `apps/web/node_modules` (dépendance
  directe de l'app). Si l'on passe un jour à `output: "standalone"`, il faudra l'ajouter à `outputFileTracingIncludes`.
  `serverExternalPackages: ["unpdf"]` peut rester : le bundle serveur n'importe plus unpdf.
- **Tests** : `apps/web/test/pdf-text.test.ts` — « finds the worker file from the app folder (next start) and from the
  repository root (tests) », « stops a worker that runs past its deadline », « stops a worker that goes over its memory
  cap », « caps the text handed back », « refuses an answer that is not a reading result », « refuses a file larger than
  a CV before starting any worker », « runs a bounded number of extractions at once and says so beyond ». Des workers de
  remplacement (`apps/web/test/fixtures/pdf-workers/*.mjs`) jouent le PDF hostile ; la lecture d'un vrai petit PDF reste
  couverte par `cv-import.test.ts` (« reads the text of a real PDF »), désormais à travers le worker.
- **Risque résiduel** : la mémoire hors tas V8 (ArrayBuffer) n'est pas comptée par `maxOldGenerationSizeMb` ; l'extraction
  de texte seule ne décode pas d'images, et le délai de 10 s borne le reste. Le build Next n'a pas été lancé dans ce lot :
  à vérifier au prochain `docker build` par un import de CV réel depuis `/fr/app/profil` (ligne `pdf text: worker file
  not found` au journal si le fichier manquait).

## M2 — Plafond plateforme de l'import de CV épuisable par quelques comptes

- **Correction** (`apps/web/src/data/cv-import.ts`) : limite par adresse réseau (10 lectures par jour, adresse lue par
  `addressFromHeaders`, `X-Real-IP` posé par Caddy ; sans adresse connue, un seul seau partagé « unknown »). Réserve
  quotidienne (`PROOFSEEN_IMPORT_DAILY_CAP`, 20 par défaut) : les comptes neufs se partagent un quart de la réserve (au
  moins une lecture), les comptes établis puisent dans toute la réserve. Établi = profil publié **ou** compte de plus de
  7 jours (`users(db).isEstablished`, `ESTABLISHED_ACCOUNT_DAYS`).
- **Tests** : `apps/web/test/cv-import.test.ts` — « limits each network address, whatever the number of accounts behind
  it », « keeps most of the platform pool for established accounts: new accounts share a small part of it », « does not
  pay when the PDF reader is busy, and says to try later » ; `packages/db/test/account-standing.test.ts` — trois tests
  « ancienneté d'un compte ».
- **Risque résiduel** : un compte neuf peut devenir « établi » en publiant aussitôt un profil minimal (titre, résumé,
  ville) — c'est la règle demandée ; derrière un NAT d'entreprise, 10 lectures par jour et par adresse peuvent gêner.

## M3 — Les profils pseudonymes laissaient fuiter l'identité

- **Correction** : sur un profil pseudonyme, les images de réalisations ne sont plus servies qu'à leur propriétaire
  (`stored-files.ts`, `readable`) ; le dépôt (`public-profile-sections.ts`) retire entreprises, écoles et images ; le
  rendu (`packages/hub/src/profile-sections.ts`, option `named` obligatoire) les retire de nouveau et n'émet ni
  `alumniOf`, ni `worksFor`, ni URL de certification, ni `image`. La page montre rôle, dates, diplôme, compétences,
  descriptions, organisme de certification. Profil nominatif inchangé. L'écran de profil explique ce qu'un profil
  pseudonyme montre et ne montre pas (`pseudonymousShows`, FR et EN).
- **Tests** : `packages/db/test/stored-files.test.ts` (« l'image d'une réalisation n'est publique que sur un profil
  nominatif, et suit son retrait ») ; `packages/db/test/profile-sections.test.ts` (« profil pseudonyme : sections
  publiées, sans photo, sans image, sans adresse web, sans entreprise ni école », « profil nominatif : photo et adresses
  publiées ») ; `packages/hub/test/profile-sections.test.ts` (« profil pseudonyme : ni entreprise, ni école, ni image, ni
  adresse, même si elles arrivaient jusqu'ici ») ; `apps/web/test/pseudonymous-copy.test.ts`.
- **Risque résiduel** : les descriptions libres et les titres de réalisations peuvent encore nommer un client ; les
  missions vérifiées affichent le nom du client quand celui-ci l'a autorisé, y compris sur un profil pseudonyme (hors du
  périmètre de ce constat, à arbitrer).

## M4 — Coordonnées passées par les champs d'adresse web

- **Correction** : `packages/db/src/contact-urls.ts` tient la seule liste `CONTACT_HOSTS` (messageries, réseaux sociaux,
  prise de rendez-vous et visio, raccourcisseurs, pages de liens : wa.me, api.whatsapp.com, t.me, telegram.me, signal.me,
  m.me, calendly.com, cal.com, bit.ly, tinyurl.com, linktr.ee…). `urlCarriesContact` refuse un hôte listé ou un de ses
  sous-domaines, un hôte où le détecteur existant lit pseudonyme, e-mail ou téléphone, et un chemin, une requête ou un
  fragment décodés qui portent un e-mail ou un téléphone (`containsReachableContact`, nouvel export de
  `contact-detection.ts`, mêmes expressions). Les identifiants techniques (uuid, jetons hexadécimaux, numéros d'objet sans
  0 ni + en tête) sont écartés avant lecture, pour que Credly, Behance ou Microsoft Learn passent. Appliqué à l'URL de
  réalisation, à l'URL de certification et au site d'entreprise (message `NO_CONTACT`, déjà reconnu par les routes).
- **Tests** : `packages/db/test/contact-urls.test.ts` (liste, sous-domaines, 15 adresses refusées, 8 acceptées, échappement
  mal formé, schémas de profil et d'entreprise).
- **Risque résiduel** : un numéro international écrit sans + dans un chemin, ou caché dans un jeton de 16 caractères et
  plus mêlant lettres et chiffres, passe ; la liste d'hôtes est à tenir à jour ; un domaine personnel peut toujours
  rediriger vers un agenda (la destination d'un lien n'est pas suivie).

## M5 — Baromètres tirés d'une seule entreprise

- **Correction** : `MIN_DISTINCT_PUBLISHERS = 3` et `MAX_VALUES_PER_PUBLISHER = 3` dans `barometer-stats.ts`
  (`cappedByPublisher`, `publisherGroupStats`, `publisherRateStat`). Tout groupe tiré des missions (TJM par compétence,
  par ville et d'ensemble ; demande par compétence) exige 3 entreprises distinctes, chacune comptant au plus pour ses 3
  missions les plus récentes. Les profils ne sont pas concernés (une personne = un profil). La règle est dite dans le
  paragraphe de méthode des deux baromètres, FR et EN, et dans la description du jeu de données (`PUBLISHER_RULE` du hub,
  dont l'égalité avec les constantes de db est testée).
- **Tests** : `packages/db/test/barometer-publishers.test.ts` (7 tests) ; `packages/hub/test/barometers.test.ts`
  (« la dit en français et en anglais, sur les deux baromètres », « la dit aussi dans la description du jeu de données »).
- **Risque résiduel** : trois entreprises créées par la même personne passent la règle ; le `total` publié reste un compte
  brut.

## L1 — Fichiers orphelins après effacement

- **Correction** : l'effacement retrouve la ligne recréée par un autre onglet par son identifiant de connexion
  (`users(db).idOfSignIn`, la ligne recréée a un nouvel id) et lit ses fichiers avant la seconde passe. Le cron
  `/api/cron/notifications` lance `sweepOrphanUploads` : fichiers nommés par l'application (uuid ou `.part`) de plus d'une
  heure sans ligne `StoredFile`, 2 000 entrées lues et 200 suppressions au plus par passage, dossier de départ tournant
  chaque heure ; rien d'autre n'est touché.
- **Tests** : `apps/web/test/upload-sweeper.test.ts` (3 tests) ; `account-standing.test.ts` (« retrouve la ligne d'un
  identifiant Clerk, recréée ou non, sans en créer »).

## L2 — Contrôle ACTIVE_PDF

Documenté comme « au mieux » dans `apps/web/src/lib/file-sniff.ts`, sans changement de comportement.

## L3 — Plafond global du disque

- **Correction** : `PROOFSEEN_UPLOADS_MAX_GB` (5 par défaut, décimales permises). Au-delà de la somme des tailles
  enregistrées, tout nouveau dépôt est refusé (`storage_full`, message clair FR/EN) avant toute lecture ou écriture ;
  au-delà de 80 %, une ligne `warn` au journal, une fois par heure et par processus.
- **Tests** : `apps/web/test/uploads.test.ts` (« refuses any new upload once the volume holds more than
  PROOFSEEN_UPLOADS_MAX_GB… », « warns in the server log past 80 %… », « reads the volume cap from the environment… »).
- **Risque résiduel** : plafond souple (deux dépôts simultanés peuvent le dépasser d'un fichier) ; la somme des lignes ne
  compte pas les orphelins avant leur balayage.

## L4 — `%` mal formé

`safeDecode` (`apps/web/src/lib/safe-decode.ts`) dans `/[lang]/entreprises/[slug]`, `/[lang]/missions/ville/[city]` et
`/[lang]/metiers/[key]` : 404 au lieu de 500. Test : `apps/web/test/public-routes.test.ts`.

## L5 — Cache des articles

`ARTICLE_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=300"` pour l'index du blog et les
articles. Test : `apps/web/test/public-routes.test.ts`. Le flux RSS garde son cache actuel (hors périmètre).

## Variables d'environnement

- `PROOFSEEN_UPLOADS_MAX_GB` (nouvelle, facultative, 5 par défaut).
- `PROOFSEEN_IMPORT_DAILY_CAP` (existante) : les comptes neufs s'en partagent au plus un quart ; le reste est réservé aux
  comptes établis.
