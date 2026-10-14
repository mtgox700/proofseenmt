import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing, type LegalSnapshot } from "../src/billing";
import { contracts } from "../src/contracts";
import { gdpr } from "../src/gdpr";
import { messaging } from "../src/messaging";
import { confirmationMail } from "../src/mission-confirmation-mail";
import { missionConfirmations } from "../src/mission-confirmations";
import { payments } from "../src/payments";
import { quotes } from "../src/quotes";
import { retention } from "../src/retention";
import { monthsBetween, recordPaidMission, verifiedMissions } from "../src/verified-missions";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, fakeGateway, nextSiret, openTestDatabase, payAndHold, verifiedVigilance, type TestDatabase } from "./support/database";

/*
 * Les deux autres bouts du parcours : l'e-mail au contact (file d'envoi sous bail), la mission née d'un contrat payé
 * sur la plateforme (une seule fois, quoi qu'on rejoue), et ce que deviennent les demandes avec le temps et le RGPD.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const DAY_MS = 86_400_000;
const NOW = new Date("2026-11-20T10:00:00Z");
const later = (days: number): Date => new Date(NOW.getTime() + days * DAY_MS);
const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const PROOFSEEN: LegalSnapshot = { legalName: "Proofseen (test)", siret: "12345678900011", vatNumber: "FR12123456789", address: ADDRESS, vatRateBp: 2000 };

const link = () => ({ id: randomUUID(), token: randomBytes(32).toString("base64url") });

const INPUT = {
  role: "Architecte cloud",
  clientName: "Client Démo",
  clientKind: "pme",
  startedOn: "2025-03",
  endedOn: "2025-04",
  summary: "Refonte de l'infrastructure sur Kubernetes.",
} as const;

let contactSeq = 0;
const requested = async (contactEmail = `achats${(contactSeq += 1)}@client-demo.fr`) => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId);
  const l = link();
  const result = await missionConfirmations(t.db).request({ userId }, { ...INPUT, contactEmail }, l, "en", NOW);
  if (result.kind !== "requested") throw new Error(result.kind);
  return { userId, profileId, contactEmail, ...l };
};

describe("la durée d'une mission", () => {
  it("compte les mois couverts, bornes comprises, jamais moins d'un", () => {
    expect(monthsBetween(new Date("2025-01-01"), new Date("2025-03-01"))).toBe(3);
    expect(monthsBetween(new Date("2025-01-15"), new Date("2025-01-20"))).toBe(1);
    expect(monthsBetween(new Date("2024-11-01"), new Date("2025-02-01"))).toBe(4);
  });
});

describe("l'e-mail au contact du client", () => {
  it("part une fois, sous bail, dans la langue choisie, et plus jamais une fois envoyé", async () => {
    const r = await requested();
    const mail = confirmationMail(t.db);
    const batch = await mail.claim(50, NOW);
    const mine = batch.find((m) => m.id === r.id);
    expect(mine).toMatchObject({ to: r.contactEmail, lang: "en", role: "Architecte cloud", clientName: "Client Démo", attempts: 0 });
    // Pris en charge : un second passage pendant le bail ne le reprend pas.
    expect((await mail.claim(50, NOW)).some((m) => m.id === r.id)).toBe(false);
    await mail.markFailed(r.id, 0, NOW);
    expect((await mail.claim(50, new Date(NOW.getTime() + 61_000))).some((m) => m.id === r.id)).toBe(true);
    await mail.markSent(r.id, NOW);
    expect((await mail.claim(50, later(1))).some((m) => m.id === r.id)).toBe(false);
  });

  it("ne part pas pour une demande retirée ou déjà décidée", async () => {
    const withdrawn = await requested();
    const decided = await requested();
    await missionConfirmations(t.db).withdraw({ userId: withdrawn.userId }, withdrawn.id);
    await missionConfirmations(t.db).decideByToken(decided.id, decided.token, { confirm: false, showClientName: false }, NOW);
    const ids = (await confirmationMail(t.db).claim(50, later(1))).map((m) => m.id);
    expect(ids).not.toContain(withdrawn.id);
    expect(ids).not.toContain(decided.id);
  });
});

/** Un contrat actif de 10 jours, signé par les deux parties, au freelance prêt à recevoir des versements. */
const activeContract = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  await verifiedVigilance(t.db, profile);
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", address: ADDRESS });
  await t.db.billingIdentity.update({ where: { profileId: profile }, data: { stripeAccountId: `acct_test${Math.random().toString(36).slice(2, 10)}`, payoutsEnabledAt: NOW } });
  const contact = await messaging(t.db).contact({ userId: recruiter }, org, profile, "Bonjour");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", NOW);
  const draft = await quotes(t.db).draft({ userId: freelanceUser }, contact.conversation.id, { dailyRateCents: 60_000, days: 10 });
  await quotes(t.db).send({ userId: freelanceUser }, draft?.id ?? "");
  await quotes(t.db).decide({ userId: recruiter }, draft?.id ?? "", "accepted");
  const created = await contracts(t.db).createFromQuote({ userId: recruiter }, draft?.id ?? "", { startsOn: "2026-10-05", endsOn: "2026-11-13" });
  if (created.kind !== "created") throw new Error(created.kind);
  await contracts(t.db).sign({ userId: recruiter }, created.contract.id, NOW);
  await contracts(t.db).sign({ userId: freelanceUser }, created.contract.id, NOW);
  return { id: created.contract.id, recruiter, freelanceUser, profile };
};

describe("la mission d'un contrat payé sur Proofseen", () => {
  it("naît au versement, une seule fois même si le versement est rejoué, sans nommer le client", async () => {
    const c = await activeContract();
    const { gateway } = fakeGateway();
    await payAndHold(t.db, c.recruiter, c.id, gateway);
    // Fonds bloqués, prestation pas encore validée : rien.
    expect(await recordPaidMission(t.db, c.id, NOW)).toBe(false);
    expect((await contracts(t.db).complete({ userId: c.recruiter }, c.id)).kind).toBe("completed");
    expect(await t.db.verifiedMission.count({ where: { contractId: c.id } })).toBe(0);
    expect((await payments(t.db).release(c.id, gateway, PROOFSEEN, NOW)).kind).toBe("released");
    expect((await payments(t.db).release(c.id, gateway, PROOFSEEN, later(1))).kind).toBe("released");
    expect(await recordPaidMission(t.db, c.id, later(2))).toBe(true);
    const missions = await t.db.verifiedMission.findMany({ where: { profileId: c.profile } });
    expect(missions).toHaveLength(1);
    expect(missions[0]).toMatchObject({ evidenceKind: "paid_on_platform", contractId: c.id, clientKind: "pme", durationMonths: 2, verifiedAt: NOW, clientName: null, summary: "", role: "Dev" });
    expect(await verifiedMissions(t.db).listMine({ userId: c.freelanceUser })).toMatchObject([{ evidenceKind: "paid_on_platform" }]);
    expect(await verifiedMissions(t.db).listMine({ userId: c.recruiter })).toEqual([]);
  });
});

describe("conservation et RGPD", () => {
  it("purge les demandes décidées ou échues 90 jours après, et garde la mission confirmée", async () => {
    const confirmed = await requested();
    await missionConfirmations(t.db).decideByToken(confirmed.id, confirmed.token, { confirm: true, showClientName: false }, NOW);
    const stale = await requested();
    const fresh = await requested();
    await retention(t.db).purge(later(89));
    expect(await t.db.missionConfirmationRequest.count({ where: { id: { in: [confirmed.id, stale.id, fresh.id] } } })).toBe(3);
    const report = await retention(t.db).purge(later(121));
    expect(report.missionConfirmations).toBeGreaterThanOrEqual(3);
    expect(await t.db.missionConfirmationRequest.count({ where: { id: { in: [confirmed.id, stale.id, fresh.id] } } })).toBe(0);
    const mission = await t.db.verifiedMission.findFirstOrThrow({ where: { profileId: confirmed.profileId } });
    expect(mission).toMatchObject({ evidenceKind: "client_confirmation", confirmationId: null });
  });

  it("exporte les demandes sans l'empreinte du jeton, et les efface avec le compte", async () => {
    const r = await requested();
    await missionConfirmations(t.db).decideByToken(r.id, r.token, { confirm: true, showClientName: true }, NOW);
    const exported = await gdpr(t.db).exportUser(r.userId, NOW);
    const text = JSON.stringify(exported);
    expect(text).toContain(r.contactEmail);
    expect(text).toContain("client_confirmation");
    expect(text).not.toContain("tokenHash");
    expect(await gdpr(t.db).eraseUser(r.userId)).toBe("erased");
    expect(await t.db.missionConfirmationRequest.count({ where: { profileId: r.profileId } })).toBe(0);
    expect(await t.db.verifiedMission.count({ where: { profileId: r.profileId } })).toBe(0);
  });

  it("efface les demandes adressées à l'adresse d'un compte qui s'efface", async () => {
    const r = await requested("achats@client-demo.fr");
    const contact = await t.db.user.create({ data: { clerkId: `clerk_contact_${r.id}`, email: "achats@client-demo.fr", displayName: "Achats" }, select: { id: true } });
    const exported = await gdpr(t.db).exportUser(contact.id, NOW);
    expect(JSON.stringify(exported?.missionConfirmations)).toContain("Architecte cloud");
    expect(await gdpr(t.db).eraseUser(contact.id)).toBe("erased");
    expect(await t.db.missionConfirmationRequest.count({ where: { contactEmail: "achats@client-demo.fr" } })).toBe(0);
  });
});
