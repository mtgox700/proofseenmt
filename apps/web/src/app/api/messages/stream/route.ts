import { liveCounts, liveHub } from "@/data/live";
import { throttled } from "@/data/throttle";
import { caller, fail } from "@/lib/api";
import { logError } from "@/lib/log";
import { openLiveStream } from "@/lib/live/sse";

/*
 * Live events of the signed-in person (Server-Sent Events): new messages and read receipts in their own conversations,
 * and their unread counters. Who receives what is decided by the hub from the database, never by the browser: the
 * stream takes no parameter. Opening one is throttled per person, and the number open at once is capped.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_RULE = { windowMs: 10 * 60_000, max: 60 };
const OPTIONS = { heartbeatMs: 25_000, maxLifetimeMs: 15 * 60_000, retryMs: 5_000, log: logError } as const;

export async function GET(request: Request): Promise<Response> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { userId } = who.actor;
  if (await throttled("live-stream", userId, OPEN_RULE, new Date())) return fail("trop de demandes");
  try {
    return openLiveStream(liveHub(), userId, request.signal, () => liveCounts(userId), OPTIONS);
  } catch (error) {
    logError("live stream: not opened", error);
    return fail("erreur serveur");
  }
}
