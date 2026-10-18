"use server";

import { redirect } from "next/navigation";
import { peopleFollows } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { COMMUNITY_RULES } from "@/lib/community";
import { actionMarket, langOf, uuidOf } from "@/lib/market";

/** Server actions of people follows (C22). Keyed on the session's own user; the profile is found by its public reference. */

const REFERENCE = /^FR-[A-Z0-9]{5,8}$/;

const page = (lang: string, query = ""): string => `/${lang}/app/abonnements${query === "" ? "" : `?${query}`}`;

/** Where to go back: the feed when the button was in it, else the follows page. */
const backTo = (formData: FormData, lang: string, flag: string): string => {
  const from = formData.get("back");
  if (from === "feed" || from === "discover") return `/${lang}/app/fil${from === "discover" ? "?onglet=decouvrir&" : "?"}suivi=${flag}`;
  return page(lang, `suivi=${flag}`);
};

export async function followProfile(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const raw = formData.get("reference");
  const reference = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!REFERENCE.test(reference)) redirect(backTo(formData, lang, "absent"));
  const market = await actionMarket(lang);
  if (await throttled("community-follow", market.actor.userId, COMMUNITY_RULES.follow, new Date())) redirect(backTo(formData, lang, "trop"));
  const result = await peopleFollows(market.db).follow(market.actor, reference, new Date());
  redirect(backTo(formData, lang, result));
}

export async function unfollowProfile(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("community-follow", market.actor.userId, COMMUNITY_RULES.follow, new Date())) redirect(page(lang, "suivi=trop"));
  await peopleFollows(market.db).unfollow(market.actor, uuidOf(formData.get("profileId")) ?? "");
  redirect(page(lang));
}
