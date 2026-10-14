import { after } from "next/server";
import { getDb } from "@proofseen/db";
import { fetchTransport } from "@proofseen/engines";
import { capsFromEnv, claimNextMeasurement, measureClaimed, measurementKit, measurementsEnabled } from "@proofseen/measure";
// Relative imports: this route is imported by a vitest test, which does not resolve the "@/" alias.
import { hasDatabase } from "../../../../data/intake-sink";
import { cronAuthorised } from "../../../../lib/cron-auth";
import { logError } from "../../../../lib/log";

/*
 * AI visibility measurements requested from the app, called by the scheduler with `Authorization: Bearer <CRON_SECRET>`.
 *
 * Each call takes at most ONE queued request, under a lease, and only if the platform spending caps
 * (PROOFSEEN_MEASURE_DAILY_USD, PROOFSEEN_MEASURE_MONTHLY_USD) leave room for its worst case: when they do not, the
 * request stays queued for a later run. The answer is sent at once and the measurement runs after it (a measurement
 * takes minutes, the scheduler must not wait on it). Overlapping calls never take the same request, and never spend
 * together more than the caps allow: the claim and the reservation happen under one database lock.
 *
 * Only the engines whose key is configured are queried, and the request records which ones. Nothing runs at all until
 * PROOFSEEN_MEASURE_ENABLED=1 is set: having a key is not the founder's go-ahead to spend.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Where the platform enforces a limit, the measurement scheduled after the response gets this long. */
export const maxDuration = 800;

const json = (body: unknown, status = 200): Response => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorised(request)) return json({ ok: false, error: "non autorisé" }, 401);
  if (!hasDatabase()) return json({ ok: false, error: "non-configuré" }, 503);
  // Paid calls are a separate decision from having keys: without the switch, requests wait and nothing is spent.
  if (!measurementsEnabled(process.env)) return json({ ok: true, data: { kind: "disabled" } });
  const kit = measurementKit(process.env, fetchTransport);
  if (kit === null) return json({ ok: true, data: { kind: "unconfigured" } });
  const input = { db: getDb(), kit, caps: capsFromEnv(process.env), now: () => new Date() };
  try {
    const step = await claimNextMeasurement(input);
    if (step.kind !== "claimed") return json({ ok: true, data: { ...step, engines: kit.engines } });
    after(async () => {
      try {
        const report = await measureClaimed(input, step);
        // Outcome, short code and cost only: never a profile, a name or an engine answer in the logs.
        const code = "code" in report ? report.code : null;
        const costCents = "costCents" in report ? report.costCents : 0;
        console.info(JSON.stringify({ level: "info", event: "cron measurements", outcome: report.kind, code, costCents, at: new Date().toISOString() }));
      } catch (error) {
        logError("cron measurements: measurement failed", error);
      }
    });
    return json({ ok: true, data: { kind: "claimed", requestId: step.request.id, engines: kit.engines } }, 202);
  } catch (error) {
    logError("cron measurements: claim failed", error);
    return json({ ok: false, error: "erreur serveur" }, 500);
  }
}
