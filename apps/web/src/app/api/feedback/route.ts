import type { NextResponse } from "next/server";
import { feedback, FeedbackInputSchema, getDb, users } from "@proofseen/db";
import { clientAddress, throttled } from "@/data/throttle";
import { hasDatabase } from "@/data/intake-sink";
import { fail, invalid, jsonBody, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";
import { session } from "@/lib/session";

/*
 * Beta feedback, from anyone: a visitor or a signed-in person. A signed-in author is attached so the founder can reply;
 * a visitor stays anonymous. Limited per address, and per person when signed in.
 */

export const runtime = "nodejs";

const RULE = { windowMs: 60 * 60_000, max: 10 };

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  if (!hasDatabase()) return fail("non-configuré");
  const now = new Date();
  if (await throttled("feedback", clientAddress(request) ?? "unknown", RULE, now)) return fail("trop de demandes");
  const parsed = FeedbackInputSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const state = await session();
    const db = getDb();
    const userId =
      state.kind === "signed-in" && state.person.email !== ""
        ? (await users(db).ensure({ clerkId: state.person.id, email: state.person.email, displayName: state.person.name })).userId
        : null;
    if (userId !== null && (await throttled("feedback-user", userId, RULE, now))) return fail("trop de demandes");
    await feedback(db).submit(userId, parsed.data);
    return ok({ received: true }, 201);
  } catch (error) {
    logError("feedback not saved", error);
    return fail("erreur serveur");
  }
}
