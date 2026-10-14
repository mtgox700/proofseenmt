import { getDb, ownedUrls } from "@proofseen/db";
// Relative imports: this route is imported by a vitest test, which does not resolve the "@/" alias.
import { hasDatabase } from "../../../../data/intake-sink";
import { recheckProofs } from "../../../../data/ownership";
import { cronAuthorised } from "../../../../lib/cron-auth";
import { logError } from "../../../../lib/log";
import { proofSecret } from "../../../../lib/proof-secret";

/*
 * Scheduled recheck of proven addresses, called with `Authorization: Bearer <CRON_SECRET>`. Each proven address is
 * reread every 30 days, a bounded batch per run.
 *
 * It has its own call, apart from the notifications job: it reads third-party sites, which can be slow or hostile, and
 * must never delay escrow releases or the mail outbox. Each reread has a deadline and the whole run a budget (see
 * `data/ownership`); what is left is due again on the next run.
 *
 * Without a proof secret no token can be computed: nothing is reread, rather than every proof failing and, after the
 * grace period, being revoked.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorised(request)) return json({ ok: false, error: "non autorisé" }, 401);
  if (!hasDatabase()) return json({ ok: false, error: "non-configuré" }, 503);
  const secret = proofSecret();
  if (secret === null) return json({ ok: true, data: { kind: "no_secret" } });
  try {
    const report = await recheckProofs(ownedUrls(getDb()), secret, new Date());
    return json({ ok: true, data: { kind: "checked", ...report } });
  } catch (error) {
    logError("cron proofs: recheck failed", error);
    return json({ ok: false, error: "erreur serveur" }, 500);
  }
}
