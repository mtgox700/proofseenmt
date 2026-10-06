import { describe, expect, it } from "vitest";
import type { Match } from "@proofseen/core";
import { normaliseWatchedPath, observationsFrom, renderLdrReport } from "../src/ldr-data";
import type { StoredDraw } from "../src/records";

const draw = (id: string, engine: StoredDraw["engine"], jdId: string, promptId: string): StoredDraw => ({
  id,
  waveId: "J0",
  engine,
  model: "m",
  promptId,
  jdId,
  drawIndex: 0,
  timestamp: "2026-09-28T10:00:00.000Z",
  costUsd: 0.01,
  status: "ok",
  errorCode: null,
  responseHash: null,
  retrieved: true,
  refusedToName: null,
  citedDomains: { platform: {}, client: 0, other: 0 },
  jdRole: "target",
  jdSource: "market",
  extractionFailed: false,
  extractionError: null,
});

const match = (drawId: string, identityId: string, type: Match["type"], clientUrlCited = false): Match => ({
  drawId,
  identityId,
  type,
  rank: type === "certain" ? 2 : null,
  clientUrlCited,
  needsReview: type === "probable",
});

const draws: StoredDraw[] = [
  draw("d1", "openai", "T01", "P1"),
  draw("d2", "openai", "T01", "P1"),
  draw("d3", "anthropic", "T02", "P1"),
  { ...draw("d4", "anthropic", "T02", "P1"), status: "error", errorCode: "timeout" },
];

describe("from a measured wave to the discoverability rate", () => {
  it("counts a citation only when the match is certain", () => {
    const observations = observationsFrom(draws, [match("d1", "FR-AAAAA", "certain"), match("d2", "FR-AAAAA", "probable")], ["FR-AAAAA"]);
    expect(observations.filter((o) => o.cited)).toHaveLength(1);
    expect(observations).toHaveLength(3); // the errored draw is not an observation
  });

  it("gives every measured profile a draw for every usable draw, cited or not", () => {
    const observations = observationsFrom(draws, [match("d1", "FR-AAAAA", "certain")], ["FR-AAAAA", "FR-BBBBB"]);
    expect(observations.filter((o) => o.profileId === "FR-BBBBB")).toHaveLength(3);
    expect(observations.filter((o) => o.profileId === "FR-BBBBB" && o.cited)).toHaveLength(0);
  });

  it("uses the job description and the prompt as the query key", () => {
    const observations = observationsFrom(draws, [], ["FR-AAAAA"]);
    expect([...new Set(observations.map((o) => o.queryId))].sort()).toEqual(["T01/P1", "T02/P1"]);
  });

  it("treats our URL being cited as proof the engine had our page", () => {
    const observations = observationsFrom(draws, [match("d1", "FR-AAAAA", "probable", true)], ["FR-AAAAA"]);
    const first = observations.find((o) => o.queryId === "T01/P1")!;
    expect(first.retrieved).toBe(true);
    expect(first.cited).toBe(false);
  });
});

describe("the report says what is measured and what is not guaranteed", () => {
  const report = () =>
    renderLdrReport({
      waveId: "J0",
      date: "2026-09-28",
      engines: ["openai", "anthropic"],
      observations: observationsFrom(draws, [match("d1", "FR-AAAAA", "certain")], ["FR-AAAAA"]),
      crawler: [],
    });

  it("never prints a rate built on too few draws", () => {
    expect(report()).toMatch(/trop peu de tirages|non publiable/i);
    expect(report()).not.toMatch(/\b33(\.\d+)?\s?%/);
  });

  it("always carries the three columns and forbids any guarantee", () => {
    const text = report();
    expect(text).toMatch(/CONTRÔLÉ/);
    expect(text).toMatch(/NON GARANTI/);
    expect(text).not.toMatch(/100 %/);
  });

  it("lists the pages no AI crawler ever fetched", () => {
    const text = renderLdrReport({
      waveId: "J0",
      date: "2026-09-28",
      engines: ["openai"],
      observations: [],
      crawler: [
        { path: "/p/FR-AAAAA/", hits: [{ bot: "OAI-SearchBot", count: 3, lastSeen: "2026-09-27" }] },
        { path: "/p/FR-BBBBB/", hits: [] },
      ],
    });
    expect(text).toContain("/p/FR-BBBBB/");
    expect(text).toMatch(/jamais/i);
    expect(text).toContain("OAI-SearchBot");
  });
});

describe("watched paths given on the command line", () => {
  it("repairs the Windows rewriting done by Git Bash", () => {
    expect(normaliseWatchedPath("P:/FR-8F42K/")).toBe("/p/FR-8F42K/");
    expect(normaliseWatchedPath("C:\\freelances\\typescript-paris\\")).toBe("/c/freelances/typescript-paris/");
  });

  it("accepts a normal path and adds the leading slash when missing", () => {
    expect(normaliseWatchedPath("/p/FR-3K9PZ/")).toBe("/p/FR-3K9PZ/");
    expect(normaliseWatchedPath("p/FR-3K9PZ/")).toBe("/p/FR-3K9PZ/");
  });
});
