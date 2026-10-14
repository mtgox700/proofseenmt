"use server";

import { redirect } from "next/navigation";
import { freelanceLists } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import type { Lang } from "@/i18n";
import { searchHref, searchQuery } from "@/lib/freelancer-search";
import { actionMarket, currentOrganisation, langOf, uuidOf, type Market } from "@/lib/market";

/*
 * Server actions of the company's freelancer lists. The person comes from the session, the company is the one they act
 * for, and every repository call checks membership inside its own query: a forged list or line id is simply absent.
 */

const RULE = { windowMs: 60_000, max: 60 };

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw : "");
const listsPage = (lang: string, query = ""): string => `/${lang}/app/listes${query === "" ? "" : `?${query}`}`;
const listPage = (lang: string, listId: string, query = ""): string => `/${lang}/app/listes/${listId}${query === "" ? "" : `?${query}`}`;

/** The company context of a list action; anyone else goes back to the app home. */
const companyMarket = async (formData: FormData): Promise<{ readonly lang: Lang; readonly market: Market }> => {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (market.person.role !== "company") redirect(`/${lang}/app`);
  if (await throttled("freelance-lists", market.actor.userId, RULE, new Date())) redirect(listsPage(lang, "erreur=trop"));
  return { lang, market };
};

export async function createList(formData: FormData): Promise<void> {
  const { lang, market } = await companyMarket(formData);
  const organisation = await currentOrganisation(market);
  if (organisation === null) redirect(`/${lang}/app`);
  const result = await freelanceLists(market.db).create(market.actor, organisation.id, text(formData.get("name")));
  if (result.kind === "created") redirect(listPage(lang, result.id));
  redirect(listsPage(lang, `erreur=${result.kind === "limit" ? "limite" : "invalide"}`));
}

export async function deleteList(formData: FormData): Promise<void> {
  const { lang, market } = await companyMarket(formData);
  const listId = uuidOf(formData.get("listId"));
  if (listId !== null) await freelanceLists(market.db).remove(market.actor, listId);
  redirect(listsPage(lang));
}

/** From a search result: back to the same search, with the outcome as a flag. */
export async function addToList(formData: FormData): Promise<void> {
  const { lang, market } = await companyMarket(formData);
  const back = searchQuery(new URLSearchParams(text(formData.get("back"))));
  const listId = uuidOf(formData.get("listId"));
  const profileId = uuidOf(formData.get("profileId"));
  const result = listId === null || profileId === null ? "absent" : await freelanceLists(market.db).addItem(market.actor, listId, profileId);
  redirect(searchHref(lang, back, { ajout: result }));
}

export async function removeFromList(formData: FormData): Promise<void> {
  const { lang, market } = await companyMarket(formData);
  const listId = uuidOf(formData.get("listId"));
  const itemId = uuidOf(formData.get("itemId"));
  if (listId === null) redirect(listsPage(lang));
  if (itemId !== null) await freelanceLists(market.db).removeItem(market.actor, itemId);
  redirect(listPage(lang, listId));
}

export async function saveNote(formData: FormData): Promise<void> {
  const { lang, market } = await companyMarket(formData);
  const listId = uuidOf(formData.get("listId"));
  const itemId = uuidOf(formData.get("itemId"));
  if (listId === null) redirect(listsPage(lang));
  const result = itemId === null ? "absent" : await freelanceLists(market.db).setNote(market.actor, itemId, text(formData.get("note")));
  redirect(listPage(lang, listId, result === "saved" ? "enregistre=1" : `erreur=${result === "invalid" ? "invalide" : "absent"}`));
}

/** A thumb: the button posts the reaction it sets, `none` when it withdraws the person's own. */
export async function react(formData: FormData): Promise<void> {
  const { lang, market } = await companyMarket(formData);
  const listId = uuidOf(formData.get("listId"));
  const itemId = uuidOf(formData.get("itemId"));
  if (listId === null) redirect(listsPage(lang));
  const posted = text(formData.get("reaction"));
  const reaction = posted === "up" || posted === "down" ? posted : null;
  if (itemId !== null) await freelanceLists(market.db).react(market.actor, itemId, reaction);
  redirect(listPage(lang, listId));
}
