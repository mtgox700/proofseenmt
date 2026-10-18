"use server";

import { APPEAL_PAGE, feedback, getDb } from "@proofseen/db";
import { accountUsers } from "@/data/accounts";
import { hasDatabase } from "@/data/intake-sink";
import { throttled } from "@/data/throttle";
import { logError } from "@/lib/log";
import { session } from "@/lib/session";

/*
 * Contesting an operator decision (C19), from the notice in one's own space or from the suspension page. It reaches the
 * back office as beta feedback filed under the appeal path, with the account attached so the team can answer. It works
 * for a suspended account too, on purpose: that is the one way left to talk to the team from inside the product.
 */

export type AppealState = { readonly kind: "idle" | "sent" | "invalid" | "too_many" | "unavailable" };

const RULE = { windowMs: 60 * 60_000, max: 5 };

export async function sendAppeal(_previous: AppealState, formData: FormData): Promise<AppealState> {
  const state = await session();
  if (state.kind !== "signed-in" || state.person.email === "" || !hasDatabase()) return { kind: "unavailable" };
  const body = formData.get("body");
  if (typeof body !== "string" || body.trim().length < 5 || body.trim().length > 2000) return { kind: "invalid" };
  try {
    const db = getDb();
    const { userId } = await accountUsers(db).ensure({ clerkId: state.person.id, email: state.person.email, displayName: state.person.name, emailVerified: state.person.emailVerified });
    if (await throttled("appeal", userId, RULE, new Date())) return { kind: "too_many" };
    const side = state.person.role === "freelance" || state.person.role === "company" ? state.person.role : "visitor";
    await feedback(db).submit(userId, { kind: "other", side, page: APPEAL_PAGE, body });
    return { kind: "sent" };
  } catch (error) {
    logError("appeal: not recorded", error);
    return { kind: "unavailable" };
  }
}
