import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditRequests } from "../src/audit-requests";
import { gdpr } from "../src/gdpr";
import { messaging } from "../src/messaging";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const SNAPSHOT = { legalName: "Test", country: "FR" };

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
let drawn = 0;
const nextReference = (): string => {
  drawn += 1;
  return `FR-GD${ALPHABET[drawn % ALPHABET.length]}${ALPHABET[Math.floor(drawn / ALPHABET.length) % ALPHABET.length]}Z`;
};

/** Un freelance avec un fil, un contrat terminé payé et facturé, un avis, et une demande d'audit à la même adresse. */
const seed = async () => {
  const recruiter = await createUser(t.db);
  const freelance = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const profile = await createProfile(t.db, freelance);
  const { email } = await t.db.user.findUniqueOrThrow({ where: { id: freelance }, select: { email: true } });
  await auditRequests(t.db).open({ displayName: "Free Lance", email, urls: ["https://free.dev"], lang: "fr", consentAt: new Date() }, nextReference);

  const contact = await messaging(t.db).contact({ userId: recruiter }, org, profile, "Bonjour, êtes-vous disponible ?");
  if (contact.kind !== "opened") throw new Error("fil non ouvert");
  const conv = contact.conversation;
  await messaging(t.db).post({ userId: freelance }, conv.id, "Bonjour, je suis disponible.");

  const contract = await t.db.contract.create({
    data: {
      organisationId: org, profileId: profile, dailyRateCents: 60000, days: 10, totalCents: 600000, currency: "EUR",
      sellerSnapshot: SNAPSHOT, buyerSnapshot: SNAPSHOT, startsOn: new Date("2026-11-01"),
      acceptedByFreelanceAt: new Date(), acceptedByOrgAt: new Date(), status: "completed",
    },
    select: { id: true },
  });
  await t.db.payment.create({ data: { contractId: contract.id, amountCents: 600000, commissionCents: 60000, currency: "EUR", stripeIntentId: `pi_${contract.id}`, status: "released" } });
  await t.db.invoice.create({
    data: { number: `2026-${contract.id}`, contractId: contract.id, netCents: 600000, vatCents: 120000, vatRateBp: 2000, totalCents: 720000, currency: "EUR", sellerSnapshot: SNAPSHOT, buyerSnapshot: SNAPSHOT },
  });
  await t.db.review.create({ data: { contractId: contract.id, authorUserId: recruiter, targetProfileId: profile, rating: 5, body: "Très bien" } });
  return { recruiter, freelance, org, profile, email, contract: contract.id, conversation: conv.id };
};

describe("RGPD", () => {
  it("exporte tout ce que la base tient sur un freelance, et dit ce qui restera", async () => {
    const s = await seed();
    const exported = await gdpr(t.db).exportUser(s.freelance, new Date("2026-10-05T12:00:00Z"));
    expect(exported).not.toBeNull();
    expect(exported?.exportedAt).toBe("2026-10-05T12:00:00.000Z");
    expect(JSON.stringify(exported)).toContain(s.email);
    expect(exported?.messagesSent).toHaveLength(1);
    expect(exported?.contracts).toHaveLength(1);
    expect(exported?.auditRequests).toHaveLength(1);
    expect(exported?.retainedAfterErasure.length).toBeGreaterThan(0);
    // L'export est sérialisable tel quel : c'est ce qui est remis à la personne.
    expect(() => JSON.parse(JSON.stringify(exported))).not.toThrow();
  });

  it("efface le freelance sans perdre la comptabilité ni la correspondance de l'entreprise", async () => {
    const s = await seed();
    expect(await gdpr(t.db).eraseUser(s.freelance)).toBe(true);

    expect(await t.db.user.count({ where: { id: s.freelance } })).toBe(0);
    expect(await t.db.freelanceProfile.count({ where: { id: s.profile } })).toBe(0);
    expect(await t.db.auditRequest.count({ where: { email: s.email } })).toBe(0);
    // Le fil était celui du freelance : il part avec son profil.
    expect(await t.db.conversation.count({ where: { id: s.conversation } })).toBe(0);
    expect(await t.db.review.count({ where: { contractId: s.contract } })).toBe(0);

    const kept = await t.db.contract.findUniqueOrThrow({ where: { id: s.contract }, select: { profileId: true, sellerSnapshot: true, _count: { select: { payments: true, invoices: true } } } });
    expect(kept).toEqual({ profileId: null, sellerSnapshot: SNAPSHOT, _count: { payments: 1, invoices: 1 } });

    expect(await gdpr(t.db).exportUser(s.freelance, new Date())).toBeNull();
    expect(await gdpr(t.db).eraseUser(s.freelance)).toBe(false);
  });

  it("efface un recruteur : ses messages restent à l'autre partie, sans auteur", async () => {
    const s = await seed();
    expect(await gdpr(t.db).eraseUser(s.recruiter)).toBe(true);
    const messages = await t.db.message.findMany({ where: { conversationId: s.conversation }, select: { senderUserId: true, body: true } });
    expect(messages).toHaveLength(2);
    expect(messages.filter((m) => m.senderUserId === null)).toHaveLength(1);
    expect(await t.db.review.findUniqueOrThrow({ where: { contractId: s.contract }, select: { authorUserId: true } })).toEqual({ authorUserId: null });
  });

  it("répond « inconnu » à un identifiant mal formé", async () => {
    expect(await gdpr(t.db).exportUser("../../x", new Date())).toBeNull();
    expect(await gdpr(t.db).eraseUser("not-a-uuid")).toBe(false);
  });
});
