import type { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, InvalidCursorError, MessageBodySchema, messaging } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/*
 * Messages of one conversation (GET, newest first) and posting one (POST). Someone else's conversation answers 404,
 * exactly like a conversation that does not exist: a 403 would confirm it does.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const PostSchema = z.object({ body: MessageBodySchema });
const READ_RULE = { windowMs: 60_000, max: 120 };
const POST_RULE = { windowMs: 60_000, max: 30 };

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("messages-read", who.actor.userId, READ_RULE, new Date())) return fail("trop de demandes");
  const { id } = await context.params;
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
  try {
    const page = await messaging(getDb()).listMessages(who.actor, id, { cursor });
    return page === null ? fail("introuvable") : ok(page);
  } catch (error) {
    return error instanceof InvalidCursorError ? fail("requête invalide") : fail("erreur serveur");
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("message", who.actor.userId, POST_RULE, new Date())) return fail("trop de demandes");

  const parsed = PostSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  try {
    const result = await messaging(getDb()).post(who.actor, id, parsed.data.body);
    switch (result.kind) {
      case "sent":
        return ok(result.message, 201);
      case "absent":
        return fail("introuvable");
      case "waiting":
        return fail("en attente d'accord");
      case "closed":
        return fail("conversation fermée");
    }
  } catch {
    return fail("erreur serveur");
  }
}
