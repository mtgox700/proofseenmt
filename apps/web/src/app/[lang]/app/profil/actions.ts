"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { profiles } from "@proofseen/db";
import { newReference } from "@proofseen/intake";
import { notifyProfileChanged } from "@/data/indexnow";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf } from "@/lib/market";
import { profileFromForm } from "@/lib/profile-form";

/*
 * Server actions of the freelancer's own profile. The public reference is drawn from a cryptographic source: it is part
 * of public addresses, and a predictable series would let anyone enumerate profiles. A change to a published profile is
 * announced to search engines (IndexNow) right away.
 */

const SAVE_RULE = { windowMs: 60 * 60_000, max: 30 };
const RANGE = 2 ** 32;
const VISIBILITIES = ["named", "pseudonymous", "private"] as const;

const secureRandom = (): number => randomInt(0, RANGE) / RANGE;
const page = (lang: string, query: string): string => `/${lang}/app/profil?${query}`;

export async function saveProfile(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (market.person.role !== "freelance") redirect(`/${lang}/app`);
  if (await throttled("profile-save", market.actor.userId, SAVE_RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const input = profileFromForm(formData);
  if (!input.success) redirect(page(lang, "erreur=invalide"));
  const repo = profiles(market.db);
  const saved = (await repo.update(market.actor, input.data)) ?? (await repo.create(market.actor, input.data, () => newReference(secureRandom)));
  if (saved !== null && saved.visibility !== "private" && saved.slug !== null) notifyProfileChanged(saved.slug);
  redirect(page(lang, "enregistre=1"));
}

export async function setProfileVisibility(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const visibility = VISIBILITIES.find((value) => value === formData.get("visibility"));
  if (visibility === undefined) redirect(page(lang, ""));
  const market = await actionMarket(lang);
  if (await throttled("profile-visibility", market.actor.userId, SAVE_RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const repo = profiles(market.db);
  const before = await repo.findMine(market.actor);
  // Nothing changes: nothing to save, nothing to announce.
  if (before?.visibility === visibility) redirect(page(lang, ""));
  const result = await repo.setVisibility(market.actor, visibility);
  if (result.kind === "incomplete") redirect(page(lang, `manque=${result.missing.join(",")}`));
  if (result.kind === "ok") {
    // Withdrawn pages are announced too: the engines come back and find them gone.
    const slug = result.profile.slug ?? before?.slug ?? null;
    if (slug !== null) notifyProfileChanged(slug);
  }
  redirect(page(lang, ""));
}
