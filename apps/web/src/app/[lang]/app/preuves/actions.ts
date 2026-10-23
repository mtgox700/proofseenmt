"use server";

import { redirect } from "next/navigation";
import { normaliseOwnedUrl, ownedUrls } from "@proofseen/db";
import { isManualOnlyHost } from "@proofseen/profiles";
import { verifyOwnedUrl, type VerifyOutcome } from "@/data/ownership";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf, uuidOf, type Market } from "@/lib/market";
import { proofSecret } from "@/lib/proof-secret";

/*
 * Server actions of the freelancer's proven addresses. Everything is keyed on the session's own user; the repository
 * only ever touches that user's profile. "Check now" sends up to three requests to the declared site, so it is
 * throttled harder than the rest.
 */

const ADD_RULE = { windowMs: 60 * 60_000, max: 30 };
const VERIFY_RULE = { windowMs: 10 * 60_000, max: 10 };
const REMOVE_RULE = { windowMs: 60_000, max: 20 };

/** Back to the addresses, where an address action writes its notice; a proof found goes to the top, to its poinçon. */
const page = (lang: string, query = ""): string => `/${lang}/app/preuves${query === "" ? "" : `?${query}`}${query.startsWith("prouve=") ? "" : "#adresses"}`;

const VERIFY_ERRORS: Readonly<Record<Exclude<VerifyOutcome, "proven">, string>> = {
  absent: "absente",
  not_found: "introuvable",
  manual_only: "manuel",
  already_proven_elsewhere: "ailleurs",
};

const ADD_ERRORS = { invalid: "invalide", duplicate: "doublon", limit: "limite", no_profile: "profil" } as const;

/** The freelancer's market context; anyone else goes back to their own home. */
const freelanceMarket = async (lang: ReturnType<typeof langOf>): Promise<Market> => {
  const market = await actionMarket(lang);
  if (market.person.role !== "freelance") redirect(`/${lang}/app`);
  return market;
};

export async function addOwnedUrl(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await freelanceMarket(lang);
  if (await throttled("proof-add", market.actor.userId, ADD_RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const raw = formData.get("url");
  const normalised = typeof raw === "string" ? normaliseOwnedUrl(raw) : null;
  if (normalised === null) redirect(page(lang, "erreur=invalide"));
  // LinkedIn and Malt are kept as declared links, marked manual: nothing will ever fetch them.
  const result = await ownedUrls(market.db).add(market.actor, normalised.url, { manual: isManualOnlyHost(normalised.url) });
  redirect(page(lang, result.kind === "added" ? "enregistre=1" : `erreur=${ADD_ERRORS[result.kind]}`));
}

export async function checkOwnedUrl(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await freelanceMarket(lang);
  if (await throttled("proof-verify", market.actor.userId, VERIFY_RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const id = uuidOf(formData.get("id"));
  if (id === null) redirect(page(lang, "erreur=introuvable"));
  const secret = proofSecret();
  if (secret === null) redirect(page(lang, "erreur=indisponible"));
  const outcome = await verifyOwnedUrl(ownedUrls(market.db), market.actor, id, secret, new Date());
  redirect(page(lang, outcome === "proven" ? "prouve=1" : `erreur=${VERIFY_ERRORS[outcome]}`));
}

export async function removeOwnedUrl(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await freelanceMarket(lang);
  if (await throttled("proof-remove", market.actor.userId, REMOVE_RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const id = uuidOf(formData.get("id"));
  const removed = id === null ? false : await ownedUrls(market.db).remove(market.actor, id);
  redirect(page(lang, removed ? "enregistre=1" : "erreur=introuvable"));
}
