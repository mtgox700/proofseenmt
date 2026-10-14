import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAuditInput } from "../../cli/src/audit";
import { readJsonl } from "../../cli/src/files";
import { StoredDrawSchema } from "../../cli/src/records";
import { categorise } from "../src/lib/answers";

/*
 * Instantané des réponses de la vague J0 du fondateur, tiré des artefacts réels de la CLI : l'image de l'accueil, un
 * point par réponse réelle. C'est le seul fichier que le site public lit hors de la base ; les espaces de démonstration,
 * qui lisaient aussi un espace freelance et un annuaire figés, ont été retirés (C13).
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../data");

const main = async (): Promise<void> => {
  const { reportInput } = await buildAuditInput({
    runsDir: join(root, "runs"),
    waveId: "J0",
    requestPath: join(root, ".war-room/experiment0/audit-J0.json"),
    manualPath: undefined,
    baselineWaveId: undefined,
  });

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

  await mkdir(out, { recursive: true });
  await writeFile(join(out, "j0-answers.json"), `${JSON.stringify(answers)}\n`);
  process.stdout.write(`Instantané écrit : ${answers.answers.length} réponses\n`);
};

main().catch((error: unknown) => {
  process.stderr.write(`snapshot : ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
