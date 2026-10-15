import type { NextResponse } from "next/server";
import { getDb, readState } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/*
 * Marks a conversation read up to its latest message, for the signed-in person (the open thread calls it when a
 * message arrives while the tab is visible). Someone else's conversation changes nothing and answers the same, so the
 * call cannot tell whether a thread exists.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const READ_RULE = { windowMs: 60_000, max: 60 };

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("message-read", who.actor.userId, READ_RULE, new Date())) return fail("trop de demandes");
  const { id } = await context.params;
  try {
    await readState(getDb()).markRead(who.actor, id);
    return ok({ read: true });
  } catch (error) {
    logError("conversation read: failed", error);
    return fail("erreur serveur");
  }
}
