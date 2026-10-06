import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commandAudit } from "../src/audit";

/*
 * La commande qui produit le livrable vendu 49 €. Les bugs trouvés en exécution aujourd'hui étaient tous ici, dans la
 * glu : plafond calculé sur la moyenne, témoin étiqueté « client », rapport de simulation indiscernable d'un vrai.
 */

const jdEntry = (id: string, provenance: "client" | "proofseen") => ({ id, label: `Offre ${id}`, provenance });

const request = {
  client: { displayName: "Camille Dupont", reference: "FR-1AB2C" },
  surface: { readableWithoutJs: true, robotsTxt: true, sitemap: true, structuredData: true, verifiedPlatforms: ["github.com"] },
  indexation: { pagesDeclared: 4, pagesIndexed: 4, checkedAt: "2026-10-24" },
  jobDescriptions: [jdEntry("T01", "client"), jdEntry("C01", "proofseen")],
  caveats: ["Gemini et Copilot ne sont pas couverts."],
};

const draw = (id: string, engine: string, jdId: string, over: Record<string, unknown> = {}) => ({
  id,
  waveId: "AUDIT-FR-1AB2C",
  engine,
  model: `${engine}-modele`,
  promptId: "P1",
  jdId,
  drawIndex: 0,
  timestamp: "2026-10-24T09:00:00.000Z",
  costUsd: 0.02,
  status: "ok",
  errorCode: null,
  responseHash: "a".repeat(64),
  retrieved: false,
  refusedToName: null,
  citedDomains: { platform: { "malt.fr": 2 }, client: 0, other: 1 },
  jdRole: jdId.startsWith("T") ? "target" : "control",
  jdSource: jdId.startsWith("T") ? "client" : "market",
  extractionFailed: false,
  extractionError: null,
  ...over,
});

describe("le rapport client, depuis une vague sur disque", () => {
  let dir: string;
  let requestPath: string;
  let runsDir: string;
  let reportDir: string;
  const logs: string[] = [];

  const wave = async (over: Record<string, unknown> = {}, draws = [draw("d1", "openai", "T01"), draw("d2", "openai", "C01")]) => {
    const waveDir = join(runsDir, "AUDIT-FR-1AB2C");
    await mkdir(waveDir, { recursive: true });
    await writeFile(
      join(waveDir, "wave.json"),
      JSON.stringify({
        waveId: "AUDIT-FR-1AB2C",
        dryRun: false,
        manifestSha256: "b".repeat(64),
        startedAt: "2026-10-24T08:30:00.000Z",
        finishedAt: "2026-10-24T09:00:00.000Z",
        spentUsd: 4.92,
        draws: draws.length,
        errors: 0,
        stoppedReason: null,
        ...over,
      }),
    );
    await writeFile(join(waveDir, "draws.jsonl"), `${draws.map((d) => JSON.stringify(d)).join("\n")}\n`);
    await writeFile(join(waveDir, "matches.jsonl"), "");
  };

  const run = () => commandAudit({ runsDir, env: {}, log: (m) => void logs.push(m), now: () => new Date("2026-10-24T10:00:00Z"), waveId: "AUDIT-FR-1AB2C", requestPath, manualPath: undefined, baselineWaveId: undefined, reportDir });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-audit-"));
    runsDir = join(dir, "runs");
    reportDir = join(dir, "report");
    requestPath = join(dir, "request.json");
    await writeFile(requestPath, JSON.stringify(request));
    logs.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("écrit les deux formats depuis la même vague", async () => {
    await wave();
    await run();
    const files = await readdir(reportDir);
    expect(files.sort()).toEqual(["audit-FR-1AB2C-AUDIT-FR-1AB2C.html", "audit-FR-1AB2C-AUDIT-FR-1AB2C.md"]);
  });

  it("relève le modèle réellement interrogé, et tous s'il a changé en cours de vague", async () => {
    // Afficher un seul modèle quand deux ont servi contredirait la phrase du rapport sur le protocole figé.
    await wave({}, [draw("d1", "openai", "T01"), draw("d2", "openai", "C01", { model: "openai-modele-v2" })]);
    await run();
    const md = await readFile(join(reportDir, "audit-FR-1AB2C-AUDIT-FR-1AB2C.md"), "utf8");
    expect(md).toContain("openai-modele, openai-modele-v2");
  });

  it("marque un rapport de simulation dans son titre ET dans son nom de fichier", async () => {
    await wave({ dryRun: true });
    await run();
    const files = await readdir(reportDir);
    expect(files.every((f) => f.includes("-SIMULATION"))).toBe(true);
    const md = await readFile(join(reportDir, "audit-FR-1AB2C-AUDIT-FR-1AB2C-SIMULATION.md"), "utf8");
    expect(md).toContain("ne doit pas être remis à un client");
  });

  it("prend le rôle des offres dans la vague, pas dans la demande", async () => {
    await wave();
    await run();
    const md = await readFile(join(reportDir, "audit-FR-1AB2C-AUDIT-FR-1AB2C.md"), "utf8");
    expect(md).toMatch(/Offre T01 \| fournie par vous \| cible/);
    expect(md).toMatch(/Offre C01 \| choisie par Proofseen \| témoin/);
  });

  it("déclare le refus de nommer non mesuré quand aucun tirage ne le sait", async () => {
    await wave();
    await run();
    const md = await readFile(join(reportDir, "audit-FR-1AB2C-AUDIT-FR-1AB2C.md"), "utf8");
    expect(md).toContain("n'a pas pu être établi");
  });

  it("avertit le client quand l'extraction a échoué, sans que personne ait à y penser", async () => {
    // Sur J0, 780 extractions sur 780 avaient échoué. Le rapport client ne le disait que parce que la réserve avait
    // été écrite à la main dans la demande : un client qui paie ne peut pas dépendre de ce geste.
    await wave({}, [draw("d1", "openai", "T01", { extractionFailed: true, extractionError: "ExtractionError" }), draw("d2", "openai", "C01")]);
    await run();
    const md = await readFile(join(reportDir, "audit-FR-1AB2C-AUDIT-FR-1AB2C.md"), "utf8");
    expect(md).toMatch(/extraction automatique des candidats a échoué sur 1 réponse\(s\) sur 2/);
    expect(md).toMatch(/recomptage déterministe/);
  });

  it("n'invente pas de réserve quand l'extraction s'est bien passée", async () => {
    await wave();
    await run();
    const md = await readFile(join(reportDir, "audit-FR-1AB2C-AUDIT-FR-1AB2C.md"), "utf8");
    expect(md).not.toMatch(/extraction automatique des candidats a échoué/);
  });

  it("refuse une offre de la demande qui n'apparaît dans aucun tirage", async () => {
    await wave({}, [draw("d1", "openai", "T01")]);
    await expect(run()).rejects.toThrow(/C01.*n'apparaît dans aucun tirage/);
  });

  it("refuse une vague sans tirage réussi plutôt que de rendre un rapport vide", async () => {
    await wave({}, [draw("d1", "openai", "T01", { status: "error", errorCode: "HTTP_500" })]);
    await expect(run()).rejects.toThrow(/aucun tirage réussi/);
  });

  it("assainit la référence avant d'en faire un nom de fichier", async () => {
    // Le schéma la contraint déjà ; on ne fait pas confiance à la validation amont pour une écriture de fichier.
    await wave();
    await run();
    const files = await readdir(reportDir);
    expect(files.every((f) => !f.includes("..") && !f.includes("/"))).toBe(true);
  });
});
