# C8 — Confiance vérifiée · reprise

> Écrit le 2026-10-07, branche `sprint/c8-confiance-verifiee`. Lancé sur le « go continue the work » du founder.

## Fait

| Brique | Fichiers |
|---|---|
| SIRET contrôlé au répertoire officiel (API publique Recherche d'entreprises, sans clé) : actif, fermé, inconnu, ou nom officiel différent de la raison sociale déclarée ; daté, remis à zéro quand le SIRET ou le nom change, revérifié tous les 30 jours ; un SIRET par partie | `packages/db/src/registry.ts`, `apps/web/src/data/registry-lookup.ts`, tâche planifiée |
| Contrat refusé si une des entreprises est fermée au répertoire ; jamais quand le répertoire n'a pas répondu | `packages/db/src/contracts.ts` |
| Faits vérifiés publics, datés, sans niveau ni score : entreprise active, identité vérifiée par le prestataire de paiement, missions payées, attestation URSSAF vérifiée ; entreprise active sur la page d'une mission | `public-profiles.ts`, `missions.ts`, `packages/hub/src/profile-page.ts`, `job-page.ts` |
| Attestation de vigilance URSSAF : déclaration, validité 6 mois, contrats des 6 derniers mois additionnés (≥ 5 000 € HT) refusés à la création et à la signature sans attestation vérifiée par un opérateur, rappel à J-30 | `packages/db/src/contract-checks.ts`, `packages/db/src/vigilance.ts`, `apps/web/src/app/api/billing/vigilance/route.ts`, `apps/cli/src/vigilance.ts` |
| Trois migrations appliquées sur Railway (`20261007100000_registry_checks`, `20261007120000_vigilance_attestation`, `20261007140000_registry_identity`) ; tests et base locale jouent toutes les migrations | `packages/db/prisma/migrations.ts` |

## Reste à faire

1. ~~Red team~~ : faite et corrigée le 2026-10-07 (2 hautes, 4 moyennes, basses) — voir `TEAM_MEMORY.md`.
2. Identité vérifiée par Stripe Connect affichée comme un fait : codée sur `payoutsEnabledAt`, s'activera avec Stripe (repoussé à la fin du projet par le founder).
3. Écrans de déclaration de l'attestation et d'affichage des faits côté espace connecté (session design).
4. Plafond d'entreprises par personne et adhésion sur invitation : avant toute route de création d'entreprise.
