import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profiles } from "../src/profiles";
import { publicProfiles } from "../src/public-profiles";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

let drawn = 0;
const nextReference = (): string => `FR-PP${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[(drawn += 1) % 31]}ZQ`;

const published = async (visibility: "named" | "pseudonymous") => {
  const userId = await createUser(t.db);
  const profile = await profiles(t.db).create({ userId }, { headline: "Dev Rust", summary: "Embarqué.", city: "Lyon", workMode: "remote", skills: ["Rust"] }, nextReference);
  await t.db.ownedUrl.create({ data: { profileId: profile?.id ?? "", url: `https://p${drawn}.dev`, urlKey: `https://p${drawn}.dev`, proofMethod: "dns_txt", verifiedAt: new Date() } });
  const result = await profiles(t.db).setVisibility({ userId }, visibility);
  if (result.kind !== "ok" || result.profile.slug === null) throw new Error(result.kind);
  return { userId, slug: result.profile.slug };
};

describe("page publique d'un profil, depuis la base", () => {
  it("cache le nom et les adresses d'un profil pseudonyme, garde le nombre de preuves", async () => {
    const p = await published("pseudonymous");
    const page = await publicProfiles(t.db).page(p.slug);
    expect(page).toMatchObject({ visibility: "pseudonymous", displayName: null, provenUrls: [], provenUrlCount: 1, skills: ["Rust"] });
    // La trace de la preuve reste publique (méthode, date), jamais l'adresse.
    expect(page?.provenAddresses).toHaveLength(1);
    expect(page?.provenAddresses[0]).toMatchObject({ url: null, method: "dns_txt", checkedAt: null });
    expect(page?.provenAddresses[0]?.verifiedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(page)).not.toContain(".dev");
  });

  it("lit les faits vérifiés : répertoire, identité, missions payées — une mission remboursée ne compte pas", async () => {
    const p = await published("pseudonymous");
    expect((await publicProfiles(t.db).page(p.slug))?.facts).toEqual({ registryActiveCheckedAt: null, identityVerified: false, identityVerifiedAt: null, payingClients: 0, vigilanceValidUntil: null, vigilanceVerifiedAt: null });

    const { id: profileId } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { userId: p.userId }, select: { id: true } });
    const checkedAt = new Date("2026-10-05T00:00:00Z");
    await t.db.billingIdentity.create({
      data: { profileId, legalName: "Test EI", siret: "55210055400025", address: { line1: "1 rue", postalCode: "75001", city: "Paris", country: "FR" }, registryStatus: "active", registryCheckedAt: checkedAt, payoutsEnabledAt: checkedAt },
    });
    const owner = await createUser(t.db);
    const { id: organisationId } = await t.db.organisation.create({ data: { name: "Acme", kind: "pme", members: { create: { userId: owner, role: "owner" } } }, select: { id: true } });
    const snapshot = { legalName: "Test", country: "FR" };
    for (const refundedCents of [0, 100_000]) {
      const { id: contractId } = await t.db.contract.create({
        data: { organisationId, profileId, dailyRateCents: 50_000, days: 2, totalCents: 100_000, currency: "EUR", sellerSnapshot: snapshot, buyerSnapshot: snapshot, startsOn: checkedAt, status: "completed", acceptedByFreelanceAt: checkedAt, acceptedByOrgAt: checkedAt },
        select: { id: true },
      });
      await t.db.payment.create({ data: { contractId, amountCents: 100_000, commissionCents: 10_000, refundedCents, currency: "EUR", stripeIntentId: `pi_${contractId}`, status: "released", transferId: `tr_${contractId}`, releasedAt: checkedAt } });
    }
    expect((await publicProfiles(t.db).page(p.slug))?.facts).toEqual({ registryActiveCheckedAt: checkedAt, identityVerified: true, identityVerifiedAt: checkedAt, payingClients: 1, vigilanceValidUntil: null, vigilanceVerifiedAt: null });

    await t.db.billingIdentity.update({ where: { profileId }, data: { registryStatus: "ceased" } });
    expect((await publicProfiles(t.db).page(p.slug))?.facts.registryActiveCheckedAt).toBeNull();
  });

  it("montre nom et adresses prouvées d'un profil nominatif", async () => {
    const p = await published("named");
    const page = await publicProfiles(t.db).page(p.slug);
    expect(page?.displayName).toMatch(/^User \d+$/);
    expect(page?.provenUrls).toHaveLength(1);
    expect(page?.provenAddresses[0]).toMatchObject({ url: page?.provenUrls[0], method: "dns_txt" });
  });

  it("ne sert aucune page pour un profil privé, retiré ou inconnu", async () => {
    const p = await published("pseudonymous");
    await profiles(t.db).setVisibility({ userId: p.userId }, "private");
    expect(await publicProfiles(t.db).page(p.slug)).toBeNull();
    expect(await publicProfiles(t.db).page("inconnu-xyz")).toBeNull();
    expect(await publicProfiles(t.db).page("../../etc")).toBeNull();
    expect((await publicProfiles(t.db).listForSitemap()).map((s) => s.slug)).not.toContain(p.slug);
  });
});
