"use server";

import { headers } from "next/headers";
import { DRAFT_SECTIONS, importDrafts, storedFiles, users, type DraftSection } from "@proofseen/db";
import { importCv } from "@/data/cv-import";
import { announceProfile, backTo, freelanceAction, SECTION_RULE, UPLOAD_RULE } from "@/data/profile-action";
import { addressFromHeaders } from "@/data/throttle";
import { readStored } from "@/data/uploads";

/*
 * Server actions of the CV import: read the uploaded CV into a draft, then accept or ignore each proposed item. The
 * draft never reaches the public page by itself: an item enters the profile only when the person adds it, through the
 * same repository checks as a hand-filled form.
 */

const SCOPE = "profile-sections";

const sectionOf = (raw: FormDataEntryValue | null): DraftSection | null => DRAFT_SECTIONS.find((s) => s === raw) ?? null;

const indexOf = (raw: FormDataEntryValue | null): number => (typeof raw === "string" && /^\d{1,2}$/.test(raw) ? Number(raw) : -1);

const keyOf = (raw: FormDataEntryValue | null): string => (typeof raw === "string" && /^[0-9a-f]{16}$/.test(raw) ? raw : "");

export async function importFromCv(formData: FormData): Promise<void> {
  // Same budget as uploads: each reading is a paid model call, on top of its own per-person and platform caps.
  const { lang, market } = await freelanceAction(formData, "cv", "profile-import", UPLOAD_RULE);
  const cv = await storedFiles(market.db).latest(market.actor, "cv");
  const bytes = cv === null ? null : await readStored(cv.id);
  if (bytes === null) backTo(lang, "cv", "no_cv");
  // The address and the account's standing decide which share of the platform's daily pool this reading draws on.
  const address = addressFromHeaders(await headers());
  const established = await users(market.db).isEstablished(market.actor, new Date());
  const outcome = await importCv({ userId: market.actor.userId, address, established }, new Uint8Array(bytes));
  if (outcome.kind !== "ok") backTo(lang, "cv", outcome.kind);
  const saved = await importDrafts(market.db).save(market.actor, outcome.draft);
  backTo(lang, "cv", saved ? "imported" : "absent");
}

export async function acceptDraftItem(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "cv", SCOPE, SECTION_RULE);
  const section = sectionOf(formData.get("section"));
  if (section === null) backTo(lang, "cv", "invalid");
  if (section === "skills") {
    const result = await importDrafts(market.db).acceptSkills(market.actor);
    if (result === "added") await announceProfile(market);
    backTo(lang, "cv", result === "added" ? "saved" : result);
  }
  const result = await importDrafts(market.db).accept(market.actor, section, indexOf(formData.get("index")), keyOf(formData.get("key")));
  if (result === "added") await announceProfile(market);
  backTo(lang, "cv", result === "added" ? "saved" : result);
}

export async function dismissDraftItem(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "cv", SCOPE, SECTION_RULE);
  const section = sectionOf(formData.get("section"));
  if (section === null) backTo(lang, "cv", "invalid");
  const dismissed = await importDrafts(market.db).dismiss(market.actor, section, indexOf(formData.get("index")), keyOf(formData.get("key")));
  backTo(lang, "cv", dismissed ? "removed" : "stale");
}

export async function discardDraft(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "cv", SCOPE, SECTION_RULE);
  await importDrafts(market.db).discard(market.actor);
  backTo(lang, "cv", "removed");
}
