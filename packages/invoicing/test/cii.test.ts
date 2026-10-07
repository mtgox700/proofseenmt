import { describe, expect, it } from "vitest";
import { invoiceTypeCode, renderCii } from "../src/cii";
import type { InvoiceDocument } from "../src/render";

const ADDRESS = { line1: "1 Allée des Écuries", postalCode: "64600", city: "Anglet", country: "FR" };

const MISSION: InvoiceDocument = {
  number: "2026-FR-ABCDE-0001",
  kind: "mission",
  label: "Mission de développement — décembre 2026",
  quantity: 10,
  unitCents: 60_000,
  netCents: 600_000,
  vatRateBp: 2000,
  vatCents: 120_000,
  totalCents: 720_000,
  currency: "EUR",
  seller: { legalName: "Camille & Fils EI", siret: "55210055400025", vatNumber: "FR40552100554", address: ADDRESS },
  buyer: { legalName: "Acme <SAS>", siret: "73282932000074", vatNumber: null, address: { ...ADDRESS, line2: "Bâtiment B" } },
  issuedAt: new Date("2026-12-31T10:00:00Z"),
  dueOn: new Date("2027-01-30T00:00:00Z"),
};

/** Vérifie que chaque balise ouverte est fermée dans l'ordre : un XML mal formé serait refusé par toute plateforme. */
const wellFormed = (xml: string): boolean => {
  const stack: string[] = [];
  for (const [, closing, name, selfClosing] of xml.replace(/<\?xml[^>]*\?>/, "").matchAll(/<(\/?)([A-Za-z][\w:.-]*)[^>]*?(\/?)>/g)) {
    if (selfClosing === "/") continue;
    if (closing === "/") {
      if (stack.pop() !== name) return false;
    } else stack.push(name ?? "");
  }
  return stack.length === 0;
};

describe("facture électronique CII (EN 16931)", () => {
  it("produit un XML bien formé, au profil EN 16931, avec les mêmes chiffres que la facture", () => {
    const xml = renderCii(MISSION);
    expect(wellFormed(xml)).toBe(true);
    expect(xml).toContain("<ram:ID>urn:cen.eu:en16931:2017</ram:ID>");
    expect(xml).toContain("<ram:TypeCode>380</ram:TypeCode>");
    expect(xml).not.toContain("<ram:TypeCode>389");
    expect(xml).toContain('<udt:DateTimeString format="102">20261231</udt:DateTimeString>');
    expect(xml).toContain('<ram:BilledQuantity unitCode="DAY">10</ram:BilledQuantity>');
    expect(xml).toContain("<ram:ChargeAmount>600.00</ram:ChargeAmount>");
    expect(xml).toContain("<ram:LineTotalAmount>6000.00</ram:LineTotalAmount>");
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">1200.00</ram:TaxTotalAmount>');
    expect(xml).toContain("<ram:GrandTotalAmount>7200.00</ram:GrandTotalAmount>");
    expect(xml).toContain('<ram:ID schemeID="0002">552100554</ram:ID>');
    expect(xml).toContain('<ram:ID schemeID="VA">FR40552100554</ram:ID>');
    expect(xml).toContain("Facture émise par un tiers : Proofseen au nom et pour le compte de Camille &amp; Fils EI");
    expect(xml).toContain("<ram:SubjectCode>PMT</ram:SubjectCode>");
  });

  it("échappe les textes, et n'écrit ni TVA ni SIRET absents", () => {
    const xml = renderCii(MISSION);
    expect(xml).toContain("<ram:Name>Acme &lt;SAS&gt;</ram:Name>");
    expect(xml).toContain("<ram:LineTwo>Bâtiment B</ram:LineTwo>");
    const buyer = /<ram:BuyerTradeParty>[\s\S]*<\/ram:BuyerTradeParty>/.exec(xml)?.[0] ?? "";
    expect(buyer).not.toContain('schemeID="VA"');
    const noSiret = renderCii({ ...MISSION, buyer: { ...MISSION.buyer, siret: null } });
    expect(/<ram:BuyerTradeParty>[\s\S]*<\/ram:BuyerTradeParty>/.exec(noSiret)?.[0]).not.toContain("SpecifiedLegalOrganization");
  });

  it("retire les caractères interdits en XML, qui rendraient la facture illisible", () => {
    const control = String.fromCharCode(1, 8, 11, 0xfffe);
    const xml = renderCii({ ...MISSION, seller: { ...MISSION.seller, legalName: `Camille${control} EI` } });
    expect(xml).toContain("<ram:Name>Camille EI</ram:Name>");
    expect(wellFormed(xml)).toBe(true);
  });

  it("déclare la franchise en base de TVA avec son motif, et la commission comme facture commerciale", () => {
    const exempt = renderCii({ ...MISSION, vatRateBp: 0, vatCents: 0, totalCents: 600_000 });
    expect(exempt).toContain("<ram:CategoryCode>E</ram:CategoryCode>");
    expect(exempt).toContain("<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI.</ram:ExemptionReason>");
    expect(exempt).toContain("<ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>");
    expect(invoiceTypeCode("commission")).toBe("380");
    const commission = renderCii({ ...MISSION, kind: "commission", quantity: 1, unitCents: 60_000, netCents: 60_000, vatCents: 12_000, totalCents: 72_000 });
    expect(commission).toContain("<ram:TypeCode>380</ram:TypeCode>");
    expect(commission).toContain('unitCode="C62"');
    expect(commission).not.toContain("Facture émise par un tiers");
  });
});
