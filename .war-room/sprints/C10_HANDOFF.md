# C10 — Régie, facturation électronique, trésorerie · reprise

> Mis à jour le 2026-10-07, branche `sprint/c10-regie`.

## Fait

| Brique | Fichiers |
|---|---|
| Mode de facturation (forfait / régie) sur devis et contrat, figé en base | `packages/db/src/quotes.ts`, `contracts.ts`, migrations `…_timesheets`, `…_invoicing_mandate` |
| Relevés mensuels : déclaration, redépôt après refus, validation par un administrateur, plafond, période, version lue | `packages/db/src/timesheets.ts`, routes `api/contracts/[id]/timesheets`, `api/timesheets/[id]` |
| Garde : un contrat en régie ne se paie pas d'un seul coup (code et base) | `packages/db/src/payments.ts`, migration `…_invoicing_mandate` |
| Mandat de facturation exigé avant tout contrat | `packages/db/src/billing.ts` (`acceptInvoicingMandate`) |
| Facture électronique CII (EN 16931) | `packages/invoicing/src/cii.ts`, `api/invoices/[id]?format=cii` |

## Reste à faire

1. **Prépaiement mensuel et versement par relevé validé**, avec Stripe en fin de projet : paiement et facture par relevé,
   clôture d'un contrat en régie ; puis `PROOFSEEN_MONTHLY_BILLING=on` ouvre la régie dans l'application.
2. **Plateforme de dématérialisation agréée** pour transmettre les factures (choix du founder) ; le XML est prêt.
   Envelopper le XML dans un PDF/A-3 pour une Factur-X complète.
3. Avance de trésorerie : étude seulement, aucun engagement.
4. Écrans (session design) : relevés, case d'acceptation du mandat, téléchargement de la facture électronique.
