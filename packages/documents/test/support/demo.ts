/*
 * Données de démonstration du contrat de prestation : réalistes, fictives. Aucune vraie personne, aucun vrai SIRET :
 * les identifiants sont des zéros, les raisons sociales portent le mot « Exemple ». Les noms étrangers servent à prouver
 * que les polices de la marque ne sortent aucun carré (Łukasz, Nguyễn, Dvořák, L'HAŸ-LES-ROSES).
 */

export type Variables = Record<string, unknown>;

/** Les mêmes variables sans certaines clés (une saisie qui manque), sans toucher à l'original. */
export const without = (variables: Variables, ...keys: readonly string[]): Variables => Object.fromEntries(Object.entries(variables).filter(([key]) => !keys.includes(key)));

export const DEMO_SELLER = {
  legalName: "Studio Exemple, Łukasz Nguyễn-Dvořák EI",
  siret: "00000000000000",
  vatNumber: "FR00000000000",
  address: { line1: "12 avenue de l'Exemple", line2: "Bâtiment B, 3e étage", postalCode: "69003", city: "Lyon", country: "FR" },
  vatRateBp: 2000,
};

export const DEMO_BUYER = {
  legalName: "Société Exemple Çağrı & Fils SAS",
  siret: "00000000000000",
  vatNumber: "FR00000000000",
  address: { line1: "1 place de l'Exemple", postalCode: "94240", city: "L'HAŸ-LES-ROSES", country: "FR" },
  vatRateBp: null,
};

/** Le contrat au forfait, daté, avec propriété intellectuelle cédée : 6 jours à 500,00 EUR, soit 3 000,00 EUR HT. */
export const demoContract = (overrides: Variables = {}): Variables => ({
  "document.issuedOn": "2026-10-24",
  "document.versionNumber": 1,
  "document.signatureMethod": "platform_acceptance",
  "contract.id": "00000000-0000-4000-8000-000000000001",
  seller: DEMO_SELLER,
  buyer: DEMO_BUYER,
  "seller.vatRateBp": 2000,
  "platform.publisherName": "Éditeur Exemple",
  "platform.publisherForm": "société par actions simplifiée au capital de 1 000 euros",
  "platform.publisherSiren": "000000000",
  "platform.publisherRegistry": "registre du commerce et des sociétés de Paris",
  "platform.publisherAddress": "1 rue de l'Exemple, 75000 Paris",
  "platform.termsVersion": "2026-10-07",
  "contract.billing": "fixed",
  "contract.currency": "EUR",
  "contract.dailyRateCents": 50_000,
  "contract.days": 6,
  "contract.totalCents": 300_000,
  "contract.startsOn": "2026-11-02",
  "contract.endsOn": "2026-12-18",
  "contract.commissionBp": 1000,
  "contract.feePayer": "freelance",
  "computed.vigilanceRequired": false,
  "rule.vigilanceThresholdCents": 500_000,
  "rule.recoveryFeeCents": 4000,
  "input.scope":
    "Refonte de l'espace client d'une application de réservation : audit de l'existant, maquettes, intégration responsive et recette avec l'équipe du Client.",
  "input.deliverables": [
    "Audit de l'existant remis sous forme d'un rapport de dix pages au plus",
    "Maquettes validées de six écrans, au format source et en export",
    "Code des écrans intégrés, livré sur le dépôt du Client avec sa documentation d'installation",
  ],
  "input.workMode": "remote",
  "input.acceptanceWindowDays": 15,
  "input.ipRegime": "assignment",
  "input.ipPurpose": "l'exploitation de l'application du Client et de ses évolutions",
  "input.ipTerritory": "world",
  "input.ipDurationYears": 10,
  "input.processesPersonalData": false,
  "input.confidentialityYears": 5,
  "input.subcontractingAllowed": false,
  ...overrides,
});

/** Le même contrat avec les trois clauses optionnelles retenues par les parties (assurance, non-sollicitation, référence). */
export const demoOptionals = {
  insurance: "included",
  "non-solicitation": "included",
  reference: "included",
} as const;

export const demoOptionalVariables = (): Variables => ({
  "input.insurerName": "Assureur Exemple Mutuelle",
  "input.insurancePolicy": "EXEMPLE-0000-0000",
  "input.nonSolicitationMonths": 12,
});
