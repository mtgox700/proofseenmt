import type { NextResponse } from "next/server";
import { getDb, QuoteInputSchema, quotes } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, invalid, jsonBody, ok, sameOrigin } from "@/lib/api";

/** Quotes of a conversation (GET, both parties) and a new draft by the freelancer (POST). */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60 * 60_000, max: 30 };

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { id } = await context.params;
  try {
    const list = await quotes(getDb()).list(who.actor, id);
    return list === null ? fail("introuvable") : ok(list);
  } catch {
    return fail("erreur serveur");
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("quotes", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = QuoteInputSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);
  const { id } = await context.params;
  try {
    const draft = await quotes(getDb()).draft(who.actor, id, parsed.data);
    return draft === null ? fail("introuvable") : ok(draft, 201);
  } catch {
    return fail("erreur serveur");
  }
}
