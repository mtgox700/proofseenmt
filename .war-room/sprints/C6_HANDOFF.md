# C6 — Confiance, conformité, robustesse · reprise

> Écrit le 2026-10-06, branche `sprint/c6-confiance`.

## Fait

| Brique | Fichiers |
|---|---|
| Effacement RGPD refusé tant qu'un contrat est en cours ou que des fonds sont engagés ; verrous ; dernier membre ferme les missions ; export limité à ce qui concerne la personne | `packages/db/src/gdpr.ts` |
| Durées de conservation exécutées par la tâche planifiée | `packages/db/src/retention.ts`, `apps/web/src/app/api/cron/notifications/route.ts` |
| Export et effacement par la personne | `apps/web/src/app/api/me/route.ts` |
| Journaux JSON sans donnée sensible, santé, secret de tâche planifiée partagé | `apps/web/src/lib/log.ts`, `apps/web/src/app/api/health/route.ts`, `apps/web/src/lib/cron-auth.ts` |
| Garde AI Act (aucun score, rang ni moyenne de personne) | `packages/db/test/ai-act.test.ts` |
| Fraude : détecteur durci, coordonnées refusées dans les champs publics et avant contrat, nom affiché jamais publié s'il contient des coordonnées | `contact-detection.ts`, `profiles.ts`, `missions.ts`, `billing.ts`, `public-profiles.ts`, `messaging.ts`, `applications.ts` |
| Fraude : avis seulement sur paiement acquis, plancher de devis 100, pas de contrat entre même SIREN, nouveau contrat possible dans un fil | `reviews.ts`, `quotes.ts`, `contracts.ts`, `prisma/init/appendix.sql` |
| Registre des traitements | `.war-room/conformite/REGISTRE_TRAITEMENTS.md` |

Scénarios rejoués : `packages/db/test/red-team-c6.test.ts`, `contact-detection.test.ts`, `gdpr.test.ts`, `retention.test.ts`.

## Reste à faire

1. Au déploiement : rejouer `DELETE /api/me` connecté (aucune clé Clerk en local) et prouver les verrous d'effacement sur
   le Postgres Railway (PGlite n'a qu'une connexion).
2. ~~Séquestre pris en otage~~ : décidé et fait le 2026-10-07 (relance + « à revoir » à 14 jours, jamais de versement
   automatique) — `packages/db/src/validation-reminders.ts`.
3. Avant toute route de création d'entreprise ou d'ajout de membre : plafond par personne, adhésion sur invitation.
4. Accessibilité AA des parcours connectés : écrans de la session design.

## Suite

C7 — Bêta publique : demande le GO DEPLOY ; en parallèle, entonnoir instrumenté et procédure de mise en production.
