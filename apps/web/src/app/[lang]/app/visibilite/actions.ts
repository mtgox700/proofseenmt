"use server";

import { redirect } from "next/navigation";
import { measurements } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf } from "@/lib/market";

/**
 * Queues an AI visibility measurement for the signed-in freelancer's own profile. Who it is for comes from the session,
 * never from the form; the repository checks the profile is published and has a proven address, that no measurement is
 * already active, and the per-period limit. Nothing is spent here: the scheduled job runs the measurement.
 */

const RULE = { windowMs: 60 * 60_000, max: 10 };

const page = (lang: string, query: string): string => `/${lang}/app/visibilite?${query}`;

export async function requestMeasurement(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("measurement-request", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const result = await measurements(market.db).request(market.actor, new Date());
  redirect(page(lang, result.kind === "queued" ? "demande=ok" : `refus=${result.reason}`));
}
