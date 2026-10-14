"use server";

import { redirect } from "next/navigation";
import { translateProfileBrief } from "@/data/brief";
import { queryFromBrief, searchHref, searchQuery } from "@/lib/freelancer-search";
import { actionMarket, langOf } from "@/lib/market";

/*
 * The brief box of the company search: one sentence, translated server-side into filters, then shown in the visible
 * form for the company to check and correct. The model never sorts: the company's chosen order is kept, and the
 * sentence itself is never echoed into the address.
 */

export async function suggestFilters(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (market.person.role !== "company") redirect(`/${lang}/app`);
  const back = formData.get("back");
  const current = searchQuery(new URLSearchParams(typeof back === "string" ? back : ""));
  const outcome = await translateProfileBrief(market.actor.userId, formData.get("brief"));
  if (outcome.kind !== "ok") redirect(searchHref(lang, current, { brief: outcome.kind }));
  redirect(searchHref(lang, { ...queryFromBrief(outcome.filters), sort: current.sort }, { brief: "ok" }));
}
