"use server";

import { redirect } from "next/navigation";
import { communityModeration, type CommunityTarget } from "@proofseen/db";
import { field, OUTCOME_FLAGS, operatorAction, reasonOf } from "@/lib/operator";

/*
 * Hide or restore a community post or comment (C22), with a reason. The role is checked first (404 for anyone else),
 * then the per-operator throttle; the repository writes the decision, its log entry and the e-mail to the author in
 * one transaction.
 */

const targetOf = (raw: string): CommunityTarget | null => (raw === "post" || raw === "comment" ? raw : null);

const run = async (formData: FormData, hide: boolean): Promise<never> => {
  const { lang, db, operator, limited } = await operatorAction(formData, "community");
  const back = (flag: string): never => redirect(`/${lang}/app/operateur/communaute?etat=${flag}`);
  if (limited) return back(OUTCOME_FLAGS.too_many);
  const target = targetOf(field(formData, "target"));
  if (target === null) return back(OUTCOME_FLAGS.absent);
  const reason = reasonOf(formData);
  if (reason === null) return back(OUTCOME_FLAGS.invalid);
  const repo = communityModeration(db, operator);
  const id = field(formData, "id").trim();
  const result = hide ? await repo.hide(target, id, reason, new Date()) : await repo.restore(target, id, reason, new Date());
  return back(OUTCOME_FLAGS[result]);
};

export async function hideCommunityItem(formData: FormData): Promise<void> {
  await run(formData, true);
}

export async function restoreCommunityItem(formData: FormData): Promise<void> {
  await run(formData, false);
}
