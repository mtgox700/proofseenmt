import { createHmac } from "node:crypto";
import { getDb, rateLimiter, type RateLimitRule } from "@proofseen/db";
import { hasDatabase } from "./intake-sink";
import { logError } from "../lib/log";

/*
 * Throttle for public and connected write endpoints.
 *
 * With a database, the counter is shared by every instance (`@proofseen/db`), so the limit holds behind a load
 * balancer. Without one, an in-memory counter remains: it raises the cost of a careless script, nothing more.
 *
 * The caller's identity never reaches the database in clear: the key is an HMAC under the server secret. A plain hash
 * would not do — the whole IPv4 space can be hashed in minutes and the table reversed.
 */

const MEMORY_CAP = 10_000;
const PURGE_PROBABILITY = 0.01;
const PURGE_AGE_MS = 24 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

const memory = new Map<string, number[]>();

const memoryThrottled = (key: string, rule: RateLimitRule, now: number): boolean => {
  const recent = (memory.get(key) ?? []).filter((at) => now - at < rule.windowMs);
  recent.push(now);
  // Re-inserting moves the key to the end: the map stays in least-recently-used order, and the oldest entry is
  // dropped in constant time. A flood of distinct keys can no longer grow the map or make each request scan it.
  memory.delete(key);
  memory.set(key, recent);
  if (memory.size > MEMORY_CAP) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  return recent.length > rule.max;
};

const digest = (value: string, secret: string): string =>
  createHmac("sha256", `rate-limit:${secret}`).update(value).digest("base64url").slice(0, 32);

/*
 * The client address as the platform saw it. `x-real-ip` is set by the edge (Vercel, most reverse proxies) and cannot
 * be supplied by the client. The leftmost `x-forwarded-for` entry can: a script would get a fresh bucket per request.
 * Without either, everyone would share one bucket and one client could lock everybody out, so the request is keyed on
 * nothing better than its own scope — still limited, by the coarse in-memory cap.
 */
export const clientAddress = (request: Request): string | null => {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real !== undefined && real !== "") return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? null;
};

let warnedAboutSecret = false;

/** True when `subject` (an address or a user id) has exceeded `rule` for `scope`. */
export const throttled = async (scope: string, subject: string, rule: RateLimitRule, now: Date): Promise<boolean> => {
  const secret = process.env.PROOFSEEN_ACCESS_SECRET ?? "";
  const memoryKey = `${scope}:${digest(subject, secret)}`;
  if (!hasDatabase()) return memoryThrottled(memoryKey, rule, now.getTime());
  if (secret.length < MIN_SECRET_LENGTH) {
    if (!warnedAboutSecret) {
      logError("throttle: PROOFSEEN_ACCESS_SECRET missing or too short, shared limiter disabled");
      warnedAboutSecret = true;
    }
    return memoryThrottled(memoryKey, rule, now.getTime());
  }
  try {
    const limiter = rateLimiter(getDb());
    const decision = await limiter.hit(memoryKey, rule, now);
    // Past windows are purged on a small fraction of requests: no scheduler to forget, and the table stays small.
    if (Math.random() < PURGE_PROBABILITY) {
      void limiter.purge(new Date(now.getTime() - PURGE_AGE_MS)).catch((error: unknown) => {
        logError("throttle: purge failed", error);
      });
    }
    return !decision.allowed;
  } catch (error) {
    // The database being down must not take the site down with it: fall back, and say so in the server log. The name
    // only: a driver message can carry the database host.
    logError("throttle: shared limiter unavailable, falling back to memory", error);
    return memoryThrottled(memoryKey, rule, now.getTime());
  }
};
