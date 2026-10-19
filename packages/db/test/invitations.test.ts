import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { gdpr } from "../src/gdpr";
import { invitationAnswers } from "../src/invitation-answers";
import { MAX_INVITATIONS_PER_MAILBOX, MAX_ORGANISATION_INVITATIONS_PER_DAY, MAX_INVITATIONS_PER_SENDER_PER_DAY } from "../src/invitation-input";
import { invitationMail } from "../src/invitation-mail";
import { invitations, type InvitationLink, type InvitationTarget } from "../src/invitations";
import { largeAccounts } from "../src/large-accounts";
import { confirmationTokenHash } from "../src/mission-confirmation-input";
import { organisations } from "../src/organisations";
import { retention } from "../src/retention";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Invitations (C23). Chaque règle est attaquée : une adresse inscrite ne se distingue jamais d'une inconnue, un lien
 * ne sert qu'une fois et échoit, un lien seul ne fait entrer personne dans un vivier privé (il faut l'adresse vérifiée),
 * plafonds par expéditeur, par entreprise et par boîte, filtre de coordonnées, révocation, relance unique, refus
 * jamais révélé, purge des invitations jamais acceptées et effacement des comptes.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const DAY_MS = 86_400_000;
const NOW = new Date("2026-10-19T09:00:00Z");
const later = (days: number): Date => new Date(NOW.getTime() + days * DAY_MS);
const repo = () => invitations(t.db);
const answers = () => invitationAnswers(t.db);
const link = (): InvitationLink => ({ id: randomUUID(), token: randomBytes(32).toString("base64url") });

let addressSeq = 0;
const freshAddress = (): string => `contact${(addressSeq += 1)}@client-${addressSeq}.fr`;

const emailOf = async (userId: string): Promise<string> => (await t.db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } })).email;

/** Une entreprise et son propriétaire. */
const company = async () => {
  const ownerId = await createUser(t.db);
  const organisationId = await createOrganisation(t.db, ownerId);
  return { owner: { userId: ownerId }, organisationId, target: { kind: "freelance", organisationId } as InvitationTarget };
};

/** Un freelance avec un profil, et son adresse vérifiée. */
const freelance = async () => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId);
  return { actor: { userId }, userId, profileId, email: await emailOf(userId) };
};

const CLIENT: InvitationTarget = { kind: "client" };

const invited = async (actor: { userId: string }, target: InvitationTarget, email: string, now = NOW) => {
  const l = link();
  const result = await repo().invite(actor, target, { email, message: null }, l, "fr", now);
  expect(result.kind).toBe("invited");
  return l;
};

describe("aucune énumération des adresses", () => {
  it("répond et écrit l'e-mail de la même façon, que l'adresse ait un compte ou non", async () => {
    const { owner, target } = await company();
    const known = await freelance();
    const unknown = freshAddress();
    const a = await repo().invite(owner, target, { email: known.email, message: "Ravi de travailler encore ensemble." }, link(), "fr", NOW);
    const b = await repo().invite(owner, target, { email: unknown, message: "Ravi de travailler encore ensemble." }, link(), "fr", NOW);
    expect(a.kind).toBe("invited");
    expect(b.kind).toBe("invited");
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    // Aucune notification au compte existant : l'invitation lui parvient par le même e-mail, et dans son espace.
    expect(await t.db.notification.count({ where: { userId: known.userId } })).toBe(0);
    expect(await t.db.appNotification.count({ where: { userId: known.userId } })).toBe(0);
    const mails = await invitationMail(t.db).claim(1000, NOW);
    const toKnown = mails.find((m) => m.to === known.email);
    const toUnknown = mails.find((m) => m.to === unknown);
    expect(toKnown).toBeDefined();
    expect(toUnknown).toBeDefined();
    // Tout est identique, sauf l'identifiant et le destinataire.
    expect({ ...toKnown, id: "", to: "" }).toEqual({ ...toUnknown, id: "", to: "" });
    // Le compte existant la voit dans son espace, par son adresse vérifiée seulement.
    expect(await answers().listReceived(known.actor, [known.email], NOW)).toHaveLength(1);
    expect(await answers().listReceived(known.actor, [], NOW)).toHaveLength(0);
  });

  it("normalise l'adresse, refuse une adresse illisible et l'invitation à soi-même", async () => {
    const { owner, target } = await company();
    const ownEmail = await emailOf(owner.userId);
    expect((await repo().invite(owner, target, { email: "pas une adresse", message: null }, link(), "fr", NOW)).kind).toBe("invalid");
    expect((await repo().invite(owner, target, { email: ownEmail.toUpperCase(), message: null }, link(), "fr", NOW)).kind).toBe("self");
    expect((await repo().invite(owner, target, { email: ownEmail.replace("@", "+autre@"), message: null }, link(), "fr", NOW)).kind).toBe("self");
    const l = link();
    expect((await repo().invite(owner, target, { email: "  Camille.Martin@Exemple.FR ", message: null }, l, "fr", NOW)).kind).toBe("invited");
    expect((await t.db.invitation.findUniqueOrThrow({ where: { id: l.id }, select: { email: true } })).email).toBe("camille.martin@exemple.fr");
  });
});

describe("jeton à usage unique, haché, échu", () => {
  it("ne garde que l'empreinte du jeton, et un lien ne sert qu'une fois", async () => {
    const { owner, target } = await company();
    const invitee = await freelance();
    const l = await invited(owner, target, invitee.email);
    const row = await t.db.invitation.findUniqueOrThrow({ where: { id: l.id }, select: { tokenHash: true } });
    expect(row.tokenHash).toBe(confirmationTokenHash(l.token));
    expect(row.tokenHash).not.toContain(l.token);
    expect((await answers().lookup(l.id, link().token, NOW)).kind).toBe("invalid");
    expect((await answers().lookup(l.id, l.token, NOW)).kind).toBe("open");
    const request = { id: l.id, token: l.token, decision: "accept" as const, kind: "freelance" as const, organisationId: null };
    // Un autre type que celui montré par la page (le côté du compte n'a été vérifié que pour lui) : refusé.
    expect((await answers().answer(invitee.actor, [invitee.email], { ...request, kind: "client" }, NOW)).kind).toBe("invalid");
    expect((await answers().answer(invitee.actor, [invitee.email], request, NOW)).kind).toBe("accepted");
    expect((await answers().answer(invitee.actor, [invitee.email], request, NOW)).kind).toBe("closed");
    expect((await answers().lookup(l.id, l.token, NOW)).kind).toBe("closed");
    // Même par une écriture directe, une décision ne se défait pas.
    await expect(t.db.invitation.update({ where: { id: l.id }, data: { status: "pending", decidedAt: null } })).rejects.toThrow();
  });

  it("échoit au bout de quatorze jours", async () => {
    const { owner, target } = await company();
    const invitee = await freelance();
    const l = await invited(owner, target, invitee.email);
    expect((await answers().lookup(l.id, l.token, later(13))).kind).toBe("open");
    expect((await answers().lookup(l.id, l.token, later(14))).kind).toBe("expired");
    expect((await answers().answer(invitee.actor, [invitee.email], { id: l.id, token: l.token, decision: "accept", kind: "freelance", organisationId: null }, later(15))).kind).toBe("expired");
    expect((await invitationMail(t.db).claim(1000, later(15))).some((m) => m.id === l.id)).toBe(false);
    const list = await repo().listForOrganisation(owner, target.kind === "freelance" ? target.organisationId : "", later(15));
    expect(list?.find((i) => i.id === l.id)?.state).toBe("expired");
  });
});

describe("vivier privé : l'adresse vérifiée, pas le lien", () => {
  it("refuse un compte sans l'adresse invitée vérifiée, même avec le bon lien", async () => {
    const { owner, organisationId, target } = await company();
    const invitee = await freelance();
    const intruder = await freelance();
    const l = await invited(owner, target, invitee.email);
    const request = { id: l.id, token: l.token, decision: "accept" as const, kind: "freelance" as const, organisationId: null };
    // L'intrus a le lien, mais aucune de ses adresses vérifiées n'est l'adresse invitée.
    expect((await answers().answer(intruder.actor, [intruder.email], request, NOW)).kind).toBe("email_mismatch");
    // L'adresse invitée, présente sur le compte mais non vérifiée, ne compte pas : l'appelant ne la passe pas.
    expect((await answers().answer(invitee.actor, [], request, NOW)).kind).toBe("email_mismatch");
    expect((await largeAccounts(t.db).talentPool(owner, organisationId))?.length).toBe(0);
    expect((await answers().answer(invitee.actor, [invitee.email.toUpperCase()], request, NOW)).kind).toBe("accepted");
    const pool = await largeAccounts(t.db).talentPool(owner, organisationId);
    expect(pool?.map((m) => m.profileId)).toEqual([invitee.profileId]);
    expect(pool?.[0]?.invitedOn?.getTime()).toBe(NOW.getTime());
    expect(pool?.[0]?.paidMissions).toBe(0);
    // L'expéditeur est prévenu, par une référence seulement.
    const notice = await t.db.notification.findFirstOrThrow({ where: { userId: owner.userId, kind: "invitation_accepted" }, select: { payload: true } });
    expect(notice.payload).toEqual({ invitationId: l.id, status: "pool" });
  });

  it("accepte depuis l'espace connecté sans jeton, par la seule adresse vérifiée", async () => {
    const { owner, target } = await company();
    const invitee = await freelance();
    const l = await invited(owner, target, invitee.email);
    expect((await answers().answer(invitee.actor, [invitee.email], { id: l.id, token: null, decision: "accept", kind: "freelance", organisationId: null }, NOW)).kind).toBe("accepted");
  });

  it("refuse l'expéditeur et les membres de l'entreprise qui invite", async () => {
    const { owner, organisationId, target } = await company();
    const colleague = await freelance();
    await t.db.membership.create({ data: { organisationId, userId: colleague.userId, role: "member" } });
    const l = await invited(owner, target, colleague.email);
    expect((await answers().answer(colleague.actor, [colleague.email], { id: l.id, token: l.token, decision: "accept", kind: "freelance", organisationId: null }, NOW)).kind).toBe("self");
  });
});

describe("plafonds", () => {
  it("plafonne un expéditeur sur 24 heures", async () => {
    const { owner, target } = await company();
    for (let i = 0; i < MAX_INVITATIONS_PER_SENDER_PER_DAY; i += 1) await invited(owner, target, freshAddress());
    expect((await repo().invite(owner, target, { email: freshAddress(), message: null }, link(), "fr", NOW)).kind).toBe("limit");
    // Le lendemain, le compteur repart.
    expect((await repo().invite(owner, target, { email: freshAddress(), message: null }, link(), "fr", later(1.01))).kind).toBe("invited");
  });

  it("plafonne une entreprise, tous membres confondus", async () => {
    const { owner, organisationId, target } = await company();
    const members = [owner];
    for (let i = 0; i < 2; i += 1) {
      const userId = await createUser(t.db);
      await t.db.membership.create({ data: { organisationId, userId, role: "admin" } });
      members.push({ userId });
    }
    for (let i = 0; i < MAX_ORGANISATION_INVITATIONS_PER_DAY; i += 1) await invited(members[i % members.length]!, target, freshAddress());
    expect((await repo().invite(members[2]!, target, { email: freshAddress(), message: null }, link(), "fr", NOW)).kind).toBe("limit");
  });

  it("plafonne une même boîte, tous expéditeurs confondus, sans le dire, et refuse un doublon", async () => {
    const address = freshAddress();
    const first = await company();
    await invited(first.owner, first.target, address);
    expect((await repo().invite(first.owner, first.target, { email: address, message: null }, link(), "fr", NOW)).kind).toBe("already_invited");
    for (let i = 1; i < MAX_INVITATIONS_PER_MAILBOX; i += 1) {
      const other = await company();
      await invited(other.owner, other.target, address.replace("@", `+${i}@`));
    }
    const last = await company();
    const l = link();
    // La même réponse qu'un envoi : l'expéditeur n'apprend pas que d'autres ont invité cette adresse. Rien n'est écrit.
    expect((await repo().invite(last.owner, last.target, { email: address, message: null }, l, "fr", NOW)).kind).toBe("invited");
    expect(await t.db.invitation.count({ where: { id: l.id } })).toBe(0);
  });

  it("ne compte pas dans le plafond d'une boîte les invitations révoquées avant leur envoi", async () => {
    const address = freshAddress();
    const { owner, target } = await company();
    for (let i = 0; i < MAX_INVITATIONS_PER_MAILBOX; i += 1) {
      const l = await invited(owner, target, address.replace("@", `+r${i}@`));
      expect(await repo().revoke(owner, l.id, NOW)).toBe("done");
    }
    const other = await company();
    const fresh = await invited(other.owner, other.target, address);
    expect(await t.db.invitation.count({ where: { id: fresh.id } })).toBe(1);
  });

  it("réserve aux propriétaires et administrateurs les invitations au nom de l'entreprise", async () => {
    const { organisationId, target } = await company();
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId, userId: member, role: "member" } });
    expect((await repo().invite({ userId: member }, target, { email: freshAddress(), message: null }, link(), "fr", NOW)).kind).toBe("absent");
    await t.db.membership.update({ where: { organisationId_userId: { organisationId, userId: member } }, data: { role: "admin" } });
    expect((await repo().invite({ userId: member }, target, { email: freshAddress(), message: null }, link(), "fr", NOW)).kind).toBe("invited");
  });
});

describe("mot personnel : filtre de coordonnées", () => {
  it("refuse un numéro, une adresse, du HTML, un texte trop long", async () => {
    const { owner, target } = await company();
    const send = (message: string) => repo().invite(owner, target, { email: freshAddress(), message }, link(), "fr", NOW);
    expect(await send("Appelle-moi au 06 12 34 56 78")).toEqual({ kind: "message", problem: "contact" });
    expect(await send("Écris-moi : moi@exemple.fr")).toEqual({ kind: "message", problem: "contact" });
    expect(await send("<b>bonjour</b>")).toEqual({ kind: "message", problem: "html" });
    expect(await send("a".repeat(501))).toEqual({ kind: "message", problem: "long" });
    expect((await send("Ravi de retravailler avec toi sur la plateforme.")).kind).toBe("invited");
  });
});

describe("révocation, relance unique, refus jamais révélé", () => {
  it("révoque : le lien ne mène plus à rien et l'e-mail ne part plus", async () => {
    const { owner, organisationId, target } = await company();
    const stranger = await createUser(t.db);
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId, userId: member, role: "member" } });
    const invitee = await freelance();
    const l = await invited(owner, target, invitee.email);
    expect(await repo().revoke({ userId: stranger }, l.id, NOW)).toBe("absent");
    // Un simple membre ne révoque pas l'invitation d'un autre.
    expect(await repo().revoke({ userId: member }, l.id, NOW)).toBe("absent");
    expect(await repo().revoke(owner, l.id, NOW)).toBe("done");
    expect(await repo().revoke(owner, l.id, NOW)).toBe("closed");
    expect((await answers().lookup(l.id, l.token, NOW)).kind).toBe("closed");
    expect((await answers().answer(invitee.actor, [invitee.email], { id: l.id, token: l.token, decision: "accept", kind: "freelance", organisationId: null }, NOW)).kind).toBe("closed");
    expect((await invitationMail(t.db).claim(1000, NOW)).some((m) => m.id === l.id)).toBe(false);
    expect((await repo().listForOrganisation(owner, organisationId, NOW))?.find((i) => i.id === l.id)?.state).toBe("revoked");
  });

  it("relance une seule fois, après deux jours, avec le même lien", async () => {
    const { owner, target } = await company();
    const l = await invited(owner, target, freshAddress());
    const mail = invitationMail(t.db);
    const first = (await mail.claim(1000, NOW)).find((m) => m.id === l.id);
    expect(first?.reminder).toBe(false);
    await mail.markSent(l.id, NOW);
    expect(await repo().remind(owner, l.id, later(1))).toBe("too_soon");
    expect(await repo().remind(owner, l.id, later(2))).toBe("done");
    expect(await repo().remind(owner, l.id, later(3))).toBe("already");
    const again = (await mail.claim(1000, later(2))).find((m) => m.id === l.id);
    expect(again?.reminder).toBe(true);
  });

  it("ne montre jamais un refus à l'expéditeur", async () => {
    const { owner, organisationId, target } = await company();
    const invitee = await freelance();
    const l = await invited(owner, target, invitee.email);
    expect((await answers().answer(invitee.actor, [invitee.email], { id: l.id, token: l.token, decision: "decline", kind: "freelance", organisationId: null }, NOW)).kind).toBe("declined");
    const view = (await repo().listForOrganisation(owner, organisationId, later(2)))?.find((i) => i.id === l.id);
    expect(view?.state).toBe("pending");
    expect(view?.remindable).toBe(true);
    expect((await repo().invite(owner, target, { email: invitee.email, message: null }, link(), "fr", later(2))).kind).toBe("already_invited");
    // La relance « réussit », mais aucun e-mail ne repart vers une personne qui a déjà répondu.
    expect(await repo().remind(owner, l.id, later(2))).toBe("done");
    expect((await invitationMail(t.db).claim(1000, later(2))).some((m) => m.id === l.id)).toBe(false);
    expect(await t.db.talentPoolEntry.count({ where: { organisationId } })).toBe(0);
  });
});

describe("un freelance invite une entreprise cliente", () => {
  it("rattache l'entreprise créée après l'acceptation, et prévient le freelance", async () => {
    const sender = await freelance();
    const clientUser = await createUser(t.db);
    const clientEmail = await emailOf(clientUser);
    const l = await invited(sender.actor, CLIENT, clientEmail);
    expect(await answers().answer({ userId: clientUser }, [clientEmail], { id: l.id, token: l.token, decision: "accept", kind: "client", organisationId: null }, NOW)).toEqual({ kind: "accepted", invitationKind: "client", linked: false });
    expect(await t.db.notification.count({ where: { userId: sender.userId, kind: "invitation_accepted" } })).toBe(0);
    const org = await organisations(t.db).create({ userId: clientUser }, { name: "Client SAS", kind: "pme" });
    const row = await t.db.invitation.findUniqueOrThrow({ where: { id: l.id }, select: { clientOrganisationId: true } });
    expect(row.clientOrganisationId).toBe(org.id);
    expect(await t.db.notification.count({ where: { userId: sender.userId, kind: "invitation_accepted" } })).toBe(1);
    const mine = await repo().listMine(sender.actor, NOW);
    expect(mine.find((i) => i.id === l.id)).toMatchObject({ state: "accepted", linkedOrganisationName: "Client SAS" });
  });

  it("rattache tout de suite l'entreprise dont la personne est déjà membre, jamais celle du freelance", async () => {
    const sender = await freelance();
    const clientUser = await createUser(t.db);
    const clientEmail = await emailOf(clientUser);
    const own = await createOrganisation(t.db, clientUser);
    const l = await invited(sender.actor, CLIENT, clientEmail);
    const shared = await createOrganisation(t.db, clientUser);
    await t.db.membership.create({ data: { organisationId: shared, userId: sender.userId, role: "member" } });
    expect((await answers().answer({ userId: clientUser }, [clientEmail], { id: l.id, token: l.token, decision: "accept", kind: "client", organisationId: shared }, NOW)).kind).toBe("self");
    expect(await answers().answer({ userId: clientUser }, [clientEmail], { id: l.id, token: l.token, decision: "accept", kind: "client", organisationId: own }, NOW)).toEqual({ kind: "accepted", invitationKind: "client", linked: true });
  });

  it("demande un profil au freelance qui invite", async () => {
    const userId = await createUser(t.db);
    expect((await repo().invite({ userId }, CLIENT, { email: freshAddress(), message: null }, link(), "fr", NOW)).kind).toBe("no_profile");
  });
});

describe("RGPD", () => {
  it("purge les invitations jamais acceptées 30 jours après leur échéance, garde les acceptées", async () => {
    const { owner, target } = await company();
    const invitee = await freelance();
    const unanswered = await invited(owner, target, freshAddress());
    const accepted = await invited(owner, target, invitee.email);
    await answers().answer(invitee.actor, [invitee.email], { id: accepted.id, token: accepted.token, decision: "accept", kind: "freelance", organisationId: null }, NOW);
    await retention(t.db).purge(later(14 + 29));
    expect(await t.db.invitation.count({ where: { id: unanswered.id } })).toBe(1);
    const report = await retention(t.db).purge(later(14 + 31));
    expect(report.invitations).toBeGreaterThanOrEqual(1);
    expect(await t.db.invitation.count({ where: { id: unanswered.id } })).toBe(0);
    expect(await t.db.invitation.count({ where: { id: accepted.id } })).toBe(1);
  });

  it("efface les invitations envoyées avec le compte de l'expéditeur, et celles reçues avec celui de l'invité", async () => {
    const sender = await freelance();
    const sent = await invited(sender.actor, CLIENT, freshAddress());
    expect(await gdpr(t.db).eraseUser(sender.userId)).toBe("erased");
    expect(await t.db.invitation.count({ where: { id: sent.id } })).toBe(0);

    const { owner, organisationId, target } = await company();
    const invitee = await freelance();
    const l = await invited(owner, target, invitee.email);
    await answers().answer(invitee.actor, [invitee.email], { id: l.id, token: l.token, decision: "accept", kind: "freelance", organisationId: null }, NOW);
    const other = await company();
    const pending = await invited(other.owner, other.target, invitee.email);
    const exported = await gdpr(t.db).exportUser(invitee.userId, NOW);
    expect(JSON.stringify(exported?.invitations)).not.toContain(confirmationTokenHash(l.token));
    expect(await gdpr(t.db).eraseUser(invitee.userId)).toBe("erased");
    expect(await t.db.invitation.count({ where: { id: { in: [l.id, pending.id] } } })).toBe(0);
    expect(await t.db.talentPoolEntry.count({ where: { organisationId } })).toBe(0);
  });
});

describe("relecture de sécurité C23", () => {
  it("ne relaie jamais un nom d'entreprise qui porte un lien ou un faux domaine", async () => {
    for (const name of ["https://evil.xyz/verify", "Impots-gouv-remboursement.xyz"]) {
      const ownerId = await createUser(t.db);
      const { id: organisationId } = await t.db.organisation.create({ data: { name, kind: "pme", members: { create: { userId: ownerId, role: "owner" } } }, select: { id: true } });
      const invitee = await freelance();
      const l = await invited({ userId: ownerId }, { kind: "freelance", organisationId }, invitee.email);
      const mail = (await invitationMail(t.db).claim(1000, NOW)).find((m) => m.id === l.id);
      expect(mail?.inviter).toBeNull();
      const view = (await answers().listReceived(invitee.actor, [invitee.email], NOW)).find((v) => v.id === l.id);
      expect(view?.inviter).toBeNull();
    }
    // Un nom ordinaire, lui, est montré.
    const plain = await company();
    const l = await invited(plain.owner, plain.target, freshAddress());
    expect((await invitationMail(t.db).claim(1000, NOW)).find((m) => m.id === l.id)?.inviter).toBe("Acme");
  });

  it("ne rattache l'entreprise qu'à sa création par la personne invitée, jamais à un ajout comme membre", async () => {
    const sender = await freelance();
    const clientUser = await createUser(t.db);
    const clientEmail = await emailOf(clientUser);
    const l = await invited(sender.actor, CLIENT, clientEmail);
    await answers().answer({ userId: clientUser }, [clientEmail], { id: l.id, token: l.token, decision: "accept", kind: "client", organisationId: null }, NOW);
    const host = await company();
    expect(await organisations(t.db).addMember(host.owner, host.organisationId, clientEmail, "member")).toBe(true);
    expect((await t.db.invitation.findUniqueOrThrow({ where: { id: l.id }, select: { clientOrganisationId: true } })).clientOrganisationId).toBeNull();
  });

  it("crée l'entreprise même si le rattachement échoue", async () => {
    const userId = await createUser(t.db);
    // Une base dont les transactions échouent : la création (une seule instruction) passe, le rattachement non.
    const failing = new Proxy(t.db, { get: (target, prop) => (prop === "$transaction" ? () => Promise.reject(new Error("boom")) : Reflect.get(target, prop, target)) });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const org = await organisations(failing).create({ userId }, { name: "Robuste SAS", kind: "pme" });
    expect(org.role).toBe("owner");
    expect(quiet).toHaveBeenCalledWith("organisations: client invitation link failed", "Error");
    quiet.mockRestore();
  });

  it("révoque les invitations ouvertes d'un membre qui quitte l'entreprise", async () => {
    const { owner, organisationId, target } = await company();
    const admin = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId, userId: admin, role: "admin" } });
    const l = await invited({ userId: admin }, target, freshAddress());
    const kept = await invited(owner, target, freshAddress());
    expect(await organisations(t.db).removeMember(owner, organisationId, admin)).toBe(true);
    expect((await t.db.invitation.findUniqueOrThrow({ where: { id: l.id }, select: { status: true } })).status).toBe("revoked");
    expect((await t.db.invitation.findUniqueOrThrow({ where: { id: kept.id }, select: { status: true } })).status).toBe("pending");
  });

  it("efface aussi les invitations adressées à la même boîte que l'adresse du compte", async () => {
    const invitee = await freelance();
    const { owner, target } = await company();
    const l = await invited(owner, target, invitee.email.replace("@", "+pro@"));
    expect(await gdpr(t.db).eraseUser(invitee.userId)).toBe("erased");
    expect(await t.db.invitation.count({ where: { id: l.id } })).toBe(0);
  });
});
