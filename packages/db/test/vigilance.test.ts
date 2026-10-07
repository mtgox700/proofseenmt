import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing } from "../src/billing";
import { VIGILANCE_THRESHOLD_BY_CURRENCY } from "../src/contract-checks";
import { contracts } from "../src/contracts";
import { messaging } from "../src/messaging";
import { profiles } from "../src/profiles";
import { publicProfiles } from "../src/public-profiles";
import { quotes } from "../src/quotes";
import { vigilance, vigilanceExpiresOn } from "../src/vigilance";
import { createOrganisation, createUser, DB_STARTUP_MS, nextSiret, openTestDatabase, type TestDatabase } from "./support/database";

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
const EUR_THRESHOLD = VIGILANCE_THRESHOLD_BY_CURRENCY.EUR ?? 500_000;

let drawn = 0;
const nextReference = (): string => `FR-VG${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[(drawn += 1) % 31]}ZQ`;

/** Un freelance publié avec identité de facturation, en relation acceptée avec une entreprise. */
const parties = async () => {
  const freelanceUser = await createUser(t.db);
  const created = await profiles(t.db).create({ userId: freelanceUser }, { headline: "Dev", summary: "Résumé.", city: "Paris", workMode: "remote", skills: ["Go"] }, nextReference);
  if (created === null) throw new Error("profil non créé");
  await profiles(t.db).setVisibility({ userId: freelanceUser }, "pseudonymous");
  await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", siret: nextSiret("732829320"), address: ADDRESS });
  const contact = await messaging(t.db).contact({ userId: recruiter }, org, created.id, "Bonjour, une mission ?");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", new Date());
  return { freelanceUser, recruiter, profile: created.id, reference: created.reference, conversation: contact.conversation.id };
};

type Parties = Awaited<ReturnType<typeof parties>>;

const acceptedQuote = async (p: Parties, dailyRateCents: number, days: number): Promise<string> => {
  const draft = await quotes(t.db).draft({ userId: p.freelanceUser }, p.conversation, { dailyRateCents, days });
  await quotes(t.db).send({ userId: p.freelanceUser }, draft?.id ?? "");
  const decided = await quotes(t.db).decide({ userId: p.recruiter }, draft?.id ?? "", "accepted");
  if (decided.kind !== "ok") throw new Error(decided.kind);
  return decided.quote.id;
};

/** Déclarée il y a dix jours, puis vérifiée par un opérateur avec le code contrôlé. */
const declaredAndVerified = async (p: Parties, now = new Date()): Promise<void> => {
  await vigilance(t.db).declare({ userId: p.freelanceUser }, { issuedOn: isoDay(new Date(now.getTime() - 10 * DAY_MS)), securityCode: "ABCD1234EF" }, now);
  expect(await vigilance(t.db).markVerified(p.reference, "ABCD1234EF", now)).toBe(true);
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

  it(`exige une attestation vérifiée pour un contrat d'au moins ${EUR_THRESHOLD / 100} € HT ; une simple déclaration ne suffit pas`, async () => {
    const p = await parties();
    const quote = await acceptedQuote(p, 60_000, 10);
    expect(await contracts(t.db).createFromQuote({ userId: p.recruiter }, quote, { startsOn: "2026-12-01" })).toEqual({ kind: "vigilance_required" });
    const now = new Date();
    await vigilance(t.db).declare({ userId: p.freelanceUser }, { issuedOn: isoDay(new Date(now.getTime() - 10 * DAY_MS)), securityCode: "abcd-1234 ef" }, now);
    expect(await contracts(t.db).createFromQuote({ userId: p.recruiter }, quote, { startsOn: "2026-12-01" })).toEqual({ kind: "vigilance_required" });
    expect(await vigilance(t.db).markVerified(p.reference, "ABCD1234EF", now)).toBe(true);
    expect(await contracts(t.db).createFromQuote({ userId: p.recruiter }, quote, { startsOn: "2026-12-01" })).toMatchObject({ kind: "created" });

    const small = await parties();
    expect(await contracts(t.db).createFromQuote({ userId: small.recruiter }, await acceptedQuote(small, 40_000, 10), { startsOn: "2026-12-01" })).toMatchObject({ kind: "created" });
  });

  it("additionne les contrats des six derniers mois : découper une mission ne contourne pas le seuil", async () => {
    const SNAPSHOT = { legalName: "Test", country: "FR" };
    const earlier = async (p: Parties, status: "active" | "cancelled") => {
      const org = (await t.db.conversation.findUniqueOrThrow({ where: { id: p.conversation }, select: { organisationId: true } })).organisationId;
      await t.db.contract.create({
        data: { organisationId: org, profileId: p.profile, dailyRateCents: 50_000, days: 5, totalCents: 250_000, currency: "EUR", sellerSnapshot: SNAPSHOT, buyerSnapshot: SNAPSHOT, startsOn: new Date(), status, ...(status === "active" ? { acceptedByFreelanceAt: new Date(), acceptedByOrgAt: new Date() } : {}) },
      });
    };
    // Une première mission de 2 500 € en cours : la suivante, de 2 500 €, atteint le seuil.
    const split = await parties();
    await earlier(split, "active");
    expect(await contracts(t.db).createFromQuote({ userId: split.recruiter }, await acceptedQuote(split, 50_000, 5), { startsOn: "2026-12-01" })).toEqual({ kind: "vigilance_required" });
    // Une mission annulée ne compte pas.
    const cancelled = await parties();
    await earlier(cancelled, "cancelled");
    expect(await contracts(t.db).createFromQuote({ userId: cancelled.recruiter }, await acceptedQuote(cancelled, 50_000, 5), { startsOn: "2026-12-01" })).toMatchObject({ kind: "created" });
  });

  it("refait le contrôle à la signature : une attestation échue entre-temps bloque la signature", async () => {
    const p = await parties();
    await declaredAndVerified(p);
    const created = await contracts(t.db).createFromQuote({ userId: p.recruiter }, await acceptedQuote(p, 60_000, 10), { startsOn: "2026-12-01" });
    if (created.kind !== "created") throw new Error(created.kind);
    const sevenMonthsLater = new Date(Date.now() + 214 * DAY_MS);
    expect(await contracts(t.db).sign({ userId: p.freelanceUser }, created.contract.id, sevenMonthsLater)).toEqual({ kind: "vigilance_required" });
    expect(await contracts(t.db).sign({ userId: p.freelanceUser }, created.contract.id, new Date())).toMatchObject({ kind: "signed" });
  });

  it("ne marque vérifiée que l'attestation dont le code a été contrôlé, et ne l'affiche qu'alors", async () => {
    const p = await parties();
    const now = new Date();
    await vigilance(t.db).declare({ userId: p.freelanceUser }, { issuedOn: isoDay(now), securityCode: "ABCD1234EF" }, now);
    const slug = (await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: p.profile }, select: { slug: true } })).slug ?? "";
    expect((await publicProfiles(t.db).page(slug, now))?.facts.vigilanceValidUntil).toBeNull();
    // Redéclarée entre le contrôle et le marquage : l'ancien code ne marque pas la nouvelle.
    await vigilance(t.db).declare({ userId: p.freelanceUser }, { issuedOn: isoDay(now), securityCode: "ZZZZ9999" }, now);
    expect(await vigilance(t.db).markVerified(p.reference, "ABCD1234EF", now)).toBe(false);
    expect(await vigilance(t.db).markVerified(p.reference, "zzzz-9999", now)).toBe(true);
    expect((await publicProfiles(t.db).page(slug, now))?.facts.vigilanceValidUntil).toEqual(vigilanceExpiresOn(new Date(`${isoDay(now)}T00:00:00Z`)));
    expect(await vigilance(t.db).forReference(p.reference)).toMatchObject({ legalName: "Camille Test EI", siret: expect.stringMatching(/^552100554\d{5}$/) });
  });

  it("rappelle une fois, trente jours avant l'échéance, jamais une attestation déjà échue", async () => {
    const p = await parties();
    const issued = new Date("2026-05-01T00:00:00Z");
    await t.db.vigilanceAttestation.create({ data: { profileId: p.profile, issuedOn: issued, securityCode: "ABCD1234EF" } });
    const expiry = vigilanceExpiresOn(issued).getTime();
    const mine = () => t.db.notification.count({ where: { userId: p.freelanceUser, kind: "vigilance_expiring" } });
    await vigilance(t.db).remindExpiring(new Date(expiry - 40 * DAY_MS));
    expect(await mine()).toBe(0);
    await vigilance(t.db).remindExpiring(new Date(expiry - 20 * DAY_MS));
    await vigilance(t.db).remindExpiring(new Date(expiry - 19 * DAY_MS));
    expect(await mine()).toBe(1);

    const late = await parties();
    await t.db.vigilanceAttestation.create({ data: { profileId: late.profile, issuedOn: issued, securityCode: "ABCD1234EF" } });
    await vigilance(t.db).remindExpiring(new Date(expiry + 5 * DAY_MS));
    expect(await t.db.notification.count({ where: { userId: late.freelanceUser, kind: "vigilance_expiring" } })).toBe(0);
  });
});
