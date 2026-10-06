import { randomInt } from "node:crypto";
import type { NextResponse } from "next/server";
import { getDb, ProfileInputSchema, profiles } from "@proofseen/db";
import { newReference } from "@proofseen/intake";
import { notifyProfileChanged } from "@/data/indexnow";
import { throttled } from "@/data/throttle";
import { caller, fail, invalid, jsonBody, ok, sameOrigin } from "@/lib/api";

/*
 * The signed-in freelancer's own profile: read (GET), create (POST, private until published) and update (PUT).
 * The public reference is drawn with a cryptographic random source: it appears in public addresses, and a predictable
 * series would let anyone enumerate profiles.
 */

export const runtime = "nodejs";

const RULE = { windowMs: 60 * 60_000, max: 30 };
const RANGE = 2 ** 32;

const secureRandom = (): number => randomInt(0, RANGE) / RANGE;

/** JSON sends dates as strings: the availability date is turned back into a date before validation. */
const withDates = (body: unknown): unknown => {
  if (typeof body !== "object" || body === null) return body;
  const value = (body as Record<string, unknown>).availableFrom;
  return typeof value === "string" ? { ...body, availableFrom: new Date(`${value.slice(0, 10)}T00:00:00Z`) } : body;
};

export async function GET(): Promise<NextResponse> {
  const who = await caller();
  if (who.kind === "refused") return who.response;
  try {
    const mine = await profiles(getDb()).findMine(who.actor);
    return mine === null ? fail("profil requis") : ok(mine);
  } catch {
    return fail("erreur serveur");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("profile", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = ProfileInputSchema.safeParse(withDates(await jsonBody(request)));
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const created = await profiles(getDb()).create(who.actor, parsed.data, () => newReference(secureRandom));
    return created === null ? fail("déjà accepté") : ok(created, 201);
  } catch {
    return fail("erreur serveur");
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("origine refusée");
  const who = await caller();
  if (who.kind === "refused") return who.response;
  if (await throttled("profile", who.actor.userId, RULE, new Date())) return fail("trop de demandes");
  const parsed = ProfileInputSchema.safeParse(withDates(await jsonBody(request)));
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const updated = await profiles(getDb()).update(who.actor, parsed.data);
    if (updated === null) return fail("profil requis");
    if (updated.visibility !== "private" && updated.slug !== null) notifyProfileChanged(updated.slug);
    return ok(updated);
  } catch {
    return fail("erreur serveur");
  }
}
