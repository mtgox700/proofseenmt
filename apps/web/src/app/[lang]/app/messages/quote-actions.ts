"use server";

import { redirect } from "next/navigation";
import { ContractDraftSchema, contracts, quotes, QuoteInputSchema } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf } from "@/lib/market";
import { eurosToCents } from "@/lib/mission-form";

/*
 * Server actions of quotes, inside a conversation. Only fixed-price quotes are offered here: monthly billing stays
 * closed until monthly prepayment exists (decision of 2026-10-07). The repositories check, in their queries, that the
 * freelancer writes the quote and a company member decides it.
 */

const RULE = { windowMs: 60_000, max: 20 };

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");
const thread = (lang: string, id: string, error?: string): string => `/${lang}/app/messages/${id}${error === undefined ? "" : `?devis=${error}`}#devis`;

export async function sendQuote(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const conversationId = text(formData.get("conversationId"));
  const market = await actionMarket(lang);
  if (await throttled("quote", market.actor.userId, RULE, new Date())) redirect(thread(lang, conversationId, "trop"));
  const days = text(formData.get("days"));
  const input = QuoteInputSchema.safeParse({ dailyRateCents: eurosToCents(text(formData.get("rate"))), days: /^\d+$/.test(days) ? Number(days) : Number.NaN, billing: "fixed" });
  if (!input.success) redirect(thread(lang, conversationId, "invalide"));
  const repo = quotes(market.db);
  const draft = await repo.draft(market.actor, conversationId, input.data);
  const sent = draft === null ? null : await repo.send(market.actor, draft.id);
  redirect(thread(lang, conversationId, sent === null ? "etat" : undefined));
}

export async function decideQuote(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const conversationId = text(formData.get("conversationId"));
  const decision = formData.get("decision");
  if (decision !== "accepted" && decision !== "declined") redirect(thread(lang, conversationId));
  const market = await actionMarket(lang);
  if (await throttled("quote", market.actor.userId, RULE, new Date())) redirect(thread(lang, conversationId, "trop"));
  const result = await quotes(market.db).decide(market.actor, text(formData.get("quoteId")), decision);
  redirect(thread(lang, conversationId, result.kind === "ok" ? undefined : result.kind === "already_accepted" ? "deja" : "etat"));
}

export async function createContract(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const conversationId = text(formData.get("conversationId"));
  const market = await actionMarket(lang);
  if (await throttled("contract-create", market.actor.userId, RULE, new Date())) redirect(thread(lang, conversationId, "trop"));
  const endsOn = text(formData.get("endsOn"));
  // The repository parses the days itself: they are checked here only to answer with a sentence instead of an error.
  const raw = { startsOn: text(formData.get("startsOn")), endsOn: endsOn === "" ? null : endsOn };
  if (!ContractDraftSchema.safeParse(raw).success) redirect(thread(lang, conversationId, "dates"));
  const result = await contracts(market.db).createFromQuote(market.actor, text(formData.get("quoteId")), raw, new Date());
  redirect(result.kind === "created" ? `/${lang}/app/contrats/${result.contract.id}` : thread(lang, conversationId, result.kind));
}
