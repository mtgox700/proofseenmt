import { describe, expect, it } from "vitest";
import { EMPTY_JOURNAL, gateStatus, markDelivered, markRefunded, recordPayment } from "../src";

/*
 * Ces tests visent les trois erreurs qui coûtent de l'argent quand on édite le journal à la main : compter deux fois,
 * écraser un fait daté, et perdre les autres paiements en réécrivant le fichier.
 */

const paid = (reference: string, over: Record<string, unknown> = {}) => ({
  reference,
  paidAt: "2026-10-01T10:00:00+02:00",
  offer: "audit" as const,
  amountCents: 29000,
  status: "paid" as const,
  ...over,
});

describe("enregistrer un paiement", () => {
  it("ajoute sans perdre les précédents", () => {
    const journal = recordPayment(recordPayment(EMPTY_JOURNAL, paid("pi_1")), paid("pi_2"));
    expect(journal.payments.map((payment) => payment.reference)).toEqual(["pi_1", "pi_2"]);
  });

  it("refuse la même référence deux fois", () => {
    // Une vente comptée deux fois ferait croire la gate atteinte avec 9 clients au lieu de 10.
    const journal = recordPayment(EMPTY_JOURNAL, paid("pi_1"));
    expect(() => recordPayment(journal, paid("pi_1"))).toThrow(/déjà enregistré/);
  });

  it("ne modifie pas le journal qu'on lui donne", () => {
    const before = recordPayment(EMPTY_JOURNAL, paid("pi_1"));
    recordPayment(before, paid("pi_2"));
    expect(before.payments).toHaveLength(1);
  });

  it("refuse un montant nul ou négatif, et une offre inconnue", () => {
    expect(() => recordPayment(EMPTY_JOURNAL, paid("pi_1", { amountCents: 0 }))).toThrow();
    expect(() => recordPayment(EMPTY_JOURNAL, paid("pi_1", { offer: "abonnement" }))).toThrow();
  });
});

describe("marquer une livraison", () => {
  const journal = recordPayment(EMPTY_JOURNAL, paid("pi_1"));

  it("pose la date et la conserve", () => {
    const delivered = markDelivered(journal, "pi_1", new Date("2026-10-10T12:00:00Z"));
    expect(delivered.payments[0]!.deliveredAt).toBe("2026-10-10T12:00:00.000Z");
  });

  it("refuse de la poser deux fois, ce qui masquerait la vraie date", () => {
    const delivered = markDelivered(journal, "pi_1", new Date("2026-10-10T12:00:00Z"));
    expect(() => markDelivered(delivered, "pi_1", new Date("2026-11-01T12:00:00Z"))).toThrow(/déjà marqué livré/);
  });

  it("refuse une livraison antérieure au paiement", () => {
    expect(() => markDelivered(journal, "pi_1", new Date("2026-09-01T12:00:00Z"))).toThrow();
  });

  it("refuse un paiement inconnu plutôt que d'en inventer un", () => {
    expect(() => markDelivered(journal, "pi_inconnu", new Date("2026-10-10T12:00:00Z"))).toThrow(/aucun paiement/);
  });
});

describe("marquer un remboursement", () => {
  it("garde la trace de la livraison, qui explique le remboursement", () => {
    const delivered = markDelivered(recordPayment(EMPTY_JOURNAL, paid("pi_1")), "pi_1", new Date("2026-10-10T12:00:00Z"));
    const refunded = markRefunded(delivered, "pi_1");
    expect(refunded.payments[0]!.status).toBe("refunded");
    expect(refunded.payments[0]!.deliveredAt).toBe("2026-10-10T12:00:00.000Z");
  });

  it("refuse de rembourser deux fois", () => {
    const refunded = markRefunded(recordPayment(EMPTY_JOURNAL, paid("pi_1")), "pi_1");
    expect(() => markRefunded(refunded, "pi_1")).toThrow(/déjà remboursé/);
  });

  it("refuse de livrer un paiement remboursé", () => {
    const refunded = markRefunded(recordPayment(EMPTY_JOURNAL, paid("pi_1")), "pi_1");
    expect(() => markDelivered(refunded, "pi_1", new Date("2026-10-10T12:00:00Z"))).toThrow(/rien à livrer/);
  });
});

describe("le décompte de la gate lit ce qui a été écrit", () => {
  it("ne compte pas un remboursement comme une vente", () => {
    // C'est le point de toute la chaîne : le chiffre qui décide du 27/11 doit être le vrai.
    let journal = EMPTY_JOURNAL;
    for (const index of [1, 2, 3]) journal = recordPayment(journal, paid(`pi_${index}`));
    const at = new Date("2026-11-27T10:00:00+01:00");
    const before = gateStatus(journal.payments, at);
    const after = gateStatus(markRefunded(journal, "pi_3").payments, at);
    expect(before.counted).toBe(3);
    expect(after.counted).toBe(2);
    expect(after.refunded).toBe(1);
    // Et le produit suit : un remboursement ne laisse pas son montant dans le chiffre d'affaires compté.
    expect(after.revenueCents).toBe(before.revenueCents - 29000);
  });
});
