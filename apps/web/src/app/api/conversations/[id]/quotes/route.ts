import type { NextResponse } from "next/server";
import { getDb, NewQuoteInputSchema, quotes } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, invalid, jsonBody, ok, sameOrigin } from "@/lib/api";

/**
 * Quotes of a conversation (GET, both parties) and a new draft by the freelancer (POST). A new quote must state the object
 * of the work (`scope`, Code civil 1163): 422 « objet de la prestation manquant » otherwise. Quotes written before that
 * rule stay readable without one; the deliverables stay optional.
 */

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
  const parsed = NewQuoteInputSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);
  // La régie s'ouvre avec son paiement mensuel : d'ici là, un contrat en régie ne pourrait être ni payé ni clos.
  if (parsed.data.billing === "monthly" && process.env.PROOFSEEN_MONTHLY_BILLING !== "on") return fail("régie pas encore ouverte");
  const { id } = await context.params;
  try {
    const draft = await quotes(getDb()).draft(who.actor, id, parsed.data);
    return draft === null ? fail("introuvable") : ok(draft, 201);
  } catch {
    return fail("erreur serveur");
  }
}
