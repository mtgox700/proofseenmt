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

**En premier — relecture sécurité des correctifs fraude (2026-10-06), à corriger avant la PR :**
- HAUTE : nom d'organisation non filtré (`organisations.ts` `OrganisationInputSchema.name`) ; utiliser `containsDirectContact` (un nom de domaine reste permis), et aussi pour `billing.ts` `legalName` à la place de `containsContact` (« Booking.com » est refusé aujourd'hui).
- MOYENNE : `messaging.ts` `post()` ouvre les coordonnées dès un contrat actif ; exiger un paiement `held`/`releasing`/`released` entre la paire.
- MOYENNE : `contracts.ts` refuser aussi le contrat quand l'utilisateur du freelance est membre de l'entreprise acheteuse ; sur ce refus, clore le devis accepté (sinon le fil est bloqué) — autoriser dans `Quote_guard` accepted → closed quand aucun contrat vivant n'existe, puis régénérer la migration.
- BASSE : `dashboards.ts:64` compter les avis avec `SETTLED_PAYMENT`.
- Fait : HAUTE « ASP.NET / Socket.IO refusés » corrigée, contournements (chiffres d'autres écritures, émojis chiffres, « jean @ outlook dot fr », lettres espacées, `*`/`#`, ig:/snap:/threema:) et faux positifs (« signal : », années, listes de versions) traités dans `contact-detection.ts`.
- Puis : gate complet sur clone propre (`C:UsersHPpscheck`), mémoire d'équipe (brouillon : scratchpad `team-memory-c6.md`, à recopier), ligne C6 du tableau de bord, push, PR, merge rebase.

1. Au déploiement : rejouer `DELETE /api/me` connecté (aucune clé Clerk en local) et prouver les verrous d'effacement sur
   le Postgres Railway (PGlite n'a qu'une connexion).
2. Décision founder : séquestre pris en otage (l'entreprise ne valide jamais) — proposition : notification puis cas
   « à revoir » N jours après la fin prévue, jamais de versement automatique sans décision.
3. Avant toute route de création d'entreprise ou d'ajout de membre : plafond par personne, adhésion sur invitation.
4. Accessibilité AA des parcours connectés : écrans de la session design.

## Suite

C7 — Bêta publique : demande le GO DEPLOY ; en parallèle, entonnoir instrumenté et procédure de mise en production.
