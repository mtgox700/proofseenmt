"use server";

import { redirect } from "next/navigation";
import { freelanceLists } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf, uuidOf } from "@/lib/market";

/*
 * Server action of "Matching profiles" (C22) on a company mission page: add a suggested profile to one of the company's
 * lists, then back to the same mission with the outcome as a flag. The repository checks membership in its own query:
 * a forged list or profile id is simply absent.
 */

const RULE = { windowMs: 60_000, max: 60 };

export async function addSuggestedToList(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const missionId = uuidOf(formData.get("missionId"));
  if (missionId === null) redirect(`/${lang}/app/missions`);
  const market = await actionMarket(lang);
  if (market.person.role !== "company") redirect(`/${lang}/app`);
  const back = (flag: string): string => `/${lang}/app/missions/${missionId}?liste=${flag}#profils`;
  if (await throttled("freelance-lists", market.actor.userId, RULE, new Date())) redirect(back("limit"));
  const listId = uuidOf(formData.get("listId"));
  const profileId = uuidOf(formData.get("profileId"));
  const result = listId === null || profileId === null ? "absent" : await freelanceLists(market.db).addItem(market.actor, listId, profileId);
  redirect(back(result));
}
