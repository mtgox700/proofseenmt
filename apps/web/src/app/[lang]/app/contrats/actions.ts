"use server";

import { redirect } from "next/navigation";
import { contracts, CostCenterSchema, largeAccounts, payments, ReviewInputSchema, reviews } from "@proofseen/db";
import { gatewayFromEnv } from "@proofseen/payments";
import { proofseenIdentity } from "@/data/payments-config";
import { throttled } from "@/data/throttle";
import { logError } from "@/lib/log";
import { actionMarket, langOf, uuidOf } from "@/lib/market";

/*
 * Server actions of a contract. Each side signs for itself; either cancels before both signed; a company administrator
 * approves the work, which releases the escrowed funds when payments are configured (otherwise the periodic job does it
 * later: nothing is lost). The repositories decide, in their queries, who may do what.
 */

const RULE = { windowMs: 60_000, max: 30 };

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");
const page = (lang: string, id: string, error?: string): string => `/${lang}/app/contrats/${id}${error === undefined ? "" : `?erreur=${error}`}`;

const guard = async (lang: string, formData: FormData) => {
  const id = uuidOf(formData.get("contractId"));
  if (id === null) redirect(`/${lang}/app/contrats`);
  const market = await actionMarket(langOf(lang));
  if (await throttled("contract-move", market.actor.userId, RULE, new Date())) redirect(page(lang, id, "trop"));
  return { id, market };
};

export async function signContract(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const { id, market } = await guard(lang, formData);
  const result = await contracts(market.db).sign(market.actor, id, new Date());
  redirect(page(lang, id, result.kind === "signed" ? undefined : result.kind === "absent" ? "etat" : result.kind));
}

export async function cancelContract(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const { id, market } = await guard(lang, formData);
  const cancelled = await contracts(market.db).cancel(market.actor, id);
  redirect(page(lang, id, cancelled === null ? "etat" : undefined));
}

export async function completeContract(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const { id, market } = await guard(lang, formData);
  const result = await contracts(market.db).complete(market.actor, id);
  if (result.kind === "completed") {
    const gateway = (() => {
      try {
        return gatewayFromEnv(process.env);
      } catch {
        return null;
      }
    })();
    const identity = proofseenIdentity();
    if (gateway !== null && identity !== null) {
      await payments(market.db)
        .release(id, gateway, identity, new Date())
        .catch((error: unknown) => logError("release deferred", error));
    }
  }
  redirect(page(lang, id, result.kind === "completed" || result.kind === "awaiting_second_approval" ? undefined : result.kind === "absent" ? "etat" : result.kind));
}

export async function saveCostCenter(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const { id, market } = await guard(lang, formData);
  const raw = text(formData.get("costCenter"));
  const costCenter = CostCenterSchema.safeParse(raw === "" ? null : raw);
  if (!costCenter.success) redirect(page(lang, id, "etat"));
  const result = await largeAccounts(market.db).setCostCenter(market.actor, id, costCenter.data);
  redirect(page(lang, id, result === "saved" ? undefined : "etat"));
}

const REVIEW_RULE = { windowMs: 60 * 60_000, max: 10 };

/** The client company's review of a completed, paid mission; the repository checks both, once per contract. */
export async function writeReview(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("contractId"));
  if (id === null) redirect(`/${lang}/app/contrats`);
  const market = await actionMarket(lang);
  if (await throttled("review-write", market.actor.userId, REVIEW_RULE, new Date())) redirect(page(lang, id, "trop"));
  const input = ReviewInputSchema.safeParse({ rating: Number(text(formData.get("rating"))), body: text(formData.get("body")) });
  if (!input.success) redirect(`${page(lang, id)}?avis=invalide`);
  const result = await reviews(market.db).write(market.actor, id, input.data);
  redirect(`${page(lang, id)}?avis=${result.kind === "written" ? "ok" : result.kind === "already_written" ? "deja" : "inadmissible"}`);
}
