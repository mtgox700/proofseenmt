import { LATE_PENALTY, NO_DISCOUNT, RECOVERY_FEE, VAT_EXEMPT, type InvoiceDocument, type Party } from "./render";

/*
 * La facture au format électronique structuré : XML « Cross Industry Invoice » (UN/CEFACT, profil EN 16931), la partie
 * lisible par machine d'une Factur-X et l'un des formats acceptés par la réforme française de la facturation
 * électronique. Elle porte exactement les mêmes chiffres et mentions que le rendu HTML.
 *
 * La facture de mission est émise par un tiers : Proofseen l'établit au nom et pour le compte du freelance, sous mandat
 * (art. 289 I-2 du CGI). Ce n'est pas une autofacturation : le code 389 (UNTDID 1001) désigne une facture établie par
 * l'acheteur, et Proofseen n'est pas l'acheteur. Les deux factures portent donc le code 380 ; le mandat figure en note.
 * La transmission par une plateforme agréée reste à brancher : ce module ne fait que produire le document.
 */

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
/** Caractères interdits en XML 1.0 (contrôles hors tabulation et sauts de ligne, U+FFFE, U+FFFF) : retirés. */
const xmlSafe = (value: string): string =>
  [...value]
    .filter((c) => {
      const code = c.codePointAt(0) ?? 0;
      return code === 0x9 || code === 0xa || code === 0xd || (code >= 0x20 && code !== 0xfffe && code !== 0xffff);
    })
    .join("");

const x = (value: string): string => xmlSafe(value).replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

const amount = (cents: number): string => (cents / 100).toFixed(2);
const percent = (bp: number): string => (bp / 100).toFixed(2);
const day = (d: Date): string => d.toISOString().slice(0, 10).replace(/-/g, "");

/** Code de type de facture : 380, facture commerciale, pour la mission émise sous mandat comme pour la commission. */
export const invoiceTypeCode = (_kind: InvoiceDocument["kind"]): "380" => "380";

const party = (tag: "SellerTradeParty" | "BuyerTradeParty", p: Party): string =>
  [
    `<ram:${tag}>`,
    `<ram:Name>${x(p.legalName)}</ram:Name>`,
    // SIREN, identifiant légal de l'entreprise (schéma 0002), tiré des neuf premiers chiffres du SIRET.
    p.siret === null ? "" : `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${x(p.siret.slice(0, 9))}</ram:ID></ram:SpecifiedLegalOrganization>`,
    "<ram:PostalTradeAddress>",
    `<ram:PostcodeCode>${x(p.address.postalCode)}</ram:PostcodeCode>`,
    `<ram:LineOne>${x(p.address.line1)}</ram:LineOne>`,
    p.address.line2 === undefined ? "" : `<ram:LineTwo>${x(p.address.line2)}</ram:LineTwo>`,
    `<ram:CityName>${x(p.address.city)}</ram:CityName>`,
    `<ram:CountryID>${x(p.address.country)}</ram:CountryID>`,
    "</ram:PostalTradeAddress>",
    p.vatNumber === null ? "" : `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${x(p.vatNumber)}</ram:ID></ram:SpecifiedTaxRegistration>`,
    `</ram:${tag}>`,
  ].join("");

const note = (content: string, subject?: string): string =>
  `<ram:IncludedNote><ram:Content>${x(content)}</ram:Content>${subject === undefined ? "" : `<ram:SubjectCode>${subject}</ram:SubjectCode>`}</ram:IncludedNote>`;

export const renderCii = (doc: InvoiceDocument): string => {
  const exempt = doc.vatRateBp === 0;
  const category = exempt ? "E" : "S";
  const lineTax = `<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${category}</ram:CategoryCode><ram:RateApplicablePercent>${percent(doc.vatRateBp)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`;
  const headerTax = [
    "<ram:ApplicableTradeTax>",
    `<ram:CalculatedAmount>${amount(doc.vatCents)}</ram:CalculatedAmount>`,
    "<ram:TypeCode>VAT</ram:TypeCode>",
    exempt ? `<ram:ExemptionReason>${x(VAT_EXEMPT)}</ram:ExemptionReason>` : "",
    `<ram:BasisAmount>${amount(doc.netCents)}</ram:BasisAmount>`,
    `<ram:CategoryCode>${category}</ram:CategoryCode>`,
    `<ram:RateApplicablePercent>${percent(doc.vatRateBp)}</ram:RateApplicablePercent>`,
    "</ram:ApplicableTradeTax>",
  ].join("");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
    "<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>",
    "<rsm:ExchangedDocument>",
    `<ram:ID>${x(doc.number)}</ram:ID>`,
    `<ram:TypeCode>${invoiceTypeCode(doc.kind)}</ram:TypeCode>`,
    `<ram:IssueDateTime><udt:DateTimeString format="102">${day(doc.issuedAt)}</udt:DateTimeString></ram:IssueDateTime>`,
    doc.kind === "mission" ? note(`Facture émise par un tiers : Proofseen au nom et pour le compte de ${doc.seller.legalName}, sous mandat de facturation.`) : "",
    note(LATE_PENALTY, "PMD"),
    note(RECOVERY_FEE, "PMT"),
    note(NO_DISCOUNT, "AAB"),
    "</rsm:ExchangedDocument>",
    "<rsm:SupplyChainTradeTransaction>",
    "<ram:IncludedSupplyChainTradeLineItem>",
    "<ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>",
    `<ram:SpecifiedTradeProduct><ram:Name>${x(doc.label)}</ram:Name></ram:SpecifiedTradeProduct>`,
    `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${amount(doc.unitCents)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>`,
    // DAY : prestation facturée au jour ; C62 : une unité (forfait, commission).
    `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${doc.quantity > 1 ? "DAY" : "C62"}">${doc.quantity}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>`,
    `<ram:SpecifiedLineTradeSettlement>${lineTax}<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amount(doc.netCents)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement>`,
    "</ram:IncludedSupplyChainTradeLineItem>",
    `<ram:ApplicableHeaderTradeAgreement>${party("SellerTradeParty", doc.seller)}${party("BuyerTradeParty", doc.buyer)}</ram:ApplicableHeaderTradeAgreement>`,
    "<ram:ApplicableHeaderTradeDelivery/>",
    "<ram:ApplicableHeaderTradeSettlement>",
    `<ram:InvoiceCurrencyCode>${x(doc.currency)}</ram:InvoiceCurrencyCode>`,
    headerTax,
    `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${day(doc.dueOn)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>`,
    "<ram:SpecifiedTradeSettlementHeaderMonetarySummation>",
    `<ram:LineTotalAmount>${amount(doc.netCents)}</ram:LineTotalAmount>`,
    `<ram:TaxBasisTotalAmount>${amount(doc.netCents)}</ram:TaxBasisTotalAmount>`,
    `<ram:TaxTotalAmount currencyID="${x(doc.currency)}">${amount(doc.vatCents)}</ram:TaxTotalAmount>`,
    `<ram:GrandTotalAmount>${amount(doc.totalCents)}</ram:GrandTotalAmount>`,
    `<ram:DuePayableAmount>${amount(doc.totalCents)}</ram:DuePayableAmount>`,
    "</ram:SpecifiedTradeSettlementHeaderMonetarySummation>",
    "</ram:ApplicableHeaderTradeSettlement>",
    "</rsm:SupplyChainTradeTransaction>",
    "</rsm:CrossIndustryInvoice>",
    "",
  ].join("\n");
};
