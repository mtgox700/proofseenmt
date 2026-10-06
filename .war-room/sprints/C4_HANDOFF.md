# C4 — Tableaux de bord et preuve · reprise

> Écrit le 2026-10-06. Fusionné sur `main` par https://github.com/Ayoubhm07/Proofseen/pull/4.

## Fait (données et API)

| Brique | Fichiers |
|---|---|
| Avis : mission terminée **et payée** seulement, sans moyenne ni note globale | `packages/db/src/reviews.ts`, déclencheur `Review_integrity` |
| Tableaux de bord freelance et entreprise, comptés en base | `packages/db/src/dashboards.ts` |
| Visibilité IA mesurée par vague et par moteur | `packages/db/src/visibility.ts`, enregistrée par `apps/cli/src/audit.ts` |
| Routes | `apps/web/src/app/api/dashboard/**`, `organisations/[id]/dashboard`, `contracts/[id]/review`, `profiles/[id]/reviews` |
| Tests de la base plus robustes : image de la base migrée chargée au lieu de rejouer la migration | `packages/db/test/support/database.ts` |

## Reste à faire pour clore C4

1. Écrans des deux tableaux de bord (session design), Lighthouse ≥ 95 et AA.
2. **Remesure J+45 de Zak** vers le 2026-11-19 : `clients/FR-ZK7M4/manifest-J45.json`, rapport comparé avec
   `--baseline AUDIT-FR-ZK7M4`. **GO API requis** (appels payants). Avec `DATABASE_URL`, la commande `audit` enregistre
   les résultats pour le tableau de bord.
3. Décompte des préventes au 2026-11-27 : le chiffre réel, sans arrondi.
