import { describe, expect, it } from "vitest";
import { missingMentions, NO_DISCOUNT, RECOVERY_FEE, renderInvoice, VAT_EXEMPT, type InvoiceDocument } from "../src/index";

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };

const MISSION: InvoiceDocument = {
  number: "FR-ABCDE-2026-0001",
  kind: "mission",
  label: "Prestation de services : 10 jours, du 2026-11-02 au 2026-11-13",
  quantity: 10,
  unitCents: 60_000,
  netCents: 600_000,
  vatRateBp: 0,
  vatCents: 0,
  totalCents: 600_000,
  currency: "EUR",
  seller: { legalName: "Camille Test EI", siret: "55210055400025", vatNumber: null, address: ADDRESS },
  buyer: { legalName: "Acme SAS", siret: "73282932000074", vatNumber: "FR40732829320", address: ADDRESS },
  issuedAt: new Date("2026-11-20T10:00:00Z"),
  dueOn: new Date("2026-12-20T00:00:00Z"),
};

describe("facture", () => {
  it("porte les mentions obligatoires", () => {
    // Le texte tel que le lit une personne : les apostrophes sont échappées dans le HTML.
    const html = renderInvoice(MISSION).replace(/&#39;/g, "'");
    for (const mention of [
      "Facture n° FR-ABCDE-2026-0001",
      "Émise le 20 novembre 2026",
      "échéance le 20 décembre 2026",
      "SIRET : 55210055400025",
      "N° TVA : FR40732829320",
      "Prestation de services : 10 jours",
      VAT_EXEMPT,
      RECOVERY_FEE,
      NO_DISCOUNT,
      "Pénalités de retard",
      "au nom et pour le compte de Camille Test EI",
    ]) {
      expect(html).toContain(mention);
    }
    expect(html).toMatch(/6\s000,00\s€/);
    expect(missingMentions(MISSION)).toEqual([]);
  });

  it("affiche la TVA au taux du vendeur, et sans mention de mandat pour la commission", () => {
    const commission: InvoiceDocument = {
      ...MISSION,
      kind: "commission",
      number: "PS-2026-0001",
      quantity: 1,
      unitCents: 60_000,
      netCents: 60_000,
      vatRateBp: 2000,
      vatCents: 12_000,
      totalCents: 72_000,
      seller: { legalName: "Proofseen", siret: "12345678900011", vatNumber: "FR12123456789", address: ADDRESS },
    };
    const html = renderInvoice(commission);
    expect(html).toContain("TVA 20 %");
    expect(html).toMatch(/720,00\s€/);
    expect(html).not.toContain("au nom et pour le compte");
    expect(html).not.toContain(VAT_EXEMPT);
  });

  it("signale ce qui manque plutôt que d'émettre une facture incomplète", () => {
    expect(missingMentions({ ...MISSION, seller: { ...MISSION.seller, siret: null } })).toEqual(["SIRET du vendeur"]);
    expect(missingMentions({ ...MISSION, vatRateBp: 2000, vatCents: 120_000, totalCents: 720_000 })).toEqual(["numéro de TVA du vendeur"]);
    expect(missingMentions({ ...MISSION, totalCents: 1 })).toEqual(["total TTC cohérent"]);
  });

  it("échappe ce qui vient des parties", () => {
    const html = renderInvoice({ ...MISSION, buyer: { ...MISSION.buyer, legalName: "<script>alert(1)</script>" } });
    expect(html).not.toContain("<script>alert");
  });
});
