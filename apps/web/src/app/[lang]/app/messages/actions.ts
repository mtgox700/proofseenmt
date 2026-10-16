"use server";

import { redirect } from "next/navigation";
import { inbox, messaging, MessageBodySchema, type PostResult } from "@proofseen/db";
import { chosenFiles, discardAttachments, saveAttachments, type SavedAttachments } from "@/data/attachments";
import { throttled } from "@/data/throttle";
import { logError } from "@/lib/log";
import { actionMarket, currentOrganisation, langOf, uuidOf } from "@/lib/market";

/*
 * Server actions of the conversations. Each one re-reads the session through `actionMarket`: an id, a role or a side
 * sent by the form is never trusted, and the repository checks in its own query that the person belongs to the thread.
 * Outcomes travel back as `?erreur=<code>`, mapped to a sentence by the page.
 */

const SEND_RULE = { windowMs: 60_000, max: 20 };
const CONTACT_RULE = { windowMs: 60 * 60_000, max: 30 };
/** Messages carrying files, per person and per hour: each one costs disk, decoding and a PDF read. */
const ATTACHMENT_RULE = { windowMs: 60 * 60_000, max: 30 };

const thread = (lang: string, id: string | null, error?: string): string => (id === null ? `/${lang}/app/messages` : `/${lang}/app/messages/${id}${error === undefined ? "" : `?erreur=${error}`}`);
const text = (raw: FormDataEntryValue | null): string => (typeof raw === "string" ? raw : "");

export async function postMessage(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("conversationId"));
  if (id === null) redirect(`/${lang}/app/messages`);
  const market = await actionMarket(lang);
  if (await throttled("message-post", market.actor.userId, SEND_RULE, new Date())) redirect(thread(lang, id, "trop"));
  const body = MessageBodySchema.safeParse(text(formData.get("body")));
  if (!body.success) redirect(thread(lang, id, "invalide"));
  const files = chosenFiles(formData.getAll("attachments"));
  if (files.length > 0 && (await throttled("message-attachment", market.actor.userId, ATTACHMENT_RULE, new Date()))) redirect(thread(lang, id, "trop"));
  // Who may attach is checked before a single byte is read or a PDF worker started (wave-3 review, M3).
  if (files.length > 0 && !(await messaging(market.db).canAttach(market.actor, id))) redirect(thread(lang, id, "pj-state"));
  const attached: SavedAttachments =
    files.length === 0
      ? { kind: "saved", ids: [], containContact: false }
      : await saveAttachments(market.db, market.actor, files).catch((error: unknown): SavedAttachments => {
          logError("message attachments not saved", error);
          return { kind: "refused", problem: "unreadable" };
        });
  if (attached.kind === "refused") redirect(thread(lang, id, `pj-${attached.problem}`));
  const withFiles = attached.ids.length > 0;
  const result = await messaging(market.db)
    .post(market.actor, id, body.data, withFiles ? { ids: attached.ids, containContact: attached.containContact } : undefined)
    .catch((error: unknown): PostResult | { readonly kind: "error" } => {
      logError("message post failed", error);
      return { kind: "error" };
    });
  // Files of a message that was not sent are removed at once; the scheduled job catches anything left behind.
  if (withFiles && result.kind !== "sent") await discardAttachments(market.db, market.actor, attached.ids).catch((error: unknown) => logError("message attachments not discarded", error));
  if (result.kind === "absent") redirect(`/${lang}/app/messages`);
  if (result.kind === "attachments") redirect(thread(lang, id, "pj-state"));
  if (result.kind === "contact_details") redirect(thread(lang, id, withFiles ? "pj-contact" : "coordonnees"));
  if (result.kind === "waiting" || result.kind === "closed") redirect(thread(lang, id, "etat"));
  if (result.kind === "error") redirect(thread(lang, id, "serveur"));
  redirect(thread(lang, id));
}

export async function decideConversation(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("conversationId"));
  if (id === null) redirect(`/${lang}/app/messages`);
  const decision = formData.get("decision");
  if (decision !== "accepted" && decision !== "declined") redirect(thread(lang, id));
  const market = await actionMarket(lang);
  if (await throttled("message-decide", market.actor.userId, SEND_RULE, new Date())) redirect(thread(lang, id, "trop"));
  await messaging(market.db).decide(market.actor, id, decision, new Date());
  redirect(thread(lang, id));
}

export async function closeConversation(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("conversationId"));
  if (id === null) redirect(`/${lang}/app/messages`);
  const market = await actionMarket(lang);
  if (await throttled("message-close", market.actor.userId, SEND_RULE, new Date())) redirect(thread(lang, id, "trop"));
  await messaging(market.db).close(market.actor, id);
  redirect(thread(lang, id));
}

/** A company writes first to a published profile. The profile is found by its public reference, never by an id posted. */
export async function contactProfile(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const reference = text(formData.get("reference"));
  const back = (error: string): string => `/${lang}/app/contact/${encodeURIComponent(reference)}?erreur=${error}`;
  const market = await actionMarket(lang);
  if (market.person.role !== "company") redirect(back("entreprise"));
  if (await throttled("message-contact", market.actor.userId, CONTACT_RULE, new Date())) redirect(back("trop"));
  const body = MessageBodySchema.safeParse(text(formData.get("body")));
  if (!body.success) redirect(back("invalide"));
  const [organisation, target] = await Promise.all([currentOrganisation(market), inbox(market.db).contactTarget(reference)]);
  if (organisation === null) redirect(back("entreprise"));
  if (target === null) redirect(`/${lang}/app/messages`);
  const result = await messaging(market.db).contact(market.actor, organisation.id, target.profileId, body.data);
  const destination =
    result.kind === "opened"
      ? thread(lang, result.conversation.id)
      : result.kind === "existing"
        ? thread(lang, result.conversation.id, "existant")
        : back(result.kind === "contact_details" ? "coordonnees" : result.kind === "limit" ? "limite" : "entreprise");
  redirect(destination);
}
