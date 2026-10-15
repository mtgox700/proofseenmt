import type { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, MissionInputSchema, missions, MissionSearchSchema } from "@proofseen/db";
import { hasDatabase } from "@/data/intake-sink";
import { clientAddress, throttled } from "@/data/throttle";
import { caller, fail, invalid, jsonBody, ok, sameOrigin } from "@/lib/api";

/*
 * Open missions (GET, public, filters only — the order is the one the visitor picks, never a computed relevance) and
 * a company member creating a draft (POST).
 */

export const runtime = "nodejs";

const SEARCH_RULE = { windowMs: 60_000, max: 60 };
const CREATE_RULE = { windowMs: 60 * 60_000, max: 30 };

const CreateSchema = z.object({ organisationId: z.uuid(), mission: MissionInputSchema });

/** Query string → search filters. Amounts arrive in whole currency units, as people type them. */
const filtersFrom = (params: URLSearchParams) => {
  const number = (name: string): number | undefined => {
    const raw = params.get(name);
    return raw === null || raw.trim() === "" ? undefined : Number(raw);
  };
  const minRate = number("tjmMin");
  const maxRate = number("tjmMax");
  return MissionSearchSchema.safeParse({
    q: params.get("q")?.trim() || undefined,
    maxDailyRateCents: maxRate === undefined ? undefined : Math.round(maxRate * 100),
    workModes: params.getAll("mode"),
    city: params.get("ville")?.trim() || undefined,
    skills: params.getAll("competence"),
    minDailyRateCents: minRate === undefined ? undefined : Math.round(minRate * 100),
    maxDurationMonths: number("dureeMax"),
    sort: params.get("tri") || undefined,
    page: number("page"),
  });
};

export async function GET(request: Request): Promise<NextResponse> {
  if (!hasDatabase()) return fail("non-configuré");
  if (await throttled("missions-search", clientAddress(request) ?? "unknown", SEARCH_RULE, new Date())) return fail("trop de demandes");
  const filters = filtersFrom(new URL(request.url).searchParams);
  if (!filters.success) return fail("requête invalide");
  try {
    return ok(await missions(getDb()).search(filters.data));
  } catch {
    return fail("erreur serveur");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("missions-create", who.actor.userId, CREATE_RULE, new Date())) return fail("trop de demandes");
  const parsed = CreateSchema.safeParse(await jsonBody(request));
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const created = await missions(getDb()).create(who.actor, parsed.data.organisationId, parsed.data.mission);
    return created === null ? fail("introuvable") : ok(created, 201);
  } catch {
    return fail("erreur serveur");
  }
}
