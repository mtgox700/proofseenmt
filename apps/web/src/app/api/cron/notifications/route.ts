import { getDb, missionAlerts, notifications, ownedUrls, payments, retention, validationReminders, vigilance } from "@proofseen/db";
import { deliver, transportFromEnv } from "@proofseen/notify";
import { gatewayFromEnv } from "@proofseen/payments";
import { proofseenIdentity } from "@/data/payments-config";
import { checkDueRegistry } from "@/data/registry-lookup";
import { hasDatabase } from "@/data/intake-sink";
import { recheckProofs } from "@/data/ownership";
import { cronAuthorised } from "@/lib/cron-auth";
import { logError } from "@/lib/log";
import { proofSecret } from "@/lib/proof-secret";
import { publicBaseUrl } from "@/lib/public-url";

/*
 * Periodic job, called by a scheduler with `Authorization: Bearer <CRON_SECRET>`: deletes what has outlived its
 * retention period, replays the saved mission alerts, rereads the ownership proofs that are due, then sends what is
 * waiting in the notification queue.
 *
 * Without a mail transport configured (RESEND_API_KEY and NOTIFY_FROM), alerts are still turned into queued
 * notifications but nothing is sent: they wait, they are not lost. Several runs at once are safe — each batch is
 * leased in the database.
 */

export const runtime = "nodejs";

const BATCH = 50;
const MAX_BATCHES = 4;

const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorised(request)) return json({ ok: false, error: "non autorisé" }, 401);
  if (!hasDatabase()) return json({ ok: false, error: "non-configuré" }, 503);
  const db = getDb();
  const now = () => new Date();
  try {
    // A failing purge must not stop escrow releases and mail: it is logged and the run goes on.
    const purged = await retention(db)
      .purge(now())
      .catch((error: unknown) => {
        logError("cron: retention purge failed", error);
        return null;
      });
    const queued = await missionAlerts(db).scan(now());
    // Paid work never approved: both parties are reminded and a person reviews the case. Nothing is released here.
    const overdue = await validationReminders(db).flagOverdue(now());
    const vigilanceReminders = await vigilance(db).remindExpiring(now());
    // SIRET numbers checked against the official directory; an unreachable directory only delays the check.
    const registryChecks = await checkDueRegistry(db, now()).catch((error: unknown) => {
      logError("cron: registry checks failed", error);
      return null;
    });
    // Proven addresses are reread every 30 days, a bounded batch per run. Without a proof secret no token can be
    // computed: nothing is reread, rather than every proof failing and, after the grace period, being revoked.
    const secret = proofSecret();
    const proofChecks =
      secret === null
        ? null
        : await recheckProofs(ownedUrls(db), secret, now()).catch((error: unknown) => {
            logError("cron: proof rechecks failed", error);
            return null;
          });
    // Escrow releases that could not go through at approval time (payout account not ready, provider down) are
    // retried here; each one is claimed in the database first, so overlapping runs never pay twice.
    let gateway;
    try {
      gateway = gatewayFromEnv(process.env);
    } catch {
      gateway = null;
    }
    const identity = proofseenIdentity();
    const releases = gateway !== null && identity !== null ? await payments(db).releaseDue(gateway, identity, now()) : null;

    const transport = transportFromEnv(process.env);
    if (transport === null) return json({ ok: true, data: { purged, queued, overdue, vigilanceReminders, registryChecks, proofChecks, releases, sent: 0, failed: 0, transport: "absent" } });

    const outbox = notifications(db);
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < MAX_BATCHES; i += 1) {
      const batch = await outbox.claim(BATCH, now());
      if (batch.length === 0) break;
      const report = await deliver(batch, { transport, outbox, baseUrl: publicBaseUrl(request), now });
      sent += report.sent;
      failed += report.failed;
    }
    return json({ ok: true, data: { purged, queued, overdue, vigilanceReminders, registryChecks, proofChecks, releases, sent, failed, transport: "resend" } });
  } catch (error) {
    logError("cron notifications: failed", error);
    return json({ ok: false, error: "erreur serveur" }, 500);
  }
}
