import type { NextResponse } from "next/server";
import { z } from "zod";
import { missionFiltersFromBrief, profileFiltersFromBrief } from "@proofseen/db";
import { createBriefTranslator, fetchTransport } from "@proofseen/engines";
import { throttled } from "@/data/throttle";
import { caller, fail, jsonBody, ok, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/log";

/*
 * A need written in one sentence, turned into visible search filters. The model only proposes filter values: it sees
 * no profile, sorts nothing, has no tool. The filters are returned to the person, who reviews and edits them before
 * any search, and the list keeps the order the person chooses (AI Act: no automatic ranking of people).
 *
 * Each call is paid: signed-in people only, a per-person limit, and a platform-wide daily cap. Without a configured
 * model the route answers "non-configuré" and the page falls back to the plain form.
 */

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5-20251001";
const PER_PERSON = { windowMs: 60 * 60_000, max: 20 };
const DEFAULT_DAILY_CAP = 300;

const BodySchema = z.object({
  target: z.enum(["profiles", "missions"]),
  brief: z.string().trim().min(5).max(600),
});

const dailyCap = (): number => {
  const value = Number(process.env.PROOFSEEN_BRIEF_DAILY_CAP ?? "");
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_CAP;
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (apiKey === "") return fail("non-configuré");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  const now = new Date();
  if (await throttled("brief", who.actor.userId, PER_PERSON, now)) return fail("trop de demandes");
  const parsed = BodySchema.safeParse(await jsonBody(request));
  if (!parsed.success) return fail("requête invalide");
  // The platform-wide cap is counted last, so refused requests do not use it up.
  if (await throttled("brief-daily", "platform", { windowMs: 24 * 60 * 60_000, max: dailyCap() }, now)) return fail("trop de demandes");
  try {
    const translate = createBriefTranslator({ apiKey, model: MODEL, transport: fetchTransport });
    const { candidate } = await translate(parsed.data.target, parsed.data.brief);
    const filters = parsed.data.target === "profiles" ? profileFiltersFromBrief(candidate) : missionFiltersFromBrief(candidate);
    if (filters === null) return fail("brief incompris");
    return ok({ target: parsed.data.target, filters });
  } catch (error) {
    logError("brief translation failed", error);
    return fail("erreur serveur");
  }
}
