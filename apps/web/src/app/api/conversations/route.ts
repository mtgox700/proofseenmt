import type { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, InvalidCursorError, MessageBodySchema, messaging } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/*
 * The signed-in person's conversations (GET), and a company taking contact with a freelance through a first message
 * (POST). Access control and the freelance's consent live in `@proofseen/db`: this route only says who is asking.
 */

export const runtime = "nodejs";

const ContactSchema = z.object({ organisationId: z.uuid(), profileId: z.uuid(), body: MessageBodySchema });
const READ_RULE = { windowMs: 60_000, max: 120 };
const CONTACT_RULE = { windowMs: 60 * 60_000, max: 20 };

export async function GET(request: Request): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("conversations-read", who.actor.userId, READ_RULE, new Date())) return fail("trop de demandes");
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
  try {
    return ok(await messaging(getDb()).listConversations(who.actor, { cursor }));
  } catch (error) {
    return error instanceof InvalidCursorError ? fail("requête invalide") : fail("erreur serveur");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  // Per hour, not per minute: prospecting twenty freelancers an hour is a busy recruiter, more is a mailing.
  if (await throttled("contact", who.actor.userId, CONTACT_RULE, new Date())) return fail("trop de demandes");

  const parsed = ContactSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  try {
    const result = await messaging(getDb()).contact(who.actor, parsed.data.organisationId, parsed.data.profileId, parsed.data.body);
    if (result.kind === "absent") return fail("introuvable");
    if (result.kind === "contact_details") return fail("coordonnées refusées");
    if (result.kind === "limit") return fail("trop de demandes");
    return ok(result, result.kind === "opened" ? 201 : 200);
  } catch {
    return fail("erreur serveur");
  }
}
