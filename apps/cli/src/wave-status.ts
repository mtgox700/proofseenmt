import { RAW_TTL_MS } from "@proofseen/extract";
import type { ArmRecord, StoredDraw } from "./records";
import type { Match } from "@proofseen/core";

/*
 * État d'une vague, lisible sans écrire de script : où elle en est, ce qu'elle a coûté, et surtout **combien de temps
 * il reste avant la purge des réponses brutes** (72 h, CONFORMITE T3). Passé ce délai, l'extraction n'est plus possible
 * et la vague est perdue : c'est l'échéance la plus facile à rater.
 */

export interface WaveStatusInput {
  readonly waveId: string;
  readonly draws: readonly StoredDraw[];
  readonly matches: readonly Match[];
  readonly arms: readonly ArmRecord[];
  readonly sealedFiles: number;
  /** Nombre de tirages prévus par le manifeste, quand il est fourni. */
  readonly expected: number | null;
  readonly now: Date;
}

const pct = (part: number, whole: number): string => (whole === 0 ? "—" : `${((part / whole) * 100).toFixed(1)} %`);

const remaining = (deadline: Date, now: Date): string => {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return "DÉPASSÉE";
  const hours = Math.floor(ms / 3_600_000);
  return `${hours} h ${Math.floor((ms % 3_600_000) / 60_000)} min restantes`;
};

export const renderWaveStatus = (input: WaveStatusInput): string => {
  const { draws, matches, arms, now } = input;
  const ok = draws.filter((d) => d.status === "ok");
  const errors = draws.length - ok.length;
  const cost = draws.reduce((sum, d) => sum + d.costUsd, 0);
  const byEngine = new Map<string, { ok: number; errors: number; cost: number }>();
  for (const draw of draws) {
    const row = byEngine.get(draw.engine) ?? { ok: 0, errors: 0, cost: 0 };
    byEngine.set(draw.engine, {
      ok: row.ok + (draw.status === "ok" ? 1 : 0),
      errors: row.errors + (draw.status === "ok" ? 0 : 1),
      cost: row.cost + draw.costUsd,
    });
  }
  const first = draws.map((d) => d.timestamp).sort()[0];
  const certain = matches.filter((m) => m.type === "certain").length;

  const lines = [
    `Vague ${input.waveId}`,
    input.expected === null
      ? `  tirages : ${draws.length} (${errors} en erreur)`
      : `  tirages : ${draws.length}/${input.expected} (${pct(draws.length, input.expected)}) · ${errors} en erreur`,
    `  dépensé : ${cost.toFixed(2)} $${ok.length > 0 ? ` (${(cost / ok.length).toFixed(4)} $ par tirage)` : ""}`,
    ...[...byEngine.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([engine, r]) => `    ${engine.padEnd(11)} ${r.ok} ok, ${r.errors} erreur(s), ${r.cost.toFixed(2)} $`),
    `  URL du client retrouvée : ${ok.filter((d) => d.retrieved).length} tirage(s) sur ${ok.length}`,
    `  appariements : ${matches.length} dont ${certain} certain(s)`,
    ...(arms.length === 0 ? [] : [`  test à 3 bras : ${arms.length} lignes, ${new Set(arms.map((a) => a.armId)).size} bras`]),
  ];

  if (first === undefined) {
    lines.push("  réponses scellées : aucune");
    return `${lines.join("\n")}\n`;
  }
  const deadline = new Date(Date.parse(first) + RAW_TTL_MS);
  // Zéro fichier scellé alors que la vague a tourné : les bruts sont partis (purge anticipée ou échéance atteinte).
  // Afficher un compte à rebours dans ce cas laisserait croire qu'il reste quelque chose à extraire.
  if (input.sealedFiles === 0) {
    lines.push(
      "  réponses scellées : aucune (purgées)",
      "  → la vague ne peut plus être ré-analysée ; les résultats déjà écrits (tirages, re-scoring, rapport) restent exploitables.",
    );
    return `${lines.join("\n")}\n`;
  }
  lines.push(
    `  réponses scellées : ${input.sealedFiles} fichier(s)`,
    `  PURGE DES BRUTS : ${deadline.toISOString()} — ${remaining(deadline, now)}`,
    deadline.getTime() <= now.getTime()
      ? "  → trop tard pour ré-extraire : seuls les résultats déjà écrits restent exploitables."
      : "  → lancer `extract` avant cette heure, sinon la vague ne peut plus être ré-analysée.",
  );
  return `${lines.join("\n")}\n`;
};
