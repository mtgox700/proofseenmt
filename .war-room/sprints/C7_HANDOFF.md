# C7 — Bêta publique · reprise

> Écrit le 2026-10-06, branche `sprint/c7-beta`.

## Fait (sans attendre le déploiement)

| Brique | Fichiers |
|---|---|
| Entonnoir des deux côtés, par cohorte d'arrivée, en totaux | `packages/db/src/funnel.ts`, `apps/cli/src/funnel.ts` |
| Retours de la bêta : collecte, classement, lecture | `packages/db/src/feedback.ts`, `apps/web/src/app/api/feedback/route.ts`, `apps/cli/src/feedback.ts` |
| Procédure de mise en production | `.war-room/sprints/C7_DEPLOY.md` |
| Prompts des sprints suivants (C8-C11), proposés | `.war-room/PROMPTS_CONQUETE.md` |

## Attend le founder

1. **GO DEPLOY**, puis les actions de `C7_DEPLOY.md` §1-2 (rotation du mot de passe Railway, `DATABASE_URL`, clés Clerk,
   clés Stripe de test, taux de commission, identité légale de Proofseen).
2. Validation des prompts C8-C11.

## Ensuite

1. Déploiement en préproduction puis production, contrôles de `C7_DEPLOY.md` §3 avec preuves.
2. Écran « Donner un avis » (session design) branché sur `POST /api/feedback`.
3. Premiers utilisateurs réels : `funnel` et `feedback` chaque semaine, chiffres réels consignés dans `TEAM_MEMORY.md`.
