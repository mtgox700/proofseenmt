import type { NextResponse } from "next/server";
import { getDb, profiles, vigilance, VigilanceInputSchema } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, invalid, jsonBody, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/*
 * The freelancer's URSSAF vigilance certificate: required by law for any service of 5,000 € excl. VAT or more. GET says
 * where it stands; PUT declares a new one (issue date and security code), which starts unverified until an operator
 * checks the code on the URSSAF website.
 */

export const runtime = "nodejs";

const RULE = { windowMs: 60 * 60_000, max: 20 };

export async function GET(): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  try {
    const db = getDb();
    const mine = await profiles(db).findMine(who.actor);
    if (mine === null) return fail("profil requis");
    return ok(await vigilance(db).status(mine.id, new Date()));
  } catch (error) {
    logError("vigilance status failed", error);
    return fail("erreur serveur");
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("vigilance", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = VigilanceInputSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const result = await vigilance(getDb()).declare(who.actor, parsed.data, new Date());
    switch (result.kind) {
      case "saved":
        return ok({ expiresOn: result.expiresOn.toISOString().slice(0, 10), verified: false });
      case "no_profile":
        return fail("profil requis");
      case "expired":
      case "future":
        return fail("requête invalide");
    }
  } catch (error) {
    logError("vigilance declaration failed", error);
    return fail("erreur serveur");
  }
}
