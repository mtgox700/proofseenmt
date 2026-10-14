import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/cron/measurements/route";

/*
 * The measurement job spends real money: nobody but the scheduler may trigger it. No database and no engine key are
 * configured here, so nothing can be claimed or spent whatever the test does.
 */

const SECRET = "s".repeat(40);
const call = (authorization?: string): Promise<Response> =>
  GET(new Request("http://localhost/api/cron/measurements", authorization === undefined ? {} : { headers: { authorization } }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cron des mesures", () => {
  it("refuses a call without the scheduler secret, or with a wrong one", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("DATABASE_URL", "");
    expect((await call()).status).toBe(401);
    expect((await call(`Bearer ${"x".repeat(40)}`)).status).toBe(401);
    expect((await call(SECRET)).status).toBe(401);
  });

  it("refuses everyone when the secret is missing or too short to be safe", async () => {
    vi.stubEnv("CRON_SECRET", "short");
    vi.stubEnv("DATABASE_URL", "");
    expect((await call("Bearer short")).status).toBe(401);
  });

  it("spends nothing until the measurement switch is on, even with a database and a key", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    // Never contacted: the switch is checked before any database access.
    vi.stubEnv("DATABASE_URL", "postgresql://unused:unused@127.0.0.1:1/unused");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
    vi.stubEnv("PROOFSEEN_MEASURE_ENABLED", "");
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { kind: "disabled" } });
  });

  it("answers « non-configuré » to the scheduler when no database is configured", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("DATABASE_URL", "");
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "non-configuré" });
  });
});
