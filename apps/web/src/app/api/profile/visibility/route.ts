import type { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, profiles } from "@proofseen/db";
import { notifyProfileChanged } from "@/data/indexnow";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/*
 * Publishing (named or pseudonymous) or withdrawing the signed-in freelancer's profile. An incomplete profile is not
 * published: the answer lists what is missing. Engines are told either way, so a withdrawn page is dropped too.
 */

export const runtime = "nodejs";

const VisibilitySchema = z.object({ visibility: z.enum(["named", "pseudonymous", "private"]) });
const RULE = { windowMs: 60 * 60_000, max: 20 };

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("profile-visibility", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = VisibilitySchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  try {
    const repo = profiles(getDb());
    const before = await repo.findMine(who.actor);
    const result = await repo.setVisibility(who.actor, parsed.data.visibility);
    if (result.kind === "absent") return fail("profil requis");
    if (result.kind === "incomplete") return ok({ published: false, missing: result.missing }, 422);
    const slug = result.profile.slug ?? before?.slug ?? null;
    if (slug !== null) notifyProfileChanged(slug);
    return ok(result.profile);
  } catch {
    return fail("erreur serveur");
  }
}
