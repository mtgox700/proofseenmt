import { getDb, missionAlerts, notifications, payments, retention } from "@proofseen/db";
import { deliver, transportFromEnv } from "@proofseen/notify";
import { gatewayFromEnv } from "@proofseen/payments";
import { proofseenIdentity } from "@/data/payments-config";
import { hasDatabase } from "@/data/intake-sink";
import { cronAuthorised } from "@/lib/cron-auth";
import { logError } from "@/lib/log";
import { publicBaseUrl } from "@/lib/public-url";

/*
 * Periodic job, called by a scheduler with `Authorization: Bearer <CRON_SECRET>`: deletes what has outlived its
 * retention period, replays the saved mission alerts, then sends what is waiting in the notification queue.
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
    if (transport === null) return json({ ok: true, data: { purged, queued, releases, sent: 0, failed: 0, transport: "absent" } });

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
    return json({ ok: true, data: { purged, queued, releases, sent, failed, transport: "resend" } });
  } catch (error) {
    logError("cron notifications: failed", error);
    return json({ ok: false, error: "erreur serveur" }, 500);
  }
}
