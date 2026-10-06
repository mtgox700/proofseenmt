import { NextResponse } from "next/server";
import { SubmissionSchema, submissionBlockers } from "@proofseen/intake";
import { getSink } from "@/data/intake-sink";
import { clientAddress, throttled } from "@/data/throttle";
import { readJson } from "@/lib/api";
import { logError } from "@/lib/log";

/*
 * Signup endpoint. Until now the web could only read: nobody could open a file without the operator typing the
 * reference, the name and the URLs by hand — which is enough on its own to block a testing phase where people arrive
 * on their own.
 *
 * Validation and refusals come from `@proofseen/intake`, the same code the CLI runs. The web must not be a second
 * place where "what we accept" is decided, or the two will disagree the day it matters.
 *
 * The throttle is shared across instances once the database is connected (`@/data/throttle`). It still does not
 * replace bot defence at the edge: one IP is cheap to change.
 */

export const runtime = "nodejs";

const RULE = { windowMs: 60_000, max: 5 };
// Ten addresses and a name fit in well under 8 KB; anything larger is not a signup.
const MAX_BODY_BYTES = 16_384;

export async function POST(request: Request): Promise<NextResponse> {
  const now = new Date();
  if (await throttled("intake", clientAddress(request) ?? "unknown", RULE, now)) {
    return NextResponse.json({ ok: false, blockers: ["trop de demandes : réessayez dans une minute."] }, { status: 429 });
  }

  const body = await readJson(request, MAX_BODY_BYTES);
  if (body === null) return NextResponse.json({ ok: false, blockers: ["requête illisible."] }, { status: 400 });

  const parsed = SubmissionSchema.safeParse(body);
  if (!parsed.success) {
    // Field-level zod messages are not shown: they describe our schema, not what the person should change.
    return NextResponse.json({ ok: false, blockers: ["le formulaire est incomplet ou mal rempli."] }, { status: 400 });
  }

  const blockers = submissionBlockers(parsed.data);
  if (blockers.length > 0) return NextResponse.json({ ok: false, blockers }, { status: 422 });

  try {
    const opened = await getSink().open(parsed.data, now);
    return NextResponse.json({ ok: true, ...opened }, { status: 201 });
  } catch (error) {
    // Never echo the underlying error: it would leak paths from the operator's machine. Its name goes to the log.
    logError("intake: file not opened", error);
    return NextResponse.json({ ok: false, blockers: ["le dossier n'a pas pu être ouvert."] }, { status: 500 });
  }
}
