import { getDb, pushQueue } from "@proofseen/db";
import { sendNotification, WebPushError } from "web-push";
import { logError } from "@/lib/log";
import { PUSH_TTL_SECONDS, type PushSender } from "@/lib/push/sender";
import { vapidFromEnv, vapidMisconfigured, type VapidConfig } from "@/lib/push/vapid";
import { sendPushes, type PushReport } from "./push-delivery";

/*
 * The real push sender (C20): Web Push with VAPID signatures and aes128gcm payload encryption, through the `web-push`
 * package (MPL-2.0). Only the endpoints accepted at subscription are ever called: those of the browsers' push
 * services (checked in @proofseen/db), never an address chosen by a user.
 */

const TIMEOUT_MS = 10_000;

export const webPushSender = (vapid: VapidConfig): PushSender => ({
  async send(target, payload) {
    try {
      await sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, payload, {
        vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        TTL: PUSH_TTL_SECONDS,
        urgency: "normal",
        timeout: TIMEOUT_MS,
        contentEncoding: "aes128gcm",
      });
      return { kind: "sent" };
    } catch (error) {
      const status = error instanceof WebPushError ? error.statusCode : null;
      if (status === 404 || status === 410) return { kind: "gone" };
      return { kind: "failed", error: status === null ? (error instanceof Error ? error.name : "unknown") : `http_${status}` };
    }
  },
});

/** The push step of the scheduled job: `null` when push is not configured (nothing is sent, nothing is lost). */
export const deliverPushes = async (now: () => Date): Promise<PushReport | null> => {
  const vapid = vapidFromEnv(process.env);
  if (vapid === null) {
    if (vapidMisconfigured(process.env)) logError("push: VAPID variables present but invalid, nothing sent");
    return null;
  }
  return sendPushes({ queue: pushQueue(getDb()), sender: webPushSender(vapid), now });
};
