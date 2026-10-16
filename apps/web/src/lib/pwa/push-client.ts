import { base64UrlBytes } from "./base64url";

/*
 * Browser side of push notifications (C20): ask permission, subscribe through the service worker, hand the
 * subscription to the server; and the reverse. Used by the setting of the notification centre only.
 */

const ENDPOINT = "/api/push/subscribe";

export type PushState = "on" | "off" | "denied" | "unsupported";
export type EnableResult = "on" | "denied" | "failed" | "too-many" | "suspended";

export const pushSupported = (): boolean =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** iPhone and iPad only offer push to an app added to the Home Screen. */
export const looksLikeIos = (): boolean => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

const registration = async (): Promise<ServiceWorkerRegistration> => {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
};

export const currentPushState = async (): Promise<PushState> => {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const existing = await navigator.serviceWorker.getRegistration("/");
  const subscription = await existing?.pushManager.getSubscription();
  return subscription === null || subscription === undefined ? "off" : "on";
};

const subscribe = async (reg: ServiceWorkerRegistration, key: Uint8Array<ArrayBuffer>): Promise<PushSubscription> => {
  const options = { userVisibleOnly: true, applicationServerKey: key };
  try {
    return await reg.pushManager.subscribe(options);
  } catch (error) {
    // Subscribed earlier under another server key (keys rotated): start again from scratch, once.
    const previous = await reg.pushManager.getSubscription();
    if (previous === null) throw error;
    await previous.unsubscribe();
    return reg.pushManager.subscribe(options);
  }
};

const send = (method: "POST" | "DELETE", body: unknown): Promise<Response> =>
  fetch(ENDPOINT, { method, credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const enablePush = async (publicKey: string): Promise<EnableResult> => {
  const key = base64UrlBytes(publicKey);
  if (key === null || !pushSupported()) return "failed";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const subscription = await subscribe(await registration(), key);
  const response = await send("POST", subscription.toJSON());
  if (response.ok) return "on";
  // The server refused it: do not leave a subscription it does not know about.
  await subscription.unsubscribe().catch(() => false);
  if (response.status === 429) return "too-many";
  if (response.status === 403) return "suspended";
  return "failed";
};

export const disablePush = async (): Promise<"off" | "failed"> => {
  const existing = await navigator.serviceWorker.getRegistration("/");
  const subscription = await existing?.pushManager.getSubscription();
  if (subscription === null || subscription === undefined) return "off";
  const response = await send("DELETE", { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
  return response.ok ? "off" : "failed";
};
