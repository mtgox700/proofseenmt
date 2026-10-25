import { describe, expect, it } from "vitest";
import { latePenaltyLine, LEGAL_DEFAULT_PENALTY, missingMentions, NO_DISCOUNT, RECOVERY_FEE, renderInvoice, VAT_EXEMPT, type InvoiceDocument } from "../src/index";

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

  describe("mentions de règlement sur toute facture (L441-9 I) et facture acquittée", () => {
    const PAID_ON = new Date("2026-11-18T00:00:00Z");
    const PAID: InvoiceDocument = { ...MISSION, paidOn: PAID_ON, dueOn: PAID_ON };
    const text = (doc: InvoiceDocument): string => renderInvoice(doc).replace(/&#39;/g, "'");

    it("imprime le taux des pénalités, l'indemnité de 40 € et les conditions d'escompte sur une facture acquittée comme sur une autre", () => {
      for (const doc of [MISSION, PAID, { ...PAID, kind: "commission" as const }]) {
        const html = text(doc);
        expect(html).toContain(LEGAL_DEFAULT_PENALTY);
        expect(html).toContain(RECOVERY_FEE);
        expect(html).toContain(NO_DISCOUNT);
      }
    });

    it("sans clause au contrat, le taux est le taux légal par défaut (BCE majoré de 10 points), jamais « trois fois le taux légal »", () => {
      const html = text(MISSION);
      expect(html).toContain("Banque centrale européenne");
      expect(html).toContain("majoré de 10 points de pourcentage");
      expect(html).not.toContain("trois fois");
      expect(LEGAL_DEFAULT_PENALTY).toContain("exigibles le jour suivant la date de règlement");
    });

    it("avec une clause au contrat, c'est la clause qui est imprimée, à la place du taux par défaut", () => {
      const clause = "Pénalités de retard : trois fois le taux d'intérêt légal en vigueur, exigibles le jour suivant la date de règlement.";
      const html = text({ ...PAID, latePenaltyClause: clause });
      expect(html).toContain(clause);
      expect(html).not.toContain("Banque centrale européenne");
      expect(text({ ...PAID, latePenaltyClause: "   " })).toContain(LEGAL_DEFAULT_PENALTY);
      expect(latePenaltyLine({ ...MISSION, latePenaltyClause: null })).toBe(LEGAL_DEFAULT_PENALTY);
    });

    it("ajoute « Facture acquittée le » aux mentions légales, jamais à leur place", () => {
      const html = text(PAID);
      expect(html).toContain("Facture acquittée le 18/11/2026 par paiement sécurisé Stripe");
      expect(html).toContain("échéance le 18 novembre 2026");
      expect(html.indexOf("Facture acquittée")).toBeLessThan(html.indexOf(LEGAL_DEFAULT_PENALTY));
      expect(missingMentions(PAID)).toEqual([]);
    });

    it("la commission est acquittée par compensation avec le versement, avec la référence de la facture de la mission", () => {
      const html = text({ ...PAID, kind: "commission", settlesNumber: "FR-ABCDE-2026-0001" });
      expect(html).toContain("Facture acquittée le 18/11/2026 par compensation avec le versement de la mission (facture n° FR-ABCDE-2026-0001)");
      expect(html).not.toContain("par paiement sécurisé Stripe");
      expect(text({ ...PAID, kind: "commission" })).toContain("par compensation avec le versement de la mission");
    });

    it("une facture non acquittée n'a pas de mention d'acquittement", () => {
      expect(text({ ...MISSION, paidOn: null })).not.toContain("Facture acquittée");
    });

    it("date l'émission à l'heure de Paris, comme l'année du numéro : 23 h 30 UTC le 31 décembre est le 1er janvier à Paris", () => {
      const newYear = { ...MISSION, number: "FR-ABCDE-2027-0001", issuedAt: new Date("2026-12-31T23:30:00Z"), dueOn: new Date("2027-01-01T00:00:00Z"), paidOn: new Date("2027-01-01T00:00:00Z") };
      const html = text(newYear);
      expect(html).toMatch(/Émise le 1(er)? janvier 2027/);
      expect(html).toContain("acquittée le 01/01/2027");
      expect(html).not.toContain("31 décembre 2026");
      // Et l'été : 22 h 30 UTC le 30 juin est déjà le 1er juillet à Paris.
      expect(text({ ...MISSION, issuedAt: new Date("2026-06-30T22:30:00Z") })).toMatch(/Émise le 1(er)? juillet 2026/);
    });

    it("signale une facture acquittée dont l'échéance n'est pas le jour du paiement", () => {
      expect(missingMentions({ ...PAID, dueOn: new Date("2026-12-18T00:00:00Z") })).toEqual(["échéance égale à la date de paiement d'une facture acquittée"]);
    });

    it("formate la date en jour/mois/année sur deux chiffres, quel que soit le fuseau de la machine", () => {
      expect(renderInvoice({ ...PAID, paidOn: new Date("2026-01-05T00:00:00Z"), dueOn: new Date("2026-01-05T00:00:00Z") })).toContain("acquittée le 05/01/2026");
    });
  });

  it("échappe ce qui vient des parties", () => {
    const html = renderInvoice({ ...MISSION, buyer: { ...MISSION.buyer, legalName: "<script>alert(1)</script>" } });
    expect(html).not.toContain("<script>alert");
  });
});
