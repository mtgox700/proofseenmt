/*
 * The push service as the delivery loop sees it (C20). The real one signs with VAPID and encrypts with the browser's
 * keys (data/web-push-sender.ts); tests use a fake, so they never reach the network.
 */

export interface PushTarget {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

/** "gone": the service answered 404 or 410, the device unsubscribed or the browser was reset. */
export type PushOutcome = { readonly kind: "sent" } | { readonly kind: "gone" } | { readonly kind: "failed"; readonly error: string };

export interface PushSender {
  send(target: PushTarget, payload: string): Promise<PushOutcome>;
}

/** How long a push service keeps a notification for a device that is offline: a day, like the queue. */
export const PUSH_TTL_SECONDS = 24 * 60 * 60;
