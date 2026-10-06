"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getSource } from "@/data/file-source";
import { getMessageStore } from "@/data/message-store";
import { viewerOf } from "@/data/viewer";
import { isLang, type Lang } from "@/i18n";
import { decide, newThread, reply, ThreadInputSchema, type Viewer } from "@/lib/messaging";
import { session } from "@/lib/session";

/*
 * Server actions of the messaging. Each one re-reads the session: an id, a role or a reference sent by the browser is
 * never trusted. The rules themselves are in lib/messaging.ts; this file only wires them to the session and the store.
 *
 * Known limit, written down: the throttle is per process and in memory. It slows a careless script, not a determined
 * one; real rate limiting belongs at the edge before the app is public.
 */

const WINDOW_MS = 60_000;
const MAX_ACTIONS = 10;
const recent = new Map<string, number[]>();

const throttled = (userId: string, now: number): boolean => {
  const hits = (recent.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > MAX_ACTIONS;
};

const langOf = (raw: FormDataEntryValue | null): Lang => (typeof raw === "string" && isLang(raw) ? raw : "fr");

const viewer = async (lang: Lang): Promise<Viewer> => {
  const state = await session();
  if (state.kind !== "signed-in") redirect(`/${lang}/connexion`);
  const who = await viewerOf(state.person);
  if (who === null) redirect(`/${lang}/app/bienvenue`);
  return who;
};

export async function openThread(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const state = await session();
  if (state.kind !== "signed-in") redirect(`/${lang}/connexion`);
  const { person } = state;
  if (person.role !== "company") redirect(`/${lang}/app`);
  if (throttled(person.id, Date.now())) redirect(`/${lang}/app/messages?erreur=trop`);

  const input = ThreadInputSchema.safeParse({ profileId: formData.get("profileId"), body: formData.get("body") });
  if (!input.success) redirect(`/${lang}/entreprise/${String(formData.get("profileId") ?? "")}?erreur=message`);
  // A thread only exists about a published profile.
  const { profiles } = await getSource().profiles();
  if (!profiles.some((profile) => profile.id === input.data.profileId)) redirect(`/${lang}/entreprise`);

  const thread = newThread({
    id: randomUUID(),
    profileId: input.data.profileId,
    company: { userId: person.id, name: person.name, email: person.email },
    body: input.data.body,
    now: new Date(),
  });
  await getMessageStore().save(thread);
  redirect(`/${lang}/app/messages/${thread.id}`);
}

export async function answerThread(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const who = await viewer(lang);
  const id = String(formData.get("threadId") ?? "");
  if (throttled(who.id, Date.now())) redirect(`/${lang}/app/messages/${id}?erreur=trop`);
  const store = getMessageStore();
  const thread = await store.get(id);
  if (thread === null) redirect(`/${lang}/app/messages`);
  try {
    await store.save(reply(thread, who, String(formData.get("body") ?? ""), new Date()));
  } catch {
    redirect(`/${lang}/app/messages/${id}?erreur=message`);
  }
  redirect(`/${lang}/app/messages/${id}`);
}

export async function decideThread(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const who = await viewer(lang);
  const id = String(formData.get("threadId") ?? "");
  const status = formData.get("decision");
  if (status !== "accepted" && status !== "declined") redirect(`/${lang}/app/messages/${id}`);
  const store = getMessageStore();
  const thread = await store.get(id);
  if (thread === null) redirect(`/${lang}/app/messages`);
  try {
    await store.save(decide(thread, who, status, new Date()));
  } catch {
    // Not theirs to decide: the page simply shows the thread again, unchanged.
  }
  redirect(`/${lang}/app/messages/${id}`);
}
