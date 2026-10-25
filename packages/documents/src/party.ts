import { typography, type Lang } from "./format";
import type { PartyLine } from "./model";

/*
 * Un bloc « partie » (TEMPLATE_FORMAT.md §3.1, type `party`) : raison sociale, adresse, SIRET, TVA ; les lignes absentes
 * (valeurs nulles) ne s'impriment pas. La forme est celle de `LegalSnapshot` (packages/db/src/billing.ts), figée à la
 * création du contrat : modifier son adresse plus tard ne réécrit pas un document.
 */

const NBSP = " ";

const COUNTRIES: Readonly<Record<string, Readonly<Record<Lang, string>>>> = {
  FR: { fr: "France", en: "France" },
  BE: { fr: "Belgique", en: "Belgium" },
  DE: { fr: "Allemagne", en: "Germany" },
  ES: { fr: "Espagne", en: "Spain" },
  IT: { fr: "Italie", en: "Italy" },
  LU: { fr: "Luxembourg", en: "Luxembourg" },
  NL: { fr: "Pays-Bas", en: "Netherlands" },
  PT: { fr: "Portugal", en: "Portugal" },
  IE: { fr: "Irlande", en: "Ireland" },
  CH: { fr: "Suisse", en: "Switzerland" },
  GB: { fr: "Royaume-Uni", en: "United Kingdom" },
  US: { fr: "États-Unis", en: "United States" },
  CA: { fr: "Canada", en: "Canada" },
  MA: { fr: "Maroc", en: "Morocco" },
  TN: { fr: "Tunisie", en: "Tunisia" },
  DZ: { fr: "Algérie", en: "Algeria" },
  SN: { fr: "Sénégal", en: "Senegal" },
};

const LABELS: Readonly<Record<Lang, { readonly siret: string; readonly vat: string }>> = {
  fr: { siret: "SIRET", vat: "N° de TVA" },
  en: { siret: "SIRET", vat: "VAT number" },
};

export interface PartyData {
  readonly legalName: string;
  readonly siret?: string | null | undefined;
  readonly vatNumber?: string | null | undefined;
  readonly address: {
    readonly line1: string;
    readonly line2?: string | undefined;
    readonly postalCode: string;
    readonly city: string;
    readonly country: string;
  };
}

const groupSiret = (siret: string): string => (/^\d{14}$/.test(siret) ? [siret.slice(0, 3), siret.slice(3, 6), siret.slice(6, 9), siret.slice(9)].join(NBSP) : siret);

export const partyLines = (party: PartyData, lang: Lang): readonly PartyLine[] => {
  const { address } = party;
  const country = COUNTRIES[address.country]?.[lang] ?? address.country;
  const labelled = (label: string, value: string): PartyLine => ({ text: typography(lang, lang === "fr" ? `${label} : ${value}` : `${label}: ${value}`) });
  return [
    { text: party.legalName, strong: true },
    { text: address.line1 },
    ...(address.line2 === undefined || address.line2 === "" ? [] : [{ text: address.line2 }]),
    { text: `${address.postalCode} ${address.city}` },
    { text: country },
    ...(party.siret === null || party.siret === undefined ? [] : [labelled(LABELS[lang].siret, groupSiret(party.siret))]),
    ...(party.vatNumber === null || party.vatNumber === undefined ? [] : [labelled(LABELS[lang].vat, party.vatNumber)]),
  ];
};
