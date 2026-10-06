import { getDb, reviews } from "@proofseen/db";
import { hasDatabase } from "@/data/intake-sink";
import { clientAddress, throttled } from "@/data/throttle";

/** Public reviews of a published profile, newest first, each as written. No average, no score (EU AI Act rule). */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly id: string }>;
}

const RULE = { windowMs: 60_000, max: 60 };

export async function GET(request: Request, context: Context): Promise<Response> {
  if (!hasDatabase()) return Response.json({ ok: false, error: "non-configuré" }, { status: 503 });
  if (await throttled("reviews-read", clientAddress(request) ?? "unknown", RULE, new Date())) {
    return Response.json({ ok: false, error: "trop de demandes" }, { status: 429 });
  }
  const { id } = await context.params;
  try {
    const data = await reviews(getDb()).listForProfile(id);
    return Response.json({ ok: true, data }, { headers: { "cache-control": "public, max-age=0, s-maxage=300" } });
  } catch {
    return Response.json({ ok: false, error: "erreur serveur" }, { status: 500 });
  }
}
