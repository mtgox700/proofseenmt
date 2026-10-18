"use server";

import { redirect } from "next/navigation";
import { savedSearches } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import type { Lang } from "@/i18n";
import { savedFiltersOf, searchHref, searchParamsOf, searchQuery, type SearchQuery } from "@/lib/freelancer-search";
import { actionMarket, currentOrganisation, langOf, uuidOf, type Market } from "@/lib/market";

/*
 * Server actions of the company's saved searches (C22). The person comes from the session, the company is the one they
 * act for, and every repository call checks membership inside its own query: a forged id is simply absent. Each action
 * goes back to the search the person was on, with a known outcome code (never user text).
 */

const RULE = { windowMs: 60_000, max: 30 };

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw : "");

interface Context {
  readonly lang: Lang;
  readonly market: Market;
  readonly back: SearchQuery;
}

/** The company context of a saved-search action, and the search to go back to; anyone else goes to the app home. */
const companyContext = async (formData: FormData): Promise<Context> => {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (market.person.role !== "company") redirect(`/${lang}/app`);
  const back = searchQuery(new URLSearchParams(text(formData.get("back"))));
  if (await throttled("saved-searches", market.actor.userId, RULE, new Date())) redirect(searchHref(lang, back, { enregistree: "trop" }));
  return { lang, market, back };
};

export async function saveSearch(formData: FormData): Promise<void> {
  const { lang, market, back } = await companyContext(formData);
  const organisation = await currentOrganisation(market);
  if (organisation === null) redirect(`/${lang}/app`);
  // The saved address is the canonical one, on page 1: what the colleague opens is exactly what is shown here.
  const query = searchParamsOf({ ...back, page: 1 }).toString();
  const result = await savedSearches(market.db).create(
    market.actor,
    organisation.id,
    { name: text(formData.get("name")), query, filters: savedFiltersOf(back), alert: text(formData.get("alert")) === "1" },
    new Date(),
  );
  redirect(searchHref(lang, back, { enregistree: result.kind === "created" ? "saved" : result.kind }));
}

export async function setSavedSearchAlert(formData: FormData): Promise<void> {
  const { lang, market, back } = await companyContext(formData);
  const id = uuidOf(formData.get("savedSearchId"));
  const result = id === null ? "absent" : await savedSearches(market.db).setAlert(market.actor, id, text(formData.get("alert")) === "1", new Date());
  redirect(searchHref(lang, back, { enregistree: result === "saved" ? "alert" : result === "limit" ? "alert_limit" : "absent" }));
}

export async function deleteSavedSearch(formData: FormData): Promise<void> {
  const { lang, market, back } = await companyContext(formData);
  const id = uuidOf(formData.get("savedSearchId"));
  const removed = id !== null && (await savedSearches(market.db).remove(market.actor, id));
  redirect(searchHref(lang, back, { enregistree: removed ? "deleted" : "absent" }));
}
