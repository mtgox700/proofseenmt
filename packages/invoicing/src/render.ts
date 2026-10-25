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
 * Le taux des pénalités de retard, l'indemnité forfaitaire de 40 € et les conditions d'escompte figurent sur TOUTE
 * facture, acquittée ou non : l'article L441-9 I du code de commerce ne prévoit aucune exception pour une facture déjà
 * réglée, et l'omission est punie d'une amende administrative (L441-9 II). Le taux imprimé est celui du contrat
 * (`latePenaltyClause`) ; sans clause, le taux légal par défaut de L441-10 II : taux de la BCE majoré de 10 points.
 * Source : réponses du Trésor (Bertrand Lacombe), .war-room/tresor/L1/compta/REPONSES_L1.md §3.1, qui cite Légifrance.
 *
 * Une facture émise à la libération des fonds (`paidOn`) porte en plus « Facture acquittée le JJ/MM/AAAA », jamais à la
 * place des mentions légales. La date est le jour où les fonds sont mis à la disposition du freelance (L441-9 I al. 5),
 * à l'heure de Paris, comme l'année du numéro : voir invoice-settlement.ts dans @proofseen/db.
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
  /** Jour (civil, à Paris) du règlement quand la facture est émise à la libération des fonds : alors `dueOn` est ce jour. */
  readonly paidOn?: Date | null | undefined;
  /** Facture de commission réglée par retenue sur le versement : le numéro de la facture de la mission. */
  readonly settlesNumber?: string | null | undefined;
  /** La clause de pénalités du contrat (texte complet de la ligne), si elle en stipule une ; sinon le taux légal par défaut. */
  readonly latePenaltyClause?: string | null | undefined;
}

/**
 * Pénalités de retard par défaut (C. com. L441-10 II) : taux de la Banque centrale européenne à son opération de
 * refinancement la plus récente, majoré de 10 points, exigibles le jour suivant la date de règlement. Un contrat peut
 * stipuler autre chose, sans descendre sous trois fois le taux d'intérêt légal : alors c'est sa clause qui est imprimée.
 */
export const LEGAL_DEFAULT_PENALTY =
  "Pénalités de retard : taux d'intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage, exigibles le jour suivant la date de règlement.";
export const RECOVERY_FEE = "Indemnité forfaitaire pour frais de recouvrement en cas de retard : 40 €.";
export const NO_DISCOUNT = "Pas d'escompte pour paiement anticipé.";
export const VAT_EXEMPT = "TVA non applicable, art. 293 B du CGI.";

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const e = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

export const money = (cents: number, currency: string): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);

/** Un instant (la date d'émission), écrit à l'heure de Paris : la même horloge que l'année du numéro de la facture. */
const instantDate = (d: Date): string => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(d);

/** Un jour civil (échéance, règlement : une colonne DATE, minuit UTC du jour voulu), écrit tel quel. */
const calendarDate = (d: Date): string => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(d);

const shortCalendarDate = (d: Date): string => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(d);

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * La mention d'acquittement d'une facture émise à la libération des fonds, ou `null` si elle n'est pas acquittée. La
 * facture de mission est réglée par le paiement du client (Stripe), reconnu au jour où les fonds sont mis à la disposition
 * du freelance ; celle de commission, par compensation avec ce versement, avec la référence de la facture de la mission.
 */
export const acquittalMention = (doc: InvoiceDocument): string | null => {
  if (doc.paidOn == null) return null;
  const when = shortCalendarDate(doc.paidOn);
  if (doc.kind === "mission") return `Facture acquittée le ${when} par paiement sécurisé Stripe`;
  const reference = doc.settlesNumber == null ? "" : ` (facture n° ${doc.settlesNumber})`;
  return `Facture acquittée le ${when} par compensation avec le versement de la mission${reference}`;
};

/** La ligne des pénalités de retard : la clause du contrat, ou le taux légal par défaut. */
export const latePenaltyLine = (doc: InvoiceDocument): string => {
  const clause = doc.latePenaltyClause?.trim();
  return clause === undefined || clause === "" ? LEGAL_DEFAULT_PENALTY : clause;
};

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
  if (doc.paidOn != null && dayKey(doc.dueOn) !== dayKey(doc.paidOn)) missing.push("échéance égale à la date de paiement d'une facture acquittée");
  return missing;
};

/** Les mentions de règlement de toute facture (L441-9 I) : pénalités, indemnité forfaitaire, escompte ; acquittée ou non. */
const legalLines = (doc: InvoiceDocument): readonly string[] => [latePenaltyLine(doc), RECOVERY_FEE, NO_DISCOUNT];

export const renderInvoice = (doc: InvoiceDocument): string => {
  const acquittal = acquittalMention(doc);
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
    `<p>Émise le ${instantDate(doc.issuedAt)} · échéance le ${calendarDate(doc.dueOn)}</p>`,
    acquittal === null ? "" : `<p><strong>${e(acquittal)}</strong></p>`,
    doc.kind === "mission" ? `<p><em>Facture émise par Proofseen au nom et pour le compte de ${e(doc.seller.legalName)}.</em></p>` : "",
    `<div class="parties">${party("Vendeur", doc.seller)}${party("Acheteur", doc.buyer)}</div>`,
    '<table><thead><tr><th scope="col">Désignation</th><th scope="col">Quantité</th><th scope="col">Prix unitaire HT</th><th scope="col">Total HT</th></tr></thead>',
    `<tbody><tr><td>${e(doc.label)}</td><td class="n">${doc.quantity}</td><td class="n">${money(doc.unitCents, doc.currency)}</td><td class="n">${money(doc.netCents, doc.currency)}</td></tr></tbody></table>`,
    '<table class="totals"><tbody>',
    `<tr><th scope="row">Total HT</th><td>${money(doc.netCents, doc.currency)}</td></tr>`,
    vatLine,
    `<tr><th scope="row">Total TTC</th><td><strong>${money(doc.totalCents, doc.currency)}</strong></td></tr>`,
    "</tbody></table>",
    `<p class="legal">${legalLines(doc).map(e).join("<br>")}</p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
