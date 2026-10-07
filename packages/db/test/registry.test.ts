import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing } from "../src/billing";
import { contracts } from "../src/contracts";
import { messaging } from "../src/messaging";
import { quotes } from "../src/quotes";
import { REGISTRY_RECHECK_DAYS, registry, registryVerdict } from "../src/registry";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const NOW = new Date("2026-11-20T10:00:00Z");

/** Forme réelle d'une réponse de l'API Recherche d'entreprises, réduite aux champs lus. */
const answer = (siret: string, unit: string, establishment: string) => ({
  results: [{ siren: siret.slice(0, 9), etat_administratif: unit, matching_etablissements: [{ siret, etat_administratif: establishment }] }],
});

describe("verdict du répertoire", () => {
  it("lit actif, fermé et inconnu, et refuse une réponse illisible", () => {
    expect(registryVerdict("99913805000011", answer("99913805000011", "A", "A"))).toBe("active");
    expect(registryVerdict("99913805000011", answer("99913805000011", "A", "F"))).toBe("ceased");
    expect(registryVerdict("99913805000011", answer("99913805000011", "C", "A"))).toBe("ceased");
    expect(registryVerdict("99913805000011", { results: [] })).toBe("not_found");
    // Un autre établissement de la même entreprise ne vaut pas pour celui-ci.
    expect(registryVerdict("99913805000029", answer("99913805000011", "A", "A"))).toBe("not_found");
    expect(registryVerdict("99913805000011", { unexpected: true })).toBeNull();
    expect(registryVerdict("99913805000011", "<html>")).toBeNull();
  });
});

describe("contrôle des SIRET", () => {
  const setup = async () => {
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const freelanceUser = await createUser(t.db);
    const profile = await createProfile(t.db, freelanceUser);
    await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { legalName: "Camille Test EI", siret: "55210055400025", vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
    await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", siret: "73282932000074", address: ADDRESS });
    return { recruiter, org, freelanceUser, profile };
  };

  it("liste les SIRET à contrôler, enregistre le verdict, et le remet à zéro quand le SIRET change", async () => {
    const s = await setup();
    const due = await registry(t.db).due(NOW, 500);
    const mine = due.filter((d) => d.siret === "55210055400025" || d.siret === "73282932000074");
    expect(mine.map((d) => d.kind).sort()).toEqual(["company", "freelance"]);
    for (const subject of mine) expect(await registry(t.db).record(subject, "active", NOW)).toBe(true);
    expect((await registry(t.db).due(NOW, 500)).some((d) => d.siret === "73282932000074")).toBe(false);
    // Revérifié au bout de la période.
    const later = new Date(NOW.getTime() + (REGISTRY_RECHECK_DAYS + 1) * 86_400_000);
    expect((await registry(t.db).due(later, 500)).some((d) => d.siret === "73282932000074")).toBe(true);

    await billing(t.db).setOrganisationIdentity({ userId: s.recruiter }, s.org, { legalName: "Acme SAS", siret: "73282932000082", address: ADDRESS });
    expect(await t.db.organisation.findUniqueOrThrow({ where: { id: s.org }, select: { registryStatus: true, registryCheckedAt: true } })).toEqual({ registryStatus: null, registryCheckedAt: null });
    // Un verdict obtenu pour l'ancien SIRET n'est pas écrit sur le nouveau.
    const company = mine.find((d) => d.kind === "company");
    if (company === undefined) throw new Error("entreprise absente");
    expect(await registry(t.db).record(company, "ceased", NOW)).toBe(false);
  });

  it("refuse un contrat quand le répertoire dit une des entreprises fermée, jamais quand il n'a rien dit", async () => {
    const s = await setup();
    await t.db.organisation.update({ where: { id: s.org }, data: { registryStatus: "ceased", registryCheckedAt: NOW } });
    const contact = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour, une mission ?");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: s.freelanceUser }, contact.conversation.id, "accepted", NOW);
    const draft = await quotes(t.db).draft({ userId: s.freelanceUser }, contact.conversation.id, { dailyRateCents: 60_000, days: 10 });
    await quotes(t.db).send({ userId: s.freelanceUser }, draft?.id ?? "");
    await quotes(t.db).decide({ userId: s.recruiter }, draft?.id ?? "", "accepted");
    expect(await contracts(t.db).createFromQuote({ userId: s.recruiter }, draft?.id ?? "", { startsOn: "2026-12-01" })).toEqual({ kind: "registry_ceased" });
    // Un répertoire injoignable ne laisse aucun verdict : il ne bloque personne.
    await t.db.organisation.update({ where: { id: s.org }, data: { registryStatus: null, registryCheckedAt: null } });
    expect(await contracts(t.db).createFromQuote({ userId: s.recruiter }, draft?.id ?? "", { startsOn: "2026-12-01" })).toMatchObject({ kind: "created" });
  });
});
