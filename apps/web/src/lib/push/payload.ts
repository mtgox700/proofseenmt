import type { PendingPush } from "@proofseen/db";
import { liveEn } from "../../i18n/market/live-en";
import { liveFr } from "../../i18n/market/live-fr";
import type { Lang } from "../../i18n/types";
import { notificationHref, notificationText, type NotificationTexts } from "../notification-link";

/*
 * What a push notification says (C20): exactly the sentence of the in-app notification centre, in the person's
 * language, and the link it opens. Nothing more: no sender name, no message text, no amount. The lock screen of a
 * phone is not a private place.
 */

export interface PushMessage {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  /** Notifications with the same tag replace each other on the device: one per thread, like the bell. */
  readonly tag: string;
  readonly lang: Lang;
}

const TEXTS: Readonly<Record<Lang, NotificationTexts>> = { fr: liveFr.notifications, en: liveEn.notifications };

export const pushMessage = (push: Pick<PendingPush, "lang" | "notification">): PushMessage => {
  const { notification, lang } = push;
  const thread = notification.payload.conversationId;
  return {
    title: "Proofseen",
    body: notificationText(notification, TEXTS[lang]),
    url: notificationHref(lang, notification),
    tag: thread === undefined ? `notification-${notification.id}` : `thread-${thread}`,
    lang,
  };
};
