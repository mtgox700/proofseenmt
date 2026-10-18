"use server";

import { redirect } from "next/navigation";
import { profileSections, type SectionName } from "@proofseen/db";
import { announceProfile, backTo, freelanceAction, itemIdOf, SECTION_RULE, updateNotice, writeNotice } from "@/data/profile-action";
import { deleteStored } from "@/data/uploads";
import { homeNoticeHref, returnsHome } from "@/lib/home-notice";
import type { SectionAnchor } from "@/lib/profile-notice";
import { certificationFromForm, educationFromForm, experienceFromForm, languageFromForm } from "@/lib/profile-sections-form";

/*
 * Server actions of the declared profile sections: plain forms, no client script. Each one checks the session and the
 * freelancer role, is throttled per person, writes through the repository (which validates, caps and checks ownership
 * inside its own query) and lands back on the section with a notice. An edit in place goes through the same validation
 * as an addition; a refused edit lands back on its open form.
 */

const SCOPE = "profile-sections";

const ANCHORS: Readonly<Record<SectionName, SectionAnchor>> = { experiences: "experiences", educations: "formation", certifications: "certifications", portfolio: "realisations" };
const SECTIONS: readonly SectionName[] = ["experiences", "educations", "certifications", "portfolio"];

export async function addExperience(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "experiences", SCOPE, SECTION_RULE);
  const result = await profileSections(market.db).addExperience(market.actor, experienceFromForm(formData));
  if (result.kind === "added") await announceProfile(market);
  backTo(lang, "experiences", writeNotice(result));
}

export async function addEducation(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "formation", SCOPE, SECTION_RULE);
  const result = await profileSections(market.db).addEducation(market.actor, educationFromForm(formData));
  if (result.kind === "added") await announceProfile(market);
  backTo(lang, "formation", writeNotice(result));
}

export async function addCertification(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "certifications", SCOPE, SECTION_RULE);
  const result = await profileSections(market.db).addCertification(market.actor, certificationFromForm(formData));
  if (result.kind === "added") await announceProfile(market);
  backTo(lang, "certifications", writeNotice(result));
}

export async function updateExperience(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "experiences", SCOPE, SECTION_RULE);
  const id = itemIdOf(formData);
  const result = await profileSections(market.db).updateExperience(market.actor, id, experienceFromForm(formData));
  if (result.kind === "updated") await announceProfile(market);
  backTo(lang, "experiences", updateNotice(result), result.kind === "updated" ? null : id);
}

export async function updateEducation(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "formation", SCOPE, SECTION_RULE);
  const id = itemIdOf(formData);
  const result = await profileSections(market.db).updateEducation(market.actor, id, educationFromForm(formData));
  if (result.kind === "updated") await announceProfile(market);
  backTo(lang, "formation", updateNotice(result), result.kind === "updated" ? null : id);
}

export async function updateCertification(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "certifications", SCOPE, SECTION_RULE);
  const id = itemIdOf(formData);
  const result = await profileSections(market.db).updateCertification(market.actor, id, certificationFromForm(formData));
  if (result.kind === "updated") await announceProfile(market);
  backTo(lang, "certifications", updateNotice(result), result.kind === "updated" ? null : id);
}

export async function setLanguage(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "langues", SCOPE, SECTION_RULE);
  const result = await profileSections(market.db).setLanguage(market.actor, languageFromForm(formData));
  if (result.kind === "added") await announceProfile(market);
  backTo(lang, "langues", writeNotice(result));
}

export async function removeLanguage(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "langues", SCOPE, SECTION_RULE);
  const code = formData.get("code");
  const removed = typeof code === "string" && (await profileSections(market.db).removeLanguage(market.actor, code));
  if (removed) await announceProfile(market);
  backTo(lang, "langues", removed ? "removed" : "invalid");
}

export async function removeSectionItem(formData: FormData): Promise<void> {
  const section = SECTIONS.find((s) => s === formData.get("section")) ?? "experiences";
  const anchor = ANCHORS[section];
  const { lang, market } = await freelanceAction(formData, anchor, SCOPE, SECTION_RULE);
  const id = formData.get("id");
  const outcome = typeof id === "string" ? await profileSections(market.db).remove(market.actor, section, id) : { removed: false, fileIds: [] };
  await deleteStored(outcome.fileIds);
  if (outcome.removed) await announceProfile(market);
  backTo(lang, anchor, outcome.removed ? "removed" : "invalid");
}

/** "Still available": the declaration stays, its date moves to now. Sent from the profile page or from the home (C23). */
export async function confirmAvailability(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "disponibilite", SCOPE, SECTION_RULE);
  const confirmed = await profileSections(market.db).confirmAvailability(market.actor, new Date());
  if (confirmed !== null) await announceProfile(market);
  if (confirmed !== null && returnsHome(formData)) redirect(homeNoticeHref(lang, "dispo-confirmee"));
  backTo(lang, "disponibilite", confirmed === null ? "absent" : "confirmed");
}

/** "No longer available", in one click (C23): the profile says so at once, dated, and is never hidden. */
export async function declareUnavailable(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "disponibilite", SCOPE, SECTION_RULE);
  const declared = await profileSections(market.db).declareUnavailable(market.actor, new Date());
  if (declared !== null) await announceProfile(market);
  if (declared !== null && returnsHome(formData)) redirect(homeNoticeHref(lang, "indisponible"));
  backTo(lang, "disponibilite", declared === null ? "absent" : "unavailable");
}
