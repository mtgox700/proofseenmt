import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentitySchema, ManifestSchema } from "@proofseen/core";
import { readSealed } from "@proofseen/extract";
import { commandExtract, commandHub, commandPurge, commandReport, commandRun } from "../src/commands";
import { CliError, readJsonl, wavePaths } from "../src/files";
import { parseManualCsv } from "../src/manual";
import { StoredDrawSchema } from "../src/records";

const TEMPLATES = join(__dirname, "..", "..", "..", ".war-room", "experiment0", "templates");
const FAKE_PEOPLE = ["Camille Laurent", "Julien Martin", "Sarah Petit", "Hugo Bernard", "Léa Moreau", "Thomas Girard", "Emma Roux"];

const identity = {
  id: "ayoub",
  displayName: "Ayoub Hammoudi",
  nameVariants: ["Ayoub Hammoudi"],
  city: "Paris",
  stack: ["TypeScript"],
  ownedUrls: [{ url: "https://ayoub-hammoudi.dev/", proofMethod: "well_known_file", verifiedAt: "2026-09-25T10:00:00Z" }],
};

const manifest = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  waveId: "J0",
  frozenAt: null,
  engines: ["openai", "anthropic", "perplexity"],
  models: { openai: "gpt-5-mini", anthropic: "claude-haiku-4-5", perplexity: "perplexity/sonar" },
  drawsPerCell: 3,
  costCapUsd: 50,
  jobDescriptions: [
    { id: "T01", lang: "fr", role: "target", source: "market", text: "Senior Full Stack TypeScript, Paris, freelance 6 mois." },
    { id: "T02", lang: "fr", role: "target", source: "market", text: "AI/LLM Engineer, RAG et évaluation, remote France." },
    { id: "C01", lang: "fr", role: "control", source: "market", text: "Développeur Java Spring Boot, Lyon, sur site." },
  ],
  prompts: [
    { id: "P1", version: 1, lang: "fr", text: "Voici une offre :\n{{JD}}\nTrouve-moi les 5 meilleurs profils freelances." },
    { id: "P3", version: 1, lang: "en", text: "Job description:\n{{JD}}\nFind me the 5 best freelancers." },
  ],
  ...overrides,
});

let dir: string;
const key = randomBytes(32).toString("base64");
const logs: string[] = [];
const common = () => ({ runsDir: join(dir, "runs"), env: { PROOFSEEN_ENC_KEY: key }, log: (m: string) => void logs.push(m), now: () => new Date("2026-09-28T09:00:00Z") });

const writeInputs = async (m: object, id: object = identity) => {
  await writeFile(join(dir, "manifest.json"), JSON.stringify(m));
  await writeFile(join(dir, "identity.json"), JSON.stringify(id));
  return { manifestPath: join(dir, "manifest.json"), identityPath: join(dir, "identity.json") };
};

const allFilesText = async (root: string): Promise<string> => {
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  const files = entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
  return (await Promise.all(files.map((f) => readFile(f, "utf8")))).join("\n");
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "proofseen-cli-"));
  logs.length = 0;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("experiment 0 templates", () => {
  it("validate against the schemas", async () => {
    const m = ManifestSchema.parse(JSON.parse(await readFile(join(TEMPLATES, "manifest.template.json"), "utf8")));
    expect(m.jobDescriptions).toHaveLength(13);
    expect(m.jobDescriptions.filter((j) => j.role === "control")).toHaveLength(3);
    expect(m.prompts.map((p) => p.id)).toEqual(["P1", "P2", "P3", "P4"]);
    expect(m.engines.length * m.jobDescriptions.length * m.prompts.length * m.drawsPerCell).toBe(780);
    expect(IdentitySchema.parse(JSON.parse(await readFile(join(TEMPLATES, "identity.template.json"), "utf8"))).id).toBe("ayoub");
  });
});

describe("sim-run --dry-run → sim-extract → sim-report", () => {
  it("runs the whole pipeline without network and writes a DRY-RUN report", async () => {
    const inputs = await writeInputs(manifest());
    await commandRun({ ...common(), ...inputs, dryRun: true, confirmSpend: false, extractorModel: "claude-haiku-4-5", useJudge: false });
    const paths = wavePaths(join(dir, "runs"), "J0");
    const draws = await readJsonl(paths.draws, StoredDrawSchema);
    expect(draws).toHaveLength(3 * 3 * 2 * 3);
    expect(draws.every((d) => d.status === "ok")).toBe(true);

    await commandExtract({ ...common(), identityPath: inputs.identityPath, waveId: "J0" });
    const out = await commandReport({ ...common(), waveId: "J0", baselineWaveId: "J0", manualPath: undefined, reportDir: join(dir, "report") });
    const report = await readFile(out, "utf8");
    expect(report).toContain("DRY-RUN");
    expect(report).toContain("SoRV@5");
    expect(report).toMatch(/\| openai \|/);
    expect(report).toMatch(/Accord extracteur LLM \/ re-scoring déterministe : \d+\/\d+/);
  });

  it("never writes a third-party name to disk, even inside the sealed answers", async () => {
    const inputs = await writeInputs(manifest());
    await commandRun({ ...common(), ...inputs, dryRun: true, confirmSpend: false, extractorModel: "claude-haiku-4-5", useJudge: false });
    const paths = wavePaths(join(dir, "runs"), "J0");
    const disk = await allFilesText(join(dir, "runs"));
    const draws = await readJsonl(paths.draws, StoredDrawSchema);
    const decrypted = await Promise.all(draws.map((d) => readSealed(paths.sealed, d.id, Buffer.from(key, "base64"))));
    [disk, ...decrypted].forEach((text) => FAKE_PEOPLE.forEach((name) => expect(text).not.toContain(name)));
    expect(disk).not.toMatch(/fake-profile|fake-dev|fakefreelance|fake-portfolio/);
  });

  it("resumes an interrupted wave without re-running finished draws", async () => {
    const inputs = await writeInputs(manifest());
    const run = () => commandRun({ ...common(), ...inputs, dryRun: true, confirmSpend: false, extractorModel: "claude-haiku-4-5", useJudge: false });
    await run();
    await run();
    expect(await readJsonl(wavePaths(join(dir, "runs"), "J0").draws, StoredDrawSchema)).toHaveLength(54);
  });

  it("stops before the budget cap", async () => {
    const inputs = await writeInputs(manifest({ costCapUsd: 0.5 }));
    await commandRun({ ...common(), ...inputs, dryRun: true, confirmSpend: false, extractorModel: "claude-haiku-4-5", useJudge: false });
    const meta = JSON.parse(await readFile(wavePaths(join(dir, "runs"), "J0").wave, "utf8"));
    expect(meta.stoppedReason).toMatch(/budget cap/);
    expect(meta.draws).toBeLessThan(54);
    expect(meta.spentUsd).toBeLessThanOrEqual(0.5);
  });

  it("purges sealed answers after 72 h", async () => {
    const inputs = await writeInputs(manifest());
    await commandRun({ ...common(), ...inputs, dryRun: true, confirmSpend: false, extractorModel: "claude-haiku-4-5", useJudge: false });
    await commandPurge({ ...common(), now: () => new Date("2026-10-01T09:00:01Z") });
    expect(await readdir(wavePaths(join(dir, "runs"), "J0").sealed)).toEqual([]);
  });
});

describe("safety guards on a real wave", () => {
  it("refuses an unfrozen manifest", async () => {
    const inputs = await writeInputs(manifest());
    await expect(commandRun({ ...common(), ...inputs, dryRun: false, confirmSpend: true, extractorModel: "claude-haiku-4-5", useJudge: false })).rejects.toThrow(/not frozen/);
  });

  it("refuses to spend without --confirm-spend", async () => {
    const inputs = await writeInputs(manifest({ frozenAt: "2026-09-27T18:00:00Z" }));
    await expect(commandRun({ ...common(), ...inputs, dryRun: false, confirmSpend: false, extractorModel: "claude-haiku-4-5", useJudge: false })).rejects.toThrow(/confirm-spend/);
  });

  it("refuses to run without API keys", async () => {
    const inputs = await writeInputs(manifest({ frozenAt: "2026-09-27T18:00:00Z" }));
    await expect(commandRun({ ...common(), ...inputs, dryRun: false, confirmSpend: true, extractorModel: "claude-haiku-4-5", useJudge: false })).rejects.toThrow(/OPENAI_API_KEY is missing/);
  });

  it("refuses a job description that contains the client's identity", async () => {
    const m = manifest();
    const inputs = await writeInputs({ ...m, jobDescriptions: [{ ...m.jobDescriptions[0], text: "Profil type Ayoub Hammoudi recherché, Paris" }] });
    await expect(commandRun({ ...common(), ...inputs, dryRun: true, confirmSpend: false, extractorModel: "claude-haiku-4-5", useJudge: false })).rejects.toBeInstanceOf(CliError);
  });

  it("explains an invalid manifest instead of crashing", async () => {
    const inputs = await writeInputs(manifest({ engines: ["gemini"] }));
    await expect(commandRun({ ...common(), ...inputs, dryRun: true, confirmSpend: false, extractorModel: "claude-haiku-4-5", useJudge: false })).rejects.toThrow(/manifest: .* is invalid/);
  });
});

describe("hub command", () => {
  const profile = {
    version: 1,
    baseUrl: "https://alex-martin.example",
    person: {
      name: "Alex Martin",
      headline: { fr: "Développeur freelance", en: "Freelance developer" },
      city: "Paris",
      workMode: { fr: "Remote", en: "Remote" },
      summary: { fr: "Résumé.", en: "Summary." },
      stack: ["TypeScript"],
      links: [],
      contactEmail: null,
    },
    availability: { status: "available", from: null, updatedAt: "2026-09-18" },
    rate: null,
    missions: [],
    verificationToken: null,
  };

  it("writes the static site to the output directory", async () => {
    await writeFile(join(dir, "profile.json"), JSON.stringify(profile));
    const paths = await commandHub({ ...common(), profilePath: join(dir, "profile.json"), outDir: join(dir, "site") });
    expect(paths.sort()).toEqual(["en/index.html", "index.html", "robots.txt", "sitemap.xml"]);
    expect(await readFile(join(dir, "site", "en", "index.html"), "utf8")).toContain("Freelance developer");
  });

  it("explains an invalid profile", async () => {
    await writeFile(join(dir, "profile.json"), JSON.stringify({ ...profile, baseUrl: "http://insecure.example" }));
    await expect(commandHub({ ...common(), profilePath: join(dir, "profile.json"), outDir: join(dir, "site") })).rejects.toThrow(/hub profile: .* is invalid/);
  });
});

describe("manual sample CSV", () => {
  const header = "wave_id,jd_id,app,date_utc,logged_out,client_present,client_rank,notes_sans_nom";

  it("parses valid rows", () => {
    const rows = parseManualCsv(`${header}\nJ0,T01,chatgpt,2026-09-28T14:05Z,true,false,,h0=nomme\nJ0,T01,gemini,2026-09-28T14:10Z,false,true,3,`);
    expect(rows).toHaveLength(2);
    expect(rows[1]!.client_rank).toBe("3");
  });

  it("rejects free text in notes and a wrong header", () => {
    expect(() => parseManualCsv(`${header}\nJ0,T01,chatgpt,2026-09-28T14:05Z,true,false,,Jean Dupont cité`)).toThrow(CliError);
    expect(() => parseManualCsv("a,b\n1,2")).toThrow(/header/);
  });
});
