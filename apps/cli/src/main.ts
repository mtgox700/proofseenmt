import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { CliError } from "./files";
import { commandCheckManual, commandExtract, commandHub, commandPurge, commandReport, commandRun } from "./commands";

const USAGE = `Proofseen CLI (V0)
  run      --manifest <file> --identity <file> [--dry-run | --confirm-spend] [--judge] [--extractor-model claude-haiku-4-5]
  extract  --identity <file> --wave <id>
  report   --wave <id> [--baseline <id>] [--manual <csv>] [--report-dir report]
  check-manual --manual <csv>
  purge
  hub      --profile <file> [--out hub-dist]
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
      profile: { type: "string" },
      out: { type: "string", default: "hub-dist" },
      "runs-dir": { type: "string", default: "runs" },
      "report-dir": { type: "string", default: "report" },
      "dry-run": { type: "boolean", default: false },
      "confirm-spend": { type: "boolean", default: false },
      judge: { type: "boolean", default: false },
      "extractor-model": { type: "string", default: "claude-haiku-4-5" },
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
      });
    case "extract":
      return commandExtract({ ...common, identityPath: need("identity", values.identity), waveId: need("wave", values.wave) });
    case "report":
      await commandReport({ ...common, waveId: need("wave", values.wave), baselineWaveId: values.baseline, manualPath: values.manual, reportDir: values["report-dir"] });
      return;
    case "check-manual":
      return commandCheckManual({ log: common.log, manualPath: need("manual", values.manual) });
    case "purge":
      return commandPurge(common);
    case "hub":
      await commandHub({ ...common, profilePath: need("profile", values.profile), outDir: values.out });
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
