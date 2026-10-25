"use server";

import { redirect } from "next/navigation";
import { ContractDraftSchema, contracts, quotes } from "@proofseen/db";
import { paymentsSandbox } from "@proofseen/payments";
import { contractCommissionTerms } from "@/data/payments-config";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf, uuidOf } from "@/lib/market";
import { quoteFromForm } from "@/lib/quote-form";

/*
 * Server actions of quotes, inside a conversation. Only fixed-price quotes are offered here: monthly billing stays
 * closed until monthly prepayment exists (decision of 2026-10-07). The repositories check, in their queries, that the
 * freelancer writes the quote and a company owner or administrator decides it and creates the contract.
 */

const RULE = { windowMs: 60_000, max: 20 };

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");
const thread = (lang: string, id: string, error?: string): string => `/${lang}/app/messages/${id}${error === undefined ? "" : `?devis=${error}`}#devis`;

export async function sendQuote(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const conversationId = uuidOf(formData.get("conversationId"));
  if (conversationId === null) redirect(`/${lang}/app/messages`);
  const market = await actionMarket(lang);
  if (await throttled("quote", market.actor.userId, RULE, new Date())) redirect(thread(lang, conversationId, "trop"));
  // A NEW quote states the object of the work (required); deliverables and the last day to accept are optional. The form is
  // read and validated in lib/quote-form.ts, which names the problem so the page can say which field to fix.
  const input = quoteFromForm(formData);
  if (!input.ok) redirect(thread(lang, conversationId, input.problem === "invalid" ? "invalide" : input.problem));
  const repo = quotes(market.db);
  const draft = await repo.draft(market.actor, conversationId, input.data);
  const sent = draft === null ? null : await repo.send(market.actor, draft.id);
  redirect(thread(lang, conversationId, sent === null ? "etat" : undefined));
}

export async function decideQuote(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const conversationId = uuidOf(formData.get("conversationId"));
  if (conversationId === null) redirect(`/${lang}/app/messages`);
  const decision = formData.get("decision");
  if (decision !== "accepted" && decision !== "declined") redirect(thread(lang, conversationId));
  const market = await actionMarket(lang);
  if (await throttled("quote", market.actor.userId, RULE, new Date())) redirect(thread(lang, conversationId, "trop"));
  const result = await quotes(market.db).decide(market.actor, text(formData.get("quoteId")), decision);
  redirect(thread(lang, conversationId, result.kind === "ok" ? undefined : result.kind === "already_accepted" ? "deja" : "etat"));
}

export async function createContract(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const conversationId = uuidOf(formData.get("conversationId"));
  if (conversationId === null) redirect(`/${lang}/app/messages`);
  const market = await actionMarket(lang);
  if (await throttled("contract-create", market.actor.userId, RULE, new Date())) redirect(thread(lang, conversationId, "trop"));
  const endsOn = text(formData.get("endsOn"));
  // The repository parses the days itself: they are checked here only to answer with a sentence instead of an error.
  const raw = { startsOn: text(formData.get("startsOn")), endsOn: endsOn === "" ? null : endsOn };
  if (!ContractDraftSchema.safeParse(raw).success) redirect(thread(lang, conversationId, "dates"));
  const result = await contracts(market.db, { requireSellerSiret: !paymentsSandbox(process.env), commissionTerms: () => contractCommissionTerms() }).createFromQuote(market.actor, text(formData.get("quoteId")), raw, new Date());
  redirect(result.kind === "created" ? `/${lang}/app/contrats/${result.contract.id}` : thread(lang, conversationId, result.kind));
}
