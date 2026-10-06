import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PublicProfileSchema, planExperiment } from "@proofseen/profiles";
import { ARM_IDS, armDrawsFrom, armIdentities, renderVerdict } from "../src/arms";
import { threeArmVerdict } from "@proofseen/stats";
import { THRESHOLDS } from "@proofseen/profiles";
import { commandExperimentVerdict, commandRun } from "../src/commands";
import { readJsonl, wavePaths } from "../src/files";
import { ArmRecordSchema, type ArmRecord, type StoredDraw } from "../src/records";

const BASE = "https://proofseen.example";
const profile = (id: string) =>
  PublicProfileSchema.parse({
    id,
    handle: `Profil.${id.slice(-1)}`,
    headline: { fr: "Ingénieur full stack TypeScript", en: "Full stack TypeScript engineer" },
    seniority: "7+ ans",
    area: "Paris / Île-de-France",
    skills: ["TypeScript", "Node.js", "PostgreSQL"],
    sectors: [],
    availability: { status: "available", updatedAt: "2026-09-21" },
    rate: null,
    verifiedMissions: 0,
    summary: {
      fr: "Conçoit et met en production des applications TypeScript, avec des missions vérifiées une à une par Proofseen avant publication.",
      en: "Designs and ships production TypeScript applications, with every mission verified one by one by Proofseen before publication.",
    },
  });

const named = { displayName: "Prénom Nom", slug: "prenom-nom", sameAs: ["https://github.com/exemple"] };
const plan = planExperiment({
  profiles: [profile("FR-AAAAA"), profile("FR-BBBBB"), profile("FR-CCCCC")],
  namedArm: { profileId: "FR-AAAAA", identity: named },
  entrySlug: "typescript-paris",
  publishedAt: "2026-09-28",
  baseUrl: BASE,
});
const arms = armIdentities(plan.manifest, profile("FR-AAAAA"), named, "2026-09-28");

describe("arm identities", () => {
  it("recognises each arm by exactly the URLs that were published, and B never by the real name", () => {
    const [a, b, c] = arms;
    expect(a!.ownedUrls.map((u) => u.url)).toEqual([`${BASE}/n/prenom-nom/`, `${BASE}/en/n/prenom-nom/`]);
    expect(b!.ownedUrls.map((u) => u.url)).toEqual([`${BASE}/p/FR-AAAAA/`, `${BASE}/en/p/FR-AAAAA/`]);
    expect(c!.ownedUrls.map((u) => u.url)).toEqual([`${BASE}/freelances/typescript-paris/`, `${BASE}/en/freelancers/typescript-paris/`]);
    expect(b!.nameVariants).toEqual(["Profil.A", "FR-AAAAA"]);
    expect(JSON.stringify(b)).not.toContain("Prénom Nom");
  });

  it("marks every URL as verified on the date the domain was proven ours", () => {
    for (const identity of arms) for (const url of identity.ownedUrls) expect(url.verifiedAt).toBe("2026-09-28T00:00:00Z");
  });

  it("refuses a manifest without the two arms that are compared", () => {
    expect(() => armIdentities({ ...plan.manifest, arms: [] }, profile("FR-AAAAA"), named, "2026-09-28")).toThrow(/bras A et B/);
  });

  it("produces two identities when the entry page is not published", () => {
    const twoArms = { ...plan.manifest, arms: plan.manifest.arms.filter((a) => a.arm !== "C") };
    const identities = armIdentities(twoArms, profile("FR-AAAAA"), named, "2026-09-28");
    expect(identities.map((i) => i.id)).toEqual([ARM_IDS.A, ARM_IDS.B]);
  });
});

describe("verdict input", () => {
  const draw = (id: string, status: "ok" | "error", jdRole: "target" | "control" = "target") => ({ id, status, jdRole }) as unknown as StoredDraw;
  const record = (drawId: string, armId: string, over: Partial<ArmRecord> = {}): ArmRecord => ({
    drawId,
    armId,
    retrieved: false,
    cited: false,
    type: null,
    rank: null,
    needsReview: false,
    ...over,
  });

  it("counts a person arm only when recognised with certainty, and the entry page when its URL is cited", () => {
    const draws = armDrawsFrom([draw("d1", "ok")], [
      record("d1", ARM_IDS.A, { type: "probable" }),
      record("d1", ARM_IDS.B, { type: "certain" }),
      record("d1", ARM_IDS.C, { cited: true }),
    ]);
    expect(draws.map((d) => [d.arm, d.cited])).toEqual([
      ["A", false],
      ["B", true],
      ["C", true],
    ]);
  });

  it("excludes errored draws instead of counting them as 'not cited'", () => {
    expect(armDrawsFrom([draw("d1", "error")], [record("d1", ARM_IDS.A)])).toEqual([]);
  });

  it("keeps the last record of a draw seen twice after a resume", () => {
    const draws = armDrawsFrom([draw("d1", "ok")], [record("d1", ARM_IDS.B), record("d1", ARM_IDS.B, { type: "certain" })]);
    expect(draws).toEqual([{ drawId: "d1", arm: "B", cited: true, jdRole: "target" }]);
  });
});

describe("verdict report", () => {
  it("states a final decision only for a real wave measured at J+60", () => {
    const verdict = threeArmVerdict([{ drawId: "d1", arm: "A", cited: true, jdRole: "target" }], 60, THRESHOLDS);
    expect(renderVerdict("J60", 60, "2026-11-27", verdict, false)).toContain("**Décision finale.**");
    expect(renderVerdict("J60", 60, "2026-11-27", verdict, true)).toContain("**Aucune décision : simulation.**");
    expect(renderVerdict("J30", 30, "2026-10-28", threeArmVerdict([], 30, THRESHOLDS), false)).toContain("aucune décision avant J+60");
  });
});

describe("a measured wave, end to end (dry run, no API call)", () => {
  let dir: string;
  const logs: string[] = [];
  const common = () => ({ runsDir: join(dir, "runs"), env: {}, log: (m: string) => void logs.push(m), now: () => new Date("2026-11-27T09:00:00Z") });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-arms-"));
    logs.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes one line per draw and per arm, then a verdict report", async () => {
    const manifest = {
      version: 1,
      waveId: "ARMS-J60",
      frozenAt: null,
      engines: ["openai"],
      models: { openai: "gpt-5-mini" },
      drawsPerCell: 2,
      costCapUsd: 5,
      jobDescriptions: [{ id: "T01", lang: "fr", role: "target", source: "market", text: "Senior Full Stack TypeScript, freelance 6 mois." }],
      prompts: [{ id: "P1", version: 1, lang: "fr", text: "Voici une offre :\n{{JD}}\nTrouve-moi les 5 meilleurs profils freelances." }],
    };
    await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
    const paths = await Promise.all(arms.map(async (identity) => {
      const path = join(dir, `${identity.id}.json`);
      await writeFile(path, JSON.stringify(identity));
      return path;
    }));
    await commandRun({
      ...common(),
      manifestPath: join(dir, "manifest.json"),
      identityPath: paths[1]!,
      armPaths: [paths[0]!, paths[1]!, paths[2]!],
      dryRun: true,
      confirmSpend: false,
      extractorModel: "claude-haiku-4-5",
      useJudge: false,
    });
    const records = await readJsonl(wavePaths(join(dir, "runs"), "ARMS-J60").arms, ArmRecordSchema);
    expect(records).toHaveLength(2 * 3);
    expect(new Set(records.map((r) => r.armId))).toEqual(new Set(Object.values(ARM_IDS)));

    const out = await commandExperimentVerdict({ ...common(), waveId: "ARMS-J60", day: 60, reportDir: join(dir, "report") });
    const report = await readFile(out, "utf8");
    expect(report).toContain("# Test à 3 bras — vague ARMS-J60, J+60 — SIMULATION");
    // A dry run must never read as a decision, whatever its numbers say.
    expect(report).toContain("ces chiffres n'ont aucune valeur");
    expect(report).not.toContain("**Décision finale.**");
    expect(report).toMatch(/Mécanisme A.*: \*\*/);
    expect(report).toContain("n'est pas anonyme");
  });

  it("refuses a verdict on a wave measured without arms", async () => {
    await expect(commandExperimentVerdict({ ...common(), waveId: "NONE", day: 60, reportDir: join(dir, "report") })).rejects.toThrow(/--arms/);
  });
});
