"use server";

import { redirect } from "next/navigation";
import { missionInvitations, savedMissions } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf, uuidOf } from "@/lib/market";

/*
 * Freelancer-side server actions of the missions space: save a mission for later, remove it, set an invitation aside.
 * Everything is keyed on the session's own user; the repositories never touch another person's rows.
 */

const RULE = { windowMs: 60_000, max: 30 };

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");

/** Where to go back: the apply page of the mission, or the saved list. Never a path taken from the form. */
const back = (lang: string, from: FormDataEntryValue | null, missionId: string, query = ""): string => {
  const base = from === "liste" ? `/${lang}/app/missions/enregistrees` : `/${lang}/app/missions/${missionId}/postuler`;
  return query === "" ? base : `${base}?${query}`;
};

export async function saveMission(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("missionId"));
  if (id === null) redirect(`/${lang}/missions`);
  const market = await actionMarket(lang);
  if (await throttled("mission-bookmark", market.actor.userId, RULE, new Date())) redirect(back(lang, null, id, "enregistrement=trop"));
  const result = await savedMissions(market.db).save(market.actor, id);
  redirect(back(lang, null, id, `enregistrement=${result}`));
}

export async function unsaveMission(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("missionId"));
  if (id === null) redirect(`/${lang}/app/missions/enregistrees`);
  const market = await actionMarket(lang);
  if (await throttled("mission-bookmark", market.actor.userId, RULE, new Date())) redirect(back(lang, formData.get("from"), id, "enregistrement=trop"));
  await savedMissions(market.db).remove(market.actor, id);
  redirect(back(lang, formData.get("from"), id));
}

export async function dismissInvitation(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("invitation-dismiss", market.actor.userId, RULE, new Date())) redirect(`/${lang}/app/missions`);
  await missionInvitations(market.db).dismiss(market.actor, text(formData.get("invitationId")), new Date());
  redirect(`/${lang}/app/missions`);
}
