"use server";

import { redirect } from "next/navigation";
import { AlertFiltersSchema, missionAlerts, NOTIFICATION_KINDS, notifications } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf } from "@/lib/market";
import { eurosToCents, skillsOf } from "@/lib/mission-form";

/** Server actions of e-mail preferences and mission alerts. Everything is keyed on the session's own user. */

const RULE = { windowMs: 60_000, max: 20 };
const MODES = ["onsite", "hybrid", "remote"] as const;
const MAX_ALERT_SKILLS = 10;

const page = (lang: string, query = ""): string => `/${lang}/app/alertes${query === "" ? "" : `?${query}`}`;
const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");

export async function saveEmailPreferences(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("email-preferences", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const repo = notifications(market.db);
  // An unticked box is absent from the form, so each kind the form showed is listed in a hidden field: those are
  // written, ticked or not; a kind the form did not show keeps its setting.
  const shown = new Set(formData.getAll("shown").filter((value): value is string => typeof value === "string"));
  for (const kind of NOTIFICATION_KINDS.filter((k) => shown.has(k))) await repo.setPreference(market.actor, kind, formData.get(kind) === "on");
  redirect(page(lang, "enregistre=1"));
}

export async function createAlert(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("alert-create", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const city = text(formData.get("city"));
  const minRate = eurosToCents(text(formData.get("minRate")));
  const maxDuration = text(formData.get("maxDuration"));
  const filters = AlertFiltersSchema.safeParse({
    workModes: MODES.filter((mode) => formData.get(`mode-${mode}`) === "on"),
    ...(city === "" ? {} : { city }),
    skills: skillsOf(text(formData.get("skills"))).slice(0, MAX_ALERT_SKILLS),
    ...(minRate === null ? {} : { minDailyRateCents: minRate }),
    ...(maxDuration === "" ? {} : { maxDurationMonths: /^\d+$/.test(maxDuration) ? Number(maxDuration) : Number.NaN }),
  });
  if (!filters.success) redirect(page(lang, "alerte=invalide"));
  const result = await missionAlerts(market.db).create(market.actor, filters.data, new Date());
  redirect(page(lang, result.kind === "created" ? "" : "alerte=limite"));
}

export async function removeAlert(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("alert-remove", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  await missionAlerts(market.db).remove(market.actor, text(formData.get("alertId")));
  redirect(page(lang));
}
