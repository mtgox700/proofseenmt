import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PublicProfileSchema } from "@proofseen/profiles";
import { z } from "zod";
import { buildAuditInput } from "../../cli/src/audit";
import { loadWave } from "../../cli/src/commands";
import { buildReportData } from "../../cli/src/report-data";
import { readJsonl } from "../../cli/src/files";
import { StoredDrawSchema } from "../../cli/src/records";
import { categorise } from "../src/lib/answers";

/*
 * Instantané des données de l'espace web, tiré des artefacts réels de la CLI.
 *
 * Le web ne recalcule rien : il lit ce que `audit` remettrait au client, calculé par la même fonction. Tant qu'il n'y a
 * pas de base de données, ce fichier est l'unique porte d'entrée des chiffres (TEAM_MEMORY 2026-09-29, Maxwell) ; le
 * jour où Postgres arrive, seul `src/data/file-source.ts` change.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../data");

const IdentitySchema = z.object({
  ownedUrls: z.array(z.object({ url: z.url(), proofMethod: z.string(), verifiedAt: z.string().nullable().optional() })),
});
const WaveMetaSchema = z.object({ spentUsd: z.number().nonnegative(), finishedAt: z.string() });
const ProfilesSchema = z.object({ updatedAt: z.string(), profiles: z.array(PublicProfileSchema) });

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;

const main = async (): Promise<void> => {
  const { request, reportInput } = await buildAuditInput({
    runsDir: join(root, "runs"),
    waveId: "J0",
    requestPath: join(root, ".war-room/experiment0/audit-J0.json"),
    manualPath: undefined,
    baselineWaveId: undefined,
  });
  // Décomptes bruts des citations : une part sans son dénominateur ne permet pas de calculer sa fourchette.
  const sources = buildReportData({ current: await loadWave(join(root, "runs"), "J0"), baseline: null, rescore: null, manual: null }).sources;
  const identity = IdentitySchema.parse(await readJson(join(root, "identity.json")));
  const wave = WaveMetaSchema.parse(await readJson(join(root, "runs/J0/wave.json")));
  const profiles = ProfilesSchema.parse(await readJson(join(root, "proofseen-dist/api/profiles.json")));

  const workspace = {
    reference: request.client.reference,
    displayName: request.client.displayName,
    report: reportInput,
    surface: request.surface,
    costUsd: wave.spentUsd,
    sourceCounts: sources,
    // Seul l'hôte est gardé : l'écran dit « quelle surface est prouvée », pas l'adresse complète du profil.
    possession: identity.ownedUrls.map((owned) => ({
      host: new URL(owned.url).hostname.replace(/^www\./, ""),
      method: owned.proofMethod,
      verifiedAt: owned.verifiedAt ?? null,
    })),
    remeasures: [],
  };

  // One point per real answer for the hero: engine, offer, role and the cited domains, never a name or a profile URL.
  const draws = (await readJsonl(join(root, "runs/J0/draws.jsonl"), StoredDrawSchema)).filter((draw) => draw.status === "ok");
  const engines = ["openai", "anthropic", "perplexity"] as const;
  const labels = new Map(reportInput.jobDescriptions.map((jd) => [jd.id, jd.label]));
  const answers = {
    waveId: reportInput.wave.id,
    engines,
    offers: Object.fromEntries(labels),
    answers: draws.map((draw) => ({
      engine: engines.indexOf(draw.engine as (typeof engines)[number]),
      offer: draw.jdId,
      control: draw.jdRole === "control",
      category: categorise(draw.citedDomains),
      domains: Object.entries(draw.citedDomains.platform).sort(([, a], [, b]) => b - a).map(([domain]) => domain),
      other: draw.citedDomains.other,
    })),
  };
  if (answers.answers.some((answer) => answer.engine < 0)) throw new Error("moteur inconnu dans la vague J0");

  await mkdir(join(out, "freelance"), { recursive: true });
  await writeFile(join(out, "j0-answers.json"), `${JSON.stringify(answers)}\n`);
  await writeFile(join(out, "freelance", `${request.client.reference}.json`), `${JSON.stringify(workspace, null, 2)}\n`);
  await writeFile(join(out, "profiles.json"), `${JSON.stringify(profiles, null, 2)}\n`);
  process.stdout.write(
    `Instantané écrit : ${reportInput.wave.draws} réponses, étape bloquante ${reportInput.plan.blockingStage ?? "aucune"}, ${profiles.profiles.length} profil(s) public(s)\n`,
  );
};

main().catch((error: unknown) => {
  process.stderr.write(`snapshot : ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
