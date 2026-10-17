"use server";

import { redirect } from "next/navigation";
import { applications, CoverNoteSchema, missions } from "@proofseen/db";
import { cvChoiceOf, prepareApplicationCv, pruneAfterWithdrawal, settleApplicationCv } from "@/data/application-cv";
import { notifyMissionChanged } from "@/data/indexnow";
import { UPLOAD_RULE } from "@/data/profile-action";
import { throttled } from "@/data/throttle";
import { actionMarket, currentOrganisation, langOf, uuidOf } from "@/lib/market";
import { cvErrorCode } from "@/lib/application-cv-form";
import { answersOf, missionFromForm } from "@/lib/mission-form";
import { MAX_DRAFTS } from "@/lib/mission-limits";

/*
 * Server actions of missions and applications. The session decides who acts; the repositories decide, inside their
 * own queries, whether that person may (member of the company, owner of the profile). Outcomes travel back as
 * `?erreur=<code>`, turned into a sentence by the page. A CV can be attached to an application (C21): the stored one,
 * or one uploaded with the form, which counts against the same upload budget as the profile's uploads.
 */

const SAVE_RULE = { windowMs: 60_000, max: 20 };
const APPLY_RULE = { windowMs: 60 * 60_000, max: 30 };
const DECIDE_RULE = { windowMs: 60_000, max: 60 };

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw : "");
const missionPath = (lang: string, id: string, error?: string): string => `/${lang}/app/missions/${id}${error === undefined ? "" : `?erreur=${error}`}`;

export async function createMission(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("mission-save", market.actor.userId, SAVE_RULE, new Date())) redirect(`/${lang}/app/missions/nouvelle?erreur=trop`);
  const organisation = await currentOrganisation(market);
  if (organisation === null) redirect(`/${lang}/app`);
  const input = missionFromForm(formData);
  if (!input.success) redirect(`/${lang}/app/missions/nouvelle?erreur=invalide`);
  const existing = (await missions(market.db).listForOrganisation(market.actor, organisation.id)) ?? [];
  if (existing.filter((mission) => mission.status === "draft").length >= MAX_DRAFTS) redirect(`/${lang}/app/missions/nouvelle?erreur=brouillons`);
  const mission = await missions(market.db).create(market.actor, organisation.id, input.data);
  redirect(mission === null ? `/${lang}/app` : missionPath(lang, mission.id));
}

export async function updateMission(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("missionId"));
  if (id === null) redirect(`/${lang}/app/missions`);
  const market = await actionMarket(lang);
  const edit = (error: string): string => `/${lang}/app/missions/${id}/modifier?erreur=${error}`;
  if (await throttled("mission-save", market.actor.userId, SAVE_RULE, new Date())) redirect(edit("trop"));
  const input = missionFromForm(formData);
  if (!input.success) redirect(edit("invalide"));
  const result = await missions(market.db).update(market.actor, id, input.data);
  // Search engines learn about a change to a public page right away; a draft is not public.
  if (result.kind === "ok" && result.mission.status === "open") notifyMissionChanged(id);
  redirect(result.kind === "ok" ? missionPath(lang, id) : result.kind === "locked" ? missionPath(lang, id, "verrouillee") : `/${lang}/app/missions`);
}

export async function publishMission(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("missionId"));
  if (id === null) redirect(`/${lang}/app/missions`);
  const market = await actionMarket(lang);
  if (await throttled("mission-state", market.actor.userId, SAVE_RULE, new Date())) redirect(missionPath(lang, id, "trop"));
  if (await missions(market.db).publish(market.actor, id, new Date())) notifyMissionChanged(id);
  redirect(missionPath(lang, id));
}

export async function closeMission(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("missionId"));
  if (id === null) redirect(`/${lang}/app/missions`);
  const market = await actionMarket(lang);
  if (await throttled("mission-state", market.actor.userId, SAVE_RULE, new Date())) redirect(missionPath(lang, id, "trop"));
  if (await missions(market.db).close(market.actor, id, new Date())) notifyMissionChanged(id);
  redirect(missionPath(lang, id));
}

export async function decideApplication(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const missionId = uuidOf(formData.get("missionId"));
  if (missionId === null) redirect(`/${lang}/app/missions`);
  const decision = formData.get("decision");
  if (decision !== "shortlisted" && decision !== "declined" && decision !== "hired") redirect(missionPath(lang, missionId));
  const market = await actionMarket(lang);
  if (await throttled("application-decide", market.actor.userId, DECIDE_RULE, new Date())) redirect(missionPath(lang, missionId, "trop"));
  await applications(market.db).decide(market.actor, text(formData.get("applicationId")), decision);
  redirect(missionPath(lang, missionId));
}

export async function applyToMission(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const missionId = uuidOf(formData.get("missionId"));
  if (missionId === null) redirect(`/${lang}/app/missions`);
  const back = (error: string): string => `/${lang}/app/missions/${missionId}/postuler?erreur=${error}`;
  const market = await actionMarket(lang);
  if (market.person.role !== "freelance") redirect(back("entreprise"));
  if (await throttled("application-apply", market.actor.userId, APPLY_RULE, new Date())) redirect(back("trop"));
  const note = CoverNoteSchema.safeParse(text(formData.get("coverNote")));
  if (!note.success) redirect(back("invalide"));
  const choice = cvChoiceOf(formData);
  if (choice.kind === "upload" && (await throttled("profile-uploads", market.actor.userId, UPLOAD_RULE, new Date()))) redirect(back("trop"));
  const cv = await prepareApplicationCv(market.db, market.actor, choice);
  if (cv.kind === "refused") redirect(back(cvErrorCode(cv.code)));
  const result = await applications(market.db)
    .apply(market.actor, missionId, note.data, new Date(), answersOf(formData), cv.kind === "ready" ? cv.fileId : null)
    .catch(async (error: unknown) => {
      // Nothing uploaded for an application that failed is left behind.
      await settleApplicationCv(market.db, market.actor, cv, false);
      throw error;
    });
  await settleApplicationCv(market.db, market.actor, cv, result.kind === "applied");
  redirect(result.kind === "applied" ? `/${lang}/app/messages/${result.conversationId}` : back(result.kind === "cv_absent" ? cvErrorCode("no_cv") : result.kind));
}

export async function withdrawApplication(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("application-withdraw", market.actor.userId, DECIDE_RULE, new Date())) redirect(`/${lang}/app/missions`);
  // A withdrawn application no longer opens its CV to the company; a CV only it kept is removed.
  if (await applications(market.db).withdraw(market.actor, text(formData.get("applicationId")))) await pruneAfterWithdrawal(market.db, market.actor);
  redirect(`/${lang}/app/missions`);
}
