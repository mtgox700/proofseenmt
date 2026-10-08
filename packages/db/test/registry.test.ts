import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { billing } from "../src/billing";
import { contracts } from "../src/contracts";
import { messaging } from "../src/messaging";
import { quotes } from "../src/quotes";
import { REGISTRY_RECHECK_DAYS, REGISTRY_RETRY_HOURS, registry, registryVerdict, sameEntityName } from "../src/registry";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase, verifiedVigilance } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const NOW = new Date("2026-11-20T10:00:00Z");
const HOUR_MS = 3_600_000;

/** Forme réelle d'une réponse de l'API Recherche d'entreprises, réduite aux champs lus. */
const answer = (siret: string, unit: string, establishment: string, name = "E-KIGAI") => ({
  results: [{ siren: siret.slice(0, 9), nom_complet: name, nom_raison_sociale: name, etat_administratif: unit, matching_etablissements: [{ siret, etat_administratif: establishment }] }],
});

describe("verdict du répertoire", () => {
  it("lit actif, fermé et inconnu, et refuse une réponse illisible", () => {
    expect(registryVerdict("99913805000011", "e-kigai SCOP SAS à capital variable", answer("99913805000011", "A", "A"))).toEqual({ status: "active", officialName: "E-KIGAI" });
    expect(registryVerdict("99913805000011", "e-kigai", answer("99913805000011", "A", "F"))).toMatchObject({ status: "ceased" });
    expect(registryVerdict("99913805000011", "e-kigai", answer("99913805000011", "C", "A"))).toMatchObject({ status: "ceased" });
    expect(registryVerdict("99913805000011", "e-kigai", { results: [] })).toEqual({ status: "not_found", officialName: null });
    // Un autre établissement de la même entreprise ne vaut pas pour celui-ci.
    expect(registryVerdict("99913805000029", "e-kigai", answer("99913805000011", "A", "A"))).toMatchObject({ status: "not_found" });
    expect(registryVerdict("99913805000011", "e-kigai", { unexpected: true })).toBeNull();
    expect(registryVerdict("99913805000011", "e-kigai", "<html>")).toBeNull();
  });

  it("refuse le badge à un SIRET actif déclaré sous un autre nom : il n'appartient pas à cette partie", () => {
    expect(registryVerdict("99913805000011", "Doliprane France", answer("99913805000011", "A", "A"))).toEqual({ status: "mismatch", officialName: "E-KIGAI" });
  });

  it("rapproche les noms sans tenir compte des formes juridiques, accents et ponctuation", () => {
    expect(sameEntityName("Acme SAS", "ACME")).toBe(true);
    expect(sameEntityName("Société Générale d'Études", "SOCIETE GENERALE D ETUDES")).toBe(true);
    expect(sameEntityName("Camille Martin EI", "MARTIN CAMILLE")).toBe(true);
    expect(sameEntityName("Acme", "ACME CONSULTING")).toBe(true);
    expect(sameEntityName("Doliprane France", "E-KIGAI")).toBe(false);
    expect(sameEntityName("SAS", "SARL")).toBe(false);
  });
});

describe("contrôle des SIRET", () => {
  const setup = async (freelanceSiret = "55210055400025", companySiret = "73282932000074") => {
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const freelanceUser = await createUser(t.db);
    const profile = await createProfile(t.db, freelanceUser);
    await verifiedVigilance(t.db, profile);
    expect(await billing(t.db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: freelanceSiret, vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 })).toBe("saved");
    expect(await billing(t.db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", siret: companySiret, address: ADDRESS })).toBe("saved");
    return { recruiter, org, freelanceUser, profile };
  };

  it("un SIRET ne peut être revendiqué que par un seul freelance et une seule entreprise", async () => {
    await setup("55210055400033", "73282932000090");
    const intruder = await createUser(t.db);
    await createProfile(t.db, intruder);
    expect(await billing(t.db).setFreelanceIdentity({ userId: intruder }, { acceptInvoicingMandate: true, legalName: "Imposteur EI", siret: "55210055400033", address: ADDRESS })).toBe("siret_taken");
    const owner = await createUser(t.db);
    const other = await createOrganisation(t.db, owner);
    expect(await billing(t.db).setOrganisationIdentity({ userId: owner }, other, { legalName: "Copie SAS", siret: "73282932000090", address: ADDRESS })).toBe("siret_taken");
  });

  it("liste les SIRET à contrôler, enregistre le verdict, et le remet à zéro quand le SIRET change", async () => {
    const s = await setup("55210055400041", "73282932000108");
    const due = await registry(t.db).due(NOW, 500);
    const mine = due.filter((d) => d.siret === "55210055400041" || d.siret === "73282932000108");
    expect(mine.map((d) => [d.kind, d.declaredName]).sort()).toEqual([["company", "Acme SAS"], ["freelance", "Camille Test EI"]]);
    for (const subject of mine) expect(await registry(t.db).record(subject, { status: "active", officialName: "ACME" }, NOW)).toBe(true);
    expect((await registry(t.db).due(NOW, 500)).some((d) => d.siret === "73282932000108")).toBe(false);
    const later = new Date(NOW.getTime() + (REGISTRY_RECHECK_DAYS + 1) * 86_400_000);
    expect((await registry(t.db).due(later, 500)).some((d) => d.siret === "73282932000108")).toBe(true);

    await billing(t.db).setOrganisationIdentity({ userId: s.recruiter }, s.org, { legalName: "Acme SAS", siret: "73282932000116", address: ADDRESS });
    expect(await t.db.organisation.findUniqueOrThrow({ where: { id: s.org }, select: { registryStatus: true, registryCheckedAt: true, registryName: true } })).toEqual({ registryStatus: null, registryCheckedAt: null, registryName: null });
    const company = mine.find((d) => d.kind === "company");
    if (company === undefined) throw new Error("entreprise absente");
    // Un verdict obtenu pour l'ancien SIRET n'est pas écrit sur le nouveau.
    expect(await registry(t.db).record(company, { status: "ceased", officialName: null }, NOW)).toBe(false);
  });

  it("un contrôle en échec attend avant d'être retenté, sans bloquer la file", async () => {
    await setup("55210055400058", "73282932000124");
    const subject = (await registry(t.db).due(NOW, 500)).find((d) => d.siret === "73282932000124");
    if (subject === undefined) throw new Error("absent");
    await registry(t.db).attempted(subject, NOW);
    expect((await registry(t.db).due(new Date(NOW.getTime() + HOUR_MS), 500)).some((d) => d.siret === "73282932000124")).toBe(false);
    expect((await registry(t.db).due(new Date(NOW.getTime() + (REGISTRY_RETRY_HOURS + 1) * HOUR_MS), 500)).some((d) => d.siret === "73282932000124")).toBe(true);
  });

  it("refuse la création et la signature quand le répertoire dit une des entreprises fermée, jamais quand il n'a rien dit", async () => {
    const s = await setup("55210055400066", "73282932000132");
    const contact = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour, une mission ?");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: s.freelanceUser }, contact.conversation.id, "accepted", NOW);
    const draft = await quotes(t.db).draft({ userId: s.freelanceUser }, contact.conversation.id, { dailyRateCents: 60_000, days: 10 });
    await quotes(t.db).send({ userId: s.freelanceUser }, draft?.id ?? "");
    await quotes(t.db).decide({ userId: s.recruiter }, draft?.id ?? "", "accepted");
    await t.db.organisation.update({ where: { id: s.org }, data: { registryStatus: "ceased", registryCheckedAt: NOW } });
    expect(await contracts(t.db).createFromQuote({ userId: s.recruiter }, draft?.id ?? "", { startsOn: "2026-12-01" })).toEqual({ kind: "registry_ceased" });
    await t.db.organisation.update({ where: { id: s.org }, data: { registryStatus: null, registryCheckedAt: null } });
    const created = await contracts(t.db).createFromQuote({ userId: s.recruiter }, draft?.id ?? "", { startsOn: "2026-12-01" });
    if (created.kind !== "created") throw new Error(created.kind);
    // Fermée entre la création et la signature : la signature est refusée.
    await t.db.organisation.update({ where: { id: s.org }, data: { registryStatus: "ceased", registryCheckedAt: NOW } });
    expect(await contracts(t.db).sign({ userId: s.freelanceUser }, created.contract.id, NOW)).toEqual({ kind: "registry_ceased" });
  });

  it("refuse aussi un SIRET inconnu du répertoire ou enregistré sous un autre nom, des deux côtés", async () => {
    const s = await setup("55210055400074", "73282932000140");
    const contact = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour, une mission ?");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: s.freelanceUser }, contact.conversation.id, "accepted", NOW);
    const draft = await quotes(t.db).draft({ userId: s.freelanceUser }, contact.conversation.id, { dailyRateCents: 60_000, days: 2 });
    await quotes(t.db).send({ userId: s.freelanceUser }, draft?.id ?? "");
    await quotes(t.db).decide({ userId: s.recruiter }, draft?.id ?? "", "accepted");
    await t.db.billingIdentity.update({ where: { profileId: s.profile }, data: { registryStatus: "mismatch", registryCheckedAt: NOW } });
    expect(await contracts(t.db).createFromQuote({ userId: s.recruiter }, draft?.id ?? "", { startsOn: "2026-12-01" })).toEqual({ kind: "registry_mismatch" });
    await t.db.billingIdentity.update({ where: { profileId: s.profile }, data: { registryStatus: "active" } });
    await t.db.organisation.update({ where: { id: s.org }, data: { registryStatus: "not_found", registryCheckedAt: NOW } });
    expect(await contracts(t.db).createFromQuote({ userId: s.recruiter }, draft?.id ?? "", { startsOn: "2026-12-01" })).toEqual({ kind: "registry_mismatch" });
    await t.db.organisation.update({ where: { id: s.org }, data: { registryStatus: "active" } });
    const created = await contracts(t.db).createFromQuote({ userId: s.recruiter }, draft?.id ?? "", { startsOn: "2026-12-01" });
    expect(created.kind).toBe("created");
  });
});
