"use server";

import { redirect } from "next/navigation";
import { missionInvitations, missions, missionTemplates, TemplateNameSchema } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, currentOrganisation, langOf, uuidOf } from "@/lib/market";
import { MAX_DRAFTS } from "@/lib/mission-limits";

/*
 * Company-side server actions of the missions space: invite a freelancer to apply, duplicate a mission, save and delete
 * templates. The repositories check membership inside their queries; outcomes travel back as query parameters.
 */

const RULE = { windowMs: 60_000, max: 20 };
const INVITE_RULE = { windowMs: 60_000, max: 10 };

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");
const missionPath = (lang: string, id: string, query: string): string => `/${lang}/app/missions/${id}?${query}`;

export async function inviteFreelancer(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("missionId"));
  if (id === null) redirect(`/${lang}/app/missions`);
  const market = await actionMarket(lang);
  if (await throttled("mission-invite", market.actor.userId, INVITE_RULE, new Date())) redirect(missionPath(lang, id, "invitation=trop"));
  const result = await missionInvitations(market.db).invite(market.actor, id, text(formData.get("reference")), new Date());
  redirect(missionPath(lang, id, `invitation=${result.kind}`));
}

export async function duplicateMission(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("missionId"));
  if (id === null) redirect(`/${lang}/app/missions`);
  const market = await actionMarket(lang);
  if (await throttled("mission-save", market.actor.userId, RULE, new Date())) redirect(missionPath(lang, id, "erreur=trop"));
  const organisation = await currentOrganisation(market);
  if (organisation === null) redirect(`/${lang}/app`);
  const existing = (await missions(market.db).listForOrganisation(market.actor, organisation.id)) ?? [];
  if (existing.filter((mission) => mission.status === "draft").length >= MAX_DRAFTS) redirect(missionPath(lang, id, "erreur=brouillons"));
  const copy = await missionTemplates(market.db).duplicate(market.actor, id);
  redirect(copy === null ? `/${lang}/app/missions` : `/${lang}/app/missions/${copy.id}`);
}

export async function saveTemplate(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("missionId"));
  if (id === null) redirect(`/${lang}/app/missions`);
  const market = await actionMarket(lang);
  if (await throttled("mission-template", market.actor.userId, RULE, new Date())) redirect(missionPath(lang, id, "erreur=trop"));
  const name = TemplateNameSchema.safeParse(text(formData.get("name")));
  if (!name.success) redirect(missionPath(lang, id, "modele=invalide"));
  const result = await missionTemplates(market.db).saveFromMission(market.actor, id, name.data);
  redirect(missionPath(lang, id, `modele=${result.kind === "saved" ? "enregistre" : result.kind === "limit" ? "limite" : "invalide"}`));
}

export async function removeTemplate(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("mission-template", market.actor.userId, RULE, new Date())) redirect(`/${lang}/app/missions/nouvelle?erreur=trop`);
  await missionTemplates(market.db).remove(market.actor, text(formData.get("templateId")));
  redirect(`/${lang}/app/missions/nouvelle`);
}
