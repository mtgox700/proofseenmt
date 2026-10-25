import { billing } from "../../src/billing";
import type { Db } from "../../src/client";
import { contracts, type ContractsOptions } from "../../src/contracts";
import { messaging } from "../../src/messaging";
import { quotes } from "../../src/quotes";
import { createOrganisation, createProfile, createUser, nextSiret, verifiedVigilance } from "./database";

const ADDRESS = { line1: "1 rue de Test", postalCode: "75001", city: "Paris", country: "FR" };
export const SIGNED_AT = new Date("2026-11-20T10:00:00Z");

export interface ActiveContract {
  readonly id: string;
  readonly recruiter: string;
  readonly freelanceUser: string;
  readonly org: string;
  readonly profile: string;
  /** Le devis dont le contrat est né, et le fil. */
  readonly quoteId: string;
  readonly conversationId: string;
}

export interface ActiveContractOptions {
  readonly days?: number;
  readonly contracts?: ContractsOptions;
  /** L'objet du devis (et du contrat) ; sans lui, comme un devis d'avant le coffre. */
  readonly scope?: string;
  readonly deliverables?: readonly string[];
  /** Faux : le contrat reste à signer (aucune partie n'a accepté). */
  readonly signed?: boolean;
}

/** Un contrat actif (signé des deux côtés) de `days` jours à 600 € HT, d'un freelance qui peut recevoir des versements. */
export const activeContract = async (db: Db, opts: ActiveContractOptions = {}): Promise<ActiveContract> => {
  const recruiter = await createUser(db);
  const org = await createOrganisation(db, recruiter);
  const freelanceUser = await createUser(db);
  const profile = await createProfile(db, freelanceUser);
  await verifiedVigilance(db, profile);
  await billing(db).setFreelanceIdentity({ userId: freelanceUser }, { acceptInvoicingMandate: true, legalName: "Camille Test EI", siret: nextSiret("552100554"), vatNumber: "FR40552100554", address: ADDRESS, vatRateBp: 2000 });
  await billing(db).setOrganisationIdentity({ userId: recruiter }, org, { legalName: "Acme SAS", address: ADDRESS });
  await db.billingIdentity.update({ where: { profileId: profile }, data: { stripeAccountId: `acct_test${Math.random().toString(36).slice(2, 10)}`, payoutsEnabledAt: SIGNED_AT } });
  const contact = await messaging(db).contact({ userId: recruiter }, org, profile, "Bonjour");
  if (contact.kind !== "opened") throw new Error(contact.kind);
  await messaging(db).decide({ userId: freelanceUser }, contact.conversation.id, "accepted", SIGNED_AT);
  const draft = await quotes(db).draft({ userId: freelanceUser }, contact.conversation.id, {
    dailyRateCents: 60_000,
    days: opts.days ?? 10,
    ...(opts.scope === undefined ? {} : { scope: opts.scope }),
    ...(opts.deliverables === undefined ? {} : { deliverables: [...opts.deliverables] }),
  });
  await quotes(db).send({ userId: freelanceUser }, draft?.id ?? "");
  await quotes(db).decide({ userId: recruiter }, draft?.id ?? "", "accepted");
  const created = await contracts(db, opts.contracts).createFromQuote({ userId: recruiter }, draft?.id ?? "", { startsOn: "2026-11-02" });
  if (created.kind !== "created") throw new Error(created.kind);
  if (opts.signed !== false) {
    await contracts(db).sign({ userId: recruiter }, created.contract.id, SIGNED_AT);
    await contracts(db).sign({ userId: freelanceUser }, created.contract.id, SIGNED_AT);
  }
  return { id: created.contract.id, recruiter, freelanceUser, org, profile, quoteId: draft?.id ?? "", conversationId: contact.conversation.id };
};
