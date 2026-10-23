import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applicationDetails } from "../src/application-detail";
import { applications } from "../src/applications";
import { billing } from "../src/billing";
import { companyDesk } from "../src/company-desk";
import { contracts } from "../src/contracts";
import { messaging } from "../src/messaging";
import { missionConfirmations } from "../src/mission-confirmations";
import { missions, type MissionInput } from "../src/missions";
import { quotes } from "../src/quotes";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, fakeGateway, nextSiret, openTestDatabase, payAndHold, verifiedVigilance, type TestDatabase } from "./support/database";

/*
 * « À traiter » sur l'accueil d'une entreprise : chaque compte suit la règle de l'écran où l'on agit, change quand on y
 * agit, et ne dit rien à qui n'est pas membre. Les actions des administrateurs ne sont pas comptées pour un simple
 * membre : elles valent `null`, jamais un zéro.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date();
const DAY_MS = 86_400_000;
const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const MISSION: MissionInput = { title: "Data engineer", description: "Plateforme de données.", skills: ["Spark"], durationMonths: 3, city: "Lyon", workMode: "remote" };
const desk = (userId: string, org: string) => companyDesk(t.db).forCompany({ userId }, org, NOW);

let siretSeq = 0;

/** Une entreprise inscrite (SIRET actif), son propriétaire et un simple membre. */
const company = async () => {
  const owner = await createUser(t.db);
  const org = await createOrganisation(t.db, owner);
  const member = await createUser(t.db);
  await t.db.membership.create({ data: { organisationId: org, userId: member, role: "member" } });
  const siret = `6${String((siretSeq += 1)).padStart(8, "0")}00012`;
  await billing(t.db).setOrganisationIdentity({ userId: owner }, org, { legalName: "Acme SAS", address: ADDRESS });
  // Après l'identité de facturation, qui réécrit l'état du répertoire : seule une entreprise active reçoit des demandes.
  await t.db.organisation.update({ where: { id: org }, data: { siret, registryStatus: "active", registryCheckedAt: NOW } });
  return { owner, member, org, siret };
};

const freelance = async () => {
  const userId = await createUser(t.db);
  const profile = await createProfile(t.db, userId);
  await verifiedVigilance(t.db, profile);
  await billing(t.db).setFreelanceIdentity({ userId }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: nextSiret("552100554"), address: ADDRESS });
  return { userId, profile };
};

/** Un contrat né d'un devis accepté, encore sans aucune signature. */
const unsignedContract = async (owner: string, org: string) => {
  const f = await freelance();
  const contact = await messaging(t.db).contact({ userId: owner }, org, f.profile, "Bonjour");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: f.userId }, contact.conversation.id, "accepted", NOW);
  const draft = await quotes(t.db).draft({ userId: f.userId }, contact.conversation.id, { dailyRateCents: 60_000, days: 5 });
  await quotes(t.db).send({ userId: f.userId }, draft?.id ?? "");
  await quotes(t.db).decide({ userId: owner }, draft?.id ?? "", "accepted");
  const created = await contracts(t.db).createFromQuote({ userId: owner }, draft?.id ?? "", { startsOn: NOW.toISOString().slice(0, 10) });
  if (created.kind !== "created") throw new Error(created.kind);
  return { id: created.contract.id, freelance: f };
};

const confirmationFor = async (siret: string) => {
  const userId = await createUser(t.db);
  await createProfile(t.db, userId);
  const link = { id: randomUUID(), token: randomBytes(32).toString("base64url") };
  const input = { role: "Lead data engineer", clientName: "Acme", clientKind: "pme", clientSiret: siret, contactEmail: null, startedOn: "2025-01", endedOn: "2025-06", summary: "Migration de la plateforme de données." } as const;
  const result = await missionConfirmations(t.db).request({ userId }, input, link, "fr", NOW);
  if (result.kind !== "requested") throw new Error(result.kind);
  return link.id;
};

describe("ce qui attend une entreprise", () => {
  it("ne dit rien à qui n'est pas membre, ni pour un identifiant qui n'en est pas un", async () => {
    const acme = await company();
    const outsider = await createUser(t.db);
    expect(await desk(outsider, acme.org)).toBeNull();
    expect(await desk(acme.owner, "pas-un-uuid")).toBeNull();
    expect(await desk(acme.owner, randomUUID())).toBeNull();
  });

  it("part de zéro pour une entreprise neuve, et ne compte pas pour un membre ce qui revient aux administrateurs", async () => {
    const acme = await company();
    expect(await desk(acme.owner, acme.org)).toEqual({ admin: true, confirmations: { count: 0, soonest: null }, toSign: 0, toPay: 0, unreadApplications: 0 });
    expect(await desk(acme.member, acme.org)).toEqual({ admin: false, confirmations: null, toSign: null, toPay: null, unreadApplications: 0 });
  });

  it("compte les confirmations en attente de cette entreprise, avec la plus proche échéance, et les retire une fois décidées", async () => {
    const acme = await company();
    const rival = await company();
    const first = await confirmationFor(acme.siret);
    await confirmationFor(acme.siret);
    await confirmationFor(rival.siret);
    const expiresAt = (await t.db.missionConfirmationRequest.findUniqueOrThrow({ where: { id: first }, select: { expiresAt: true } })).expiresAt;
    expect((await desk(acme.owner, acme.org))?.confirmations).toEqual({ count: 2, soonest: expiresAt });
    expect(await missionConfirmations(t.db).decideAsCompany({ userId: acme.owner }, first, { confirm: true, showClientName: false }, NOW)).toBe("confirmed");
    expect((await desk(acme.owner, acme.org))?.confirmations?.count).toBe(1);
    // Une demande échue n'attend plus personne : la page des confirmations ne la montre plus.
    await t.db.missionConfirmationRequest.updateMany({ where: { organisationId: acme.org, status: "pending" }, data: { expiresAt: new Date(NOW.getTime() - DAY_MS) } });
    expect((await desk(acme.owner, acme.org))?.confirmations).toEqual({ count: 0, soonest: null });
  });

  it("suit un contrat : à signer par l'entreprise, puis à payer une fois signé des deux côtés, puis plus rien une fois payé", async () => {
    const acme = await company();
    const contract = await unsignedContract(acme.owner, acme.org);
    expect(await desk(acme.owner, acme.org)).toMatchObject({ toSign: 1, toPay: 0 });
    await contracts(t.db).sign({ userId: acme.owner }, contract.id, NOW);
    // Signé par l'entreprise : c'est au freelance de signer, rien n'attend l'entreprise.
    expect(await desk(acme.owner, acme.org)).toMatchObject({ toSign: 0, toPay: 0 });
    await contracts(t.db).sign({ userId: contract.freelance.userId }, contract.id, NOW);
    expect(await desk(acme.owner, acme.org)).toMatchObject({ toSign: 0, toPay: 1 });
    await payAndHold(t.db, acme.owner, contract.id, fakeGateway().gateway);
    expect(await desk(acme.owner, acme.org)).toMatchObject({ toSign: 0, toPay: 0 });
  });

  it("compte les candidatures que personne n'a ouvertes, pour tout membre, jusqu'à la première ouverture", async () => {
    const acme = await company();
    const draft = await missions(t.db).create({ userId: acme.owner }, acme.org, MISSION);
    if (draft === null) throw new Error("mission non créée");
    await missions(t.db).publish({ userId: acme.owner }, draft.id, NOW);
    const dev = await freelance();
    const applied = await applications(t.db).apply({ userId: dev.userId }, draft.id, "Bonjour", NOW, []);
    if (applied.kind !== "applied") throw new Error(applied.kind);
    expect((await desk(acme.owner, acme.org))?.unreadApplications).toBe(1);
    expect((await desk(acme.member, acme.org))?.unreadApplications).toBe(1);
    expect(await applicationDetails(t.db).open({ userId: acme.member }, applied.applicationId, NOW)).not.toBeNull();
    expect((await desk(acme.owner, acme.org))?.unreadApplications).toBe(0);
  });
});
