# C2 — Missions et candidatures · reprise

> Écrit le 2026-10-06 pour que la session suivante reprenne sans rien redécouvrir. Lire d'abord les entrées
> 2026-10-05 et 2026-10-06 de `TEAM_MEMORY.md`.

## Fait (couche données et API — périmètre de cette session)

| Brique | Fichiers | Preuve |
|---|---|---|
| Missions : brouillon → ouverte → clôturée, recherche par filtres, tri choisi | `packages/db/src/missions.ts` | `test/marketplace.test.ts` |
| Candidatures : une par mission, fil accepté ouvert dans la même transaction, statut visible du freelance | `packages/db/src/applications.ts` | `test/marketplace.test.ts` |
| Messagerie avec consentement : en attente / accepté / refusé / fermé | `packages/db/src/messaging.ts`, `contact-detection.ts` | `test/repositories.test.ts` |
| Entreprises et membres | `packages/db/src/organisations.ts` | `test/accounts.test.ts` |
| Profil freelance, publication, recherche de freelances par faits | `packages/db/src/profiles.ts` | `test/accounts.test.ts` |
| Compétences normalisées | `packages/db/src/skills.ts` | `test/marketplace.test.ts` |
| `JobPosting` schema.org | `packages/hub/src/job-posting.ts` | `packages/hub/test/job-posting.test.ts` |
| Règles dans la base (17 déclencheurs, CHECK) | `packages/db/prisma/init/appendix.sql` → migration init | `test/migration.test.ts`, `test/red-team-c2.test.ts` |
| API | `apps/web/src/app/api/{missions,applications,conversations}/**`, `apps/web/src/lib/api.ts` | lint + types ; exécution réelle en attente de la base |

## Exécuter le site sans Railway

`npx tsx packages/db/scripts/local-db.ts` (base sur le port 5433, données marquées « test »), build `NEXT_DIST_DIR=.next-c1`, puis la config de lancement `web-c1-localdb` (port 3103). Les routes connectées demandent une session Clerk : non exécutables ainsi.

## Reste à faire

1. **[FOUNDER] `DATABASE_URL`** dans `.env` (valeur de `DATABASE_PUBLIC_URL` sur Railway) ; pour la mise en ligne, aussi `PROOFSEEN_PUBLIC_URL` (adresse publique du site) et `INDEXNOW_KEY`. Ensuite : `pnpm --filter @proofseen/db migrate:deploy`, rejouer la suite contre Railway, rejouer le test de rafale du limiteur (vraie concurrence), puis supprimer `packages/db/prisma/init/`.
2. **Écrans** (session design) : brancher `apps/web/src/app/[lang]/app/messages/**` sur `@proofseen/db` via les routes ci-dessus. Aujourd'hui ils lisent `apps/web/src/data/message-store.ts` (fichiers) et `lib/messaging.ts`. Le contrat de la base reprend les règles de `lib/messaging.ts` (accord du freelance) sauf le **rôle opérateur**, pas encore porté.
3. ~~Pages publiques de mission~~ ✅ 2026-10-06 : `/[lang]/missions` (index filtrable sans JS), `/[lang]/missions/[id]`, `/sitemap-missions.xml`, IndexNow à la publication (éteint sans `INDEXNOW_KEY` + `PROOFSEEN_PUBLIC_URL`). Exécuté sur la base locale.
4. ~~Alertes e-mail~~ ✅ 2026-10-06 côté données, envoi et API : file d'envoi Postgres (pas Inngest, décision consignée), `@proofseen/notify`, `/api/cron/notifications`, `/api/notifications/preferences`, `/api/alerts`. Exécuté sur la base locale. **Pour envoyer réellement** : `RESEND_API_KEY`, `NOTIFY_FROM` (ex. `Proofseen <bonjour@proofseen.com>`, domaine vérifié chez Resend), `CRON_SECRET` (32 caractères au moins) et un planificateur qui appelle la route toutes les 5 à 10 minutes (cron Vercel sur offre Pro, ou un service externe avec l'en-tête `Authorization: Bearer <CRON_SECRET>`). Écrans des préférences et des alertes : session design.
5. **E2E navigateur** du parcours complet (Playwright), une fois la base branchée.
6. Constats LOW ouverts : plafond de missions ouvertes par entreprise, plafond de la somme des paiements au total du contrat, `FOR SHARE` dans les déclencheurs, `sslmode` imposé, ajout de membre sans acceptation de l'invité.

## Décisions qui reviennent au founder

- **Vérification de l'entreprise (SIRET, INSEE) avant toute prise de contact** : aujourd'hui, n'importe quel compte peut créer une entreprise et contacter 50 profils par jour (plafonné, mais sans vérification). Recommandation War Room : SIRET vérifié obligatoire pour `contact`, à poser en C6.
- **« Embauché » sans contrat sur la plateforme** : une entreprise peut marquer une candidature « hired » sans passer par le devis et le contrat de C3. Recommandation : l'état « hired » n'existe qu'au contrat signé (C3).
- **Rôles** : un simple membre a aujourd'hui les mêmes droits qu'un propriétaire sur les missions et les candidatures.
