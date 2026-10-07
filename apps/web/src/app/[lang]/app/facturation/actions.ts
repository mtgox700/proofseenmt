"use server";

import { redirect } from "next/navigation";
import { billing, profiles, vigilance, VigilanceInputSchema } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { billingFromForm } from "@/lib/billing-form";
import { actionMarket, currentOrganisation, langOf } from "@/lib/market";

/*
 * Server actions of billing: the freelancer's identity (with the invoicing mandate), the company's legal identity, and
 * the URSSAF vigilance certificate. The registry check of a new SIRET is run by the periodic job, never on submit.
 */

const RULE = { windowMs: 60 * 60_000, max: 20 };

const page = (lang: string, query: string): string => `/${lang}/app/facturation?${query}`;

export async function saveBilling(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("billing", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const input = billingFromForm(formData);
  if (!input.success) redirect(page(lang, "erreur=invalide"));
  const repo = billing(market.db);
  const company = market.person.role === "company";
  const organisation = company ? await currentOrganisation(market) : null;
  if (company && organisation === null) redirect(`/${lang}/app`);
  const result =
    organisation === null
      ? await repo.setFreelanceIdentity(market.actor, input.data)
      : // A company's identity carries no invoicing mandate: only the freelancer gives one.
        await repo.setOrganisationIdentity(market.actor, organisation.id, { ...input.data, acceptInvoicingMandate: false });
  redirect(page(lang, result === "saved" ? "enregistre=1" : result === "siret_taken" ? "erreur=siret" : market.person.role === "company" ? "erreur=admin" : "erreur=profil"));
}

export async function declareVigilance(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("vigilance", market.actor.userId, RULE, new Date())) redirect(page(lang, "vigilance=trop"));
  const input = VigilanceInputSchema.safeParse({ issuedOn: formData.get("issuedOn"), securityCode: formData.get("securityCode") });
  if (!input.success) redirect(page(lang, "vigilance=invalide"));
  if ((await profiles(market.db).findMine(market.actor)) === null) redirect(page(lang, "erreur=profil"));
  const result = await vigilance(market.db).declare(market.actor, input.data, new Date());
  redirect(page(lang, result.kind === "saved" ? "vigilance=ok" : `vigilance=${result.kind === "no_profile" ? "invalide" : result.kind}`));
}
