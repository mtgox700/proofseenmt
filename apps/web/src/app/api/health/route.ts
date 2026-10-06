import { getDb } from "@proofseen/db";
import { transportFromEnv } from "@proofseen/notify";
import { gatewayFromEnv } from "@proofseen/payments";
import { proofseenIdentity } from "@/data/payments-config";
import { hasDatabase } from "@/data/intake-sink";
import { cronAuthorised } from "@/lib/cron-auth";
import { logError } from "@/lib/log";

/*
 * Health check for an uptime monitor: 200 when the database answers, 503 otherwise. Anyone gets the verdict; only a
 * caller holding the cron secret also sees which services are configured (names and yes/no, never a value), because
 * that list tells an attacker what is switched off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 3_000;
/** A flood of health checks must not take database connections from real traffic: the verdict is reused briefly. */
const CACHE_MS = 5_000;

type Database = "up" | "down" | "absent";

const probe = async (): Promise<Database> => {
  if (!hasDatabase()) return "absent";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getDb().$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS);
      }),
    ]);
    return "up";
  } catch (error) {
    logError("health: database not answering", error);
    return "down";
  } finally {
    clearTimeout(timer);
  }
};

let last: { readonly at: number; readonly verdict: Promise<Database> } | null = null;

const database = (): Promise<Database> => {
  const now = Date.now();
  if (last === null || now - last.at > CACHE_MS) last = { at: now, verdict: probe() };
  return last.verdict;
};

const configured = (read: () => unknown): boolean => {
  try {
    return read() !== null;
  } catch {
    return false;
  }
};

export async function GET(request: Request): Promise<Response> {
  const db = await database();
  const healthy = db === "up";
  const services = cronAuthorised(request)
    ? {
        payments: configured(() => gatewayFromEnv(process.env)),
        billingIdentity: proofseenIdentity() !== null,
        mail: transportFromEnv(process.env) !== null,
        indexNow: (process.env.INDEXNOW_KEY ?? "") !== "" && (process.env.PROOFSEEN_PUBLIC_URL ?? "") !== "",
      }
    : undefined;
  return Response.json(
    { ok: healthy, data: { database: db, ...(services === undefined ? {} : { services }) } },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
