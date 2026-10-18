import type { AppNotificationKind, AppNotificationPayload } from "@proofseen/db";
import type { Lang } from "../i18n/types";

/*
 * Where an in-app notification leads, and the sentence that describes it. Ids from the payload only enter a path once
 * checked to be uuids; anything else falls back to the section page. The page that opens checks access again: a link
 * is never a permission.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const id = (value: string | undefined): string | null => (value !== undefined && UUID.test(value) ? value : null);

export interface NotificationLike {
  readonly kind: AppNotificationKind;
  readonly payload: AppNotificationPayload;
}

export const notificationHref = (lang: Lang, n: NotificationLike): string => {
  const app = `/${lang}/app`;
  const under = (base: string, value: string | undefined): string => {
    const known = id(value);
    return known === null ? base : `${base}/${known}`;
  };
  switch (n.kind) {
    case "contact_received":
    case "message_received":
      return under(`${app}/messages`, n.payload.conversationId);
    case "application_received":
      return under(`${app}/missions`, n.payload.missionId);
    case "application_read":
    case "application_status":
      return `${app}/missions`;
    case "mission_invitation":
      return under(`/${lang}/missions`, n.payload.missionId);
    case "mission_confirmation":
      return n.payload.status === "requested" ? `${app}/confirmations` : `${app}/preuves`;
    case "contract_update":
      return under(`${app}/contrats`, n.payload.contractId);
    case "measurement_done":
      return `${app}/visibilite`;
    case "post_comment":
    case "post_reaction":
    case "post_share":
      return under(`${app}/fil`, n.payload.postId);
    case "new_follower":
      return `${app}/abonnements`;
    case "availability_reminder":
      return `${app}/profil#disponibilite`;
  }
};

export interface NotificationTexts {
  readonly kinds: Readonly<Record<AppNotificationKind, string>>;
  readonly statuses: Readonly<Record<string, string>>;
}

/** The sentence of a notification: the status-specific one when the payload names a known status. */
export const notificationText = (n: NotificationLike, texts: NotificationTexts): string => {
  const status = n.payload.status;
  const specific = status === undefined ? undefined : texts.statuses[status];
  return specific ?? texts.kinds[n.kind];
};
