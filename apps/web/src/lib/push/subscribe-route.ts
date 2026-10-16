import type { Actor, PushSubscriptions } from "@proofseen/db";
import type { ApiError } from "../api";

/*
 * The checks of /api/push/subscribe (C20), apart from Next so they can be tested with fakes: same origin (CSRF),
 * signed-in and not suspended, throttled per person, a JSON body, then the repository, which validates the
 * subscription itself (known push services only) and keeps ten devices at most.
 */

export type PushRouteError = Extract<ApiError, "non-configuré" | "origine refusée" | "trop de demandes" | "requête invalide" | "compte suspendu">;

export type PushRouteOutcome =
  | { readonly kind: "refused"; readonly response: Response }
  | { readonly kind: "error"; readonly error: PushRouteError }
  | { readonly kind: "ok"; readonly data: { readonly subscribed: boolean } };

export type PushCaller = { readonly kind: "actor"; readonly actor: Actor } | { readonly kind: "refused"; readonly response: Response };

export interface PushRouteDeps {
  /** Push is configured (VAPID keys present): without it, nobody subscribes. */
  readonly configured: boolean;
  readonly sameOrigin: (request: Request) => boolean;
  readonly caller: () => Promise<PushCaller>;
  readonly throttled: (userId: string) => Promise<boolean>;
  readonly body: (request: Request) => Promise<unknown>;
  readonly subscriptions: () => Pick<PushSubscriptions, "subscribe" | "unsubscribe">;
  readonly deviceLabel: string | null;
}

type Checked = { readonly kind: "pass"; readonly actor: Actor; readonly body: unknown } | Exclude<PushRouteOutcome, { kind: "ok" }>;

const check = async (request: Request, deps: PushRouteDeps): Promise<Checked> => {
  if (!deps.sameOrigin(request)) return { kind: "error", error: "origine refusée" };
  const who = await deps.caller();
  if (who.kind === "refused") return who;
  if (await deps.throttled(who.actor.userId)) return { kind: "error", error: "trop de demandes" };
  const body = await deps.body(request);
  if (body === null || typeof body !== "object") return { kind: "error", error: "requête invalide" };
  return { kind: "pass", actor: who.actor, body };
};

export const subscribeDevice = async (request: Request, deps: PushRouteDeps): Promise<PushRouteOutcome> => {
  if (!deps.configured) return { kind: "error", error: "non-configuré" };
  const checked = await check(request, deps);
  if (checked.kind !== "pass") return checked;
  const result = await deps.subscriptions().subscribe(checked.actor, checked.body, deps.deviceLabel);
  if (result === "subscribed") return { kind: "ok", data: { subscribed: true } };
  return { kind: "error", error: result === "suspended" ? "compte suspendu" : "requête invalide" };
};

/** Unsubscribing works even once push is switched off: a device can always be taken back. */
export const unsubscribeDevice = async (request: Request, deps: PushRouteDeps): Promise<PushRouteOutcome> => {
  const checked = await check(request, deps);
  if (checked.kind !== "pass") return checked;
  await deps.subscriptions().unsubscribe(checked.actor, checked.body);
  // The same answer whether or not the device was subscribed to this account: nothing to learn about other accounts.
  return { kind: "ok", data: { subscribed: false } };
};
