import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { CliError } from "./files";
import { recordPathFor } from "./record-path";
import { commandAccess, commandIntake } from "./intake";
import { commandPayment } from "./payment";
import { corpusDirFor, identityPathFor, manifestPathFor } from "./client-paths";
import { normaliseWatchedPath } from "./ldr-data";
import { commandAudit } from "./audit";
import { commandPossession } from "./possession";
import { commandGate } from "./gate";
import { commandClientWave } from "./client-wave";
import { commandSurfaceCheck } from "./surface-check";
import { commandFollowUp } from "./follow-up";
import { enforceRawTtl } from "./raw-ttl";
import { commandClientInit } from "./client-init";
import { commandClientStatus } from "./client-status";
import { commandCheckManual, commandExperiment, commandExperimentArms, commandWaveStatus, commandJdImport, commandExperimentVerdict, commandExtract, commandIndexNow, commandSiteVerify, commandHub, commandHubVerify, commandLdr, commandPreflight, commandProfiles, commandPurge, commandReport, commandRun } from "./commands";

const USAGE = `Proofseen CLI (V0)
  preflight --manifest <file> --identity <file> [--record <fichier>]   (no API call, no spending)
  run      --manifest <file> --identity <file> [--dry-run | --confirm-spend] [--judge] [--extractor-model claude-haiku-4-5]
  extract  --identity <file> --wave <id>
  report   --wave <id> [--baseline <id>] [--manual <csv>] [--report-dir report]
  surface-check --identity <file> [--record <fichier>] [--timeout 10000]   (trace écrite à côté de l'identité)   (manipulations destinées aux IA : refus de mesurer)
  follow-up --manifest <manifeste de référence> --wave <nouvel id> --out <manifest>   (re-mesure identique à sa référence)
  client-init --reference <FR-XXXXX> --name <nom> --url <url,url> [--out clients]   (ouvre le dossier d'un client)
  client-status [--out clients] [--report-dir report]   (où en est chaque client, et la prochaine action)
  intake   --submission <file> [--out clients] [--reference FR-XXXXX]   (OUVRE un dossier depuis une inscription, sans rien retaper)
  access   --reference FR-XXXXX [--ttl-days 30]   (ré-émet le lien d'espace d'un dossier existant)
  client-wave --request <file> [--dir <offres>] [--out <manifest>] [--identity <file>] [--cost-cap <usd>]   (CRÉE le manifeste ; chemins déduits du dossier client)   (monte la vague d'un client)
  gate     --journal <file>   (décompte de la GATE (3) Argent : acquis, provisoires, remboursements dus)
  payment  --journal <file> --reference <ref> [--offer audit --amount-cents 29000 [--early-start] | --delivered | --refunded]   (ÉCRIT dans le journal)
  possession --identity <file> [--verify]   (US-F00 : consignes de preuve, puis vérification ; jamais de requête vers LinkedIn/Malt)
  audit    --wave <id> --request <file> [--baseline <id>] [--manual <csv>] [--report-dir report]   (rapport client : funnel, sources, plan de correction)
  check-manual --manual <csv> [--expected <saisies réellement faites>]
  purge    [--wave <id>]   (sans --wave : purge les réponses expirées ; avec : supprime celles d une vague terminée)
  hub      --profile <file> [--identity <file>] [--out hub-dist]   (avec --identity : le site publie lui-même le jeton de preuve)
  hub-verify --profile <file> [--timeout 10000]   (fetches the deployed site)
  profiles --input <file> [--out profiles-dist]   (pseudonymous public site)
  experiment --input <file> --experiment <file> [--out experiment-dist] [--manifest-out .war-room/experiment/manifest.json]
  site-verify --out <dossier publié> --base-url <https://…>   (compare le site déployé au dossier)
  indexnow --out <dossier publié> --base-url <https://…> [--confirm-submit]   (rien n'est envoyé sans le flag)
  wave-status --wave <id> [--manifest <file>]   (avancement, coût, échéance de purge)
  jd-import --manifest <file> --identity <file> --dir <dossier de T01.txt…> [--out <manifest>]   (RECHARGE les textes d'un manifeste existant)
  experiment-arms --input <file> --experiment <file> --verified-at <date> [--out arms]   (identités des 3 bras)
  experiment-verdict --wave <id> --day <30|60> [--indexation <file>] [--report-dir report]   (verdict pré-enregistré ; sans --indexation, aucune voie n'est close)
  ldr      --wave <id> [--profiles <id,id>] [--log <access.log>] [--paths </p/X/,...>]
Common: [--runs-dir runs]`;

const main = async (argv: readonly string[]): Promise<void> => {
  const { positionals, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      manifest: { type: "string" },
      identity: { type: "string" },
      wave: { type: "string" },
      baseline: { type: "string" },
      manual: { type: "string" },
      request: { type: "string" },
      profile: { type: "string" },
      input: { type: "string" },
      experiment: { type: "string" },
      "base-url": { type: "string" },
      arms: { type: "string" },
      dir: { type: "string" },
      "verified-at": { type: "string" },
      day: { type: "string" },
      expected: { type: "string" },
      "confirm-submit": { type: "boolean", default: false },
      verify: { type: "boolean", default: false },
      journal: { type: "string" },
      record: { type: "string" },
      reference: { type: "string" },
      name: { type: "string" },
      url: { type: "string" },
      "cost-cap": { type: "string" },
      "manifest-out": { type: "string", default: "experiment/manifest.json" },
      profiles: { type: "string" },
      indexation: { type: "string" },
      submission: { type: "string" },
      "ttl-days": { type: "string" },
      offer: { type: "string" },
      "amount-cents": { type: "string" },
      "early-start": { type: "boolean", default: false },
      delivered: { type: "boolean", default: false },
      refunded: { type: "boolean", default: false },
      log: { type: "string" },
      paths: { type: "string" },
      out: { type: "string", default: "hub-dist" },
      "runs-dir": { type: "string", default: "runs" },
      "report-dir": { type: "string", default: "report" },
      "dry-run": { type: "boolean", default: false },
      "confirm-spend": { type: "boolean", default: false },
      judge: { type: "boolean", default: false },
      "extractor-model": { type: "string", default: "claude-haiku-4-5" },
      timeout: { type: "string", default: "10000" },
    },
  });
  // Secrets come from .env; values are never printed.
  if (existsSync(".env")) process.loadEnvFile(".env");
  const common = {
    runsDir: values["runs-dir"],
    env: process.env,
    log: (m: string): void => void process.stdout.write(`${m}\n`),
    now: () => new Date(),
  };

  const need = (name: string, value: string | undefined): string => {
    if (value === undefined) throw new CliError(`--${name} is required\n\n${USAGE}`);
    return value;
  };

  // Le délai de 72 h s'applique à chaque appel, avant toute lecture : il est annoncé publiquement comme un fait, il
  // ne peut pas dépendre de quelqu'un qui pense à lancer `purge`.
  await enforceRawTtl(common.runsDir, common.now(), common.log);

  switch (positionals[0]) {
    case "run":
      return commandRun({
        ...common,
        manifestPath: need("manifest", values.manifest),
        identityPath: need("identity", values.identity),
        dryRun: values["dry-run"],
        confirmSpend: values["confirm-spend"],
        extractorModel: values["extractor-model"],
        useJudge: values.judge,
        armPaths: (values.arms ?? "").split(",").map((s) => s.trim()).filter((s) => s !== ""),
      });
    case "extract":
      return commandExtract({ ...common, identityPath: need("identity", values.identity), waveId: need("wave", values.wave) });
    case "report":
      await commandReport({ ...common, waveId: need("wave", values.wave), baselineWaveId: values.baseline, manualPath: values.manual, reportDir: values["report-dir"] });
      return;
    case "surface-check": {
      const clean = await commandSurfaceCheck({ log: common.log, now: common.now, identityPath: need("identity", values.identity), recordPath: values.record ?? recordPathFor(need("identity", values.identity)), timeoutMs: Number(values.timeout) });
      if (!clean) process.exitCode = 1;
      return;
    }
    case "follow-up":
      await commandFollowUp({ log: common.log, referencePath: need("manifest", values.manifest), waveId: need("wave", values.wave), outPath: need("out", values.out === "hub-dist" ? undefined : values.out) });
      return;
    case "client-init":
      await commandClientInit({ log: common.log, reference: need("reference", values.reference), displayName: need("name", values.name), urls: need("url", values.url), outDir: values.out === "hub-dist" ? "clients" : values.out });
      return;
    case "payment":
      await commandPayment({
        log: common.log,
        now: common.now,
        journalPath: need("journal", values.journal),
        reference: need("reference", values.reference),
        action: values.delivered === true ? "delivered" : values.refunded === true ? "refunded" : "record",
        offer: values.offer,
        amountCents: values["amount-cents"] === undefined ? undefined : Number(values["amount-cents"]),
        earlyStart: values["early-start"],
      });
      break;
    case "intake":
      await commandIntake({
        log: common.log,
        now: common.now,
        submissionPath: need("submission", values.submission),
        outDir: values.out === "hub-dist" ? "clients" : values.out,
        reference: values.reference,
        // Le secret ne transite jamais par la ligne de commande : il y resterait dans l'historique du shell.
        accessSecret: process.env.PROOFSEEN_ACCESS_SECRET,
      });
      break;
    case "access":
      await commandAccess({
        log: common.log,
        now: common.now,
        reference: need("reference", values.reference),
        secret: process.env.PROOFSEEN_ACCESS_SECRET,
        ttlDays: values["ttl-days"] === undefined ? undefined : Number(values["ttl-days"]),
        clientsDir: values.out === "hub-dist" ? "clients" : values.out,
      });
      break;
    case "client-status":
      await commandClientStatus({ log: common.log, now: common.now, runsDir: common.runsDir, clientsDir: values.out === "hub-dist" ? "clients" : values.out, reportDir: values["report-dir"] });
      return;
    case "client-wave":
      {
        // Les chemins suivent la disposition créée par `client-init` : rien à répéter, rien à désaccorder.
        const request = need("request", values.request);
        await commandClientWave({
          log: common.log,
          requestPath: request,
          jdDir: values.dir ?? corpusDirFor(request),
          outPath: values.out === "hub-dist" ? manifestPathFor(request) : values.out,
          identityPath: values.identity ?? identityPathFor(request),
          costCapUsd: values["cost-cap"] === undefined ? undefined : Number(values["cost-cap"]),
        });
      }
      return;
    case "gate":
      await commandGate({ log: common.log, now: common.now, journalPath: need("journal", values.journal) });
      return;
    case "possession":
      await commandPossession({ log: common.log, env: common.env, now: common.now, identityPath: need("identity", values.identity), mode: values.verify ? "verify" : "issue", timeoutMs: Number(values.timeout) });
      return;
    case "audit":
      await commandAudit({ ...common, waveId: need("wave", values.wave), requestPath: need("request", values.request), manualPath: values.manual, baselineWaveId: values.baseline, reportDir: values["report-dir"] });
      return;
    case "preflight":
      return commandPreflight({ ...common, manifestPath: need("manifest", values.manifest), identityPath: need("identity", values.identity), recordPath: values.record ?? recordPathFor(need("identity", values.identity)) });
    case "check-manual":
      return commandCheckManual({ log: common.log, manualPath: need("manual", values.manual), expectedRows: values.expected === undefined ? undefined : Number(values.expected) });
    case "hub-verify":
      return commandHubVerify({ log: common.log, profilePath: need("profile", values.profile), timeoutMs: Number(values.timeout) });
    case "profiles":
      await commandProfiles({ ...common, inputPath: need("input", values.input), outDir: values.out === "hub-dist" ? "profiles-dist" : values.out });
      return;
    case "experiment":
      await commandExperiment({
        ...common,
        inputPath: need("input", values.input),
        experimentPath: need("experiment", values.experiment),
        outDir: values.out === "hub-dist" ? "experiment-dist" : values.out,
        manifestPath: values["manifest-out"],
      });
      return;
    case "site-verify":
      return commandSiteVerify({ log: common.log, outDir: need("out", values.out === "hub-dist" ? undefined : values.out), baseUrl: need("base-url", values["base-url"]), timeoutMs: Number(values.timeout) });
    case "indexnow":
      await commandIndexNow({ log: common.log, outDir: need("out", values.out === "hub-dist" ? undefined : values.out), baseUrl: need("base-url", values["base-url"]), confirmSubmit: values["confirm-submit"] });
      return;
    case "wave-status":
      await commandWaveStatus({ ...common, waveId: need("wave", values.wave), manifestPath: values.manifest });
      return;
    case "jd-import":
      await commandJdImport({
        log: common.log,
        manifestPath: need("manifest", values.manifest),
        identityPath: need("identity", values.identity),
        dir: need("dir", values.dir),
        outPath: values.out === "hub-dist" ? need("manifest", values.manifest) : values.out,
      });
      return;
    case "experiment-arms":
      await commandExperimentArms({
        ...common,
        inputPath: need("input", values.input),
        experimentPath: need("experiment", values.experiment),
        verifiedAt: need("verified-at", values["verified-at"]),
        outDir: values.out === "hub-dist" ? "arms" : values.out,
      });
      return;
    case "experiment-verdict":
      await commandExperimentVerdict({ ...common, waveId: need("wave", values.wave), day: Number(need("day", values.day)), reportDir: values["report-dir"], indexationPath: values.indexation });
      return;
    case "ldr":
      await commandLdr({
        ...common,
        waveId: need("wave", values.wave),
        profileIds: (values.profiles ?? "").split(",").map((s) => s.trim()).filter((s) => s !== ""),
        logPath: values.log,
        watchedPaths: (values.paths ?? "").split(",").filter((s) => s.trim() !== "").map(normaliseWatchedPath),
        reportDir: values["report-dir"],
      });
      return;
    case "purge":
      return commandPurge({ ...common, waveId: values.wave });
    case "hub":
      await commandHub({ ...common, profilePath: need("profile", values.profile), outDir: values.out, identityPath: values.identity });
      return;
    default:
      throw new CliError(USAGE);
  }
};

main(process.argv.slice(2)).catch((error: unknown) => {
  // Allow-list: only our own CliError messages are printed. Other errors could quote provider payloads,
  // so only their class is shown unless PROOFSEEN_DEBUG=1 is set explicitly by the operator.
  const detail = process.env.PROOFSEEN_DEBUG === "1" && error instanceof Error ? ` — ${error.message}` : "";
  const message = error instanceof CliError ? error.message : `Unexpected error (${error instanceof Error ? error.name : "unknown"})${detail}`;
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
