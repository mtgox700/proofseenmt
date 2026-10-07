import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applications } from "../src/applications";
import { billing, type LegalSnapshot } from "../src/billing";
import { contracts } from "../src/contracts";
import { NO_CONTACT } from "../src/contact-detection";
import { organisations } from "../src/organisations";
import { MAX_CONTACTS_PER_ORGANISATION_PER_DAY, messaging } from "../src/messaging";
import { missions, type MissionInput } from "../src/missions";
import { payments } from "../src/payments";
import { profiles } from "../src/profiles";
import { publicProfiles } from "../src/public-profiles";
import { MIN_QUOTE_TOTAL_CENTS, quotes } from "../src/quotes";
import { reviews } from "../src/reviews";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, fakeGateway, openTestDatabase, payAndHold, type TestDatabase, verifiedVigilance, nextSiret } from "./support/database";

/*
 * Chaque contournement trouvé par la red team du sprint C6 (2026-10-06), rejoué. Un test par scénario : s'il repasse un
 * jour, le contournement est revenu.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const MISSION: MissionInput = { title: "Data engineer", description: "Pipeline Spark.", workMode: "remote", skills: ["Spark"] };
const SNAPSHOT = { legalName: "Test", country: "FR" };

const setup = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  const freelanceUser = await createUser(t.db);
  const profile = await createProfile(t.db, freelanceUser);
  await verifiedVigilance(t.db, profile);
  return { recruiter, org, freelanceUser, profile };
};

const rejectsContact = async (promise: Promise<unknown>): Promise<void> => {
  await expect(promise).rejects.toThrow(NO_CONTACT);
};

describe("coordonnées dans les champs publics", () => {
  it("refuse une adresse dans le résumé, le titre, la ville ou une compétence du profil", async () => {
    const s = await setup();
    const base = { headline: "Data engineer", summary: "Spark et Kafka.", city: "Lyon", workMode: "remote" as const, skills: ["Spark"] };
    await rejectsContact(profiles(t.db).update({ userId: s.freelanceUser }, { ...base, summary: "écrivez à jean@outlook.fr" }));
    await rejectsContact(profiles(t.db).update({ userId: s.freelanceUser }, { ...base, headline: "Dev 06 12 34 56 78" }));
    await rejectsContact(profiles(t.db).update({ userId: s.freelanceUser }, { ...base, city: "Lyon linktr.ee/jean" }));
    await rejectsContact(profiles(t.db).update({ userId: s.freelanceUser }, { ...base, skills: ["Spark", "whats app"] }));
    expect(await profiles(t.db).update({ userId: s.freelanceUser }, base)).not.toBeNull();
  });

  it("ne publie jamais un nom affiché qui est une adresse e-mail : la page montre la référence", async () => {
    const s = await setup();
    const row = await t.db.freelanceProfile.update({ where: { id: s.profile }, data: { visibility: "named" }, select: { slug: true } });
    await t.db.user.update({ where: { id: s.freelanceUser }, data: { displayName: "jean.dupont@gmail.com" } });
    expect(await publicProfiles(t.db).page(row.slug ?? "")).toMatchObject({ visibility: "named", displayName: null });
    await t.db.user.update({ where: { id: s.freelanceUser }, data: { displayName: "Jean Dupont" } });
    expect(await publicProfiles(t.db).page(row.slug ?? "")).toMatchObject({ displayName: "Jean Dupont" });
  });

  it("refuse des coordonnées dans le nom d'une entreprise, la ville ou les compétences d'une mission", async () => {
    const s = await setup();
    const address = { line1: "1 rue de la Paix", postalCode: "75002", city: "Paris", country: "FR" };
    await rejectsContact(billing(t.db).setOrganisationIdentity({ userId: s.recruiter }, s.org, { legalName: "ACME rh@acme.fr", address }));
    await rejectsContact(missions(t.db).create({ userId: s.recruiter }, s.org, { ...MISSION, workMode: "onsite", city: "Paris 0612345678" }));
    await rejectsContact(missions(t.db).create({ userId: s.recruiter }, s.org, { ...MISSION, skills: ["Spark", "cutt.ly/x"] }));
  });
});

describe("coordonnées dans les échanges, avant tout contrat", () => {
  it("refuse une note de candidature qui contient des coordonnées, sans créer de candidature", async () => {
    const s = await setup();
    const mission = (await missions(t.db).create({ userId: s.recruiter }, s.org, MISSION))?.id ?? "";
    await missions(t.db).publish({ userId: s.recruiter }, mission, new Date());
    expect(await applications(t.db).apply({ userId: s.freelanceUser }, mission, "Dispo, appelez-moi au 06 12 34 56 78", new Date())).toEqual({ kind: "contact_details" });
    expect(await t.db.application.count({ where: { jobPostId: mission } })).toBe(0);
    expect(await applications(t.db).apply({ userId: s.freelanceUser }, mission, "Disponible dès lundi.", new Date())).toMatchObject({ kind: "applied" });
  });

  it("refuse des coordonnées dans un fil accepté tant qu'aucun paiement n'est engagé, les laisse passer après", async () => {
    const s = await setup();
    const opened = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour, êtes-vous disponible ?");
    if (opened.kind !== "opened") throw new Error("fil non ouvert");
    const id = opened.conversation.id;
    await messaging(t.db).decide({ userId: s.freelanceUser }, id, "accepted", new Date());

    expect(await messaging(t.db).post({ userId: s.freelanceUser }, id, "Écrivez-moi à jean@outlook.fr")).toEqual({ kind: "contact_details" });
    expect(await messaging(t.db).post({ userId: s.recruiter }, id, "Appelez le 06 12 34 56 78")).toEqual({ kind: "contact_details" });

    const contract = await t.db.contract.create({
      data: {
        organisationId: s.org, profileId: s.profile, dailyRateCents: 50000, days: 2, totalCents: 100000, currency: "EUR",
        sellerSnapshot: SNAPSHOT, buyerSnapshot: SNAPSHOT, startsOn: new Date("2026-12-01"), status: "active",
        acceptedByFreelanceAt: new Date(), acceptedByOrgAt: new Date(),
      },
      select: { id: true },
    });
    const payment = await t.db.payment.create({ data: { contractId: contract.id, amountCents: 100000, commissionCents: 10000, currency: "EUR", stripeIntentId: `pi_${contract.id}` }, select: { id: true } });
    await t.db.payment.update({ where: { id: payment.id }, data: { status: "held" } });
    expect(await messaging(t.db).post({ userId: s.freelanceUser }, id, "Écrivez-moi à jean@outlook.fr")).toMatchObject({ kind: "sent", message: { containsContact: true } });
  });

  it("refuse une nouvelle prise de contact après un refus du freelance", async () => {
    const s = await setup();
    const opened = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour, êtes-vous disponible ?");
    if (opened.kind !== "opened") throw new Error("fil non ouvert");
    await messaging(t.db).decide({ userId: s.freelanceUser }, opened.conversation.id, "declined", new Date());
    const again = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Et maintenant ?");
    expect(again).toMatchObject({ kind: "existing", conversation: { id: opened.conversation.id } });
    expect(await messaging(t.db).post({ userId: s.recruiter }, opened.conversation.id, "Vraiment ?")).toEqual({ kind: "closed" });
  });

  it(`plafonne une entreprise à ${MAX_CONTACTS_PER_ORGANISATION_PER_DAY} prises de contact par jour`, async () => {
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    for (let i = 0; i < MAX_CONTACTS_PER_ORGANISATION_PER_DAY; i += 1) {
      const target = await createProfile(t.db, await createUser(t.db));
      expect(await messaging(t.db).contact({ userId: recruiter }, org, target, "Bonjour, êtes-vous disponible ?")).toMatchObject({ kind: "opened" });
    }
    const oneMore = await createProfile(t.db, await createUser(t.db));
    expect(await messaging(t.db).contact({ userId: recruiter }, org, oneMore, "Bonjour, êtes-vous disponible ?")).toEqual({ kind: "limit" });
  }, 120_000);
});

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
const PROOFSEEN: LegalSnapshot = { legalName: "Proofseen (test)", siret: "12345678900011", vatNumber: "FR12123456789", address: ADDRESS, vatRateBp: 2000 };
const NOW = new Date("2026-11-20T10:00:00Z");

/** Un fil accepté entre une entreprise et un freelance qui ont tous deux leur identité de facturation. */
const parties = async (orgSiret = nextSiret("732829320")) => {
  const s = await setup();
  await billing(t.db).setFreelanceIdentity({ userId: s.freelanceUser }, { legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  await billing(t.db).setOrganisationIdentity({ userId: s.recruiter }, s.org, { legalName: "Acme SAS", siret: orgSiret, address: ADDRESS });
  await t.db.billingIdentity.update({ where: { profileId: s.profile }, data: { stripeAccountId: `acct_test${Math.random().toString(36).slice(2, 10)}`, payoutsEnabledAt: NOW } });
  const contact = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, "Bonjour, une mission ?");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(t.db).decide({ userId: s.freelanceUser }, contact.conversation.id, "accepted", NOW);
  return { ...s, conversation: contact.conversation.id };
};

const acceptedQuote = async (p: Awaited<ReturnType<typeof parties>>): Promise<string> => {
  const draft = await quotes(t.db).draft({ userId: p.freelanceUser }, p.conversation, { dailyRateCents: 60_000, days: 10 });
  await quotes(t.db).send({ userId: p.freelanceUser }, draft?.id ?? "");
  const decided = await quotes(t.db).decide({ userId: p.recruiter }, draft?.id ?? "", "accepted");
  if (decided.kind !== "ok") throw new Error(decided.kind);
  return decided.quote.id;
};

/** Un contrat signé, payé, validé et versé. */
const paidContract = async () => {
  const p = await parties();
  const created = await contracts(t.db).createFromQuote({ userId: p.recruiter }, await acceptedQuote(p), { startsOn: "2026-11-02" });
  if (created.kind !== "created") throw new Error(created.kind);
  const id = created.contract.id;
  await contracts(t.db).sign({ userId: p.recruiter }, id, NOW);
  await contracts(t.db).sign({ userId: p.freelanceUser }, id, NOW);
  const { gateway } = fakeGateway();
  const intent = await payAndHold(t.db, p.recruiter, id, gateway);
  await contracts(t.db).complete({ userId: p.recruiter }, id);
  expect(await payments(t.db).release(id, gateway, PROOFSEEN, NOW)).toMatchObject({ kind: "released" });
  return { ...p, contract: id, intent };
};

describe("avis et contrats : ce qui ne s'achète pas", () => {
  it("un avis disparaît quand le paiement est rétrofacturé, et ne peut plus être écrit", async () => {
    const reviewed = await paidContract();
    expect(await reviews(t.db).write({ userId: reviewed.recruiter }, reviewed.contract, { rating: 1, body: "Travail bâclé." })).toMatchObject({ kind: "written" });
    expect(await reviews(t.db).listForProfile(reviewed.profile)).toHaveLength(1);
    await payments(t.db).applyEvent({ id: `evt_cb_${reviewed.contract}`, type: "dispute.opened", intentId: reviewed.intent }, NOW);
    await payments(t.db).applyEvent({ id: `evt_cbl_${reviewed.contract}`, type: "dispute.closed", intentId: reviewed.intent, won: false }, NOW);
    expect(await reviews(t.db).listForProfile(reviewed.profile)).toEqual([]);

    const disputed = await paidContract();
    await payments(t.db).applyEvent({ id: `evt_cb_${disputed.contract}`, type: "dispute.opened", intentId: disputed.intent }, NOW);
    expect(await reviews(t.db).write({ userId: disputed.recruiter }, disputed.contract, { rating: 1, body: "Travail bâclé." })).toEqual({ kind: "not_eligible" });
  });

  it("la base refuse qu'un freelance devenu membre de l'entreprise évalue sa propre mission", async () => {
    const c = await paidContract();
    await t.db.membership.create({ data: { organisationId: c.org, userId: c.freelanceUser, role: "member" } });
    await expect(t.db.review.create({ data: { contractId: c.contract, authorUserId: c.freelanceUser, targetProfileId: c.profile, rating: 5, body: "Parfait." } })).rejects.toThrow(/soi-même/);
  });

  it(`refuse un devis sous ${MIN_QUOTE_TOTAL_CENTS / 100} : un contrat à quelques centimes n'achète qu'un avis`, async () => {
    const p = await parties();
    await expect(quotes(t.db).draft({ userId: p.freelanceUser }, p.conversation, { dailyRateCents: 1, days: 1 })).rejects.toThrow(/minimum/);
    expect(await quotes(t.db).draft({ userId: p.freelanceUser }, p.conversation, { dailyRateCents: MIN_QUOTE_TOTAL_CENTS, days: 1 })).not.toBeNull();
  });

  it("refuse un contrat avec soi-même (même SIREN, ou freelance membre de l'entreprise) et libère le fil", async () => {
    const p = await parties("55210055400033");
    expect(await contracts(t.db).createFromQuote({ userId: p.recruiter }, await acceptedQuote(p), { startsOn: "2026-11-02" })).toEqual({ kind: "self_dealing" });
    // Le devis refusé est clos : un nouveau devis peut être accepté dans le même fil.
    await expect(acceptedQuote(p)).resolves.toBeTypeOf("string");

    const insider = await parties();
    await t.db.membership.create({ data: { organisationId: insider.org, userId: insider.freelanceUser, role: "member" } });
    expect(await contracts(t.db).createFromQuote({ userId: insider.recruiter }, await acceptedQuote(insider), { startsOn: "2026-11-02" })).toEqual({ kind: "self_dealing" });
  });

  it("refuse un nom d'organisation qui donne un moyen de joindre quelqu'un, garde un nom de domaine", async () => {
    const owner = await createUser(t.db);
    await expect(organisations(t.db).create({ userId: owner }, { name: "Jean 06 12 34 56 78", kind: "pme" })).rejects.toThrow(NO_CONTACT);
    await expect(organisations(t.db).create({ userId: owner }, { name: "Booking.com", kind: "pme" })).resolves.toBeTruthy();
  });

  it("un contrat signé sans paiement n'ouvre pas l'échange de coordonnées", async () => {
    const p = await parties();
    const created = await contracts(t.db).createFromQuote({ userId: p.recruiter }, await acceptedQuote(p), { startsOn: "2026-11-02" });
    if (created.kind !== "created") throw new Error(created.kind);
    await contracts(t.db).sign({ userId: p.recruiter }, created.contract.id, NOW);
    await contracts(t.db).sign({ userId: p.freelanceUser }, created.contract.id, NOW);
    expect(await messaging(t.db).post({ userId: p.freelanceUser }, p.conversation, "Mon numéro : 06 12 34 56 78")).toEqual({ kind: "contact_details" });
    await payAndHold(t.db, p.recruiter, created.contract.id);
    expect(await messaging(t.db).post({ userId: p.freelanceUser }, p.conversation, "Mon numéro : 06 12 34 56 78")).toMatchObject({ kind: "sent" });
  });

  it("un contrat annulé ou terminé libère le fil pour un nouveau devis et un nouveau contrat", async () => {
    const p = await parties();
    const first = await contracts(t.db).createFromQuote({ userId: p.recruiter }, await acceptedQuote(p), { startsOn: "2026-11-02" });
    if (first.kind !== "created") throw new Error(first.kind);
    expect(await contracts(t.db).cancel({ userId: p.recruiter }, first.contract.id)).not.toBeNull();
    const second = await contracts(t.db).createFromQuote({ userId: p.recruiter }, await acceptedQuote(p), { startsOn: "2026-12-01" });
    expect(second).toMatchObject({ kind: "created" });

    const done = await paidContract();
    expect(await contracts(t.db).createFromQuote({ userId: done.recruiter }, await acceptedQuote(done), { startsOn: "2027-01-04" })).toMatchObject({ kind: "created" });
  });
});
