import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contracts } from "../src/contracts";
import { documents, type Affair, type DocumentLang, type NewVersion, type VersionTarget } from "../src/documents";
import { gdpr } from "../src/gdpr";
import { messaging } from "../src/messaging";
import { NewQuoteInputSchema, quotes, QuoteInputSchema, SCOPE_REQUIRED } from "../src/quotes";
import { storedFiles } from "../src/stored-files";
import { activeContract, type ActiveContract } from "./support/active-contract";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Le coffre (L1.3) : documents d'une affaire, versions immuables, journal d'accès en ajout seul, autorisation par objet ;
 * et les conditions du devis (L1-011) et le moment d'acceptation (L1.5).
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T10:00:00Z");
const SCOPE = "Développement de la plateforme de données : ingestion, modèles dbt et tableaux de bord.";
const DELIVERABLES = ["Pipelines d'ingestion documentés", "Modèles dbt testés", "Tableaux de bord de suivi"];

const fileOf = (reason = "première version"): NewVersion => ({
  storageKey: randomUUID(),
  sha256: createHash("sha256").update(randomUUID()).digest("hex"),
  // L'empreinte du CONTENU (celle du pied de page du PDF), distincte de celle du fichier.
  contentDigest: createHash("sha256").update(randomUUID()).digest("hex"),
  size: 4321,
  contentType: "application/pdf",
  templateId: "service-agreement",
  templateVersion: "1.0.0",
  engine: "pdfmake@0.3.12",
  variables: { totalCents: 600_000, currency: "EUR" },
  reason,
});

const contractTarget = (c: ActiveContract, type: "service_agreement" | "acceptance_report" | "amendment" = "service_agreement", lang: DocumentLang = "fr"): Extract<VersionTarget, { readonly affair: Affair }> => ({
  affair: { kind: "contract", id: c.id },
  type,
  lang,
});

/** Un contrat à signer, avec objet et livrables : le seul état où le contrat de prestation se range. */
const pendingContract = (): Promise<ActiveContract> => activeContract(t.db, { scope: SCOPE, deliverables: DELIVERABLES, signed: false });

/** Le numéro de la dernière version rangée pour le contrat de prestation (0 : aucune) : ce que l'écran envoie comme `attendu`. */
const seen = async (c: ActiveContract): Promise<number> =>
  (await t.db.documentVersion.aggregate({ where: { document: { contractId: c.id, type: "service_agreement", slot: 1 } }, _max: { number: true } }))._max.number ?? 0;

const addVersion = async (c: ActiveContract, who: string, reason = "première version") => {
  const result = await documents(t.db).record({ userId: who }, contractTarget(c), fileOf(reason), NOW, await seen(c));
  if (result.kind !== "recorded") throw new Error(result.kind);
  return result;
};

describe("l'objet, les livrables et la validité d'un devis (L1-011)", () => {
  it("se rédigent au brouillon, puis sont recopiés au contrat tels que l'entreprise les a vus", async () => {
    const c = await pendingContract();
    const quote = await t.db.quote.findUniqueOrThrow({ where: { id: c.quoteId }, select: { scope: true, deliverables: true } });
    expect(quote).toEqual({ scope: SCOPE, deliverables: DELIVERABLES });
    expect(await contracts(t.db).find({ userId: c.recruiter }, c.id)).toMatchObject({ scope: SCOPE, deliverables: DELIVERABLES });
  });

  it("restent nuls pour un devis sans objet (historique), sans rien inventer", async () => {
    const c = await activeContract(t.db);
    expect(await contracts(t.db).find({ userId: c.recruiter }, c.id)).toMatchObject({ scope: null, deliverables: [] });
  });

  it("sont validés : objet de 6 000 caractères au plus, 30 livrables au plus, validité future, aucune coordonnée directe", () => {
    const base = { dailyRateCents: 60_000, days: 10 };
    expect(QuoteInputSchema.safeParse({ ...base, scope: "x".repeat(6001) }).success).toBe(false);
    expect(QuoteInputSchema.safeParse({ ...base, deliverables: Array.from({ length: 31 }, (_, i) => `livrable ${i}`) }).success).toBe(false);
    expect(QuoteInputSchema.safeParse({ ...base, deliverables: ["   "] }).success).toBe(false);
    expect(QuoteInputSchema.safeParse({ ...base, validUntil: "2020-01-01" }).success).toBe(false);
    expect(QuoteInputSchema.safeParse({ ...base, validUntil: "pas une date" }).success).toBe(false);
    expect(QuoteInputSchema.safeParse({ ...base, scope: "Écrivez-moi à marie.durand@example.com pour le détail" }).success).toBe(false);
    expect(QuoteInputSchema.safeParse({ ...base, deliverables: ["Appelez le 06 12 34 56 78"] }).success).toBe(false);
    expect(QuoteInputSchema.safeParse({ ...base, scope: SCOPE, deliverables: DELIVERABLES, validUntil: "2099-12-31" }).success).toBe(true);
  });

  it("l'objet est obligatoire pour un NOUVEAU devis ; les livrables restent facultatifs", () => {
    const base = { dailyRateCents: 60_000, days: 10 };
    for (const scope of [undefined, "", "   ", null, 12]) {
      const parsed = NewQuoteInputSchema.safeParse(scope === undefined ? base : { ...base, scope });
      expect(parsed.success).toBe(false);
    }
    expect(NewQuoteInputSchema.safeParse(base).error?.issues.map((i) => i.message)).toContain(SCOPE_REQUIRED);
    expect(NewQuoteInputSchema.safeParse({ ...base, scope: "   " }).error?.issues.map((i) => i.message)).toContain(SCOPE_REQUIRED);
    expect(NewQuoteInputSchema.safeParse({ ...base, scope: SCOPE }).success).toBe(true);
    expect(NewQuoteInputSchema.safeParse({ ...base, scope: SCOPE, deliverables: DELIVERABLES }).success).toBe(true);
    // Les autres règles du devis restent celles du devis : plancher, plafonds, coordonnées directes.
    expect(NewQuoteInputSchema.safeParse({ dailyRateCents: 5_000, days: 1, scope: SCOPE }).success).toBe(false);
    expect(NewQuoteInputSchema.safeParse({ ...base, scope: "x".repeat(6001) }).success).toBe(false);
    expect(NewQuoteInputSchema.safeParse({ ...base, scope: "Écrivez-moi à marie.durand@example.com" }).success).toBe(false);
  });

  it("un ancien devis sans objet reste lisible, avec un objet nul et rien d'inventé, même après acceptation", async () => {
    const legacy = await activeContract(t.db);
    const quote = await t.db.quote.findUniqueOrThrow({ where: { id: legacy.quoteId }, select: { scope: true, deliverables: true, status: true } });
    expect(quote).toMatchObject({ scope: null, deliverables: [], status: "accepted" });
    const conversation = await t.db.conversation.findUniqueOrThrow({ where: { id: legacy.conversationId }, select: { id: true } });
    const listed = await quotes(t.db).list({ userId: legacy.recruiter }, conversation.id);
    expect(listed?.find((q) => q.id === legacy.quoteId)).toMatchObject({ scope: null, deliverables: [] });
    expect(QuoteInputSchema.safeParse({ dailyRateCents: 60_000, days: 10 }).success).toBe(true);
  });

  it("sont figés dès l'envoi du devis (base) et ne changent plus sur le contrat, même de nul vers une valeur", async () => {
    const c = await activeContract(t.db, { scope: SCOPE, deliverables: DELIVERABLES });
    await expect(t.db.quote.update({ where: { id: c.quoteId }, data: { scope: "Autre objet" } })).rejects.toThrow(/devis envoyé ne change ni d'objet/);
    await expect(t.db.contract.update({ where: { id: c.id }, data: { scope: "Autre objet" } })).rejects.toThrow(/objet et les livrables d'un contrat ne changent pas/);
    await expect(t.db.contract.update({ where: { id: c.id }, data: { deliverables: [] } })).rejects.toThrow(/ne changent pas/);
    const legacy = await activeContract(t.db);
    await expect(t.db.contract.update({ where: { id: legacy.id }, data: { scope: "Ajouté après coup" } })).rejects.toThrow(/ne changent pas/);
  });

  it("un brouillon reste modifiable", async () => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    const freelance = await createUser(t.db);
    const profile = await createProfile(t.db, freelance);
    const contact = await messaging(t.db).contact({ userId: owner }, org, profile, "Bonjour");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: freelance }, contact.conversation.id, "accepted", NOW);
    const draft = await quotes(t.db).draft({ userId: freelance }, contact.conversation.id, { dailyRateCents: 60_000, days: 10, scope: SCOPE });
    await t.db.quote.update({ where: { id: draft?.id ?? "" }, data: { scope: "Objet précisé" } });
    expect((await t.db.quote.findUniqueOrThrow({ where: { id: draft?.id ?? "" }, select: { scope: true } })).scope).toBe("Objet précisé");
  });
});

describe("la durée de validité et le moment d'acceptation d'un devis (L1.5)", () => {
  const sentQuote = async (validUntil?: string) => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    const freelance = await createUser(t.db);
    const profile = await createProfile(t.db, freelance);
    const contact = await messaging(t.db).contact({ userId: owner }, org, profile, "Bonjour");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: freelance }, contact.conversation.id, "accepted", NOW);
    const draft = await quotes(t.db).draft({ userId: freelance }, contact.conversation.id, { dailyRateCents: 60_000, days: 10, scope: SCOPE, ...(validUntil === undefined ? {} : { validUntil }) });
    const quoteId = draft?.id ?? "";
    await quotes(t.db).send({ userId: freelance }, quoteId);
    return { owner, freelance, quoteId };
  };

  it("l'acceptation pose son moment ; un devis envoyé, décliné ou ancien n'en a pas", async () => {
    const q = await sentQuote();
    expect((await t.db.quote.findUniqueOrThrow({ where: { id: q.quoteId }, select: { acceptedAt: true } })).acceptedAt).toBeNull();
    const result = await quotes(t.db).decide({ userId: q.owner }, q.quoteId, "accepted", NOW);
    expect(result).toMatchObject({ kind: "ok", quote: { status: "accepted", acceptedAt: NOW } });
    const declined = await sentQuote();
    expect(await quotes(t.db).decide({ userId: declined.owner }, declined.quoteId, "declined", NOW)).toMatchObject({ kind: "ok", quote: { status: "declined", acceptedAt: null } });
  });

  it("le moment ne se réécrit pas, ni ne se pose sans acceptation", async () => {
    const q = await sentQuote();
    await expect(t.db.quote.update({ where: { id: q.quoteId }, data: { acceptedAt: NOW } })).rejects.toThrow(/moment d'acceptation/);
    await quotes(t.db).decide({ userId: q.owner }, q.quoteId, "accepted", NOW);
    await expect(t.db.quote.update({ where: { id: q.quoteId }, data: { acceptedAt: new Date("2026-12-01T00:00:00Z") } })).rejects.toThrow(/moment d'acceptation/);
  });

  it("le paiement bloqué date l'encaissement de la même façon : Payment.paidAt remplit le rôle de heldAt", async () => {
    const column = await t.pg.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Payment' AND column_name IN ('paidAt','heldAt') ORDER BY 1`);
    expect(column.rows.map((r) => r.column_name)).toEqual(["paidAt"]);
  });

  it("un devis ne s'accepte plus au-delà de sa validité, mais peut encore être décliné", async () => {
    const q = await sentQuote("2099-01-10");
    expect(await quotes(t.db).decide({ userId: q.owner }, q.quoteId, "accepted", new Date("2099-01-11T08:00:00Z"))).toEqual({ kind: "expired" });
    // Le dernier jour compte encore.
    expect(await quotes(t.db).decide({ userId: q.owner }, q.quoteId, "accepted", new Date("2099-01-10T22:00:00Z"))).toMatchObject({ kind: "ok" });
    const later = await sentQuote("2099-01-10");
    expect(await quotes(t.db).decide({ userId: later.owner }, later.quoteId, "declined", new Date("2099-02-01T00:00:00Z"))).toMatchObject({ kind: "ok" });
  });
});

describe("autorisation par objet : une personne étrangère à l'affaire reçoit 404 (null)", () => {
  it("ne voit, n'ouvre ni ne crée rien sur le document d'un contrat dont elle n'est pas partie", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    const stranger = { userId: await createUser(t.db) };
    const affair: Affair = { kind: "contract", id: c.id };
    expect(await documents(t.db).list(stranger, affair)).toBeNull();
    expect(await documents(t.db).find(stranger, created.document.id)).toBeNull();
    expect(await documents(t.db).open(stranger, created.document.id, 1, NOW)).toBeNull();
    expect(await documents(t.db).prepare(stranger, contractTarget(c), 1)).toEqual({ kind: "absent" });
    expect(await documents(t.db).record(stranger, { documentId: created.document.id }, fileOf(), NOW, 1)).toEqual({ kind: "absent" });
    // Rien n'a été écrit : ni version, ni ligne de journal pour l'étranger.
    expect(await t.db.documentVersion.count({ where: { documentId: created.document.id } })).toBe(1);
    expect(await t.db.documentAccess.count({ where: { userId: stranger.userId } })).toBe(0);
  });

  it("un identifiant inconnu ou mal formé répond comme un document étranger", async () => {
    const actor = { userId: await createUser(t.db) };
    expect(await documents(t.db).find(actor, randomUUID())).toBeNull();
    expect(await documents(t.db).find(actor, "pas-un-uuid")).toBeNull();
    expect(await documents(t.db).list(actor, { kind: "contract", id: "pas-un-uuid" })).toBeNull();
    expect(await documents(t.db).open(actor, randomUUID(), 1, NOW)).toBeNull();
  });

  it("les deux parties lisent, et se reconnaissent comme auteur ou autre partie", async () => {
    const c = await pendingContract();
    await addVersion(c, c.recruiter);
    const forFreelance = await documents(t.db).list({ userId: c.freelanceUser }, { kind: "contract", id: c.id });
    const forCompany = await documents(t.db).list({ userId: c.recruiter }, { kind: "contract", id: c.id });
    expect(forFreelance).toHaveLength(1);
    expect(forFreelance?.[0]?.latest?.by).toBe("other_party");
    expect(forCompany?.[0]?.latest?.by).toBe("you");
    expect(forCompany?.[0]).toMatchObject({ type: "service_agreement", lang: "fr", versionCount: 1, affair: { kind: "contract", id: c.id } });
  });

  it("distingue « vous », « un collègue de votre entreprise » et « l'autre partie », sans nommer personne", async () => {
    const c = await pendingContract();
    const colleague = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.org, userId: colleague, role: "member" } });
    const outsider = await createUser(t.db);
    await addVersion(c, c.recruiter, "par la responsable");
    await addVersion(c, colleague, "par le collègue");
    await addVersion(c, c.freelanceUser, "par le freelance");
    const listed = async (userId: string) => (await documents(t.db).list({ userId }, { kind: "contract", id: c.id }))?.[0];
    const byReason = (versions: readonly { reason: string; by: string; side: string | null }[] | undefined) => Object.fromEntries((versions ?? []).map((v) => [v.reason, `${v.by}/${v.side}`]));
    const detail = async (userId: string) => (await documents(t.db).find({ userId }, (await listed(userId))?.id ?? ""))?.versions;

    expect(byReason(await detail(c.recruiter))).toEqual({ "par la responsable": "you/company", "par le collègue": "colleague/company", "par le freelance": "other_party/freelance" });
    expect(byReason(await detail(colleague))).toEqual({ "par la responsable": "colleague/company", "par le collègue": "you/company", "par le freelance": "other_party/freelance" });
    expect(byReason(await detail(c.freelanceUser))).toEqual({ "par la responsable": "other_party/company", "par le collègue": "other_party/company", "par le freelance": "you/freelance" });
    // Une personne étrangère n'apprend rien de tout cela.
    expect(await documents(t.db).list({ userId: outsider }, { kind: "contract", id: c.id })).toBeNull();
    // La liste porte le même vocabulaire que le détail (dernière version : celle du freelance).
    expect((await listed(c.recruiter))?.latest).toMatchObject({ by: "other_party", side: "freelance" });
  });

  it("un collègue qui a quitté l'entreprise s'affiche comme ancien membre, sans côté", async () => {
    const c = await pendingContract();
    const colleague = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.org, userId: colleague, role: "member" } });
    await addVersion(c, colleague, "avant son départ");
    await t.db.membership.delete({ where: { organisationId_userId: { organisationId: c.org, userId: colleague } } });
    const latest = (await documents(t.db).list({ userId: c.recruiter }, { kind: "contract", id: c.id }))?.[0]?.latest;
    expect(latest).toMatchObject({ by: "former_member", side: null });
  });

  it("expose l'empreinte du contenu à côté de celle du fichier, dans la liste, le détail et la version rangée", async () => {
    const c = await pendingContract();
    const file = fileOf();
    const recorded = await documents(t.db).record({ userId: c.recruiter }, contractTarget(c), file, NOW, 0);
    if (recorded.kind !== "recorded") throw new Error(recorded.kind);
    expect(file.contentDigest).not.toBe(file.sha256);
    expect(recorded.version).toMatchObject({ sha256: file.sha256, contentDigest: file.contentDigest });
    const detail = await documents(t.db).find({ userId: c.freelanceUser }, recorded.document.id);
    expect(detail?.versions[0]).toMatchObject({ sha256: file.sha256, contentDigest: file.contentDigest });
    const listed = await documents(t.db).list({ userId: c.freelanceUser }, { kind: "contract", id: c.id });
    expect(listed?.[0]?.latest).toMatchObject({ contentDigest: file.contentDigest });
  });

  it("un autre contrat de la même entreprise n'ouvre pas celui-ci : l'accès suit l'affaire du document", async () => {
    const a = await pendingContract();
    const b = await pendingContract();
    const docA = await addVersion(a, a.recruiter);
    expect(await documents(t.db).find({ userId: b.recruiter }, docA.document.id)).toBeNull();
    expect(await documents(t.db).find({ userId: b.freelanceUser }, docA.document.id)).toBeNull();
  });

  it("l'entreprise ne voit pas le brouillon d'un devis ni ses documents, le freelance si", async () => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    const freelance = await createUser(t.db);
    const profile = await createProfile(t.db, freelance);
    const contact = await messaging(t.db).contact({ userId: owner }, org, profile, "Bonjour");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: freelance }, contact.conversation.id, "accepted", NOW);
    const draft = await quotes(t.db).draft({ userId: freelance }, contact.conversation.id, { dailyRateCents: 60_000, days: 10, scope: SCOPE });
    const affair: Affair = { kind: "quote", id: draft?.id ?? "" };
    expect(await documents(t.db).list({ userId: owner }, affair)).toBeNull();
    expect(await documents(t.db).list({ userId: freelance }, affair)).toEqual([]);
    // Un brouillon ne se range pas non plus : le contenu n'est pas encore figé.
    expect(await documents(t.db).prepare({ userId: freelance }, { affair, type: "quote", lang: "fr" }, 0)).toEqual({ kind: "refused", reason: "wrong_state" });
    await quotes(t.db).send({ userId: freelance }, draft?.id ?? "");
    expect(await documents(t.db).prepare({ userId: owner }, { affair, type: "quote", lang: "fr" }, 0)).toMatchObject({ kind: "ready" });
  });
});

describe("règles de l'affaire", () => {
  it("un contrat sans objet (signé avant le coffre) n'a pas de contrat de prestation : rien n'est rangé", async () => {
    const legacy = await activeContract(t.db, { signed: false });
    expect(await documents(t.db).prepare({ userId: legacy.recruiter }, contractTarget(legacy), 0)).toEqual({ kind: "refused", reason: "scope_missing" });
    expect(await documents(t.db).record({ userId: legacy.recruiter }, contractTarget(legacy), fileOf(), NOW, 0)).toEqual({ kind: "refused", reason: "scope_missing" });
    expect(await t.db.document.count({ where: { contractId: legacy.id } })).toBe(0);
    const signedLegacy = await activeContract(t.db);
    expect(await documents(t.db).record({ userId: signedLegacy.recruiter }, contractTarget(signedLegacy), fileOf(), NOW, 0)).toEqual({ kind: "refused", reason: "scope_missing" });
  });

  it("le contrat de prestation se range avant l'acceptation de l'une ou l'autre partie, pas après", async () => {
    const c = await pendingContract();
    expect(await documents(t.db).prepare({ userId: c.recruiter }, contractTarget(c), 0)).toMatchObject({ kind: "ready", nextVersion: 1 });
    await contracts(t.db).sign({ userId: c.freelanceUser }, c.id, NOW);
    expect(await documents(t.db).record({ userId: c.recruiter }, contractTarget(c), fileOf(), NOW, 0)).toEqual({ kind: "refused", reason: "wrong_state" });
    const active = await activeContract(t.db, { scope: SCOPE, deliverables: DELIVERABLES });
    expect(await documents(t.db).record({ userId: active.recruiter }, contractTarget(active), fileOf(), NOW, 0)).toEqual({ kind: "refused", reason: "wrong_state" });
  });

  it("le procès-verbal de recette et l'avenant ne se rangent que sur un contrat actif", async () => {
    const pending = await pendingContract();
    expect(await documents(t.db).prepare({ userId: pending.recruiter }, contractTarget(pending, "acceptance_report"), 0)).toEqual({ kind: "refused", reason: "wrong_state" });
    const active = await activeContract(t.db, { scope: SCOPE, deliverables: DELIVERABLES });
    expect(await documents(t.db).prepare({ userId: active.recruiter }, contractTarget(active, "acceptance_report"), 0)).toMatchObject({ kind: "ready" });
  });

  it("une sorte de document qui ne va pas avec l'affaire est invalide", async () => {
    const c = await pendingContract();
    expect(await documents(t.db).prepare({ userId: c.recruiter }, { affair: { kind: "contract", id: c.id }, type: "quote", lang: "fr" }, 0)).toEqual({ kind: "refused", reason: "invalid" });
    expect(await documents(t.db).prepare({ userId: c.recruiter }, { affair: { kind: "quote", id: c.quoteId }, type: "service_agreement", lang: "fr" }, 0)).toEqual({ kind: "refused", reason: "invalid" });
  });

  it("refuse une version mal formée avant toute écriture", async () => {
    const c = await pendingContract();
    const actor = { userId: c.recruiter };
    expect(await documents(t.db).record(actor, contractTarget(c), { ...fileOf(), sha256: "xyz" }, NOW, 0)).toEqual({ kind: "invalid" });
    expect(await documents(t.db).record(actor, contractTarget(c), { ...fileOf(), contentDigest: "xyz" }, NOW, 0)).toEqual({ kind: "invalid" });
    expect(await documents(t.db).record(actor, contractTarget(c), { ...fileOf(), size: 0 }, NOW, 0)).toEqual({ kind: "invalid" });
    expect(await documents(t.db).record(actor, contractTarget(c), { ...fileOf(), contentType: "text/html" as "application/pdf" }, NOW, 0)).toEqual({ kind: "invalid" });
    expect(await documents(t.db).record(actor, contractTarget(c), fileOf("Voir marie.durand@example.com"), NOW, 0)).toEqual({ kind: "invalid" });
    // Le numéro attendu est un entier positif ou nul : jamais -1, jamais 1,5.
    expect(await documents(t.db).record(actor, contractTarget(c), fileOf(), NOW, -1)).toEqual({ kind: "invalid" });
    expect(await documents(t.db).record(actor, contractTarget(c), fileOf(), NOW, 1.5)).toEqual({ kind: "invalid" });
    expect(await t.db.document.count({ where: { contractId: c.id } })).toBe(0);
  });
});

describe("versions : numérotées sans trou, immuables", () => {
  it("la première version ouvre le document, les suivantes se numérotent à la suite, la plus récente en tête", async () => {
    const c = await pendingContract();
    const first = await addVersion(c, c.recruiter);
    expect(first.version.number).toBe(1);
    const second = await addVersion(c, c.freelanceUser, "correction du prix");
    expect(second.document.id).toBe(first.document.id);
    expect(second.version).toMatchObject({ number: 2, reason: "correction du prix", by: "you" });
    const detail = await documents(t.db).find({ userId: c.recruiter }, first.document.id);
    expect(detail?.versions.map((v) => v.number)).toEqual([2, 1]);
    expect(detail).toMatchObject({ versionCount: 2, latest: { number: 2 } });
  });

  it("double clic : deux envois simultanés de la même personne, une version rangée et un « stale » portant le numéro de la dernière", async () => {
    const c = await pendingContract();
    await addVersion(c, c.recruiter);
    const target = { documentId: (await t.db.document.findFirstOrThrow({ where: { contractId: c.id } })).id };
    const results = await Promise.all([documents(t.db).record({ userId: c.recruiter }, target, fileOf("a"), NOW, 1), documents(t.db).record({ userId: c.recruiter }, target, fileOf("a"), NOW, 1)]);
    expect(results.map((r) => r.kind).sort()).toEqual(["recorded", "stale"]);
    expect(results.find((r) => r.kind === "stale")).toEqual({ kind: "stale", latest: 2 });
    expect((await t.db.documentVersion.findMany({ where: { documentId: target.documentId }, orderBy: { number: "asc" } })).map((v) => v.number)).toEqual([1, 2]);
  });

  it("course entre les parties : la seconde, qui n'a pas vu la version de l'autre, ne l'écrase pas et reçoit « stale »", async () => {
    const c = await pendingContract();
    await addVersion(c, c.recruiter);
    const target = { documentId: (await t.db.document.findFirstOrThrow({ where: { contractId: c.id } })).id };
    const results = await Promise.all([documents(t.db).record({ userId: c.recruiter }, target, fileOf("entreprise"), NOW, 1), documents(t.db).record({ userId: c.freelanceUser }, target, fileOf("freelance"), NOW, 1)]);
    expect(results.map((r) => r.kind).sort()).toEqual(["recorded", "stale"]);
    expect(await t.db.documentVersion.count({ where: { documentId: target.documentId } })).toBe(2);
    // Elle recommence après avoir lu la version de l'autre : cette fois, la sienne se range à la suite.
    const loser = results[0]?.kind === "stale" ? c.recruiter : c.freelanceUser;
    expect(await documents(t.db).record({ userId: loser }, target, fileOf("après relecture"), NOW, 2)).toMatchObject({ kind: "recorded", version: { number: 3 } });
  });

  it("un envoi sur une version déjà dépassée est refusé aussi à la préparation, avant tout rendu", async () => {
    const c = await pendingContract();
    await addVersion(c, c.recruiter);
    await addVersion(c, c.freelanceUser, "correction");
    expect(await documents(t.db).prepare({ userId: c.recruiter }, contractTarget(c), 1)).toEqual({ kind: "stale", latest: 2 });
    expect(await documents(t.db).prepare({ userId: c.recruiter }, contractTarget(c), 2)).toMatchObject({ kind: "ready", nextVersion: 3 });
    // Attendre une version qui n'existe pas encore est tout aussi périmé.
    expect(await documents(t.db).prepare({ userId: c.recruiter }, contractTarget(c), 3)).toEqual({ kind: "stale", latest: 2 });
    expect(await documents(t.db).record({ userId: c.recruiter }, contractTarget(c), fileOf("tardive"), NOW, 1)).toEqual({ kind: "stale", latest: 2 });
    expect(await t.db.documentVersion.count({ where: { document: { contractId: c.id } } })).toBe(2);
  });

  it("deux ouvertures simultanées du même document n'en font qu'un : la seconde reçoit « stale » (elle attendait une première version)", async () => {
    const c = await pendingContract();
    const results = await Promise.all([documents(t.db).record({ userId: c.recruiter }, contractTarget(c), fileOf("a"), NOW, 0), documents(t.db).record({ userId: c.freelanceUser }, contractTarget(c), fileOf("b"), NOW, 0)]);
    expect(results.map((r) => r.kind).sort()).toEqual(["recorded", "stale"]);
    expect(results.find((r) => r.kind === "stale")).toEqual({ kind: "stale", latest: 1 });
    expect(await t.db.document.count({ where: { contractId: c.id } })).toBe(1);
    expect(await t.db.documentVersion.count({ where: { document: { contractId: c.id } } })).toBe(1);
  });

  it("attendre une version d'un document qui n'existe pas encore est périmé, et n'ouvre aucun document", async () => {
    const c = await pendingContract();
    expect(await documents(t.db).record({ userId: c.recruiter }, contractTarget(c), fileOf(), NOW, 3)).toEqual({ kind: "stale", latest: 0 });
    expect(await t.db.document.count({ where: { contractId: c.id } })).toBe(0);
  });

  it("une version ne se modifie pas (empreinte, clé, taille, raison, date, valeurs), ni ne se supprime, ni ne saute un numéro", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    const where = { documentId_number: { documentId: created.document.id, number: 1 } };
    await expect(t.db.documentVersion.update({ where, data: { sha256: "0".repeat(64) } })).rejects.toThrow(/immuable/);
    await expect(t.db.documentVersion.update({ where, data: { reason: "réécrite" } })).rejects.toThrow(/immuable/);
    await expect(t.db.documentVersion.update({ where, data: { contentDigest: "0".repeat(64) } })).rejects.toThrow(/immuable/);
    await expect(t.db.documentVersion.update({ where, data: { size: 1 } })).rejects.toThrow(/immuable/);
    await expect(t.db.documentVersion.update({ where, data: { storageKey: randomUUID() } })).rejects.toThrow(/immuable/);
    await expect(t.db.documentVersion.update({ where, data: { variables: { totalCents: 1 } } })).rejects.toThrow(/immuable/);
    await expect(t.db.documentVersion.update({ where, data: { createdAt: new Date("2020-01-01T00:00:00Z") } })).rejects.toThrow(/immuable/);
    await expect(t.db.documentVersion.update({ where, data: { authorId: c.freelanceUser } })).rejects.toThrow(/immuable/);
    await expect(t.db.documentVersion.delete({ where })).rejects.toThrow(/immuable et conservée/);
    await expect(t.db.document.delete({ where: { id: created.document.id } })).rejects.toThrow(/conservé avec lui/);
    const skipped = { documentId: created.document.id, number: 5, sha256: "a".repeat(64), contentDigest: "b".repeat(64), storageKey: randomUUID(), size: 10, contentType: "application/pdf", templateVersion: "1.0.0", engine: "pdfmake", variables: {}, reason: "trou" };
    await expect(t.db.documentVersion.create({ data: skipped })).rejects.toThrow(/sans trou/);
    expect(await t.db.documentVersion.findUniqueOrThrow({ where })).toMatchObject({ number: 1, size: 4321, reason: "première version" });
  });

  it("seule la référence à l'auteur peut disparaître (suppression de son compte)", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    await t.db.documentVersion.update({ where: { documentId_number: { documentId: created.document.id, number: 1 } }, data: { authorId: null } });
    expect((await documents(t.db).find({ userId: c.freelanceUser }, created.document.id))?.latest?.by).toBe("removed");
  });

  it("un document ne change ni de sorte, ni de gabarit, ni d'affaire, et ne tient qu'à une seule affaire", async () => {
    const c = await pendingContract();
    const other = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    await expect(t.db.document.update({ where: { id: created.document.id }, data: { type: "nda" } })).rejects.toThrow(/ne change ni de sorte/);
    await expect(t.db.document.update({ where: { id: created.document.id }, data: { templateId: "autre" } })).rejects.toThrow(/ne change ni de sorte/);
    await expect(t.db.document.update({ where: { id: created.document.id }, data: { contractId: other.id } })).rejects.toThrow(/ne change ni de sorte/);
    await expect(t.db.document.create({ data: { contractId: c.id, quoteId: c.quoteId, type: "nda", templateId: "nda", lang: "fr" } })).rejects.toThrow(/une seule affaire/);
    await expect(t.db.document.create({ data: { type: "nda", templateId: "nda", lang: "fr" } })).rejects.toThrow(/une seule affaire/);
  });

  it("un avenant de plus ouvre un nouveau document de même sorte, le suivant dans l'ordre", async () => {
    const c = await activeContract(t.db, { scope: SCOPE, deliverables: DELIVERABLES });
    const actor = { userId: c.recruiter };
    // Chaque avenant est un nouveau document : la première version de chacun est attendue à 0.
    const first = await documents(t.db).record(actor, { ...contractTarget(c, "amendment"), additional: true }, fileOf("avenant 1"), NOW, 0);
    const second = await documents(t.db).record(actor, { ...contractTarget(c, "amendment"), additional: true }, fileOf("avenant 2"), NOW, 0);
    if (first.kind !== "recorded" || second.kind !== "recorded") throw new Error("avenants non rangés");
    expect([first.document.slot, second.document.slot]).toEqual([1, 2]);
    expect(first.document.id).not.toBe(second.document.id);
    expect(await documents(t.db).list(actor, { kind: "contract", id: c.id })).toHaveLength(2);
  });
});

describe("journal d'accès en ajout seul", () => {
  it("consigne qui a créé, qui a ajouté une version, qui a téléchargé quoi et quand, sans rien de plus", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    const opened = await documents(t.db).open({ userId: c.freelanceUser }, created.document.id, 1, new Date("2026-11-21T09:00:00Z"));
    expect(opened).toMatchObject({ version: { number: 1, sha256: created.version.sha256 }, document: { id: created.document.id } });
    expect(opened?.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    const log = await t.db.documentAccess.findMany({ where: { documentId: created.document.id }, orderBy: [{ at: "asc" }, { id: "asc" }], select: { action: true, versionNumber: true, userId: true, at: true } });
    expect(log.map((l) => [l.action, l.versionNumber, l.userId])).toEqual([
      ["created", null, c.recruiter],
      ["version_created", 1, c.recruiter],
      ["downloaded", 1, c.freelanceUser],
    ]);
    expect(Object.keys(log[0] ?? {}).sort()).toEqual(["action", "at", "userId", "versionNumber"]);
  });

  it("ne consigne pas une ouverture refusée, et ne sert pas une version qui n'existe pas", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    expect(await documents(t.db).open({ userId: c.freelanceUser }, created.document.id, 2, NOW)).toBeNull();
    expect(await documents(t.db).open({ userId: c.freelanceUser }, created.document.id, 0, NOW)).toBeNull();
    expect(await t.db.documentAccess.count({ where: { documentId: created.document.id, action: "downloaded" } })).toBe(0);
  });

  it("une ligne du journal ne se modifie ni ne se supprime ; seule la référence à la personne peut disparaître", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    const line = await t.db.documentAccess.findFirstOrThrow({ where: { documentId: created.document.id, action: "version_created" } });
    await expect(t.db.documentAccess.update({ where: { id: line.id }, data: { action: "downloaded" } })).rejects.toThrow(/ajout seul/);
    await expect(t.db.documentAccess.update({ where: { id: line.id }, data: { at: new Date("2020-01-01T00:00:00Z") } })).rejects.toThrow(/ajout seul/);
    await expect(t.db.documentAccess.update({ where: { id: line.id }, data: { userId: c.freelanceUser } })).rejects.toThrow(/ajout seul/);
    await expect(t.db.documentAccess.delete({ where: { id: line.id } })).rejects.toThrow(/ajout seul/);
    await t.db.documentAccess.update({ where: { id: line.id }, data: { userId: null } });
    expect((await t.db.documentAccess.findUniqueOrThrow({ where: { id: line.id } })).userId).toBeNull();
  });
});

describe("stockage : le coffre partage le volume des dépôts", () => {
  it("les fichiers du coffre ne sont pas des orphelins pour le balayage, et comptent dans le plafond du volume", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    const key = (await t.db.documentVersion.findFirstOrThrow({ where: { documentId: created.document.id } })).storageKey;
    const stray = randomUUID();
    expect(await storedFiles(t.db).existing([key, stray])).toEqual(new Set([key]));
    const before = await storedFiles(t.db).totalBytes();
    await addVersion(c, c.recruiter, "deuxième");
    expect((await storedFiles(t.db).totalBytes()) - before).toBe(4321);
  });
});

describe("RGPD : export et effacement", () => {
  it("l'export du freelance et de l'entreprise liste les documents de leurs affaires (métadonnées et empreintes, jamais le contenu ni les valeurs du rendu) et leurs propres accès", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    await documents(t.db).open({ userId: c.freelanceUser }, created.document.id, 1, NOW);
    const mine = (await gdpr(t.db).exportUser(c.freelanceUser, NOW))?.documents as { documents: { id: string; forAContract: boolean; versions: { sha256: string; writtenByYou: boolean }[] }[]; myAccesses: { action: string }[] };
    const doc = mine.documents.find((d) => d.id === created.document.id);
    expect(doc).toMatchObject({ forAContract: true, versions: [{ sha256: created.version.sha256, writtenByYou: false }] });
    expect(mine.myAccesses.map((a) => a.action)).toEqual(["downloaded"]);
    expect(JSON.stringify(mine)).not.toContain("storageKey");
    expect(JSON.stringify(mine)).not.toContain("totalCents");
    const theirs = (await gdpr(t.db).exportUser(c.recruiter, NOW))?.documents as { documents: { id: string; versions: { writtenByYou: boolean }[] }[] };
    expect(theirs.documents.find((d) => d.id === created.document.id)?.versions[0]?.writtenByYou).toBe(true);
  });

  it("l'export ne montre pas à une personne étrangère les documents d'une autre affaire", async () => {
    const c = await pendingContract();
    await addVersion(c, c.recruiter);
    const stranger = await createUser(t.db);
    expect(((await gdpr(t.db).exportUser(stranger, NOW))?.documents as { documents: unknown[] }).documents).toEqual([]);
  });

  it("effacer le compte du freelance garde le document de son contrat (détaché, auteur et accès anonymisés) et la base refuse de le supprimer", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.freelanceUser);
    await documents(t.db).open({ userId: c.freelanceUser }, created.document.id, 1, NOW);
    await contracts(t.db).cancel({ userId: c.recruiter }, c.id);
    expect(await gdpr(t.db).eraseUser(c.freelanceUser)).toBe("erased");
    const kept = await t.db.document.findUniqueOrThrow({ where: { id: created.document.id }, select: { contractId: true, versions: { select: { authorId: true, sha256: true } } } });
    expect(kept.contractId).toBe(c.id);
    expect(kept.versions).toEqual([{ authorId: null, sha256: created.version.sha256 }]);
    expect(await t.db.documentAccess.count({ where: { documentId: created.document.id, userId: { not: null }, action: "downloaded" } })).toBe(0);
    // L'entreprise, elle, retrouve son document, et voit que l'auteur a disparu.
    expect((await documents(t.db).find({ userId: c.recruiter }, created.document.id))?.latest?.by).toBe("removed");
    await expect(t.db.document.delete({ where: { id: created.document.id } })).rejects.toThrow(/conservé avec lui/);
  });

  it("effacer le compte du freelance emporte les documents sans contrat (devis resté devis), versions et journal compris", async () => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    const freelance = await createUser(t.db);
    const profile = await createProfile(t.db, freelance);
    const contact = await messaging(t.db).contact({ userId: owner }, org, profile, "Bonjour");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: freelance }, contact.conversation.id, "accepted", NOW);
    const draft = await quotes(t.db).draft({ userId: freelance }, contact.conversation.id, { dailyRateCents: 60_000, days: 10, scope: SCOPE });
    await quotes(t.db).send({ userId: freelance }, draft?.id ?? "");
    const target: VersionTarget = { affair: { kind: "quote", id: draft?.id ?? "" }, type: "quote", lang: "fr" };
    const recorded = await documents(t.db).record({ userId: freelance }, target, { ...fileOf(), templateId: "quote" }, NOW, 0);
    if (recorded.kind !== "recorded") throw new Error(recorded.kind);
    const key = (await t.db.documentVersion.findFirstOrThrow({ where: { documentId: recorded.document.id } })).storageKey;

    expect(await gdpr(t.db).eraseUser(freelance)).toBe("erased");
    expect(await t.db.document.count({ where: { id: recorded.document.id } })).toBe(0);
    expect(await t.db.documentVersion.count({ where: { documentId: recorded.document.id } })).toBe(0);
    expect(await t.db.documentAccess.count({ where: { documentId: recorded.document.id } })).toBe(0);
    // Son fichier n'a plus de ligne : le balayage des orphelins l'efface.
    expect(await storedFiles(t.db).existing([key])).toEqual(new Set());
  });

  it("dit ce qui est conservé et ce qui part", async () => {
    const { RETAINED_AFTER_ERASURE } = await import("../src/gdpr");
    expect(RETAINED_AFTER_ERASURE.some((line) => line.includes("documents du coffre d'un contrat") && line.includes("10 ans"))).toBe(true);
    expect(RETAINED_AFTER_ERASURE.some((line) => line.includes("documents du coffre sans contrat"))).toBe(true);
  });
});

describe("valeurs figées d'une version (`frozen`), lues côté serveur par les parties seulement", () => {
  it("rend les valeurs, le gabarit et l'empreinte de contenu aux deux parties, et ne consigne rien", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    const stored = await t.db.documentVersion.findFirstOrThrow({ where: { documentId: created.document.id } });
    const logBefore = await t.db.documentAccess.count({ where: { documentId: created.document.id } });
    for (const userId of [c.recruiter, c.freelanceUser]) {
      expect(await documents(t.db).frozen({ userId }, created.document.id, 1)).toEqual({
        templateId: "service-agreement",
        templateVersion: "1.0.0",
        engine: "pdfmake@0.3.12",
        contentDigest: stored.contentDigest,
        variables: { totalCents: 600_000, currency: "EUR" },
      });
    }
    expect(await t.db.documentAccess.count({ where: { documentId: created.document.id } })).toBe(logBefore);
  });

  it("rend null à une personne étrangère, comme pour un document ou une version qui n'existe pas", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    const stranger = { userId: await createUser(t.db) };
    const actor = { userId: c.recruiter };
    expect(await documents(t.db).frozen(stranger, created.document.id, 1)).toBeNull();
    expect(await documents(t.db).frozen(actor, randomUUID(), 1)).toBeNull();
    expect(await documents(t.db).frozen(actor, "pas-un-uuid", 1)).toBeNull();
    for (const number of [0, -1, 2, 1.5, Number.NaN]) expect(await documents(t.db).frozen(actor, created.document.id, number)).toBeNull();
    // Le contrat voisin d'une même entreprise n'ouvre pas ce document.
    const other = await pendingContract();
    expect(await documents(t.db).frozen({ userId: other.recruiter }, created.document.id, 1)).toBeNull();
  });

  it("n'apparaît dans aucune lecture publique du dépôt : ni la liste, ni le détail, ni la version rangée", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    const reads = [created, await documents(t.db).list({ userId: c.freelanceUser }, { kind: "contract", id: c.id }), await documents(t.db).find({ userId: c.freelanceUser }, created.document.id), await documents(t.db).listMine({ userId: c.freelanceUser }, {})];
    expect(JSON.stringify(reads)).not.toContain("totalCents");
    expect(JSON.stringify(reads)).not.toContain("variables");
  });
});

describe("« Tous mes documents » (`listMine`) : filtres, tri, pagination par 50", () => {
  /** Des documents de plus sur un contrat, posés directement (un par rang) : rapide, et les dates sont celles qu'on choisit. */
  const seed = async (c: ActiveContract, count: number, authorId: string, type: "amendment" | "acceptance_report" = "amendment", firstDay = 1) => {
    const docs = Array.from({ length: count }, (_, i) => ({ id: randomUUID(), slot: i + 1 }));
    await t.db.document.createMany({ data: docs.map((d) => ({ id: d.id, contractId: c.id, type, slot: d.slot, templateId: "amendment", lang: "fr" })) });
    await t.db.documentVersion.createMany({
      data: docs.map((d, i) => ({
        documentId: d.id,
        number: 1,
        sha256: createHash("sha256").update(d.id).digest("hex"),
        contentDigest: createHash("sha256").update(`c${d.id}`).digest("hex"),
        storageKey: randomUUID(),
        size: 100,
        contentType: "application/pdf",
        templateVersion: "1",
        engine: "pdfmake",
        variables: {},
        reason: `avenant ${i + 1}`,
        authorId,
        createdAt: new Date(Date.UTC(2026, 10, firstDay, 8, i)),
      })),
    });
    return docs;
  };

  const mine = (userId: string, query: Parameters<ReturnType<typeof documents>["listMine"]>[1] = {}) => documents(t.db).listMine({ userId }, query);

  it("ne liste que les documents des affaires dont la personne est partie, des deux côtés, et rien à une personne étrangère", async () => {
    const c = await pendingContract();
    const created = await addVersion(c, c.recruiter);
    const colleague = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: c.org, userId: colleague, role: "member" } });
    const unrelated = await pendingContract();
    await addVersion(unrelated, unrelated.recruiter);
    for (const userId of [c.recruiter, c.freelanceUser, colleague]) {
      const page = await mine(userId);
      expect(page?.items.map((d) => d.id)).toEqual([created.document.id]);
      expect(page).toMatchObject({ total: 1, page: 1, pageSize: 50, pages: 1 });
    }
    expect(await mine(await createUser(t.db))).toEqual({ items: [], total: 0, page: 1, pageSize: 50, pages: 0 });
    // Le point de vue est celui de la personne : le même document se lit « vous » ou « l'autre partie » selon qui demande.
    expect((await mine(c.recruiter))?.items[0]?.latest?.by).toBe("you");
    expect((await mine(colleague))?.items[0]?.latest?.by).toBe("colleague");
    expect((await mine(c.freelanceUser))?.items[0]?.latest?.by).toBe("other_party");
  });

  it("l'entreprise ne voit pas les documents du brouillon d'un devis, le freelance si", async () => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    const freelance = await createUser(t.db);
    const profile = await createProfile(t.db, freelance);
    const contact = await messaging(t.db).contact({ userId: owner }, org, profile, "Bonjour");
    if (contact.kind !== "opened") throw new Error(contact.kind);
    await messaging(t.db).decide({ userId: freelance }, contact.conversation.id, "accepted", NOW);
    const draft = await quotes(t.db).draft({ userId: freelance }, contact.conversation.id, { dailyRateCents: 60_000, days: 10, scope: SCOPE });
    const quoteId = draft?.id ?? "";
    const doc = await t.db.document.create({ data: { quoteId, type: "quote", templateId: "quote", lang: "fr" } });
    await t.db.documentVersion.create({
      data: { documentId: doc.id, number: 1, sha256: "a".repeat(64), contentDigest: "b".repeat(64), storageKey: randomUUID(), size: 10, contentType: "application/pdf", templateVersion: "1", engine: "pdfmake", variables: {}, reason: "brouillon", authorId: freelance, createdAt: NOW },
    });
    expect((await mine(freelance))?.items.map((d) => d.id)).toEqual([doc.id]);
    expect((await mine(owner))?.items).toEqual([]);
    await quotes(t.db).send({ userId: freelance }, quoteId);
    expect((await mine(owner))?.items.map((d) => d.id)).toEqual([doc.id]);
  });

  it("filtre par sorte et par auteur de la dernière version (« moi » ou « un autre »)", async () => {
    const c = await activeContract(t.db, { scope: SCOPE, deliverables: DELIVERABLES });
    await seed(c, 2, c.recruiter, "amendment", 1);
    await seed(c, 1, c.freelanceUser, "acceptance_report", 5);
    expect((await mine(c.recruiter))?.total).toBe(3);
    expect((await mine(c.recruiter, { type: "amendment" }))?.items.map((d) => d.type)).toEqual(["amendment", "amendment"]);
    expect((await mine(c.recruiter, { type: "nda" }))?.total).toBe(0);
    expect((await mine(c.recruiter, { by: "you" }))?.total).toBe(2);
    expect((await mine(c.recruiter, { by: "other" }))?.items.map((d) => d.type)).toEqual(["acceptance_report"]);
    expect((await mine(c.freelanceUser, { by: "you" }))?.items.map((d) => d.type)).toEqual(["acceptance_report"]);
    expect((await mine(c.freelanceUser, { by: "other", type: "amendment" }))?.total).toBe(2);
    expect((await mine(c.recruiter, { by: "you", type: "acceptance_report" }))?.total).toBe(0);
  });

  it("trie par date de dépôt de la dernière version (décroissante par défaut), ancienneté ou sorte", async () => {
    const c = await activeContract(t.db, { scope: SCOPE, deliverables: DELIVERABLES });
    await seed(c, 3, c.recruiter, "amendment", 1);
    const [late] = await seed(c, 1, c.freelanceUser, "acceptance_report", 9);
    const reasons = async (sort?: "recent" | "oldest" | "type") => (await mine(c.recruiter, sort === undefined ? {} : { sort }))?.items.map((d) => d.latest?.reason);
    // Le plus récent d'abord : le procès-verbal du 9, puis les avenants du 1er (3, 2, 1).
    expect(await reasons()).toEqual(["avenant 1", "avenant 3", "avenant 2", "avenant 1"]);
    expect(await reasons("recent")).toEqual(await reasons());
    expect(await reasons("oldest")).toEqual(["avenant 1", "avenant 2", "avenant 3", "avenant 1"]);
    // Par sorte : « acceptance_report » avant « amendment », puis le plus récent d'abord.
    expect((await mine(c.recruiter, { sort: "type" }))?.items.map((d) => d.id)[0]).toBe(late?.id);
    expect(await reasons("type")).toEqual(["avenant 1", "avenant 3", "avenant 2", "avenant 1"]);
  });

  it("pagine par 50 sans doublon ni trou, et dit le total ; une page au-delà du bout est vide", async () => {
    const c = await activeContract(t.db, { scope: SCOPE, deliverables: DELIVERABLES });
    await seed(c, 55, c.recruiter);
    const first = await mine(c.recruiter, { page: 1 });
    const second = await mine(c.recruiter, { page: 2 });
    expect(first).toMatchObject({ total: 55, page: 1, pageSize: 50, pages: 2 });
    expect(first?.items).toHaveLength(50);
    expect(second?.items).toHaveLength(5);
    const ids = [...(first?.items ?? []), ...(second?.items ?? [])].map((d) => d.id);
    expect(new Set(ids).size).toBe(55);
    // Plus récent d'abord : la page 2 ne porte que les plus anciens.
    expect(second?.items.map((d) => d.latest?.reason)).toEqual(["avenant 5", "avenant 4", "avenant 3", "avenant 2", "avenant 1"]);
    expect(await mine(c.recruiter, { page: 3 })).toMatchObject({ items: [], total: 55, page: 3, pages: 2 });
    // Les filtres comptent avant la pagination.
    expect((await mine(c.recruiter, { type: "amendment", by: "you", page: 2 }))?.total).toBe(55);
    expect((await mine(c.recruiter, { by: "other" }))?.total).toBe(0);
  });

  it("refuse une demande invalide (null), sans rien lire", async () => {
    const userId = await createUser(t.db);
    for (const query of [{ page: 0 }, { page: -1 }, { page: 1.5 }, { page: 10_001 }, { type: "poem" }, { by: "everyone" }, { sort: "random" }]) {
      expect(await mine(userId, query as never)).toBeNull();
    }
  });
});
