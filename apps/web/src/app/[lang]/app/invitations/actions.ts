"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { invitationAnswers, invitations, type AnswerResult, type InvitationResult, type InvitationTarget, type ManageResult } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { invitationPath, invitationSecret, invitationToken } from "@/lib/invitation-secret";
import { requiredSide, sideAllows, invitationKindOf, type InvitationKindName } from "@/lib/invitations";
import { actionMarket, answerMarket, currentOrganisation, langOf, uuidOf, type Market } from "@/lib/market";
import { chooseRole, verifiedAddresses } from "@/lib/session";

/*
 * Server actions of the invitations (C23). The person always comes from the session, never from the form; the
 * repository checks membership, caps, the contact filter and, on answer, that one of the account's VERIFIED addresses
 * is the invited one. Each send may e-mail a third party: throttled on top of the database caps.
 */

const SEND_RULE = { windowMs: 60_000, max: 10 };
const MANAGE_RULE = { windowMs: 60_000, max: 30 };
const ANSWER_RULE = { windowMs: 60_000, max: 10 };

const list = (lang: string, query: string): string => `/${lang}/app/invitations?${query}`;

const SEND_ERRORS: Readonly<Record<Exclude<InvitationResult["kind"], "invited" | "message">, string>> = {
  invalid: "invalide",
  self: "soi",
  absent: "introuvable",
  no_profile: "profil",
  already_invited: "deja",
  limit: "limite",
};

const MANAGE_ERRORS: Readonly<Record<Exclude<ManageResult, "done">, string>> = {
  absent: "introuvable",
  closed: "close",
  too_soon: "trop-tot",
  already: "deja-relancee",
};

const ANSWER_ERRORS: Readonly<Record<Exclude<AnswerResult["kind"], "accepted" | "declined">, string>> = {
  invalid: "invalide",
  expired: "expiree",
  closed: "close",
  email_mismatch: "adresse",
  self: "soi",
};

const senderMarket = async (lang: ReturnType<typeof langOf>): Promise<Market> => {
  const market = await actionMarket(lang);
  if (market.person.role !== "company" && market.person.role !== "freelance") redirect(`/${lang}/app`);
  return market;
};

const targetOf = async (market: Market): Promise<InvitationTarget | null> => {
  if (market.person.role === "freelance") return { kind: "client" };
  const organisation = await currentOrganisation(market);
  return organisation === null ? null : { kind: "freelance", organisationId: organisation.id };
};

export async function sendInvitation(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await senderMarket(lang);
  if (await throttled("invitation-send", market.actor.userId, SEND_RULE, new Date())) redirect(list(lang, "erreur=trop"));
  // The link's token is derived from the invitation id: without the secret, no link could ever be sent.
  const secret = invitationSecret();
  if (secret === null) redirect(list(lang, "erreur=indisponible"));
  const target = await targetOf(market);
  if (target === null) redirect(list(lang, "erreur=entreprise"));
  const email = formData.get("email");
  const message = formData.get("message");
  const id = randomUUID();
  const result = await invitations(market.db).invite(
    market.actor,
    target,
    { email: typeof email === "string" ? email : "", message: typeof message === "string" ? message : null },
    { id, token: invitationToken(secret, id) },
    lang,
    new Date(),
  );
  if (result.kind === "invited") redirect(list(lang, "fait=envoyee"));
  redirect(list(lang, `erreur=${result.kind === "message" ? `mot-${result.problem}` : SEND_ERRORS[result.kind]}`));
}

const manage = async (formData: FormData, action: "revoke" | "remind"): Promise<void> => {
  const lang = langOf(formData.get("lang"));
  const market = await senderMarket(lang);
  if (await throttled("invitation-manage", market.actor.userId, MANAGE_RULE, new Date())) redirect(list(lang, "erreur=trop"));
  const id = uuidOf(formData.get("id"));
  const repo = invitations(market.db);
  const result: ManageResult = id === null ? "absent" : action === "revoke" ? await repo.revoke(market.actor, id, new Date()) : await repo.remind(market.actor, id, new Date());
  redirect(list(lang, result === "done" ? `fait=${action === "revoke" ? "revoquee" : "relancee"}` : `erreur=${MANAGE_ERRORS[result]}`));
};

export async function revokeInvitation(formData: FormData): Promise<void> {
  await manage(formData, "revoke");
}

export async function remindInvitation(formData: FormData): Promise<void> {
  await manage(formData, "remind");
}

/** Where an answer goes back to on error: the link's page (with its token), or the list in the connected space. */
const back = (lang: "fr" | "en", id: string | null, token: string | null, error: string): string =>
  id !== null && token !== null ? `${invitationPath(lang, id, token)}&erreur=${error}` : list(lang, `erreur=${error}`);

const tokenOf = (raw: FormDataEntryValue | null): string | null => (typeof raw === "string" && /^[A-Za-z0-9_-]{43}$/.test(raw) ? raw : null);

/**
 * Accept or decline. A person who has not chosen a side yet chooses it by accepting (the invitation says which); one on
 * the other side is refused before anything is written. The repository then requires a verified invited address.
 */
export async function answerInvitation(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("id"));
  const token = tokenOf(formData.get("t"));
  const kind: InvitationKindName | null = invitationKindOf(formData.get("kind"));
  const decision = formData.get("decision") === "accept" ? "accept" : "decline";
  const market = await answerMarket(lang);
  if (await throttled("invitation-answer", market.actor.userId, ANSWER_RULE, new Date())) redirect(back(lang, id, token, "trop"));
  if (id === null || kind === null) redirect(back(lang, id, token, "invalide"));
  if (decision === "accept" && !sideAllows(market.person.role, kind)) redirect(back(lang, id, token, "cote"));
  const organisation = kind === "client" && market.person.role === "company" ? await currentOrganisation(market) : null;
  const result = await invitationAnswers(market.db).answer(market.actor, await verifiedAddresses(), { id, token, decision, kind, organisationId: organisation?.id ?? null }, new Date());
  if (result.kind === "declined") redirect(list(lang, "fait=refusee"));
  if (result.kind !== "accepted") redirect(back(lang, id, token, ANSWER_ERRORS[result.kind]));
  // Accepting chose the side for a person who had not chosen yet; `chooseRole` never overwrites a choice already made.
  if (market.person.role === null) await chooseRole(market.person.id, requiredSide(kind));
  redirect(list(lang, `fait=${result.invitationKind === "freelance" ? "acceptee-vivier" : result.linked ? "acceptee-rattachee" : "acceptee-client"}`));
}
