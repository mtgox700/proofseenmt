import { timingSafeEqual } from "node:crypto";
import { getDb, missionAlerts, notifications } from "@proofseen/db";
import { deliver, transportFromEnv } from "@proofseen/notify";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";

/*
 * Periodic job, called by a scheduler with `Authorization: Bearer <CRON_SECRET>`: replays the saved mission alerts,
 * then sends what is waiting in the notification queue.
 *
 * Without a mail transport configured (RESEND_API_KEY and NOTIFY_FROM), alerts are still turned into queued
 * notifications but nothing is sent: they wait, they are not lost. Several runs at once are safe — each batch is
 * leased in the database.
 */

export const runtime = "nodejs";

const BATCH = 50;
const MAX_BATCHES = 4;
const MIN_SECRET_LENGTH = 32;

const authorised = (request: Request): boolean => {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
};

const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  if (!authorised(request)) return json({ ok: false, error: "non autorisé" }, 401);
  if (!hasDatabase()) return json({ ok: false, error: "non-configuré" }, 503);
  const db = getDb();
  const now = () => new Date();
  try {
    const queued = await missionAlerts(db).scan(now());
    const transport = transportFromEnv(process.env);
    if (transport === null) return json({ ok: true, data: { queued, sent: 0, failed: 0, transport: "absent" } });

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
    return json({ ok: true, data: { queued, sent, failed, transport: "resend" } });
  } catch (error) {
    console.error("cron notifications: failed", error instanceof Error ? error.name : "unknown");
    return json({ ok: false, error: "erreur serveur" }, 500);
  }
}
