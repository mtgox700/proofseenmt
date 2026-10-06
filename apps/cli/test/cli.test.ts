import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdentitySchema, ManifestSchema } from "@proofseen/core";
import { readSealed } from "@proofseen/extract";
import { commandExperiment, commandExtract, commandProfiles, commandHub, commandPurge, commandReport, commandRun } from "../src/commands";
import { CliError, readJsonl, wavePaths } from "../src/files";
import { checkManualSample, isRefusal, parseManualCsv, type ManualRow } from "../src/manual";
import { StoredDrawSchema } from "../src/records";

// These tests run whole pipelines and write dozens of encrypted files: on a loaded machine they need more than the
// suite's 60 s, and a timeout here would be noise, not a regression.
vi.setConfig({ testTimeout: 180_000 });

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

  it("reads a file saved by a French Excel: BOM, semicolons, CRLF, quoted field, VRAI/FAUX", () => {
    const excel =
      "﻿" +
      header.replaceAll(",", ";") +
      "\r\nJ0;T01;chatgpt;2026-09-28T14:05Z;VRAI;FAUX;;\"h0=nomme;src=malt\"\r\nJ0;T02;claude;2026-09-28T14:20Z;faux;vrai;2;\r\n";
    const rows = parseManualCsv(excel);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ logged_out: "true", client_present: "false", notes_sans_nom: "h0=nomme;src=malt" });
    expect(rows[1]).toMatchObject({ logged_out: "false", client_present: "true", client_rank: "2" });
  });

  it("accepts oui/non and 1/0 for yes-no columns, and a quoted field without separator", () => {
    const rows = parseManualCsv(`${header}\nJ0,T01,perplexity,2026-09-28T15:00Z,oui,0,,"a=b"\nJ0,T01,copilot,2026-09-28T15:05Z,NON,1,1,`);
    expect(rows.map((r) => [r.logged_out, r.client_present])).toEqual([
      ["true", "false"],
      ["false", "true"],
    ]);
  });

  it("checks the protocol rules of a manual sample and summarises it", () => {
    const ok = parseManualCsv(`${header}\nJ0,T01,chatgpt,d,true,true,2,\nJ0,T01,claude,d,true,false,,\nJ0,T02,chatgpt,d,true,false,,`);
    const good = checkManualSample(ok, 3);
    expect(good.problems).toEqual([]);
    expect(good.summary).toEqual({ total: 3, present: 1, refusals: 0, byApp: { chatgpt: 2, claude: 1 } });

    const bad = parseManualCsv(
      `${header}\nJ0,T01,chatgpt,d,true,true,,\nJ0,T01,chatgpt,d,true,false,3,\nJ1,T02,claude,d,true,false,,`,
    );
    const problems = checkManualSample(bad, 50).problems.join("\n");
    expect(problems).toMatch(/line 2: client_rank is required/);
    expect(problems).toMatch(/line 3: client_rank must be empty/);
    expect(problems).toMatch(/line 3: duplicate J0 × T01 × chatgpt/);
    expect(problems).toMatch(/several waves: J0, J1/);
    expect(problems).toMatch(/3 rows, 50 expected/);
  });

  it("gives a precise error for a broken line instead of guessing", () => {
    expect(() => parseManualCsv(`${header}\nJ0,T01,chatgpt,2026-09-28T14:05Z,true,false,,"unclosed`)).toThrow(/line 2/);
    expect(() => parseManualCsv(`${header}\nJ0,T01,chatgpt,2026-09-28T14:05Z,peut-être,false,,`)).toThrow(/line 2/);
  });
});

describe("three-arm test command", () => {
  const person = (n: string, extra: Record<string, unknown> = {}) => ({
    identity: {
      profileId: `FR-0000${n}`,
      realName: `Personne Numero ${n}`,
      email: `p${n}@example.com`,
      phone: null,
      links: [],
      legalId: null,
      consent: { givenAt: "2026-09-20", scope: "public_pseudonymous_profile", irreversibilityAcknowledged: true },
      ...extra,
    },
    profile: {
      id: `FR-0000${n}`,
      handle: `Profil.${n}`,
      headline: { fr: "Ingenieur full stack TypeScript", en: "Full stack TypeScript engineer" },
      seniority: "7+ ans",
      area: "Paris / Ile-de-France",
      skills: ["TypeScript", "Node.js", "PostgreSQL"],
      sectors: ["SaaS B2B"],
      availability: { status: "available", updatedAt: "2026-09-28" },
      rate: { min: 550, max: 650, currency: "EUR", unit: "day" },
      verifiedMissions: 4,
      summary: {
        fr: "Concoit et met en production des applications TypeScript, avec des missions verifiees une a une par Proofseen avant publication.",
        en: "Designs and ships production TypeScript applications, with every mission verified one by one by Proofseen before publication.",
      },
    },
  });

  const plan = (extra = {}) => ({
    entrySlug: "typescript-paris",
    publishedAt: "2026-09-28",
    namedArm: {
      profileId: "FR-0000A",
      identity: { displayName: "Personne Numero A", slug: "personne-numero-a", sameAs: ["https://github.com/exemple"] },
      consent: { selfPublished: true, givenAt: "2026-09-20", scope: "named_arm_of_the_three_arm_test" },
      ...extra,
    },
  });

  const write = async (entries: unknown[], experiment: unknown) => {
    await writeFile(join(dir, "profiles.json"), JSON.stringify({ baseUrl: "https://proofseen.example", entries }));
    await writeFile(join(dir, "experiment.json"), JSON.stringify(experiment));
    return {
      ...common(),
      inputPath: join(dir, "profiles.json"),
      experimentPath: join(dir, "experiment.json"),
      outDir: join(dir, "site"),
      manifestPath: join(dir, "pre-registration.json"),
    };
  };

  it("writes the three arms and keeps the pre-registration out of the published site", async () => {
    const paths = await commandExperiment(await write([person("A"), person("B"), person("C")], plan()));
    expect(paths).toContain("n/personne-numero-a/index.html");
    expect(paths).toContain("p/FR-0000A/index.html");
    expect(paths).toContain("freelances/typescript-paris/index.html");
    const manifest: unknown = JSON.parse(await readFile(join(dir, "pre-registration.json"), "utf8"));
    expect((manifest as { measurements: { date: string }[] }).measurements.map((m) => m.date)).toEqual(["2026-10-28", "2026-11-27"]);
    expect(await allFilesText(join(dir, "site"))).not.toContain("measurements");
  });

  it("writes nothing when a blocker would make the measurement unreadable", async () => {
    const options = await write([person("A"), person("B")], plan());
    await expect(commandExperiment(options)).rejects.toThrow(/bloquant/);
    await expect(readdir(join(dir, "site"))).rejects.toThrow();
    expect(logs.join(" ")).toMatch(/BLOQUANT : bras C/);
  });

  it("still protects the other freelancers on the named pages", async () => {
    await commandExperiment(await write([person("A"), person("B"), person("C")], plan()));
    const site = await allFilesText(join(dir, "site"));
    expect(site).not.toContain("Personne Numero B");
    expect(site).not.toContain("pB@example.com");
  });

  it("refuses any private field of the subject other than the name and the links", async () => {
    // legalId chosen so it only appears on the pages the named arm owns: the tolerance must stay limited to two fields.
    const options = await write([person("A", { legalId: "personne-numero-a" }), person("B"), person("C")], plan());
    await expect(commandExperiment(options)).rejects.toThrow(/bras nominatif.*legalId/);
  });
});

describe("profiles command: re-identification test and withdrawals", () => {
  const entry = (n: string, extra: { withdrawnAt?: string; selfSearch?: unknown } = {}) => ({
    identity: {
      profileId: `FR-0000${n}`,
      realName: `Personne Numero ${n}`,
      email: `p${n}@example.com`,
      phone: null,
      links: [],
      legalId: null,
      consent: { givenAt: "2026-09-20", scope: "public_pseudonymous_profile", irreversibilityAcknowledged: true, withdrawnAt: extra.withdrawnAt ?? null },
    },
    profile: {
      id: `FR-0000${n}`,
      handle: `Profil.${n}`,
      headline: { fr: "Ingenieur full stack TypeScript", en: "Full stack TypeScript engineer" },
      seniority: "7+ ans",
      area: "Paris / Ile-de-France",
      skills: ["TypeScript", "Node.js", "PostgreSQL"],
      sectors: ["SaaS B2B"],
      availability: { status: "available", updatedAt: "2026-09-28" },
      rate: { min: 550, max: 650, currency: "EUR", unit: "day" },
      verifiedMissions: 0,
      summary: {
        fr: "Concoit et met en production des applications TypeScript, avec des missions verifiees une a une par Proofseen avant publication.",
        en: "Designs and ships production TypeScript applications, with every mission verified one by one by Proofseen before publication.",
      },
    },
    ...(extra.selfSearch === undefined ? {} : { selfSearch: extra.selfSearch }),
  });
  const passed = { doneAt: "2026-09-27", outcome: "not_found", queriesRun: 5 };
  const run = async (entries: unknown[]) => {
    await writeFile(join(dir, "profiles.json"), JSON.stringify({ baseUrl: "https://proofseen.example", entries }));
    return commandProfiles({ ...common(), inputPath: join(dir, "profiles.json"), outDir: join(dir, "site") });
  };

  it("writes nothing until the freelancer has searched for himself, and hands him the queries", async () => {
    await expect(run([entry("A")])).rejects.toThrow(/ré-identification/);
    await expect(readdir(join(dir, "site"))).rejects.toThrow();
    expect(logs.join("\n")).toMatch(/Auto-recherche à faire par FR-0000A/);
    expect(logs.join("\n")).toMatch(/site:linkedin\.com\/in TypeScript/);
  });

  it("refuses a profile whose self-search found the real identity", async () => {
    await expect(run([entry("A", { selfSearch: { ...passed, outcome: "found" } })])).rejects.toThrow(/ré-identification/);
  });

  it("publishes once every profile passed its self-search", async () => {
    const paths = await run([entry("A", { selfSearch: passed }), entry("B", { selfSearch: passed })]);
    expect(paths).toContain("p/FR-0000A/index.html");
    expect(logs.join("\n")).toMatch(/k-anonymat : .* indicatif sous 50 profils/);
  });

  it("refuses a Proofseen contact address that is in fact a freelancer's own address", async () => {
    await writeFile(
      join(dir, "profiles.json"),
      JSON.stringify({ baseUrl: "https://proofseen.example", contactEmail: "pA@example.com", entries: [entry("A", { selfSearch: passed })] }),
    );
    await expect(commandProfiles({ ...common(), inputPath: join(dir, "profiles.json"), outDir: join(dir, "site") })).rejects.toThrow(/email/);
  });

  it("takes a withdrawn profile off the site, including the pages left by a previous build", async () => {
    await run([entry("A", { selfSearch: passed }), entry("B", { selfSearch: passed })]);
    const paths = await run([entry("A", { selfSearch: passed }), entry("B", { withdrawnAt: "2026-09-28" })]);
    expect(paths.some((p) => p.includes("FR-0000B"))).toBe(false);
    await expect(readdir(join(dir, "site", "p", "FR-0000B"))).rejects.toThrow();
    await expect(readdir(join(dir, "site", "en", "p", "FR-0000B"))).rejects.toThrow();
    expect(logs.join("\n")).toMatch(/RETRAIT FR-0000B .* échéance 2026-10-01T00:00:00.000Z/);
    expect(await allFilesText(join(dir, "site"))).not.toContain("Personne Numero B");
  });
});

describe("un refus de nommer n'est pas une absence", () => {
  const row = (app: "chatgpt" | "claude" | "perplexity" | "gemini" | "copilot", present: "true" | "false", notes = ""): ManualRow => ({
    wave_id: "J0",
    jd_id: "T01",
    app,
    date_utc: "2026-09-24T10:00:00Z",
    logged_out: "true" as const,
    client_present: present,
    client_rank: "",
    notes_sans_nom: notes,
  });

  it("reconnaît le code `refus` dans les notes, seul ou combiné", () => {
    expect(isRefusal(row("claude", "false", "refus"))).toBe(true);
    expect(isRefusal(row("claude", "false", "h0=1;refus"))).toBe(true);
    expect(isRefusal(row("claude", "false", "refus;h0=1"))).toBe(true);
    expect(isRefusal(row("claude", "false", ""))).toBe(false);
    expect(isRefusal(row("claude", "false", "refuse-web"))).toBe(false);
  });

  it("refuse une ligne qui prétend à la fois refuser et nommer le client", () => {
    const bad = { ...row("claude", "true", "refus"), client_rank: "2" };
    expect(checkManualSample([bad], 1).problems.join(" ")).toMatch(/un refus ne peut pas valoir client_present=true/);
  });

  it("compte les refus à part dans le résumé", () => {
    const rows = [row("claude", "false", "refus"), row("chatgpt", "false"), row("perplexity", "true")];
    rows[2]!.client_rank = "3";
    const summary = checkManualSample(rows, 3).summary;
    expect(summary).toMatchObject({ total: 3, present: 1, refusals: 1 });
  });
});
