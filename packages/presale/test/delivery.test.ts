import { describe, expect, it } from "vitest";
import { DELIVERY_DEADLINE, DUE_SOON_DAYS, PaymentSchema, deliveryStatus, type Payment } from "../src/gate";

const pay = (reference: string, over: Partial<Payment> = {}): Payment =>
  PaymentSchema.parse({ reference, paidAt: "2026-10-01T12:00:00Z", offer: "audit", amountCents: 4900, status: "paid", ...over });

const NOW = new Date("2026-11-01T12:00:00Z");
const AFTER_DEADLINE = new Date("2027-01-02T12:00:00Z");

describe("ce qui reste à livrer", () => {
  it("compte les livrés et les restants", () => {
    const status = deliveryStatus([pay("A", { deliveredAt: "2026-10-20T12:00:00Z" }), pay("B"), pay("C")], NOW);
    expect(status).toMatchObject({ paid: 3, delivered: 1, pending: 2 });
  });

  it("ne compte pas un paiement remboursé : il n'y a plus rien à livrer", () => {
    const status = deliveryStatus([pay("A", { status: "refunded" }), pay("B")], NOW);
    expect(status).toMatchObject({ paid: 1, pending: 1 });
  });

  it("ne réclame rien quand tout est livré", () => {
    const status = deliveryStatus([pay("A", { deliveredAt: "2026-10-20T12:00:00Z" })], AFTER_DEADLINE);
    expect(status.pending).toBe(0);
    expect(status.toRefund).toEqual([]);
  });
});

describe("l'échéance de livraison", () => {
  it("signale ce qui approche de l'échéance, avant qu'il soit trop tard", () => {
    const soon = new Date(Date.parse(DELIVERY_DEADLINE) - (DUE_SOON_DAYS - 1) * 86_400_000);
    expect(deliveryStatus([pay("A")], soon).dueSoon).toBe(1);
  });

  it("ne crie pas trop tôt", () => {
    const early = new Date(Date.parse(DELIVERY_DEADLINE) - (DUE_SOON_DAYS + 5) * 86_400_000);
    expect(deliveryStatus([pay("A")], early).dueSoon).toBe(0);
  });

  it("dresse la liste des remboursements dus dès l'échéance passée", () => {
    const status = deliveryStatus([pay("A"), pay("B", { deliveredAt: "2026-12-01T12:00:00Z" }), pay("C")], AFTER_DEADLINE);
    expect(status.overdue).toBe(2);
    expect(status.toRefund).toEqual(["A", "C"]);
    expect(status.toRefundCents).toBe(2 * 4900);
  });

  it("ne réclame aucun remboursement avant l'échéance, même si rien n'est livré", () => {
    // Tant que la date n'est pas passée, il reste du temps pour livrer : réclamer serait faux.
    const status = deliveryStatus([pay("A"), pay("B")], NOW);
    expect(status.overdue).toBe(0);
    expect(status.toRefund).toEqual([]);
  });
});

describe("ce que le journal refuse", () => {
  it("refuse une livraison datée avant le paiement", () => {
    expect(() => pay("A", { deliveredAt: "2026-09-01T12:00:00Z" })).toThrow();
  });

  it("refuse une date de livraison sans fuseau", () => {
    expect(() => pay("A", { deliveredAt: "2026-12-01" })).toThrow();
  });

  it("accepte un paiement non encore livré", () => {
    expect(pay("A").deliveredAt).toBeNull();
  });
});
