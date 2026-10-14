import type { NextResponse } from "next/server";
import { z } from "zod";
import { briefConfigured, translateMissionBrief, translateProfileBrief, type BriefOutcome } from "@/data/brief";
import { caller, fail, jsonBody, ok, sameOrigin, type ApiError } from "@/lib/api";

/*
 * A need written in one sentence, turned into visible search filters. The model only proposes filter values: it sees
 * no profile, sorts nothing, has no tool. The filters are returned to the person, who reviews and edits them before
 * any search, and the list keeps the order the person chooses (AI Act: no automatic ranking of people).
 *
 * Each call is paid: signed-in people only, a per-person limit, and a platform-wide daily cap, shared with the company
 * search page (`@/data/brief`). Without a configured model the route answers "non-configuré" and the page falls back
 * to the plain form.
 */

export const runtime = "nodejs";

const BodySchema = z.object({
  target: z.enum(["profiles", "missions"]),
  brief: z.unknown(),
});

const REFUSAL: Readonly<Record<Exclude<BriefOutcome<unknown>["kind"], "ok">, ApiError>> = {
  unconfigured: "non-configuré",
  throttled: "trop de demandes",
  invalid: "requête invalide",
  not_understood: "brief incompris",
  failed: "erreur serveur",
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  if (!briefConfigured()) return fail("non-configuré");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const parsed = BodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  const { target, brief } = parsed.data;
  const outcome = target === "profiles" ? await translateProfileBrief(who.actor.userId, brief) : await translateMissionBrief(who.actor.userId, brief);
  return outcome.kind === "ok" ? ok({ target, filters: outcome.filters }) : fail(REFUSAL[outcome.kind]);
}
