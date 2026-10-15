"use server";

import { redirect } from "next/navigation";
import { companyPages, CompanyPublicInputSchema } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, currentOrganisation, langOf } from "@/lib/market";

/*
 * Server actions of the company's public page. The company is always the person's own (`currentOrganisation`), never
 * an id posted by the form; the repository checks owner or administrator rights in its queries.
 */

const RULE = { windowMs: 60_000, max: 10 };

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");
const optional = (raw: FormDataEntryValue | null): string | null => (text(raw) === "" ? null : text(raw));
const page = (lang: string, query = ""): string => `/${lang}/app/equipe/page-publique${query === "" ? "" : `?${query}`}`;

export async function publishCompanyPage(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("company-page", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const organisation = await currentOrganisation(market);
  if (organisation === null) redirect(`/${lang}/app`);
  const input = CompanyPublicInputSchema.safeParse({
    publicName: text(formData.get("publicName")),
    description: optional(formData.get("description")),
    website: optional(formData.get("website")),
    city: optional(formData.get("city")),
  });
  if (!input.success) redirect(page(lang, "erreur=invalide"));
  const result = await companyPages(market.db).publish(market.actor, organisation.id, input.data, new Date());
  redirect(page(lang, result.kind === "saved" ? "enregistre=1" : "erreur=droits"));
}

export async function unpublishCompanyPage(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("company-page", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const organisation = await currentOrganisation(market);
  if (organisation === null) redirect(`/${lang}/app`);
  const removed = await companyPages(market.db).unpublish(market.actor, organisation.id);
  redirect(page(lang, removed ? "retiree=1" : "erreur=droits"));
}
