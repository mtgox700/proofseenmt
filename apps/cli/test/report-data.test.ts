import { describe, expect, it } from "vitest";
import type { Match } from "@proofseen/core";
import { buildReportData, type WaveData } from "../src/report-data";
import type { StoredDraw, WaveMeta } from "../src/records";

const meta = (waveId: string, stoppedReason: string | null = null): WaveMeta => ({
  waveId,
  dryRun: false,
  manifestSha256: "0".repeat(64),
  startedAt: "2026-09-28T09:00:00Z",
  finishedAt: "2026-09-28T12:00:00Z",
  spentUsd: 1,
  draws: 0,
  errors: 0,
  stoppedReason,
});

let seq = 0;
const draw = (engine: StoredDraw["engine"], jdId: string, status: "ok" | "error" = "ok", role: "target" | "control" = "target"): StoredDraw => ({
  id: `d${(seq += 1)}`,
  waveId: "J0",
  engine,
  model: "m",
  promptId: "P1",
  jdId,
  drawIndex: 0,
  timestamp: "2026-09-28T09:00:00Z",
  costUsd: 0.01,
  status,
  errorCode: status === "error" ? "EngineHttpError:401" : null,
  responseHash: status === "ok" ? "a".repeat(64) : null,
  retrieved: true,
  citedDomains: { platform: {}, client: 0, other: 0 },
  jdRole: role,
  jdSource: "market",
  extractionFailed: false,
  extractionError: null,
});

const certain = (d: StoredDraw, rank = 1): Match => ({ drawId: d.id, identityId: "ayoub", type: "certain", rank, clientUrlCited: false, needsReview: false });

const wave = (waveId: string, draws: StoredDraw[], matches: Match[], stopped: string | null = null): WaveData => ({ meta: meta(waveId, stopped), draws, matches });

describe("buildReportData — completeness (red-team #1)", () => {
  it("marks the wave incomplete when an engine is down instead of averaging only the survivors", () => {
    const ok = [draw("openai", "T01"), draw("openai", "T02"), draw("anthropic", "T01"), draw("anthropic", "T02")];
    const down = [draw("perplexity", "T01", "error"), draw("perplexity", "T02", "error")];
    const data = buildReportData({ current: wave("J0", [...ok, ...down], ok.map((d) => certain(d))), baseline: null, rescore: null, manual: null });
    expect(data.incomplete).toBe(true);
    expect(data.coverage.perplexity).toEqual({ ok: 0, total: 2 });
    expect(data.renderedVisible).toBe(false);
  });

  it("marks the wave incomplete when the budget stopped it", () => {
    const ok = [draw("openai", "T01"), draw("openai", "T02")];
    const data = buildReportData({ current: wave("J0", ok, ok.map((d) => certain(d)), "budget cap reached"), baseline: null, rescore: null, manual: null });
    expect(data.incomplete).toBe(true);
  });

  it("is complete and can declare the profile visible when every engine delivered", () => {
    const ok = [draw("openai", "T01"), draw("openai", "T02"), draw("anthropic", "T01"), draw("anthropic", "T02")];
    const data = buildReportData({ current: wave("J0", ok, ok.map((d) => certain(d))), baseline: null, rescore: null, manual: null });
    expect(data.incomplete).toBe(false);
    expect(data.renderedVisible).toBe(true);
  });
});

describe("buildReportData — difference-in-differences (red-team #4)", () => {
  const targets = (jds: string[]) => jds.map((j) => draw("openai", j));
  const controls = (jds: string[]) => jds.map((j) => draw("openai", j, "ok", "control"));

  it("refuses to compute DiD when the JD sets differ between waves", () => {
    const base = wave("J0", [...targets(["T01", "T02"]), ...controls(["C01"])], []);
    const now = wave("J30", [...targets(["T01", "T03"]), ...controls(["C01"])], []);
    const data = buildReportData({ current: now, baseline: base, rescore: null, manual: null });
    expect(data.did).toBeNull();
    expect(data.didNote).toMatch(/JD/);
  });

  it("computes DiD when both waves cover the same JDs", () => {
    const base = wave("J0", [...targets(["T01", "T02"]), ...controls(["C01"])], []);
    const nowDraws = [...targets(["T01", "T02"]), ...controls(["C01"])];
    const now = wave("J30", nowDraws, [certain(nowDraws[0]!)]);
    const data = buildReportData({ current: now, baseline: base, rescore: null, manual: null });
    expect(data.did?.estimate).toBeCloseTo(0.5, 10);
    expect(data.didNote).toBeNull();
  });
});
