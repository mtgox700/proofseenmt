import type { NextResponse } from "next/server";
import { ApiPageSchema, companyApi, getDb } from "@proofseen/db";
import { fail, ok } from "@/lib/api";
import { keyCaller } from "@/lib/api-key";
import { logError } from "@/lib/log";

/** Read-only company API: the mission invoices addressed to the calling company, oldest first, paged. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const who = await keyCaller(request);
  if (who.kind === "refused") return who.response;
  const query = new URL(request.url).searchParams;
  const parsed = ApiPageSchema.safeParse({ after: query.get("after") ?? undefined, limit: query.get("limit") ?? undefined });
  if (!parsed.success) return fail("requête invalide");
  try {
    return ok(await companyApi(getDb()).invoices(who.caller.organisationId, parsed.data));
  } catch (error) {
    logError("api invoices failed", error);
    return fail("erreur serveur");
  }
}
