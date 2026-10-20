/*
 * Les faits des pages légales, en un seul endroit, chacun avec sa source.
 *
 * Éditeur : décision du founder du 2026-10-07, confirmée le 2026-10-20 — Proofseen reprend les mentions légales de
 * Spar-X (https://www.spar-x.fr/mentions.html, lue le 2026-10-20). Hébergeurs : pages légales officielles de chaque
 * prestataire, lues le 2026-10-20 (adresses ci-dessous). Rien n'est complété de mémoire : un champ que la source ne
 * donne pas est absent.
 */

export const LEGAL_VERSION_DATE = "2026-10-20";

export const LEGAL_VERSION = { fr: "Version du 20 octobre 2026", en: "Version of 20 October 2026" } as const;

export const PUBLISHER = {
  name: "e-kigai",
  brand: "Spar-X",
  form: {
    fr: "Société coopérative et participative par actions simplifiée (SCOP SAS) à capital variable",
    en: "Société coopérative et participative par actions simplifiée (SCOP SAS, a French worker cooperative) with variable capital",
  },
  address: "1 Allée des Écuries, 64600 Anglet, France",
  registry: { fr: "RCS de Bayonne", en: "Bayonne Trade and Companies Register (RCS)" },
  siren: "999 138 050",
  vat: "FR90999138050",
  ape: "7022Z",
  director: { fr: "M. Mehdi T., Président", en: "Mr Mehdi T., President" },
  dataEmail: "data@spar-x.fr",
  dataPostal: "Siège social e-kigai, 1 Allée des Écuries, 64600 Anglet",
  contactEmail: "contact@proofseen.com",
  source: "https://www.spar-x.fr/mentions.html",
} as const;

export interface Host {
  readonly name: string;
  readonly role: { readonly fr: string; readonly en: string };
  readonly lines: readonly string[];
  readonly source: string;
}

/** Les hébergeurs : le serveur de l'application (IONOS) et la base de données (Railway). */
export const HOSTS: readonly Host[] = [
  {
    name: "IONOS SARL",
    role: { fr: "Hébergement de l'application (serveur privé virtuel)", en: "Application hosting (virtual private server)" },
    lines: [
      "SARL au capital de 100 000 EUR",
      "7, place de la Gare, BP 70109, 57200 Sarreguemines Cedex, France",
      "RCS Sarreguemines B 431 303 775",
      "Tél. : 0970 808 911",
    ],
    source: "https://www.ionos.fr/terms-gtc/terms-imprint/",
  },
  {
    name: "Railway Corporation",
    role: { fr: "Hébergement de la base de données", en: "Database hosting" },
    lines: ["548 Market St Suite 68956, San Francisco, California 94104, United States", "Phone: (415) 707-7675", "team@railway.com"],
    source: "https://railway.com/legal/terms",
  },
];
