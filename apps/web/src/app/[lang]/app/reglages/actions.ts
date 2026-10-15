"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { organisations, users } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf, uuidOf } from "@/lib/market";
import { ORGANISATION_COOKIE, ORGANISATION_COOKIE_MAX_AGE } from "@/lib/settings";

/*
 * Account settings: the language of the e-mails, and the company the person acts for. Both are re-checked here, from
 * the session: the form only proposes. Throttled per person, so a script cannot hammer either.
 */

const SETTINGS_RULE = { windowMs: 10 * 60_000, max: 20 };

const back = (lang: string, code: string, anchor: string): never => redirect(`/${lang}/app/reglages?reglage=${code}#${anchor}`);

export async function saveEmailLanguage(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("settings", market.actor.userId, SETTINGS_RULE, new Date())) back(lang, "trop", "langue");
  const chosen = formData.get("emailLang");
  const saved = typeof chosen === "string" && (await users(market.db).setLang(market.actor.userId, chosen));
  back(lang, saved ? "langue" : "invalide", "langue");
}

export async function chooseOrganisation(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("settings", market.actor.userId, SETTINGS_RULE, new Date())) back(lang, "trop", "entreprise");
  const chosen = uuidOf(formData.get("organisationId"));
  // Only a company the person belongs to right now: the cookie is a preference, membership is the permission.
  const mine = await organisations(market.db).listMine(market.actor);
  if (chosen === null || !mine.some((org) => org.id === chosen)) back(lang, "invalide", "entreprise");
  (await cookies()).set(ORGANISATION_COOKIE, chosen ?? "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ORGANISATION_COOKIE_MAX_AGE,
  });
  back(lang, "entreprise", "entreprise");
}
