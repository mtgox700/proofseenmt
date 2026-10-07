import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing } from "../src/billing";
import { contracts } from "../src/contracts";
import { messaging } from "../src/messaging";
import { profiles } from "../src/profiles";
import { publicProfiles } from "../src/public-profiles";
import { quotes } from "../src/quotes";
import { VIGILANCE_THRESHOLD_CENTS, vigilance, vigilanceExpiresOn } from "../src/vigilance";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const DAY_MS = 86_400_000;
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

let drawn = 0;
const nextReference = (): string => `FR-VG${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[(drawn += 1) % 31]}ZQ`;

/** Un freelance publié avec identité de facturation, en relation acceptée avec une entreprise. */
const parties = async () => {
  const freelanceUser = await createUser(t.db);
  const created = await profiles(t.db).create({ userId: freelanceUser }, { headline: "Dev", summary: "Résumé.", city: "Paris", workMode: "remote", skills: ["Go"] }, nextReference);
  if (created === null) throw new Error("profil non créé");
  await profiles(t.db).setVisibility({ userId: freelanceUser }, "pseudonymous");
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { legalName: "Camille Test EI", siret: "55210055400025", vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", siret: "73282932000074", address: ADDRESS });
  const contact = await messaging(t.db).contact({ userId: recruiter }, org, created.id, "Bonjour, une mission ?");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", new Date());
  return { freelanceUser, recruiter, profile: created.id, reference: created.reference, conversation: contact.conversation.id };
};

const acceptedQuote = async (p: Awaited<ReturnType<typeof parties>>, dailyRateCents: number, days: number): Promise<string> => {
  const draft = await quotes(t.db).draft({ userId: p.freelanceUser }, p.conversation, { dailyRateCents, days });
  await quotes(t.db).send({ userId: p.freelanceUser }, draft?.id ?? "");
  const decided = await quotes(t.db).decide({ userId: p.recruiter }, draft?.id ?? "", "accepted");
  if (decided.kind !== "ok") throw new Error(decided.kind);
  return decided.quote.id;
};

describe("attestation de vigilance URSSAF", () => {
  it("expire six mois calendaires après sa délivrance", () => {
    expect(vigilanceExpiresOn(new Date("2026-08-31T00:00:00Z"))).toEqual(new Date("2027-03-03T00:00:00Z"));
    expect(vigilanceExpiresOn(new Date("2026-10-07T00:00:00Z"))).toEqual(new Date("2027-04-07T00:00:00Z"));
  });

  it("refuse une attestation future, échue, ou au code illisible", async () => {
    const p = await parties();
    const now = new Date();
    expect(await vigilance(t.db).declare({ userId: p.freelanceUser }, { issuedOn: isoDay(new Date(now.getTime() + 2 * DAY_MS)), securityCode: "ABCD1234EF" }, now)).toEqual({ kind: "future" });
    expect(await vigilance(t.db).declare({ userId: p.freelanceUser }, { issuedOn: isoDay(new Date(now.getTime() - 200 * DAY_MS)), securityCode: "ABCD1234EF" }, now)).toEqual({ kind: "expired" });
    await expect(vigilance(t.db).declare({ userId: p.freelanceUser }, { issuedOn: isoDay(now), securityCode: "<script>" }, now)).rejects.toThrow();
  });

  it(`exige une attestation en cours de validité pour un contrat d'au moins ${VIGILANCE_THRESHOLD_CENTS / 100} € HT, pas en dessous`, async () => {
    const p = await parties();
    expect(await contracts(t.db).createFromQuote({ userId: p.recruiter }, await acceptedQuote(p, 60_000, 10), { startsOn: "2026-12-01" })).toEqual({ kind: "vigilance_required" });

    const small = await parties();
    expect(await contracts(t.db).createFromQuote({ userId: small.recruiter }, await acceptedQuote(small, 40_000, 10), { startsOn: "2026-12-01" })).toMatchObject({ kind: "created" });

    const now = new Date();
    expect(await vigilance(t.db).declare({ userId: p.freelanceUser }, { issuedOn: isoDay(new Date(now.getTime() - 10 * DAY_MS)), securityCode: "abcd-1234 ef" }, now)).toMatchObject({ kind: "saved" });
    expect(await t.db.vigilanceAttestation.findUniqueOrThrow({ where: { profileId: p.profile }, select: { securityCode: true } })).toEqual({ securityCode: "ABCD1234EF" });
    // Le devis refusé reste accepté : le contrat se crée une fois l'attestation déclarée.
    const quoteId = (await t.db.quote.findFirstOrThrow({ where: { conversationId: p.conversation, status: "accepted" }, select: { id: true } })).id;
    expect(await contracts(t.db).createFromQuote({ userId: p.recruiter }, quoteId, { startsOn: "2026-12-01" })).toMatchObject({ kind: "created" });
  });

  it("ne montre l'attestation publiquement qu'une fois vérifiée par un opérateur", async () => {
    const p = await parties();
    const now = new Date();
    await vigilance(t.db).declare({ userId: p.freelanceUser }, { issuedOn: isoDay(now), securityCode: "ABCD1234EF" }, now);
    const slug = (await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: p.profile }, select: { slug: true } })).slug ?? "";
    expect((await publicProfiles(t.db).page(slug, now))?.facts.vigilanceValidUntil).toBeNull();
    expect(await vigilance(t.db).markVerified(p.reference, now)).toBe(true);
    expect((await publicProfiles(t.db).page(slug, now))?.facts.vigilanceValidUntil).toEqual(vigilanceExpiresOn(new Date(`${isoDay(now)}T00:00:00Z`)));
    // Une nouvelle déclaration repart non vérifiée.
    await vigilance(t.db).declare({ userId: p.freelanceUser }, { issuedOn: isoDay(now), securityCode: "ZZZZ9999" }, now);
    expect((await publicProfiles(t.db).page(slug, now))?.facts.vigilanceValidUntil).toBeNull();
  });

  it("rappelle une fois, trente jours avant l'échéance", async () => {
    const p = await parties();
    const issued = new Date("2026-05-01T00:00:00Z");
    await t.db.vigilanceAttestation.create({ data: { profileId: p.profile, issuedOn: issued, securityCode: "ABCD1234EF" } });
    const before = new Date(vigilanceExpiresOn(issued).getTime() - 40 * DAY_MS);
    const within = new Date(vigilanceExpiresOn(issued).getTime() - 20 * DAY_MS);
    const mine = () => t.db.notification.count({ where: { userId: p.freelanceUser, kind: "vigilance_expiring" } });
    await vigilance(t.db).remindExpiring(before);
    expect(await mine()).toBe(0);
    await vigilance(t.db).remindExpiring(within);
    await vigilance(t.db).remindExpiring(within);
    expect(await mine()).toBe(1);
  });
});
