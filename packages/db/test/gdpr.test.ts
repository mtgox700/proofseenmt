import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditRequests } from "../src/audit-requests";
import { gdpr } from "../src/gdpr";
import { messaging } from "../src/messaging";
import { missions } from "../src/missions";
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
  await t.db.payment.create({ data: { contractId: contract.id, amountCents: 600000, commissionCents: 60000, currency: "EUR", stripeIntentId: `pi_${contract.id}`, status: "released", transferId: `tr_${contract.id}`, releasedAt: new Date() } });
  await t.db.invoice.create({
    data: { number: `2026-${contract.id}`, kind: "commission", issuer: "proofseen", label: "Commission", dueOn: new Date("2099-01-01"), contractId: contract.id, netCents: 600000, vatCents: 120000, vatRateBp: 2000, totalCents: 720000, currency: "EUR", sellerSnapshot: SNAPSHOT, buyerSnapshot: SNAPSHOT },
  });
  await t.db.review.create({ data: { contractId: contract.id, authorUserId: recruiter, targetProfileId: profile, rating: 5, body: "Très bien" } });
  return { recruiter, freelance, org, profile, email, contract: contract.id, conversation: conv.id };
};

type Seeded = Awaited<ReturnType<typeof seed>>;

const openContract = async (s: Seeded, status: "pending_signatures" | "active"): Promise<string> => {
  const accepted = status === "active" ? { acceptedByFreelanceAt: new Date(), acceptedByOrgAt: new Date() } : {};
  const { id } = await t.db.contract.create({
    data: {
      organisationId: s.org, profileId: s.profile, dailyRateCents: 50000, days: 2, totalCents: 100000, currency: "EUR",
      sellerSnapshot: SNAPSHOT, buyerSnapshot: SNAPSHOT, startsOn: new Date("2026-12-01"), status, ...accepted,
    },
    select: { id: true },
  });
  return id;
};

describe("RGPD", () => {
  it("exporte tout ce que la base tient sur un freelance, et dit ce qui restera", async () => {
    const s = await seed();
    const exported = await gdpr(t.db).exportUser(s.freelance, new Date("2026-10-05T12:00:00Z"));
    expect(exported).not.toBeNull();
    expect(exported?.exportedAt).toBe("2026-10-05T12:00:00.000Z");
    expect(JSON.stringify(exported)).toContain(s.email);
    expect(exported?.messagesSent).toHaveLength(1);
    expect(exported?.contracts).toMatchObject({ asFreelance: [{ sellerSnapshot: SNAPSHOT }], asCompany: [] });
    expect(exported?.auditRequests).toHaveLength(1);
    expect(exported?.retainedAfterErasure.length).toBeGreaterThan(0);
    // L'export est sérialisable tel quel : c'est ce qui est remis à la personne.
    expect(() => JSON.parse(JSON.stringify(exported))).not.toThrow();
  });

  it("efface le freelance sans perdre la comptabilité ni la correspondance de l'entreprise", async () => {
    const s = await seed();
    expect(await gdpr(t.db).eraseUser(s.freelance)).toBe("erased");

    expect(await t.db.user.count({ where: { id: s.freelance } })).toBe(0);
    expect(await t.db.freelanceProfile.count({ where: { id: s.profile } })).toBe(0);
    expect(await t.db.auditRequest.count({ where: { email: s.email } })).toBe(0);
    // Le fil était celui du freelance : il part avec son profil.
    expect(await t.db.conversation.count({ where: { id: s.conversation } })).toBe(0);
    expect(await t.db.review.count({ where: { contractId: s.contract } })).toBe(0);

    const kept = await t.db.contract.findUniqueOrThrow({ where: { id: s.contract }, select: { profileId: true, sellerSnapshot: true, _count: { select: { payments: true, invoices: true } } } });
    expect(kept).toEqual({ profileId: null, sellerSnapshot: SNAPSHOT, _count: { payments: 1, invoices: 1 } });

    expect(await gdpr(t.db).exportUser(s.freelance, new Date())).toBeNull();
    expect(await gdpr(t.db).eraseUser(s.freelance)).toBe("absent");
  });

  it("n'exporte pas à un membre d'entreprise l'identité légale des freelances", async () => {
    const s = await seed();
    const exported = await gdpr(t.db).exportUser(s.recruiter, new Date());
    expect(exported?.contracts).toMatchObject({ asFreelance: [], asCompany: [{ id: s.contract, buyerSnapshot: SNAPSHOT }] });
    expect(JSON.stringify((exported?.contracts as { asCompany: unknown[] }).asCompany)).not.toContain("sellerSnapshot");
  });

  it("le dernier membre qui part ferme les missions encore ouvertes de son entreprise", async () => {
    const s = await seed();
    const mission = await missions(t.db).create({ userId: s.recruiter }, s.org, { title: "Data engineer", description: "Pipeline Spark.", workMode: "remote", skills: ["Spark"] });
    if (mission === null) throw new Error("mission non créée");
    await missions(t.db).publish({ userId: s.recruiter }, mission.id, new Date());
    expect(await gdpr(t.db).eraseUser(s.recruiter)).toBe("erased");
    expect(await t.db.jobPost.findUniqueOrThrow({ where: { id: mission.id }, select: { status: true } })).toEqual({ status: "closed" });
  });

  it("deux derniers membres qui s'effacent en même temps : l'un attend l'autre, l'entreprise n'est jamais abandonnée en plein contrat", async () => {
    const s = await seed();
    const colleague = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: s.org, userId: colleague, role: "admin" } });
    await openContract(s, "active");
    const results = await Promise.all([gdpr(t.db).eraseUser(s.recruiter), gdpr(t.db).eraseUser(colleague)]);
    expect([...results].sort()).toEqual(["erased", "in_progress"]);
    expect(await t.db.membership.count({ where: { organisationId: s.org } })).toBe(1);
  });

  it("efface un recruteur : ses messages restent à l'autre partie, sans auteur", async () => {
    const s = await seed();
    expect(await gdpr(t.db).eraseUser(s.recruiter)).toBe("erased");
    const messages = await t.db.message.findMany({ where: { conversationId: s.conversation }, select: { senderUserId: true, body: true } });
    expect(messages).toHaveLength(2);
    expect(messages.filter((m) => m.senderUserId === null)).toHaveLength(1);
    expect(await t.db.review.findUniqueOrThrow({ where: { contractId: s.contract }, select: { authorUserId: true } })).toEqual({ authorUserId: null });
  });

  /*
   * Effacer une partie pendant un contrat en cours casserait l'autre : un freelance effacé perd son compte de versement
   * (les fonds bloqués ne pourraient plus lui être versés), une entreprise sans plus aucun membre ne peut plus valider.
   */
  it("refuse d'effacer tant qu'un contrat est en cours, côté freelance comme côté dernier membre de l'entreprise", async () => {
    const s = await seed();
    const pending = await openContract(s, "pending_signatures");
    expect(await gdpr(t.db).eraseUser(s.freelance)).toBe("in_progress");
    expect(await gdpr(t.db).eraseUser(s.recruiter)).toBe("in_progress");
    expect(await t.db.user.count({ where: { id: { in: [s.freelance, s.recruiter] } } })).toBe(2);

    await t.db.contract.update({ where: { id: pending }, data: { status: "cancelled" } });
    expect(await gdpr(t.db).eraseUser(s.freelance)).toBe("erased");
  });

  it("refuse d'effacer tant qu'un paiement n'est ni versé ni remboursé, même sur un contrat terminé", async () => {
    const s = await seed();
    const contract = await openContract(s, "active");
    const payment = await t.db.payment.create({ data: { contractId: contract, amountCents: 100000, commissionCents: 10000, currency: "EUR", stripeIntentId: `pi_${contract}` }, select: { id: true } });
    await t.db.payment.update({ where: { id: payment.id }, data: { status: "held" } });
    await t.db.contract.update({ where: { id: contract }, data: { status: "completed" } });
    expect(await gdpr(t.db).eraseUser(s.freelance)).toBe("in_progress");
    expect(await gdpr(t.db).eraseUser(s.recruiter)).toBe("in_progress");
  });

  it("un recruteur peut partir si un autre membre reste pour suivre les contrats", async () => {
    const s = await seed();
    await openContract(s, "active");
    const colleague = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: s.org, userId: colleague, role: "admin" } });
    expect(await gdpr(t.db).eraseUser(s.recruiter)).toBe("erased");
  });

  it("répond « inconnu » à un identifiant mal formé", async () => {
    expect(await gdpr(t.db).exportUser("../../x", new Date())).toBeNull();
    expect(await gdpr(t.db).eraseUser("not-a-uuid")).toBe("absent");
  });
});
