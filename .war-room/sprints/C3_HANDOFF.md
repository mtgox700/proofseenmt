# C3 — Devis, contrat, paiement sécurisé · reprise

> Écrit le 2026-10-06. Fusionné sur `main` par https://github.com/Ayoubhm07/Proofseen/pull/3. Lire les entrées
> 2026-10-06 de `TEAM_MEMORY.md` (revue de sécurité des paiements).

## Fait

| Brique | Fichiers |
|---|---|
| Identités de facturation (SIRET, TVA, taux, adresse) | `packages/db/src/billing.ts` |
| Devis | `packages/db/src/quotes.ts` |
| Contrats (identités figées, signatures, validation exigeant des fonds bloqués) | `packages/db/src/contracts.ts` |
| Factures (série par émetteur, mission sous mandat, commission) | `packages/db/src/invoices.ts`, rendu `packages/invoicing` |
| Séquestre (réservation, faits de litige et remboursement, reprise des versements, compte de versement) | `packages/db/src/payments.ts` |
| Stripe (mode test), webhooks signés | `packages/payments` |
| Routes | `apps/web/src/app/api/{billing,contracts,quotes,invoices,webhooks/stripe}/**`, `conversations/[id]/quotes`, `organisations/[id]/billing` |
| Liste juriste (non bloquante) | `.war-room/sprints/C3_JURISTE.md` |

Exécuté : webhook dans le site compilé sur la base locale (`packages/db/scripts/local-db.ts` crée un paiement de test en
attente, intention `pi_local_test`).

## Reste à faire pour clore C3

1. **[FOUNDER]** Taux de commission (`PROOFSEEN_COMMISSION_BP`), identité légale de Proofseen (`PROOFSEEN_LEGAL_NAME`,
   `PROOFSEEN_SIRET`, `PROOFSEEN_VAT_NUMBER`, `PROOFSEEN_ADDRESS_LINE1`, `_POSTAL_CODE`, `_CITY`, `_COUNTRY`), clés
   Stripe **de test** (`STRIPE_SECRET_KEY` en `sk_test_…`, `STRIPE_WEBHOOK_SECRET`), et l'activation de Connect sur le
   compte Stripe.
2. Parcours E2E en mode test réel (devis → contrat → paiement Stripe test → validation → versement → facture), une fois
   les clés posées.
3. Écrans (session design) : devis, contrat, paiement (Stripe Elements avec le `clientSecret`), factures.
4. Décisions : qui paie et valide (aujourd'hui administrateurs), litige après versement (aujourd'hui « à revoir »).

## Sprint suivant

C4 « Tableaux de bord et preuve » (`PROMPTS_CONQUETE.md`). Branche à créer depuis `main` :
`git fetch && git switch -c sprint/c4-tableaux-de-bord origin/main`.
