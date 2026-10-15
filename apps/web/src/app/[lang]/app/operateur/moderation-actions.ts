"use server";

import { redirect } from "next/navigation";
import { moderation, type ModerationTarget } from "@proofseen/db";
import { field, OUTCOME_FLAGS, operatorAction, reasonOf } from "@/lib/operator";

/*
 * Hide or restore a public profile, mission or company page. The role is checked first (404 for anyone else), then the
 * per-operator throttle; the repository writes the decision, its log entry and the e-mail in one transaction.
 */

const TARGETS: readonly ModerationTarget[] = ["profile", "mission", "company"];

const targetOf = (raw: string): ModerationTarget | null => (TARGETS as readonly string[]).includes(raw) ? (raw as ModerationTarget) : null;

const run = async (formData: FormData, hide: boolean): Promise<never> => {
  const { lang, db, operator, limited } = await operatorAction(formData, "moderation");
  const back = (flag: string): never => redirect(`/${lang}/app/operateur/moderation?etat=${flag}`);
  if (limited) return back(OUTCOME_FLAGS.too_many);
  const target = targetOf(field(formData, "target"));
  if (target === null) return back(OUTCOME_FLAGS.absent);
  const reason = reasonOf(formData);
  if (reason === null) return back(OUTCOME_FLAGS.invalid);
  const repo = moderation(db, operator);
  const key = field(formData, "key");
  const result = hide ? await repo.hide(target, key, reason, new Date()) : await repo.restore(target, key, reason, new Date());
  return back(OUTCOME_FLAGS[result]);
};

export async function hideContent(formData: FormData): Promise<void> {
  await run(formData, true);
}

export async function restoreContent(formData: FormData): Promise<void> {
  await run(formData, false);
}
