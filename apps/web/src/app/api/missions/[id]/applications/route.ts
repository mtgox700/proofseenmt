import type { NextResponse } from "next/server";
import { z } from "zod";
import { AnswerSchema, applications, CoverNoteSchema, getDb } from "@proofseen/db";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";

/*
 * Applying to a mission (POST, a freelance) and reading its applications (GET, members of the company). Applying opens
 * the conversation with the company, already accepted, with the cover note as its first message.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const ApplySchema = z.object({ coverNote: CoverNoteSchema, answers: z.array(AnswerSchema).max(3).default([]) });
// Per day: thirty considered applications a day is a lot; a hundred is a script.
const APPLY_RULE = { windowMs: 24 * 60 * 60_000, max: 30 };

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const order = new URL(request.url).searchParams.get("ordre") === "recentes" ? "newest" : "oldest";
  const { id } = await context.params;
  try {
    const list = await applications(getDb()).listForMission(who.actor, id, order);
    return list === null ? fail("introuvable") : ok(list);
  } catch {
    return fail("erreur serveur");
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("apply", who.actor.userId, APPLY_RULE, new Date())) return fail("trop de demandes");
  const parsed = ApplySchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { id } = await context.params;
  try {
    const result = await applications(getDb()).apply(who.actor, id, parsed.data.coverNote, new Date(), parsed.data.answers);
    switch (result.kind) {
      case "applied":
        return ok(result, 201);
      case "no_profile":
        return fail("profil requis");
      case "profile_private":
        return fail("profil privé");
      case "already_applied":
        return fail("déjà candidat");
      case "absent":
        return fail("introuvable");
      case "contact_details":
        return fail("coordonnées refusées");
      // This route attaches no CV (the apply form uploads it): "cv_absent" is kept for the exhaustive switch.
      case "answers_required":
      case "cv_absent":
        return fail("requête invalide");
    }
  } catch {
    return fail("erreur serveur");
  }
}
