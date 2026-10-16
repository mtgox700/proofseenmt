import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, messageDigests } from "@proofseen/db";
import { hasDatabase } from "@/data/intake-sink";
import { clientAddress, throttled } from "@/data/throttle";
import { fail, ok } from "@/lib/api";
import { digestUnsubscribeSecret, isUnsubscribeToken } from "@/lib/digest-unsubscribe";
import { logError } from "@/lib/log";

/*
 * One-click unsubscribe of the daily digest (wave-3 review, L12, RFC 8058). The mail client POSTs to the link of the
 * `List-Unsubscribe` header: no session and no origin to check, the signed token is the authority, and all it can do is
 * switch that one person's digest off. A GET (a person opening the link, or a scanner prefetching it) changes nothing:
 * it leads to the notification settings.
 */

export const runtime = "nodejs";

const QuerySchema = z.object({ u: z.uuid(), t: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
const RULE = { windowMs: 60_000, max: 10 };

export async function POST(request: Request): Promise<NextResponse> {
  if (!hasDatabase()) return fail("non-configuré");
  if (await throttled("digest-unsubscribe", clientAddress(request) ?? "unknown", RULE, new Date())) return fail("trop de demandes");
  const url = new URL(request.url);
  const query = QuerySchema.safeParse({ u: url.searchParams.get("u"), t: url.searchParams.get("t") });
  const secret = digestUnsubscribeSecret();
  if (!query.success || secret === null || !isUnsubscribeToken(secret, query.data.u, query.data.t)) return fail("requête invalide");
  try {
    await messageDigests(getDb()).set({ userId: query.data.u }, false);
    return ok({ unsubscribed: true });
  } catch (error) {
    logError("digest unsubscribe failed", error);
    return fail("erreur serveur");
  }
}

export function GET(request: Request): NextResponse {
  return NextResponse.redirect(new URL("/fr/app/notifications", request.url), 303);
}
