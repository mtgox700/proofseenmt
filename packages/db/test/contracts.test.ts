import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing } from "../src/billing";
import { contracts } from "../src/contracts";
import { messaging } from "../src/messaging";
import { quotes } from "../src/quotes";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, payAndHold, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };

/** Une entreprise et un freelance en conversation acceptée, avec leurs identités de facturation. */
const setup = async (identities = true) => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  const contact = await messaging(t.db).contact({ userId: recruiter }, org, profile, "Bonjour, une mission ?");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  const conversation = contact.conversation.id;
  await messaging(t.db).decide({ userId: freelanceUser }, conversation, "accepted", new Date());
  if (identities) {
    await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { legalName: "Camille Test EI", siret: "552 100 554 00025", address: ADDRESS });
    await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", siret: "73282932000074", vatNumber: "FR 40 732829320", address: ADDRESS });
  }
  return { recruiter, org, freelanceUser, profile, conversation };
};

const acceptedQuote = async (s: Awaited<ReturnType<typeof setup>>) => {
  const draft = await quotes(t.db).draft({ userId: s.freelanceUser }, s.conversation, { dailyRateCents: 60_000, days: 10 });
  await quotes(t.db).send({ userId: s.freelanceUser }, draft?.id ?? "");
  const decided = await quotes(t.db).decide({ userId: s.recruiter }, draft?.id ?? "", "accepted");
  if (decided.kind !== "ok") throw new Error(decided.kind);
  return decided.quote.id;
};

describe("devis", () => {
  it("se rédige par le freelance, s'envoie, se décide par l'entreprise ; le total est calculé, jamais reçu", async () => {
    const s = await setup();
    expect(await quotes(t.db).draft({ userId: s.recruiter }, s.conversation, { dailyRateCents: 1, days: 1 })).toBeNull();
    const draft = await quotes(t.db).draft({ userId: s.freelanceUser }, s.conversation, { dailyRateCents: 65_000, days: 12 });
    expect(draft).toMatchObject({ status: "draft", totalCents: 780_000 });

    expect(await quotes(t.db).list({ userId: s.recruiter }, s.conversation)).toEqual([]);
    expect(await quotes(t.db).decide({ userId: s.recruiter }, draft?.id ?? "", "accepted")).toEqual({ kind: "absent" });
    await quotes(t.db).send({ userId: s.freelanceUser }, draft?.id ?? "");
    expect(await quotes(t.db).decide({ userId: s.freelanceUser }, draft?.id ?? "", "accepted")).toEqual({ kind: "absent" });
    expect(await quotes(t.db).decide({ userId: s.recruiter }, draft?.id ?? "", "accepted")).toMatchObject({ kind: "ok", quote: { status: "accepted" } });
  });

  it("remplace le devis en attente quand un nouveau part, et n'accepte qu'un devis par fil", async () => {
    const s = await setup();
    const first = await quotes(t.db).draft({ userId: s.freelanceUser }, s.conversation, { dailyRateCents: 60_000, days: 10 });
    await quotes(t.db).send({ userId: s.freelanceUser }, first?.id ?? "");
    const second = await quotes(t.db).draft({ userId: s.freelanceUser }, s.conversation, { dailyRateCents: 55_000, days: 10 });
    await quotes(t.db).send({ userId: s.freelanceUser }, second?.id ?? "");
    const listed = await quotes(t.db).list({ userId: s.recruiter }, s.conversation);
    expect(listed?.map((q) => q.status).sort()).toEqual(["sent", "superseded"]);

    await quotes(t.db).decide({ userId: s.recruiter }, second?.id ?? "", "accepted");
    const third = await quotes(t.db).draft({ userId: s.freelanceUser }, s.conversation, { dailyRateCents: 50_000, days: 10 });
    await quotes(t.db).send({ userId: s.freelanceUser }, third?.id ?? "");
    expect(await quotes(t.db).decide({ userId: s.recruiter }, third?.id ?? "", "accepted")).toEqual({ kind: "already_accepted" });
  });

  it("ne laisse aucun tiers lire ni rédiger", async () => {
    const s = await setup();
    const stranger = await createUser(t.db);
    expect(await quotes(t.db).list({ userId: stranger }, s.conversation)).toBeNull();
    expect(await quotes(t.db).draft({ userId: stranger }, s.conversation, { dailyRateCents: 1, days: 1 })).toBeNull();
  });
});

describe("contrat", () => {
  it("naît d'un devis accepté, fige les identités, devient actif à la seconde signature, se termine par l'entreprise", async () => {
    const s = await setup();
    const quoteId = await acceptedQuote(s);
    const created = await contracts(t.db).createFromQuote({ userId: s.recruiter }, quoteId, { startsOn: "2026-11-02", endsOn: "2026-11-13" });
    if (created.kind !== "created") throw new Error(created.kind);
    const id = created.contract.id;
    expect(created.contract).toMatchObject({ totalCents: 600_000, status: "pending_signatures", acceptedByOrgAt: null });
    expect(await contracts(t.db).createFromQuote({ userId: s.freelanceUser }, quoteId, { startsOn: "2026-11-02" })).toEqual({ kind: "already_exists" });

    // Une adresse modifiée après coup ne réécrit pas le contrat.
    await billing(t.db).setFreelanceIdentity({ userId: s.freelanceUser }, { legalName: "Autre nom", address: { ...ADDRESS, city: "Lyon" } });
    const row = await t.db.contract.findUniqueOrThrow({ where: { id }, select: { sellerSnapshot: true, buyerSnapshot: true } });
    expect(row.sellerSnapshot).toMatchObject({ legalName: "Camille Test EI", siret: "55210055400025", address: { city: "Paris" } });
    expect(row.buyerSnapshot).toMatchObject({ legalName: "Acme SAS", vatNumber: "FR40732829320" });

    expect(await contracts(t.db).complete({ userId: s.recruiter }, id)).toEqual({ kind: "absent" });
    expect(await contracts(t.db).sign({ userId: s.recruiter }, id, new Date("2026-10-20T10:00:00Z"))).toMatchObject({ status: "pending_signatures" });
    expect(await contracts(t.db).sign({ userId: s.recruiter }, id, new Date("2026-10-20T11:00:00Z"))).toMatchObject({ acceptedByOrgAt: new Date("2026-10-20T10:00:00Z") });
    expect(await contracts(t.db).sign({ userId: s.freelanceUser }, id, new Date("2026-10-20T12:00:00Z"))).toMatchObject({ status: "active" });
    expect(await contracts(t.db).cancel({ userId: s.freelanceUser }, id)).toBeNull();

    expect(await contracts(t.db).complete({ userId: s.recruiter }, id)).toEqual({ kind: "not_paid" });
    await payAndHold(t.db, s.recruiter, id);
    expect(await contracts(t.db).complete({ userId: s.freelanceUser }, id)).toEqual({ kind: "absent" });
    expect(await contracts(t.db).complete({ userId: s.recruiter }, id)).toMatchObject({ kind: "completed", contract: { status: "completed" } });

    const notified = await t.db.notification.findMany({ where: { kind: "contract_update", payload: { path: ["contractId"], equals: id } }, select: { userId: true, payload: true } });
    expect(notified.map((n) => [n.userId === s.freelanceUser ? "freelance" : "entreprise", (n.payload as { status: string }).status]).sort()).toEqual([
      ["entreprise", "active"],
      ["freelance", "completed"],
      ["freelance", "to_sign"],
    ]);
  });

  it("refuse un contrat sans identité de facturation, et le cache aux tiers", async () => {
    const s = await setup(false);
    const quoteId = await acceptedQuote(s);
    expect(await contracts(t.db).createFromQuote({ userId: s.recruiter }, quoteId, { startsOn: "2026-11-02" })).toEqual({ kind: "seller_identity_missing" });
    await billing(t.db).setFreelanceIdentity({ userId: s.freelanceUser }, { legalName: "Camille Test EI", address: ADDRESS });
    // Sans SIRET, la facture ne serait pas valable : toujours pas de contrat.
    expect(await contracts(t.db).createFromQuote({ userId: s.recruiter }, quoteId, { startsOn: "2026-11-02" })).toEqual({ kind: "seller_identity_missing" });
    await billing(t.db).setFreelanceIdentity({ userId: s.freelanceUser }, { legalName: "Camille Test EI", siret: "55210055400025", address: ADDRESS });
    expect(await contracts(t.db).createFromQuote({ userId: s.recruiter }, quoteId, { startsOn: "2026-11-02" })).toEqual({ kind: "buyer_identity_missing" });
    await billing(t.db).setOrganisationIdentity({ userId: s.recruiter }, s.org, { legalName: "Acme SAS", address: ADDRESS });
    const created = await contracts(t.db).createFromQuote({ userId: s.freelanceUser }, quoteId, { startsOn: "2026-11-02" });
    expect(created.kind).toBe("created");

    const stranger = await createUser(t.db);
    const id = created.kind === "created" ? created.contract.id : "";
    expect(await contracts(t.db).find({ userId: stranger }, id)).toBeNull();
    expect(await contracts(t.db).sign({ userId: stranger }, id, new Date())).toBeNull();
    expect(await contracts(t.db).createFromQuote({ userId: stranger }, quoteId, { startsOn: "2026-11-02" })).toEqual({ kind: "absent" });
  });

  it("refuse un SIRET, un numéro de TVA ou des dates incohérents, et l'identité d'une entreprise par un simple membre", async () => {
    const s = await setup(false);
    await expect(billing(t.db).setFreelanceIdentity({ userId: s.freelanceUser }, { legalName: "X Y", siret: "123", address: ADDRESS })).rejects.toThrow(/SIRET/);
    await expect(billing(t.db).setFreelanceIdentity({ userId: s.freelanceUser }, { legalName: "X Y", vatNumber: "12", address: ADDRESS })).rejects.toThrow(/TVA/);
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: s.org, userId: member, role: "member" } });
    expect(await billing(t.db).setOrganisationIdentity({ userId: member }, s.org, { legalName: "Pirate SAS", address: ADDRESS })).toBe(false);
    const quoteId = await acceptedQuote(s);
    await expect(contracts(t.db).createFromQuote({ userId: s.recruiter }, quoteId, { startsOn: "2026-11-10", endsOn: "2026-11-01" })).rejects.toThrow(/fin précède/);
  });
});
