import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/cron/proofs/route";

/*
 * The proof recheck reads third-party sites, which can be slow or hostile. It runs in its own scheduled call, so a site
 * that drips bytes can never delay escrow releases or the mail outbox. No database is reachable here.
 */

const SECRET = "s".repeat(40);
const call = (authorization?: string): Promise<Response> =>
  GET(new Request("http://localhost/api/cron/proofs", authorization === undefined ? {} : { headers: { authorization } }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cron des preuves", () => {
  it("refuses a call without the scheduler secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("DATABASE_URL", "");
    expect((await call()).status).toBe(401);
    expect((await call(`Bearer ${"x".repeat(40)}`)).status).toBe(401);
  });

  it("answers « non-configuré » when no database is configured", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("DATABASE_URL", "");
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "non-configuré" });
  });

  it("rereads nothing without a proof secret, rather than failing every proof", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    // Never contacted: the secret is checked before any database access.
    vi.stubEnv("DATABASE_URL", "postgresql://unused:unused@127.0.0.1:1/unused");
    vi.stubEnv("PROOFSEEN_PROOF_SECRET", "");
    vi.stubEnv("PROOFSEEN_ACCESS_SECRET", "");
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { kind: "no_secret" } });
  });

  it("is no longer part of the notifications job, and the scheduler calls it", () => {
    const root = join(__dirname, "..", "..", "..");
    const notifications = readFileSync(join(root, "apps/web/src/app/api/cron/notifications/route.ts"), "utf8");
    expect(notifications).not.toContain("recheckProofs");
    expect(readFileSync(join(root, "deploy/vps/cron.sh"), "utf8")).toContain("/api/cron/proofs");
  });
});
