import { describe, expect, it } from "vitest";
import { GATE_DEADLINE, GATE_TARGET, WITHDRAWAL_DAYS, gateStatus, PaymentSchema, type Payment } from "../src/gate";

const day = (n: number): string => new Date(Date.UTC(2026, 9, n, 12, 0, 0)).toISOString(); // octobre 2026
const pay = (over: Partial<Payment> = {}): Payment =>
  PaymentSchema.parse({ reference: `p${Math.random().toString(36).slice(2, 8)}`, paidAt: day(1), offer: "audit", amountCents: 4900, status: "paid", ...over });

const many = (n: number, over: Partial<Payment> = {}) => [...Array(n)].map(() => pay(over));
const AFTER = new Date("2026-11-28T09:00:00Z");

describe("ce qui compte pour la gate", () => {
  it("compte un paiement encaissé, consolidé et dans les délais", () => {
    const status = gateStatus(many(10), AFTER);
    expect(status.counted).toBe(10);
    expect(status.met).toBe(true);
  });

  it("ne compte pas un paiement remboursé ni un paiement contesté", () => {
    const status = gateStatus([...many(9), pay({ status: "refunded" }), pay({ status: "disputed" })], AFTER);
    expect(status.counted).toBe(9);
    expect(status.met).toBe(false);
    expect(status).toMatchObject({ refunded: 1, disputed: 1 });
  });

  it("exclut un paiement encaissé après l'échéance, et le signale", () => {
    const status = gateStatus([...many(9), pay({ paidAt: "2026-11-28T10:00:00Z" })], AFTER);
    expect(status.counted).toBe(9);
    expect(status.afterDeadline).toBe(1);
  });

  it("additionne le produit des seuls paiements comptés", () => {
    const status = gateStatus([pay(), pay({ offer: "cle_en_main", amountCents: 49_000 }), pay({ status: "refunded", amountCents: 4900 })], AFTER);
    expect(status.revenueCents).toBe(4900 + 49_000);
  });
});

describe("le délai de rétractation de 14 jours", () => {
  // Compter un paiement encore rétractable, c'est annoncer une gate franchie qu'un client peut défaire le lendemain.
  const justPaid = "2026-11-25T12:00:00Z";

  it("met de côté un paiement encore rétractable au moment du décompte", () => {
    const status = gateStatus([...many(9), pay({ paidAt: justPaid })], new Date("2026-11-27T23:00:00Z"));
    expect(status.counted).toBe(9);
    expect(status.provisional).toBe(1);
    expect(status.met).toBe(false);
    expect(status.metWithProvisional).toBe(true);
  });

  it("le compte une fois le délai écoulé", () => {
    const status = gateStatus([...many(9), pay({ paidAt: justPaid })], new Date(`2026-12-${10 + WITHDRAWAL_DAYS - 14}T12:00:01Z`));
    expect(status.counted).toBe(10);
    expect(status.met).toBe(true);
  });

  it("compte tout de suite un client qui a renoncé par écrit à se rétracter", () => {
    const status = gateStatus([...many(9), pay({ paidAt: justPaid, earlyStartRequestedAt: justPaid })], new Date("2026-11-27T23:00:00Z"));
    expect(status.counted).toBe(10);
    expect(status.provisional).toBe(0);
  });

  it("ignore une renonciation datée avant le paiement ou dans le futur", () => {
    // Une date incohérente ne doit pas acquérir un paiement encore rétractable : ce serait annoncer la gate à tort.
    const now = new Date("2026-11-27T23:00:00Z");
    for (const earlyStartRequestedAt of ["2026-11-20T12:00:00Z", "2026-12-24T12:00:00Z"]) {
      const status = gateStatus([pay({ paidAt: justPaid, earlyStartRequestedAt })], now);
      expect(status.counted, earlyStartRequestedAt).toBe(0);
      expect(status.provisional, earlyStartRequestedAt).toBe(1);
    }
  });
});

describe("quand la gate échoue", () => {
  it("dresse la liste de tout ce qui doit être remboursé, provisoires compris", () => {
    const payments = [pay({ reference: "A" }), pay({ reference: "B", paidAt: "2026-11-26T12:00:00Z" }), pay({ reference: "C", status: "refunded" })];
    const status = gateStatus(payments, AFTER);
    expect(status.met).toBe(false);
    // Un paiement déjà remboursé ne se rembourse pas deux fois ; un provisoire, si.
    expect(status.toRefund).toEqual(["A", "B"]);
  });

  it("ne demande aucun remboursement quand la gate est franchie", () => {
    expect(gateStatus(many(10), AFTER).toRefund).toEqual([]);
  });
});

describe("avant l'échéance, rien n'est tranché", () => {
  it("dit que la décision n'est pas encore prenable", () => {
    const status = gateStatus(many(12), new Date("2026-10-15T12:00:00Z"));
    expect(status.decidable).toBe(false);
    expect(status.met).toBe(false);
    expect(status.counted).toBe(12);
    expect(status.toRefund).toEqual([]);
  });

  it("devient décidable à l'échéance", () => {
    expect(gateStatus([], new Date(GATE_DEADLINE)).decidable).toBe(true);
  });
});

describe("le journal refuse ce qui ne se compte pas", () => {
  it("refuse un montant nul, négatif ou non entier", () => {
    for (const amountCents of [0, -100, 49.5]) expect(() => pay({ amountCents })).toThrow();
  });

  it("refuse une référence vide et une date qui n'en est pas une", () => {
    expect(() => pay({ reference: "" })).toThrow();
    expect(() => pay({ paidAt: "hier" })).toThrow();
  });

  it("refuse une date sans fuseau : le même journal donnerait deux décomptes selon la machine qui le lit", () => {
    for (const paidAt of ["2026-11-25", "2026-11-25T12:00:00", "11/25/2026"]) expect(() => pay({ paidAt }), paidAt).toThrow();
    expect(() => pay({ paidAt: "2026-11-25T12:00:00+01:00" })).not.toThrow();
    expect(() => pay({ paidAt: "2026-11-25T12:00:00Z" })).not.toThrow();
  });

  it("refuse une offre hors catalogue : le décompte de la gate porte sur les deux offres annoncées", () => {
    expect(() => pay({ offer: "abonnement" as Payment["offer"] })).toThrow();
  });

  it("refuse deux fois la même référence dans un même décompte", () => {
    expect(() => gateStatus([pay({ reference: "A" }), pay({ reference: "A" })], AFTER)).toThrow(/référence/i);
  });
});

describe("constantes du contrat", () => {
  it("porte la cible et l'échéance annoncées dans la roadmap et les CGV", () => {
    expect(GATE_TARGET).toBe(10);
    expect(GATE_DEADLINE).toContain("2026-11-27");
    expect(WITHDRAWAL_DAYS).toBe(14);
  });
});
