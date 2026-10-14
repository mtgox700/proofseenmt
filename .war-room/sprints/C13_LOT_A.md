# C13 — lot A : adresses prouvées depuis l'application web

Branche `sprint/c13-proofs`. Un freelance déclare ses URL dans l'espace connecté et prouve qu'elles sont à lui ; la
mesure ne compte une citation que sur ces adresses. Avant ce lot, aucun code de production ne créait de ligne `OwnedUrl`.

## Ce qui est construit

- **Récupérateur durci partagé** : `apps/cli/src/safe-fetch.ts` déplacé dans `packages/profiles/src/safe-fetch.ts`
  (https seul, IP jugée à la connexion, redirections revalidées, corps borné). Nouveau
  `packages/profiles/src/ownership-check.ts` : `proveOwnership` (trois méthodes en parallèle, sonde injectée),
  `readEvidence` (aussi utilisé par la CLI), `proofKit` (valeurs exactes à poser). LinkedIn et Malt : aucune requête.
- **Dépôt** `packages/db/src/owned-urls.ts` : `add` (https, domaine public, sans port ni identifiants, requête et ancre
  retirées, 10 par profil), `list`, `get`, `remove`, `markVerified` (`already_proven_elsewhere` si un autre profil a
  déjà prouvé l'adresse, y compris quand l'index partiel tranche une course), `dueForRecheck`, `recordRecheck`. Le
  contrôle d'accès est dans les requêtes : un identifiant étranger donne `null` / `not_found`.
- **Migration** `20261014100000_owned_url_checks` : colonnes `checkedAt`, `failedAt` + deux CHECK. Écrite à la main
  (`prisma migrate diff` ne rendait rien sur ce poste), au format exact de Prisma ; rejouée par les tests PGlite.
- **Écran** `/[lang]/app/preuves` (freelance seulement, Server Components, aucun JavaScript client) : liste avec statut,
  ajout, pour chaque adresse en attente les trois preuves avec la valeur exacte (un clic la sélectionne), « Vérifier
  maintenant », retrait. Entrée de menu « Adresses prouvées ». Dictionnaires `proofs-fr.ts` / `proofs-en.ts`.
- **Relecture planifiée** dans `/api/cron/notifications` (`proofChecks` dans le rapport) : 20 adresses au plus par
  passage, 5 en parallèle, délai 5 s ; relecture tous les 30 jours, nouvel essai le lendemain d'un échec, grâce de
  7 jours, puis l'adresse repasse en attente.

## Décisions

- Jeton lié à l'**id du profil** et à l'URL : celui d'un profil ne prouve rien pour un autre.
- Secret : `PROOFSEEN_PROOF_SECRET` s'il est défini (même variable que la CLI), sinon dérivé de
  `PROOFSEEN_ACCESS_SECRET` par HMAC sous l'étiquette `proofseen:possession-proof:v1`. **Choisir une source et la
  garder** : changer le secret change tous les jetons, et les preuves tomberaient à la relecture suivante. Sans secret,
  l'écran garde les adresses mais n'affiche pas de consigne, et le cron ne relit rien.
- `verifiedAt` reste la date de **première** preuve ; une reconfirmation met à jour `checkedAt`.
- Méthode balise meta **durcie** : seul le `content` d'une vraie balise `<meta name="proofseen-verification">` compte
  (`metaTagProofs`). Avant, le jeton en simple texte n'importe où dans la page suffisait : un commentaire posé sous
  l'article de quelqu'un d'autre aurait « prouvé » sa page. La CLI profite du même durcissement.
- LinkedIn / Malt : gardés comme liens déclarés (`profile_token`), marqués « non vérifiable automatiquement », jamais
  auto-certifiés (le dépôt refuse `markVerified`), jamais relus par le cron.

## Ce qui reste

- Aucune notification quand une preuve passe en grâce ou tombe (le statut s'affiche sur l'écran).
- Vérification manuelle des liens LinkedIn/Malt par un opérateur : pas d'écran.
- Litige « déjà prouvée ailleurs » : traité à la main (message affiché).
- Les redirections https sont suivies (5 au plus, revalidées) : une page qui redirige vers un autre domaine est jugée
  sur la page d'arrivée. Requête et ancre sont retirées des adresses, ce qui écarte les redirections ouvertes par
  paramètre ; restreindre aux redirections du même domaine enregistrable reste à décider.
- Écran non vérifié dans un navigateur dans ce lot (pas de base ni de Clerk dans le worktree) : `next build` passe.

## Tester dans le navigateur

1. Base locale migrée (`pnpm --filter @proofseen/db migrate:deploy`), `PROOFSEEN_ACCESS_SECRET` (32+ caractères) dans
   `.env`, Clerk configuré ; `pnpm --filter @proofseen/web dev`.
2. Se connecter avec un compte freelance qui a un profil, ouvrir `/fr/app/preuves`.
3. Ajouter `https://<un domaine à vous>/` : la consigne affiche le fichier `/.well-known/proofseen-verification.txt`,
   la balise meta et la valeur TXT. Poser l'une des trois, cliquer « Vérifier maintenant » → « Preuve trouvée ».
4. Ajouter `https://www.linkedin.com/in/x` : statut « Non vérifiable automatiquement », pas de bouton de vérification.
5. Erreurs : `http://…`, `https://127.0.0.1/`, un doublon, une 11e adresse.
6. Cron : `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3100/api/cron/notifications` → `proofChecks`.
