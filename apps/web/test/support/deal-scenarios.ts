import { billing, contracts, messaging, payments, quotes, type Db, type LegalSnapshot } from "@proofseen/db";
import { createOrganisation, createProfile, createUser, fakeGateway, nextSiret, payAndHold, verifiedVigilance } from "../../../../packages/db/test/support/database";

/*
 * Deals at each stage, on a real test database (PGlite), for the server renders of lot 4. Built with the repositories
 * the screens use, never by writing a status by hand: a payment is opened, held and paid out through the fake gateway
 * of packages/db, so no call ever reaches Stripe. Names are the longest the screens must hold at 375 px.
 */

export type DealStage = "contact_pending" | "quote_sent" | "to_sign" | "signed" | "held" | "released" | "cancelled";

export interface DealScenario {
  readonly recruiter: { readonly userId: string };
  readonly freelance: { readonly userId: string };
  readonly organisationId: string;
  readonly profileId: string;
  readonly conversationId: string;
  readonly contractId: string | null;
}

const ADDRESS = { line1: "128 boulevard de la Croix-Rousse", postalCode: "69004", city: "Lyon", country: "FR" };
export const PROOFSEEN_TEST: LegalSnapshot = { legalName: "Proofseen (test)", siret: "12345678900011", vatNumber: "FR12123456789", address: ADDRESS, vatRateBp: 2000 };
export const LONG_COMPANY = "Compagnie Générale d'Ingénierie et de Conseil en Systèmes d'Information SAS";
export const LONG_FREELANCE = "Marie-Christine Delaunay-Fontaine EI";

const ORDER: readonly DealStage[] = ["contact_pending", "quote_sent", "to_sign", "signed", "held", "released"];
const reached = (stage: DealStage, step: DealStage): boolean => (stage === "cancelled" ? ORDER.indexOf(step) <= ORDER.indexOf("to_sign") : ORDER.indexOf(step) <= ORDER.indexOf(stage));

/** A company, a freelancer with a payout account and a verified URSSAF certificate, and their deal up to `stage`. */
export const dealScenario = async (db: Db, stage: DealStage, now: Date): Promise<DealScenario> => {
  const recruiter = { userId: await createUser(db) };
  const organisationId = await createOrganisation(db, recruiter.userId);
  const freelance = { userId: await createUser(db) };
  const profileId = await createProfile(db, freelance.userId);
  await verifiedVigilance(db, profileId);
  await billing(db).setFreelanceIdentity(freelance, { acceptInvoicingMandate: true, legalName: LONG_FREELANCE, siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  await billing(db).setOrganisationIdentity(recruiter, organisationId, { legalName: LONG_COMPANY, address: ADDRESS });
  await db.billingIdentity.update({ where: { profileId }, data: { stripeAccountId: `acct_test${Math.random().toString(36).slice(2, 10)}`, payoutsEnabledAt: now, registryStatus: "active", registryCheckedAt: now } });

  const contact = await messaging(db).contact(recruiter, organisationId, profileId, "Bonjour, une mission de six semaines sur la plateforme de données.");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  const conversationId = contact.conversation.id;
  const done = (contractId: string | null): DealScenario => ({ recruiter, freelance, organisationId, profileId, conversationId, contractId });
  if (stage === "contact_pending") return done(null);

  await messaging(db).decide(freelance, conversationId, "accepted", now);
  const draft = await quotes(db).draft(freelance, conversationId, { dailyRateCents: 65_000, days: 30 });
  if (draft === null) throw new Error("devis non rédigé");
  await quotes(db).send(freelance, draft.id);
  if (stage === "quote_sent") return done(null);

  await quotes(db).decide(recruiter, draft.id, "accepted");
  const created = await contracts(db).createFromQuote(recruiter, draft.id, { startsOn: "2026-11-02", endsOn: "2026-12-11" });
  if (created.kind !== "created") throw new Error(created.kind);
  const contractId = created.contract.id;
  await contracts(db).sign(recruiter, contractId, now);
  if (stage === "cancelled") {
    await contracts(db).cancel(recruiter, contractId);
    return done(contractId);
  }
  if (!reached(stage, "signed")) return done(contractId);

  await contracts(db).sign(freelance, contractId, now);
  if (!reached(stage, "held")) return done(contractId);

  const { gateway } = fakeGateway();
  await payAndHold(db, recruiter.userId, contractId, gateway);
  if (!reached(stage, "released")) return done(contractId);

  const completed = await contracts(db).complete(recruiter, contractId);
  if (completed.kind !== "completed") throw new Error(completed.kind);
  const released = await payments(db).release(contractId, gateway, PROOFSEEN_TEST, now);
  if (released.kind !== "released") throw new Error(released.kind);
  return done(contractId);
};
