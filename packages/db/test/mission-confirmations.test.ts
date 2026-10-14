import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { confirmationTokenHash, mailboxKey, MAX_PENDING_CONFIRMATIONS, MAX_REQUESTS_PER_CONTACT, type ConfirmationInput } from "../src/mission-confirmation-input";
import { missionConfirmations, type ConfirmationLink } from "../src/mission-confirmations";
import { publicProfiles } from "../src/public-profiles";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Une mission ne devient un fait vérifié que si le client la confirme : par son espace d'entreprise, ou par un lien
 * signé à usage unique. Chaque règle est attaquée : accès d'un tiers, confirmation pour soi-même, jeton faux, rejoué ou
 * échu, plafond des demandes, et rien de public avant la confirmation.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const DAY_MS = 86_400_000;
const NOW = new Date("2026-10-14T09:00:00Z");
const later = (days: number): Date => new Date(NOW.getTime() + days * DAY_MS);
const repo = () => missionConfirmations(t.db);
const NO = { confirm: false, showClientName: false } as const;
const YES = { confirm: true, showClientName: false } as const;

const link = (): ConfirmationLink => ({ id: randomUUID(), token: randomBytes(32).toString("base64url") });

let siretSeq = 0;
const freshSiret = (): string => `8${String((siretSeq += 1)).padStart(8, "0")}00012`;

const freelance = async () => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId);
  const { email } = await t.db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  return { actor: { userId }, userId, profileId, email };
};

/** Une entreprise inscrite, au SIRET actif au répertoire. */
const company = async (registryStatus: "active" | "mismatch" = "active") => {
  const ownerId = await createUser(t.db);
  const orgId = await createOrganisation(t.db, ownerId);
  const siret = freshSiret();
  await t.db.organisation.update({ where: { id: orgId }, data: { siret, registryStatus, registryCheckedAt: NOW } });
  return { owner: { userId: ownerId }, orgId, siret };
};

let contactSeq = 0;
/** Une adresse de contact neuve à chaque demande : une même boîte ne reçoit que quelques demandes par mois. */
const input = (over: Partial<ConfirmationInput> = {}): ConfirmationInput => ({
  role: "Lead data engineer",
  clientName: "Acme Industries",
  clientKind: "eti",
  clientSiret: null,
  contactEmail: `dsi${(contactSeq += 1)}@client.fr`,
  startedOn: "2025-01",
  endedOn: "2025-06",
  summary: "Migration de la plateforme de données vers dbt et Snowflake.",
  ...over,
});

const requestByEmail = async (actor: { userId: string }, over: Partial<ConfirmationInput> = {}) => {
  const l = link();
  const result = await repo().request(actor, input(over), l, "fr", NOW);
  if (result.kind !== "requested") throw new Error(`demande refusée : ${result.kind}`);
  return l;
};

const missionsOf = (profileId: string) => t.db.verifiedMission.findMany({ where: { profileId } });

describe("demander la confirmation par e-mail", () => {
  it("ne garde que l'empreinte du jeton, met l'e-mail en file et ne publie rien", async () => {
    const f = await freelance();
    const l = await requestByEmail(f.actor);
    const row = await t.db.missionConfirmationRequest.findUniqueOrThrow({ where: { id: l.id } });
    expect(row.tokenHash).toBe(confirmationTokenHash(l.token));
    expect(JSON.stringify(row)).not.toContain(l.token);
    expect(row).toMatchObject({ status: "pending", contactEmail: expect.stringMatching(/^dsi\d+@client\.fr$/), organisationId: null, emailSentAt: null });
    expect(row.expiresAt).toEqual(later(30));
    expect(await missionsOf(f.profileId)).toHaveLength(0);
    const slug = (await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: f.profileId }, select: { slug: true } })).slug ?? "";
    expect((await publicProfiles(t.db).page(slug, NOW))?.missions).toEqual([]);
    expect(await repo().listMine(f.actor, NOW)).toMatchObject([{ id: l.id, target: "email", state: "pending" }]);
  });

  it("refuse une saisie invalide, une mission pas encore terminée, des coordonnées dans le résumé", async () => {
    const f = await freelance();
    expect(await repo().request(f.actor, input({ endedOn: "2026-12" }), link(), "fr", NOW)).toEqual({ kind: "future" });
    expect(await repo().request(f.actor, input({ startedOn: "2025-07" }), link(), "fr", NOW)).toEqual({ kind: "invalid" });
    expect(await repo().request(f.actor, input({ summary: "Appelez-moi au 06 12 34 56 78 pour en parler" }), link(), "fr", NOW)).toEqual({ kind: "invalid" });
    expect(await repo().request(f.actor, input({ contactEmail: null }), link(), "fr", NOW)).toEqual({ kind: "invalid" });
    expect(await repo().request(f.actor, input(), { id: "pas-un-uuid", token: link().token }, "fr", NOW)).toEqual({ kind: "invalid" });
    expect(await repo().request(f.actor, input(), { id: randomUUID(), token: "court" }, "fr", NOW)).toEqual({ kind: "invalid" });
    expect(await repo().request({ userId: await createUser(t.db) }, input(), link(), "fr", NOW)).toEqual({ kind: "no_profile" });
  });

  it("plafonne les demandes en attente, et un retrait libère une place", async () => {
    const f = await freelance();
    const links = [];
    for (let i = 0; i < MAX_PENDING_CONFIRMATIONS; i += 1) links.push(await requestByEmail(f.actor));
    expect(await repo().request(f.actor, input(), link(), "fr", NOW)).toEqual({ kind: "limit" });
    const stranger = await freelance();
    expect(await repo().withdraw(stranger.actor, links[0]?.id ?? "")).toBe(false);
    expect(await repo().withdraw(f.actor, links[0]?.id ?? "")).toBe(true);
    expect((await repo().request(f.actor, input(), link(), "fr", NOW)).kind).toBe("requested");
  });
});

describe("une adresse de contact n'est pas un canal d'envoi", () => {
  it("reconnaît une même boîte malgré sous-adresse, casse et points Gmail", () => {
    expect(mailboxKey("Jean.Dupont+mission@GoogleMail.com")).toBe("jeandupont@gmail.com");
    expect(mailboxKey("dsi+1@client.fr")).toBe("dsi@client.fr");
    expect(mailboxKey("d.s.i@client.fr")).toBe("d.s.i@client.fr");
  });

  it("plafonne les demandes vers une même boîte sur trente jours, tous freelances confondus", async () => {
    const target = "achats@plafond.fr";
    for (let i = 0; i < MAX_REQUESTS_PER_CONTACT; i += 1) await requestByEmail((await freelance()).actor, { contactEmail: i === 0 ? target : `achats+${i}@plafond.fr` });
    const late = await freelance();
    expect(await repo().request(late.actor, input({ contactEmail: target }), link(), "fr", NOW)).toEqual({ kind: "contact_limit" });
    expect((await repo().request(late.actor, input({ contactEmail: target }), link(), "fr", later(31))).kind).toBe("requested");
  });
});

describe("personne ne confirme pour soi", () => {
  it("ni sa propre adresse, ni celle d'un collègue de son entreprise, ni son propre SIREN", async () => {
    const f = await freelance();
    expect(await repo().request(f.actor, input({ contactEmail: f.email.toUpperCase() }), link(), "fr", NOW)).toEqual({ kind: "self_confirmation" });
    expect(await repo().request(f.actor, input({ contactEmail: f.email.replace("@", "+client@") }), link(), "fr", NOW)).toEqual({ kind: "self_confirmation" });
    const own = await createOrganisation(t.db, f.userId);
    const colleague = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: own, userId: colleague, role: "member" } });
    const { email } = await t.db.user.findUniqueOrThrow({ where: { id: colleague }, select: { email: true } });
    expect(await repo().request(f.actor, input({ contactEmail: email }), link(), "fr", NOW)).toEqual({ kind: "self_confirmation" });
    await t.db.billingIdentity.create({ data: { profileId: f.profileId, legalName: "Moi EI", siret: "55210055400011", address: {} } });
    expect(await repo().request(f.actor, input({ clientSiret: "55210055400099" }), link(), "fr", NOW)).toEqual({ kind: "self_confirmation" });
  });

  it("ni une entreprise inscrite dont il est membre, même s'il la rejoint après sa demande", async () => {
    const f = await freelance();
    const c = await company();
    await t.db.membership.create({ data: { organisationId: c.orgId, userId: f.userId, role: "admin" } });
    expect(await repo().request(f.actor, input({ clientSiret: c.siret }), link(), "fr", NOW)).toEqual({ kind: "self_confirmation" });

    const g = await freelance();
    const d = await company();
    const l = link();
    expect(await repo().request(g.actor, input({ clientSiret: d.siret, contactEmail: null }), l, "fr", NOW)).toEqual({ kind: "requested", target: "organisation" });
    await t.db.membership.create({ data: { organisationId: d.orgId, userId: g.userId, role: "member" } });
    expect(await repo().decideAsCompany(d.owner, l.id, YES, NOW)).toBe("self_confirmation");
    expect(await missionsOf(g.profileId)).toHaveLength(0);
  });
});

describe("confirmer par le lien signé", () => {
  it("montre le minimum, sans coordonnée du freelance, et refuse un jeton faux", async () => {
    const f = await freelance();
    const l = await requestByEmail(f.actor);
    expect(await repo().lookupByToken(l.id, link().token, NOW)).toEqual({ kind: "invalid" });
    expect(await repo().lookupByToken(randomUUID(), l.token, NOW)).toEqual({ kind: "invalid" });
    const open = await repo().lookupByToken(l.id, l.token, NOW);
    expect(open).toMatchObject({ kind: "open", view: { role: "Lead data engineer", clientName: "Acme Industries" } });
    expect(JSON.stringify(open)).not.toContain(f.email);
    expect(await repo().decideByToken(l.id, link().token, YES, NOW)).toBe("invalid");
  });

  it("crée exactement une mission vérifiée, datée, et le jeton ne sert qu'une fois", async () => {
    const f = await freelance();
    const l = await requestByEmail(f.actor);
    expect(await repo().decideByToken(l.id, l.token, { confirm: true, showClientName: true }, NOW)).toBe("confirmed");
    expect(await repo().decideByToken(l.id, l.token, YES, NOW)).toBe("decided");
    expect(await repo().decideByToken(l.id, l.token, NO, NOW)).toBe("decided");
    expect(await repo().lookupByToken(l.id, l.token, NOW)).toEqual({ kind: "decided" });
    const missions = await missionsOf(f.profileId);
    expect(missions).toHaveLength(1);
    expect(missions[0]).toMatchObject({
      evidenceKind: "client_confirmation",
      verifiedAt: NOW,
      durationMonths: 6,
      clientKind: "eti",
      clientName: "Acme Industries",
      confirmationId: l.id,
      confirmedByDomain: "client.fr",
      confirmedByOrganisationId: null,
    });
    expect(await t.db.notification.count({ where: { userId: f.userId, kind: "mission_confirmation" } })).toBe(1);
    const slug = (await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: f.profileId }, select: { slug: true } })).slug ?? "";
    expect((await publicProfiles(t.db).page(slug, NOW))?.missions).toMatchObject([{ evidenceKind: "client_confirmation", clientName: "Acme Industries", verifiedAt: NOW, confirmedBy: "contact" }]);
  });

  it("ne publie le nom du client que s'il coche la case", async () => {
    const f = await freelance();
    const l = await requestByEmail(f.actor);
    expect(await repo().decideByToken(l.id, l.token, YES, NOW)).toBe("confirmed");
    expect((await missionsOf(f.profileId))[0]?.clientName).toBeNull();
  });

  it("un refus ou une expiration ne laissent rien de public", async () => {
    const f = await freelance();
    const refused = await requestByEmail(f.actor);
    expect(await repo().decideByToken(refused.id, refused.token, { confirm: false, showClientName: true }, NOW)).toBe("refused");
    const row = await t.db.missionConfirmationRequest.findUniqueOrThrow({ where: { id: refused.id } });
    expect(row).toMatchObject({ status: "refused", showClientName: false });
    const expired = await requestByEmail(f.actor);
    expect(await repo().lookupByToken(expired.id, expired.token, later(30))).toEqual({ kind: "expired" });
    expect(await repo().decideByToken(expired.id, expired.token, YES, later(31))).toBe("expired");
    expect(await missionsOf(f.profileId)).toHaveLength(0);
    expect((await repo().listMine(f.actor, later(31))).map((r) => r.state).sort()).toEqual(["expired", "refused"]);
  });
});

describe("confirmer depuis l'espace de l'entreprise", () => {
  it("adresse la demande à l'entreprise au SIRET reconnu, prévient ses administrateurs", async () => {
    const f = await freelance();
    const c = await company();
    const admin = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.orgId, userId: admin, role: "admin" } });
    const l = link();
    // Le type de client est celui de l'entreprise inscrite, pas celui déclaré.
    expect(await repo().request(f.actor, input({ clientSiret: c.siret, clientKind: "startup" }), l, "fr", NOW)).toEqual({ kind: "requested", target: "organisation" });
    const row = await t.db.missionConfirmationRequest.findUniqueOrThrow({ where: { id: l.id } });
    expect(row).toMatchObject({ organisationId: c.orgId, contactEmail: null, tokenHash: null, clientKind: "pme" });
    expect(await t.db.notification.count({ where: { userId: { in: [c.owner.userId, admin] }, kind: "mission_confirmation" } })).toBe(2);
    const listed = await repo().listForCompany(c.owner, NOW);
    expect(listed).toMatchObject([{ id: l.id, organisationName: "Acme", role: "Lead data engineer" }]);
    expect(JSON.stringify(listed)).not.toContain(f.email);
  });

  it("réserve la décision aux propriétaires et administrateurs de cette entreprise", async () => {
    const f = await freelance();
    const c = await company();
    const other = await company();
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.orgId, userId: member, role: "member" } });
    const l = link();
    await repo().request(f.actor, input({ clientSiret: c.siret }), l, "fr", NOW);
    for (const stranger of [{ userId: member }, other.owner, f.actor]) {
      expect(await repo().listForCompany(stranger, NOW)).toEqual([]);
      expect(await repo().decideAsCompany(stranger, l.id, YES, NOW)).toBe("not_found");
    }
    expect(await repo().decideAsCompany(c.owner, "pas-un-uuid", YES, NOW)).toBe("not_found");
    expect(await repo().decideAsCompany(c.owner, l.id, YES, NOW)).toBe("confirmed");
    expect(await repo().decideAsCompany(c.owner, l.id, NO, NOW)).toBe("decided");
    const missions = await missionsOf(f.profileId);
    expect(missions).toHaveLength(1);
    expect(missions[0]).toMatchObject({ evidenceKind: "client_confirmation", confirmedByOrganisationId: c.orgId, confirmedByDomain: null, clientName: null });
    // Avec l'accord d'affichage, c'est le nom de l'entreprise inscrite qui est publié, jamais le texte du freelance.
    const g = await freelance();
    const named = link();
    await repo().request(g.actor, input({ clientSiret: c.siret, clientName: "Google" }), named, "fr", NOW);
    expect(await repo().decideAsCompany(c.owner, named.id, { confirm: true, showClientName: true }, NOW)).toBe("confirmed");
    expect((await missionsOf(g.profileId))[0]?.clientName).toBe("Acme");
    const decided = await t.db.missionConfirmationRequest.findUniqueOrThrow({ where: { id: l.id } });
    expect(decided).toMatchObject({ status: "confirmed", decidedByUserId: c.owner.userId, decidedAt: NOW });
  });

  it("un SIRET non vérifié au répertoire ne suffit pas : il faut alors un contact", async () => {
    const f = await freelance();
    const c = await company("mismatch");
    expect(await repo().request(f.actor, input({ clientSiret: c.siret, contactEmail: null }), link(), "fr", NOW)).toEqual({ kind: "contact_required" });
    expect(await repo().request(f.actor, input({ clientSiret: c.siret }), link(), "fr", NOW)).toEqual({ kind: "requested", target: "email" });
  });

  it("une demande échue n'est plus proposée ni décidable", async () => {
    const f = await freelance();
    const c = await company();
    const l = link();
    await repo().request(f.actor, input({ clientSiret: c.siret }), l, "fr", NOW);
    expect(await repo().listForCompany(c.owner, later(31))).toEqual([]);
    expect(await repo().decideAsCompany(c.owner, l.id, YES, later(31))).toBe("expired");
    expect(await missionsOf(f.profileId)).toHaveLength(0);
  });
});

describe("la base tient les mêmes règles", () => {
  const insert = (profileId: string, columns: string, values: string) =>
    t.pg.query(
      `INSERT INTO "MissionConfirmationRequest" ("id","profileId","role","clientName","clientKind","startedOn","endedOn","summary","expiresAt"${columns})
       VALUES (gen_random_uuid(), $1, 'Rôle', 'Client', 'pme', '2025-01-01', '2025-02-01', 'Un résumé assez long.', now()${values})`,
      [profileId],
    );

  it("refuse une demande sans cible ou à deux cibles, un contact sans jeton, un nom autorisé avant confirmation", async () => {
    const f = await freelance();
    const c = await company();
    await expect(insert(f.profileId, "", "")).rejects.toThrow(/one_target/);
    await expect(insert(f.profileId, `,"organisationId","contactEmail","tokenHash"`, `,'${c.orgId}','a@b.fr','h1'`)).rejects.toThrow(/one_target/);
    await expect(insert(f.profileId, `,"contactEmail"`, `,'a@b.fr'`)).rejects.toThrow(/email_has_token/);
    await expect(insert(f.profileId, `,"contactEmail","tokenHash"`, `,'A@B.fr','h2'`)).rejects.toThrow(/email_format/);
    await expect(insert(f.profileId, `,"organisationId","showClientName"`, `,'${c.orgId}',true`)).rejects.toThrow(/name_consent/);
    await expect(insert(f.profileId, `,"organisationId","status"`, `,'${c.orgId}','confirmed'`)).rejects.toThrow(/decided_dated/);
    await expect(insert(f.profileId, `,"organisationId"`, `,'${c.orgId}'`)).resolves.toBeDefined();
  });
});
