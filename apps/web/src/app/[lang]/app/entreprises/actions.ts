"use server";

import { redirect } from "next/navigation";
import { companyFollows } from "@proofseen/db";
import { companyDirectoryQueryString } from "@proofseen/hub";
import { throttled } from "@/data/throttle";
import { companyDirectoryQuery } from "@/lib/company-directory-filters";
import { actionMarket, langOf } from "@/lib/market";

/*
 * Follow and unfollow from the companies discovery page (C22), keyed on the session's own user; the company is found by
 * its public address. Back to the same filters, with a known outcome code (never user text).
 */

const RULE = { windowMs: 60_000, max: 20 };
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");

const backTo = (lang: string, formData: FormData, code: string): string => {
  const filters = companyDirectoryQuery(new URLSearchParams(text(formData.get("back"))));
  const query = companyDirectoryQueryString(filters, filters.page);
  return `/${lang}/app/entreprises${query === "" ? `?suivi=${code}` : `${query}&suivi=${code}`}`;
};

export async function followFromDirectory(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const slug = text(formData.get("slug"));
  if (!SLUG.test(slug) || slug.length > 80) redirect(backTo(lang, formData, "absent"));
  const market = await actionMarket(lang);
  if (await throttled("company-follow", market.actor.userId, RULE, new Date())) redirect(backTo(lang, formData, "trop"));
  const result = await companyFollows(market.db).follow(market.actor, slug);
  redirect(backTo(lang, formData, result));
}

export async function unfollowFromDirectory(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("company-follow", market.actor.userId, RULE, new Date())) redirect(backTo(lang, formData, "trop"));
  const removed = await companyFollows(market.db).unfollow(market.actor, text(formData.get("organisationId")));
  redirect(backTo(lang, formData, removed ? "unfollowed" : "absent"));
}
