/*
 * L'export comptable des factures de mission reçues par une entreprise : une ligne par facture, au format qu'ouvre un
 * tableur français (séparateur point-virgule, virgule décimale, UTF-8 avec BOM, fins de ligne CRLF).
 *
 * Une cellule qui commence par =, +, -, @, une tabulation ou un retour chariot serait lue comme une formule par le
 * tableur : un nom de société choisi par un tiers pourrait alors exécuter quelque chose chez le comptable. Ces cellules
 * sont préfixées d'une apostrophe. Les montants, écrits par nous, ne le sont jamais.
 */

export interface AccountingRow {
  readonly issuedAt: Date;
  readonly number: string;
  readonly seller: { readonly legalName: string; readonly siret: string | null; readonly vatNumber: string | null };
  readonly label: string;
  readonly costCenter: string | null;
  readonly contractId: string;
  readonly netCents: number;
  readonly vatRateBp: number;
  readonly vatCents: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly dueOn: string;
}

const HEADER = ["Date", "Numéro", "Fournisseur", "SIRET", "TVA intracommunautaire", "Libellé", "Centre de coûts", "Contrat", "HT", "Taux TVA", "TVA", "TTC", "Devise", "Échéance"];

const FORMULA_START = /^[=+\-@\t\r]/;

const text = (value: string | null): string => {
  const raw = value ?? "";
  const safe = FORMULA_START.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

const decimal = (hundredths: number): string => {
  const sign = hundredths < 0 ? "-" : "";
  const abs = Math.abs(hundredths);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
};

const parisDay = (d: Date): string => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const accountingCsv = (rows: readonly AccountingRow[]): string => {
  const lines = rows.map((r) =>
    [
      parisDay(r.issuedAt),
      text(r.number),
      text(r.seller.legalName),
      text(r.seller.siret),
      text(r.seller.vatNumber),
      text(r.label),
      text(r.costCenter),
      r.contractId,
      decimal(r.netCents),
      decimal(r.vatRateBp),
      decimal(r.vatCents),
      decimal(r.totalCents),
      r.currency,
      r.dueOn,
    ].join(";"),
  );
  return `\uFEFF${[HEADER.map(text).join(";"), ...lines].join("\r\n")}\r\n`;
};
