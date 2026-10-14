"use server";

import { redirect } from "next/navigation";
import { missionConfirmations, type ConfirmationDecideResult } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { decisionFromForm } from "@/lib/confirmation-form";
import { actionMarket, langOf, uuidOf } from "@/lib/market";

/*
 * A company owner or administrator confirms or declines a freelancer's mission. The request id comes from the form,
 * but the repository only finds it among the requests addressed to a company the person administers: any other id
 * reads as "not found". The company name is published only when its box was ticked.
 */

const RULE = { windowMs: 60_000, max: 20 };

const page = (lang: string, query: string): string => `/${lang}/app/confirmations?${query}`;

const CODES: Readonly<Record<ConfirmationDecideResult, string>> = {
  confirmed: "fait=confirmee",
  refused: "fait=refusee",
  not_found: "erreur=introuvable",
  expired: "erreur=expiree",
  decided: "erreur=decidee",
  self_confirmation: "erreur=soi",
};

export async function decideMissionConfirmation(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (market.person.role !== "company") redirect(`/${lang}/app`);
  if (await throttled("mission-confirmation-decide", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const id = uuidOf(formData.get("id"));
  const decision = decisionFromForm(formData);
  if (id === null || decision === null) redirect(page(lang, "erreur=introuvable"));
  const result = await missionConfirmations(market.db).decideAsCompany(market.actor, id, decision, new Date());
  redirect(page(lang, CODES[result]));
}
