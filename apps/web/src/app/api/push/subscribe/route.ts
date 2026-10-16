import { getDb, pushSubscriptions } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";
import { deviceLabel } from "@/lib/push/device-label";
import { subscribeDevice, unsubscribeDevice, type PushRouteDeps, type PushRouteOutcome } from "@/lib/push/subscribe-route";
import { vapidFromEnv } from "@/lib/push/vapid";

/*
 * Push subscription of this device for the signed-in person (C20): POST subscribes (the browser's
 * `PushSubscription.toJSON()`), DELETE unsubscribes (`{ endpoint }`). Same-origin JSON only, throttled per person; a
 * suspended account cannot subscribe.
 */

export const runtime = "nodejs";

const RULE = { windowMs: 10 * 60_000, max: 20 };

const deps = (request: Request): PushRouteDeps => ({
  configured: vapidFromEnv(process.env) !== null,
  sameOrigin,
  caller,
  throttled: (userId) => throttled("push-subscribe", userId, RULE, new Date()),
  body: jsonBody,
  subscriptions: () => pushSubscriptions(getDb()),
  deviceLabel: deviceLabel(request.headers.get("user-agent")),
});

const answer = (outcome: PushRouteOutcome): Response => {
  if (outcome.kind === "refused") return outcome.response;
  if (outcome.kind === "error") return fail(outcome.error);
  return ok(outcome.data);
};

const run = async (request: Request, handler: typeof subscribeDevice): Promise<Response> => {
  try {
    return answer(await handler(request, deps(request)));
  } catch (error) {
    logError("push subscription: failed", error);
    return fail("erreur serveur");
  }
};

export async function POST(request: Request): Promise<Response> {
  return run(request, subscribeDevice);
}

export async function DELETE(request: Request): Promise<Response> {
  return run(request, unsubscribeDevice);
}
