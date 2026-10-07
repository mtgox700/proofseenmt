import type { NextResponse } from "next/server";
import { z } from "zod";
import { ApiKeyNameSchema, apiKeys, getDb } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/*
 * The company's API keys, for its owners and administrators: listed without their secret (GET), or created (POST). The
 * key itself is in the POST answer and nowhere else, ever.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60 * 60_000, max: 20 };
const CreateSchema = z.object({ name: ApiKeyNameSchema });

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const { id } = await context.params;
  try {
    const keys = await apiKeys(getDb()).list(who.actor, id);
    return keys === null ? fail("introuvable") : ok(keys);
  } catch (error) {
    logError("api keys list failed", error);
    return fail("erreur serveur");
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("api-key-create", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = CreateSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  try {
    const created = await apiKeys(getDb()).create(who.actor, id, parsed.data.name, new Date());
    switch (created.kind) {
      case "created": {
        // The only response that ever carries the key: no cache may keep it.
        const response = ok({ key: created.key, ...created.summary }, 201);
        response.headers.set("cache-control", "no-store");
        return response;
      }
      case "too_many":
        return fail("trop de clés");
      case "absent":
        return fail("introuvable");
    }
  } catch (error) {
    logError("api key create failed", error);
    return fail("erreur serveur");
  }
}
