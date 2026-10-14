"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, missionConfirmations } from "@proofseen/db";
import { hasDatabase } from "@/data/intake-sink";
import { addressFromHeaders, throttled } from "@/data/throttle";
import { decisionFromForm } from "@/lib/confirmation-form";
import { langOf, uuidOf } from "@/lib/market";

/*
 * The client's contact answers through the signed link, without an account. The token travels in the form and is
 * checked by the repository (hash comparison, single use, expiry) in the same conditional update that records the
 * answer. Throttled per network address: a token cannot be guessed, but the endpoint must not be a free oracle either.
 */

const RULE = { windowMs: 10 * 60_000, max: 10 };
const TOKEN = /^[A-Za-z0-9_-]{1,100}$/;

const page = (lang: string, id: string, query: string): string => `/${lang}/confirmer-mission/${id}?${query}`;

const OUTCOME: Readonly<Record<string, string>> = {
  confirmed: "fait=confirmee",
  refused: "fait=refusee",
  expired: "etat=expiree",
  decided: "etat=decidee",
  invalid: "etat=invalide",
};

export async function decideMissionByLink(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("id"));
  const rawToken = formData.get("t");
  const token = typeof rawToken === "string" && TOKEN.test(rawToken) ? rawToken : null;
  if (id === null) redirect(`/${lang}`);
  if (token === null || !hasDatabase()) redirect(page(lang, id, "etat=invalide"));
  const address = addressFromHeaders(await headers()) ?? "unknown";
  if (await throttled("mission-confirmation-link", address, RULE, new Date())) redirect(page(lang, id, `t=${encodeURIComponent(token)}&erreur=trop`));
  const decision = decisionFromForm(formData);
  if (decision === null) redirect(page(lang, id, `t=${encodeURIComponent(token)}`));
  const result = await missionConfirmations(getDb()).decideByToken(id, token, decision, new Date());
  redirect(page(lang, id, OUTCOME[result] ?? "etat=invalide"));
}
