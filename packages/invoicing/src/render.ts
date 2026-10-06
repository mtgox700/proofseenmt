/*
 * Rendu HTML d'une facture, avec les mentions obligatoires entre professionnels en France (art. 242 nonies A de
 * l'annexe II du CGI, art. L441-9 et L441-10 du code de commerce) :
 *  - numéro unique et chronologique, date d'émission ;
 *  - identité, adresse, SIRET et numéro de TVA du vendeur ; identité et adresse de l'acheteur, son numéro de TVA s'il
 *    en a un ;
 *  - désignation, quantité, prix unitaire hors taxe, total hors taxe ;
 *  - taux et montant de TVA, total TTC — ou, en franchise, « TVA non applicable, art. 293 B du CGI » ;
 *  - date d'échéance, taux des pénalités de retard, indemnité forfaitaire de 40 € pour frais de recouvrement,
 *    conditions d'escompte ;
 *  - pour la facture de mission, la mention du mandat : émise par Proofseen au nom et pour le compte du freelance.
 *
 * Ce rendu ne remplace pas la facture électronique structurée qu'impose la réforme de 2026-2027 : c'est l'un des
 * points à faire relire.
 */

export interface Party {
  readonly legalName: string;
  readonly siret: string | null;
  readonly vatNumber: string | null;
  readonly address: { readonly line1: string; readonly line2?: string | undefined; readonly postalCode: string; readonly city: string; readonly country: string };
}

export interface InvoiceDocument {
  readonly number: string;
  readonly kind: "mission" | "commission";
  readonly label: string;
  readonly quantity: number;
  readonly unitCents: number;
  readonly netCents: number;
  readonly vatRateBp: number;
  readonly vatCents: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly seller: Party;
  readonly buyer: Party;
  readonly issuedAt: Date;
  readonly dueOn: Date;
}

export const LATE_PENALTY = "Pénalités de retard : trois fois le taux d'intérêt légal en vigueur, exigibles dès le lendemain de l'échéance.";
export const RECOVERY_FEE = "Indemnité forfaitaire pour frais de recouvrement en cas de retard : 40 €.";
export const NO_DISCOUNT = "Pas d'escompte pour paiement anticipé.";
export const VAT_EXEMPT = "TVA non applicable, art. 293 B du CGI.";

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const e = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

export const money = (cents: number, currency: string): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);

const date = (d: Date): string => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(d);

const rate = (bp: number): string => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(bp / 100)} %`;

const party = (title: string, p: Party): string =>
  [
    `<section class="party"><h2>${e(title)}</h2>`,
    `<p><strong>${e(p.legalName)}</strong><br>${e(p.address.line1)}${p.address.line2 === undefined ? "" : `<br>${e(p.address.line2)}`}<br>${e(p.address.postalCode)} ${e(p.address.city)}<br>${e(p.address.country)}</p>`,
    p.siret === null ? "" : `<p>SIRET : ${e(p.siret)}</p>`,
    p.vatNumber === null ? "" : `<p>N° TVA : ${e(p.vatNumber)}</p>`,
    "</section>",
  ].join("");

/** Les mentions obligatoires manquantes ; vide quand la facture est complète. */
export const missingMentions = (doc: InvoiceDocument): readonly string[] => {
  const missing: string[] = [];
  if (doc.seller.siret === null) missing.push("SIRET du vendeur");
  if (doc.vatRateBp > 0 && doc.seller.vatNumber === null) missing.push("numéro de TVA du vendeur");
  if (doc.netCents !== doc.quantity * doc.unitCents) missing.push("total hors taxe cohérent avec la quantité et le prix unitaire");
  if (doc.totalCents !== doc.netCents + doc.vatCents) missing.push("total TTC cohérent");
  return missing;
};

export const renderInvoice = (doc: InvoiceDocument): string => {
  const vatLine =
    doc.vatRateBp === 0
      ? `<tr><th scope="row">TVA</th><td>${e(VAT_EXEMPT)}</td></tr>`
      : `<tr><th scope="row">TVA ${rate(doc.vatRateBp)}</th><td>${money(doc.vatCents, doc.currency)}</td></tr>`;
  return [
    "<!doctype html>",
    '<html lang="fr">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Facture ${e(doc.number)}</title>`,
    "<style>body{font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:760px;margin:2rem auto;padding:0 1rem}h1{font-size:1.6rem;margin:0}h2{font-size:.85rem;text-transform:uppercase;letter-spacing:.06em;color:#555;margin:0 0 .4rem}.parties{display:flex;gap:2rem;flex-wrap:wrap;margin:1.5rem 0}.party{flex:1 1 16rem}table{width:100%;border-collapse:collapse;margin:1rem 0}td,th{text-align:left;padding:.4rem;border-bottom:1px solid #ddd}td.n{text-align:right}.totals{width:auto;margin-left:auto}.totals td{text-align:right}.legal{font-size:.85rem;color:#444}</style>",
    "</head>",
    "<body>",
    `<h1>Facture n° ${e(doc.number)}</h1>`,
    `<p>Émise le ${date(doc.issuedAt)} · échéance le ${date(doc.dueOn)}</p>`,
    doc.kind === "mission" ? `<p><em>Facture émise par Proofseen au nom et pour le compte de ${e(doc.seller.legalName)}.</em></p>` : "",
    `<div class="parties">${party("Vendeur", doc.seller)}${party("Acheteur", doc.buyer)}</div>`,
    '<table><thead><tr><th scope="col">Désignation</th><th scope="col">Quantité</th><th scope="col">Prix unitaire HT</th><th scope="col">Total HT</th></tr></thead>',
    `<tbody><tr><td>${e(doc.label)}</td><td class="n">${doc.quantity}</td><td class="n">${money(doc.unitCents, doc.currency)}</td><td class="n">${money(doc.netCents, doc.currency)}</td></tr></tbody></table>`,
    '<table class="totals"><tbody>',
    `<tr><th scope="row">Total HT</th><td>${money(doc.netCents, doc.currency)}</td></tr>`,
    vatLine,
    `<tr><th scope="row">Total TTC</th><td><strong>${money(doc.totalCents, doc.currency)}</strong></td></tr>`,
    "</tbody></table>",
    `<p class="legal">${e(LATE_PENALTY)}<br>${e(RECOVERY_FEE)}<br>${e(NO_DISCOUNT)}</p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
