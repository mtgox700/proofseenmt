"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { missionConfirmations, type RequestConfirmationResult } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { confirmationFromForm } from "@/lib/confirmation-form";
import { confirmationSecret, confirmationToken } from "@/lib/confirmation-secret";
import { actionMarket, langOf, uuidOf, type Market } from "@/lib/market";

/*
 * Server actions of the freelancer's verified missions: ask a client to confirm a past mission, or withdraw a pending
 * request. Keyed on the session's own user; the repository refuses self-confirmation, caps pending requests and
 * publishes nothing until the client answers. Each request may send an e-mail to a third party: throttled hard.
 */

const REQUEST_RULE = { windowMs: 24 * 60 * 60_000, max: 10 };
const WITHDRAW_RULE = { windowMs: 60_000, max: 20 };

const page = (lang: string, query: string): string => `/${lang}/app/preuves?${query}#missions`;

const REQUEST_ERRORS: Readonly<Record<Exclude<RequestConfirmationResult["kind"], "requested">, string>> = {
  invalid: "invalide",
  no_profile: "profil",
  limit: "limite",
  future: "future",
  self_confirmation: "soi",
  contact_required: "contact",
  contact_limit: "contact-limite",
};

const freelanceMarket = async (lang: ReturnType<typeof langOf>): Promise<Market> => {
  const market = await actionMarket(lang);
  if (market.person.role !== "freelance") redirect(`/${lang}/app`);
  return market;
};

export async function requestMissionConfirmation(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await freelanceMarket(lang);
  if (await throttled("mission-confirmation", market.actor.userId, REQUEST_RULE, new Date())) redirect(page(lang, "mission-erreur=trop"));
  // The link's token is derived from the request id: without the secret, no link could ever be sent.
  const secret = confirmationSecret();
  if (secret === null) redirect(page(lang, "mission-erreur=indisponible"));
  const id = randomUUID();
  const result = await missionConfirmations(market.db).request(market.actor, confirmationFromForm(formData), { id, token: confirmationToken(secret, id) }, lang, new Date());
  redirect(page(lang, result.kind === "requested" ? `mission=${result.target === "organisation" ? "entreprise" : "email"}` : `mission-erreur=${REQUEST_ERRORS[result.kind]}`));
}

export async function withdrawMissionConfirmation(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await freelanceMarket(lang);
  if (await throttled("mission-confirmation-withdraw", market.actor.userId, WITHDRAW_RULE, new Date())) redirect(page(lang, "mission-erreur=trop"));
  const id = uuidOf(formData.get("id"));
  const withdrawn = id === null ? false : await missionConfirmations(market.db).withdraw(market.actor, id);
  redirect(page(lang, withdrawn ? "mission=retiree" : "mission-erreur=introuvable"));
}
