"use server";

import { redirect } from "next/navigation";
import { appNotifications, messageDigests } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { actionMarket, langOf, uuidOf } from "@/lib/market";
import { notificationHref } from "@/lib/notification-link";

/*
 * Server actions of the notification centre. The person comes from the session; a notification id posted by the form
 * only ever reaches the person's own notifications (the repository filters on them). Outcomes travel back as
 * `?avis=<code>`.
 */

const RULE = { windowMs: 60_000, max: 60 };

const page = (lang: string, notice?: string): string => `/${lang}/app/notifications${notice === undefined ? "" : `?avis=${notice}`}`;

/** Opens a notification: marks it read, then goes where it points. */
export async function openNotification(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("notificationId"));
  if (id === null) redirect(page(lang));
  const market = await actionMarket(lang);
  if (await throttled("notification-write", market.actor.userId, RULE, new Date())) redirect(page(lang, "trop"));
  const repository = appNotifications(market.db);
  const notification = await repository.get(market.actor, id);
  if (notification === null) redirect(page(lang));
  await repository.markRead(market.actor, id);
  redirect(notificationHref(lang, notification));
}

export async function markNotificationRead(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const id = uuidOf(formData.get("notificationId"));
  if (id === null) redirect(page(lang));
  const market = await actionMarket(lang);
  if (await throttled("notification-write", market.actor.userId, RULE, new Date())) redirect(page(lang, "trop"));
  await appNotifications(market.db).markRead(market.actor, id);
  redirect(page(lang));
}

export async function markAllNotificationsRead(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const market = await actionMarket(lang);
  if (await throttled("notification-write", market.actor.userId, RULE, new Date())) redirect(page(lang, "trop"));
  await appNotifications(market.db).markAllRead(market.actor);
  redirect(page(lang));
}

/** Turns the daily e-mail summary of unread messages on or off. */
export async function setMessageDigest(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const on = formData.get("digest") === "on";
  const market = await actionMarket(lang);
  if (await throttled("notification-write", market.actor.userId, RULE, new Date())) redirect(page(lang, "trop"));
  await messageDigests(market.db).set(market.actor, on);
  redirect(page(lang, on ? "resume-on" : "resume-off"));
}
