"use server";

import { profileSections, storedFiles } from "@proofseen/db";
import { announceProfile, backTo, freelanceAction, SECTION_RULE, UPLOAD_RULE, writeNotice } from "@/data/profile-action";
import { saveCv } from "@/data/cv-upload";
import { deleteStored, saveUpload } from "@/data/uploads";
import { portfolioFromForm } from "@/lib/profile-sections-form";

/*
 * Server actions that receive files: the profile photo, a portfolio item with its optional image, the CV. Each upload
 * is sniffed, size-checked and (for images) re-encoded by `saveUpload`, stored under a random id, then attached. When
 * attaching fails, the new file is removed again; when it replaces another, the old one is removed from disk. The CV
 * is also read by the PDF worker before it is stored (`saveCv`): companies download it.
 */

const UPLOADS = "profile-uploads";

/** Removes a file that was stored but could not be attached: its row, then its bytes. */
const discard = async (db: Parameters<typeof storedFiles>[0], userId: string, id: string): Promise<void> => {
  await storedFiles(db).remove({ userId }, id);
  await deleteStored([id]);
};

export async function uploadPhoto(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "photo", UPLOADS, UPLOAD_RULE);
  const saved = await saveUpload(market.db, market.actor, "photo", formData.get("photo"));
  if (saved.kind !== "stored") backTo(lang, "photo", saved.kind);
  const attached = await profileSections(market.db).setPhoto(market.actor, saved.id);
  if (attached.kind === "absent") {
    await discard(market.db, market.actor.userId, saved.id);
    backTo(lang, "photo", "absent");
  }
  if (attached.previousFileId !== null) await deleteStored([attached.previousFileId]);
  await announceProfile(market);
  backTo(lang, "photo", "uploaded");
}

export async function removePhoto(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "photo", UPLOADS, SECTION_RULE);
  const removed = await profileSections(market.db).removePhoto(market.actor);
  if (removed !== null) {
    await deleteStored([removed]);
    await announceProfile(market);
  }
  backTo(lang, "photo", "removed");
}

export async function addPortfolioItem(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "realisations", UPLOADS, UPLOAD_RULE);
  const upload = formData.get("image");
  const hasImage = upload !== null && typeof upload !== "string" && upload.size > 0;
  const image = hasImage ? await saveUpload(market.db, market.actor, "portfolio_image", upload) : null;
  if (image !== null && image.kind !== "stored") backTo(lang, "realisations", image.kind);
  const imageId = image === null ? null : image.id;
  const result = await profileSections(market.db).addPortfolioItem(market.actor, portfolioFromForm(formData), imageId);
  if (result.kind !== "added" && imageId !== null) await discard(market.db, market.actor.userId, imageId);
  if (result.kind === "added") await announceProfile(market);
  backTo(lang, "realisations", writeNotice(result));
}

export async function uploadCv(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "cv", UPLOADS, UPLOAD_RULE);
  const saved = await saveCv(market.db, market.actor, formData.get("cv"));
  if (saved.kind !== "stored") backTo(lang, "cv", saved.kind);
  // One CV at a time: the previous ones go, rows and bytes.
  await deleteStored(await storedFiles(market.db).removeKind(market.actor, "cv", saved.id));
  backTo(lang, "cv", "uploaded");
}

export async function removeCv(formData: FormData): Promise<void> {
  const { lang, market } = await freelanceAction(formData, "cv", UPLOADS, SECTION_RULE);
  await deleteStored(await storedFiles(market.db).removeKind(market.actor, "cv"));
  backTo(lang, "cv", "removed");
}
