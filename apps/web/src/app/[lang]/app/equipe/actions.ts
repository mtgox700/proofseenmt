"use server";

import { redirect } from "next/navigation";
import { ApiKeyNameSchema, apiKeys, largeAccounts, organisations } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, currentOrganisation, langOf } from "@/lib/market";

/*
 * Server actions of the company's administration. The company is always the person's own (`currentOrganisation`),
 * never an id posted by the form; the repositories check owner or administrator rights in their queries.
 */

const RULE = { windowMs: 60_000, max: 20 };
const MEMBER_RULE = { windowMs: 60 * 60_000, max: 20 };
const Email = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw.trim() : "");
const page = (lang: string, query = ""): string => `/${lang}/app/equipe${query === "" ? "" : `?${query}`}`;

const companyOf = async (lang: string) => {
  const market = await actionMarket(langOf(lang));
  const organisation = await currentOrganisation(market);
  if (organisation === null) redirect(`/${lang}/app`);
  return { market, organisation };
};

export async function addMember(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const { market, organisation } = await companyOf(lang);
  // Limited per hour: each attempt says nothing about whether the address has an account, but many would.
  if (await throttled("member-add", market.actor.userId, MEMBER_RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const email = text(formData.get("email")).toLowerCase();
  const role = formData.get("role") === "admin" ? "admin" : "member";
  if (!Email.test(email)) redirect(page(lang, "erreur=invalide"));
  await organisations(market.db).addMember(market.actor, organisation.id, email, role);
  redirect(page(lang, "ajoute=1"));
}

export async function removeMember(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const { market, organisation } = await companyOf(lang);
  if (await throttled("member-remove", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const userId = text(formData.get("userId"));
  const removed = await organisations(market.db).removeMember(market.actor, organisation.id, userId);
  // Leaving one's own company ends access to it: back to the home, which offers to create one.
  if (removed && userId === market.actor.userId) redirect(`/${lang}/app`);
  redirect(page(lang, removed ? "" : "erreur=proprietaire"));
}

export async function setApprovalLevels(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const { market, organisation } = await companyOf(lang);
  if (await throttled("org-settings", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  const levels = formData.get("approvalLevels") === "2" ? 2 : 1;
  const result = await largeAccounts(market.db).setApprovalLevels(market.actor, organisation.id, levels);
  redirect(page(lang, result === "saved" ? "" : result === "single_admin" ? "validation=un" : "validation=proprietaire"));
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const { market, organisation } = await companyOf(lang);
  if (await throttled("api-key-revoke", market.actor.userId, RULE, new Date())) redirect(page(lang, "erreur=trop"));
  await apiKeys(market.db).revoke(market.actor, organisation.id, text(formData.get("keyId")), new Date());
  redirect(page(lang));
}

export type CreateKeyState = { readonly kind: "idle" } | { readonly kind: "created"; readonly key: string } | { readonly kind: "error"; readonly code: "invalide" | "trop" | "limite" | "absent" };

/** Returns the key to the page that asked, the only time it exists in clear: it is never stored, logged or redirected. */
export async function createApiKey(_previous: CreateKeyState, formData: FormData): Promise<CreateKeyState> {
  const lang = langOf(formData.get("lang"));
  const { market, organisation } = await companyOf(lang);
  if (await throttled("api-key-create", market.actor.userId, RULE, new Date())) return { kind: "error", code: "trop" };
  const name = ApiKeyNameSchema.safeParse(text(formData.get("name")));
  if (!name.success) return { kind: "error", code: "invalide" };
  const created = await apiKeys(market.db).create(market.actor, organisation.id, name.data, new Date());
  if (created.kind === "created") return { kind: "created", key: created.key };
  return { kind: "error", code: created.kind === "too_many" ? "limite" : "absent" };
}
