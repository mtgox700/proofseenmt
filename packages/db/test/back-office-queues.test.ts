import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accountNotices } from "../src/account-notices";
import type { Operator } from "../src/back-office";
import { contactReviews, FIRST_CONTACT_REVIEW, isRecentSender } from "../src/contact-review";
import { messaging } from "../src/messaging";
import { operatorLog } from "../src/operator-log";
import { ownedUrls } from "../src/owned-urls";
import { proofDisputes } from "../src/proof-disputes";
import { profiles } from "../src/profiles";
import { registryDesk } from "../src/registry-desk";
import { vigilance } from "../src/vigilance";
import { vigilanceDesk } from "../src/vigilance-desk";
import { createOrganisation, createUser, DB_STARTUP_MS, nextSiret, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Les files de l'opérateur (C19) : premiers contacts signalés, attestations URSSAF, adresses contestées, entreprises.
 */

let t: TestDatabase;
let operator: Operator;

beforeAll(async () => {
  t = await openTestDatabase();
  operator = { role: "operator", userId: await createUser(t.db) };
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const DAY_MS = 86_400_000;
const REASON = "Démarchage hors plateforme";
let drawn = 0;
const nextReference = (): string => `FR-BQ${"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[(drawn += 1) % 31]}ZQ`;
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

const published = async () => {
  const userId = await createUser(t.db);
  const created = await profiles(t.db).create({ userId }, { headline: "Dev", summary: "Résumé.", city: "Lyon", workMode: "remote", skills: ["Go"] }, nextReference);
  if (created === null) throw new Error("profil non créé");
  await profiles(t.db).setVisibility({ userId }, "pseudonymous");
  return { userId, id: created.id, reference: created.reference };
};

const contact = async (orgAgeDays: number) => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const born = new Date(Date.now() - orgAgeDays * DAY_MS);
  await t.db.organisation.update({ where: { id: org }, data: { createdAt: born } });
  await t.db.user.update({ where: { id: recruiter }, data: { createdAt: born } });
  const p = await published();
  const opened = await messaging(t.db).contact({ userId: recruiter }, org, p.id, "Bonjour, une mission de six mois vous intéresse ?");
  if (opened.kind !== "opened") throw new Error(opened.kind);
  return { recruiter, org, profile: p, conversationId: opened.conversation.id };
};

describe("premiers contacts des entreprises récentes", () => {
  it("signale le premier message d'une entreprise de moins de sept jours, sans retenir sa livraison", async () => {
    expect(FIRST_CONTACT_REVIEW).toEqual({ mode: "flag", newAccountDays: 7 });
    const c = await contact(2);
    const queue = await contactReviews(t.db, operator).pending();
    const flagged = queue.find((q) => q.conversationId === c.conversationId);
    expect(flagged?.firstMessage?.body).toMatch(/six mois/);
    expect(flagged?.profileReference).toBe(c.profile.reference);
    // Livré : le freelance a le fil et sa notification, comme pour n'importe quel contact.
    expect(await t.db.message.count({ where: { conversationId: c.conversationId } })).toBe(1);
    expect(await t.db.notification.count({ where: { userId: c.profile.userId, kind: "contact_received" } })).toBe(1);
  });

  it("ne signale pas une entreprise établie", async () => {
    const c = await contact(30);
    expect(await t.db.contactReview.count({ where: { conversationId: c.conversationId } })).toBe(0);
    expect(isRecentSender(new Date(Date.now() - 30 * DAY_MS), new Date(Date.now() - DAY_MS), new Date())).toBe(true);
  });

  it("laisse passer, ou ferme le fil avec un motif que l'entreprise reçoit", async () => {
    const ok = await contact(1);
    const closed = await contact(1);
    const desk = contactReviews(t.db, operator);
    expect(await desk.clear(ok.conversationId, new Date())).toBe("done");
    expect(await desk.clear(ok.conversationId, new Date())).toBe("unchanged");
    expect(await desk.close(closed.conversationId, REASON, new Date())).toBe("done");
    expect((await t.db.conversation.findUniqueOrThrow({ where: { id: closed.conversationId } })).status).toBe("closed");
    expect(await messaging(t.db).post({ userId: closed.profile.userId }, closed.conversationId, "Je réponds quand même")).toEqual({ kind: "closed" });
    const mail = await t.db.notification.findFirstOrThrow({ where: { userId: closed.recruiter, kind: "account_notice" } });
    expect(mail.payload).toMatchObject({ notice: "contact_closed", reason: REASON });
    const pending = (await desk.pending()).map((q) => q.conversationId);
    expect(pending).not.toContain(ok.conversationId);
    expect(pending).not.toContain(closed.conversationId);
    expect((await operatorLog(t.db, operator).list({ targetId: closed.conversationId })).items[0]).toMatchObject({ action: "contact_closed", reason: REASON });
  });
});

describe("attestations de vigilance URSSAF", () => {
  const declared = async () => {
    const p = await published();
    await vigilance(t.db).declare({ userId: p.userId }, { issuedOn: isoDay(new Date(Date.now() - 5 * DAY_MS)), securityCode: "ABCD1234EF" }, new Date());
    return p;
  };

  it("se vérifient avec le code contrôlé, comme en ligne de commande, et seulement avec lui", async () => {
    const p = await declared();
    const desk = vigilanceDesk(t.db, operator);
    const pending = await desk.pending(new Date());
    expect(pending.find((a) => a.reference === p.reference)).toMatchObject({ securityCode: "ABCD1234EF" });
    expect(await desk.verify(p.reference, "AUTRECODE1", new Date())).toBe("absent");
    expect(await desk.verify(p.reference, "abcd 1234-ef", new Date())).toBe("done");
    expect((await vigilance(t.db).status(p.id, new Date())).verified).toBe(true);
    expect((await desk.pending(new Date())).map((a) => a.reference)).not.toContain(p.reference);
    expect((await operatorLog(t.db, operator).list({ action: "vigilance_verified" })).items.some((i) => i.metadata.reference === p.reference)).toBe(true);
  });

  it("se refusent avec un motif que le freelance voit ; une nouvelle déclaration repart à zéro", async () => {
    const p = await declared();
    const desk = vigilanceDesk(t.db, operator);
    expect(await desk.reject(p.reference, "Code introuvable sur urssaf.fr", new Date())).toBe("done");
    expect((await accountNotices(t.db).standing({ userId: p.userId })).vigilanceRejection?.reason).toBe("Code introuvable sur urssaf.fr");
    // Refusée : ni l'écran ni la ligne de commande ne la marquent vérifiée.
    expect(await desk.verify(p.reference, "ABCD1234EF", new Date())).toBe("unchanged");
    expect(await vigilance(t.db).markVerified(p.reference, "ABCD1234EF", new Date())).toBe(false);
    await vigilance(t.db).declare({ userId: p.userId }, { issuedOn: isoDay(new Date()), securityCode: "NEWCODE99" }, new Date());
    expect((await accountNotices(t.db).standing({ userId: p.userId })).vigilanceRejection).toBeNull();
    expect((await desk.pending(new Date())).map((a) => a.reference)).toContain(p.reference);
  });
});

describe("adresses contestées", () => {
  it("montre les deux profils et leurs dates, et retire la preuve du premier avec un motif", async () => {
    const holder = await published();
    const claimant = await published();
    const url = `https://contested-${Date.now()}.dev/`;
    const first = await ownedUrls(t.db).add({ userId: holder.userId }, url, { manual: false });
    if (first.kind !== "added") throw new Error(first.kind);
    expect((await ownedUrls(t.db).markVerified({ userId: holder.userId }, first.record.id, "well_known_file", new Date())).kind).toBe("verified");
    const second = await ownedUrls(t.db).add({ userId: claimant.userId }, url, { manual: false });
    if (second.kind !== "added") throw new Error(second.kind);
    expect((await ownedUrls(t.db).markVerified({ userId: claimant.userId }, second.record.id, "well_known_file", new Date())).kind).toBe("already_proven_elsewhere");

    const desk = proofDisputes(t.db, operator);
    const dispute = (await desk.list()).find((d) => d.claimant.ownedUrlId === second.record.id);
    expect(dispute?.holder).toMatchObject({ ownedUrlId: first.record.id, reference: holder.reference });
    expect(dispute?.claimant.reference).toBe(claimant.reference);

    expect(await desk.revoke(first.record.id, "Le domaine a changé de propriétaire", new Date())).toBe("done");
    expect(await desk.revoke(first.record.id, "Le domaine a changé de propriétaire", new Date())).toBe("unchanged");
    expect((await desk.list()).find((d) => d.claimant.ownedUrlId === second.record.id)).toBeUndefined();
    // Le second peut maintenant prouver l'adresse.
    expect((await ownedUrls(t.db).markVerified({ userId: claimant.userId }, second.record.id, "well_known_file", new Date())).kind).toBe("verified");
    expect(await t.db.notification.count({ where: { userId: holder.userId, kind: "account_notice" } })).toBe(1);
  });
});

describe("entreprises au répertoire", () => {
  it("relance un contrôle et l'enregistre avec sa trace, seulement si le SIRET n'a pas changé", async () => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    const siret = nextSiret("732829320");
    await t.db.organisation.update({ where: { id: org }, data: { siret, name: "Acme Registre" } });
    const desk = registryDesk(t.db, operator);
    expect((await desk.list("Acme Registre")).map((o) => o.id)).toContain(org);
    const subject = await desk.subject(org);
    expect(subject).toEqual({ kind: "company", id: org, siret, declaredName: "Acme Registre" });
    if (subject === null) throw new Error("sujet absent");
    expect(await desk.record(subject, { status: "active", officialName: "ACME REGISTRE" }, new Date())).toBe("recorded");
    expect((await t.db.organisation.findUniqueOrThrow({ where: { id: org } })).registryStatus).toBe("active");
    expect(await desk.record(subject, null, new Date())).toBe("attempted");
    await t.db.organisation.update({ where: { id: org }, data: { siret: nextSiret("732829320") } });
    expect(await desk.record(subject, { status: "ceased", officialName: null }, new Date())).toBe("changed");
    expect((await operatorLog(t.db, operator).list({ targetId: org })).items.map((i) => i.metadata.status)).toEqual(["unreachable", "active"]);
    expect(await desk.subject("pas-un-id")).toBeNull();
  });
});
