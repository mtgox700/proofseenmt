/*
 * Règles datées dont un gabarit a besoin et qui ne sont ni en base ni dans un autre paquet (bloc commun, règle 6 : un
 * montant légal vit dans un fichier de règles, avec sa source et sa date de lecture, jamais en dur dans une fonction).
 */

/**
 * Indemnité forfaitaire pour frais de recouvrement due au créancier professionnel en cas de retard : 40 euros.
 * Source : Code de commerce, art. D441-5 (lu par la recherche Légifrance du 2026-10-24, rapportée par le Trésor dans
 * `templates/service-agreement/template.yaml`, variable `rule.recoveryFeeCents`). Même montant que la mention des
 * factures (`RECOVERY_FEE` de `packages/invoicing`, qui l'écrit en texte).
 */
export const RECOVERY_FEE_CENTS = 4_000;
