"use server";

import { redirect } from "next/navigation";
import { companyFollows } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf } from "@/lib/market";

/** Server actions of followed companies. Keyed on the session's own user; the company is found by its public address. */

const RULE = { windowMs: 60_000, max: 20 };
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");
const page = (lang: string, query = ""): string => `/${lang}/app/entreprises-suivies${query === "" ? "" : `?${query}`}`;

export async function followCompany(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const slug = text(formData.get("slug"));
  if (!SLUG.test(slug) || slug.length > 80) redirect(page(lang, "suivi=absent"));
  const market = await actionMarket(lang);
  if (await throttled("company-follow", market.actor.userId, RULE, new Date())) redirect(page(lang, "suivi=trop"));
  const result = await companyFollows(market.db).follow(market.actor, slug);
  redirect(page(lang, `suivi=${result}`));
}

export async function unfollowCompany(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("company-follow", market.actor.userId, RULE, new Date())) redirect(page(lang, "suivi=trop"));
  await companyFollows(market.db).unfollow(market.actor, text(formData.get("organisationId")));
  redirect(page(lang));
}
