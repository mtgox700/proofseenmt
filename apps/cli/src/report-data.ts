import type { EngineId, Match } from "@proofseen/core";
import {
  controlDrift,
  differenceInDifferences,
  funnel,
  isRenderedVisible,
  sorvAt5,
  wilson,
  type ClusterCount,
  type DrawOutcome,
  type EngineFunnel,
  type Estimate,
  type Interval,
  type SorvResult,
} from "@proofseen/stats";
import { isRefusal, type ManualRow } from "./manual";
import type { RescoreRecord, StoredDraw, WaveMeta } from "./records";

export interface WaveData {
  readonly meta: WaveMeta;
  readonly draws: readonly StoredDraw[];
  readonly matches: readonly Match[];
}

export interface ReportData {
  readonly meta: WaveMeta;
  readonly okDraws: number;
  readonly errorsByCode: Record<string, number>;
  readonly extractionFailures: number;
  readonly probableToReview: number;
  readonly funnel: EngineFunnel[];
  readonly sorv: SorvResult | null;
  readonly renderedVisible: boolean;
  readonly controlRetrieval: Interval | null;
  readonly sources: { platform: Record<string, number>; client: number; other: number };
  readonly drift: { delta: number; flagged: boolean } | null;
  readonly did: Estimate | null;
  readonly didNote: string | null;
  /** Successful / attempted draws per engine. */
  readonly coverage: Record<string, { ok: number; total: number }>;
  /** True when an engine delivered < 80 % of its draws or the budget stopped the wave: SoRV must not be published. */
  readonly incomplete: boolean;
  readonly rescoreAgreement: { agree: number; total: number } | null;
  readonly manual: { agree: number; total: number; refusals: number; otherApps: Record<string, { present: number; total: number; refusals: number }> } | null;
}

const APP_TO_ENGINE: Readonly<Record<string, EngineId>> = { chatgpt: "openai", claude: "anthropic", perplexity: "perplexity" };

/** Certain matches only feed the headline metrics (probable ones are shown as "to review"). */
export const toOutcomes = (draws: readonly StoredDraw[], matches: readonly Match[]): (DrawOutcome & { role: string })[] => {
  const byDraw = new Map(matches.map((m) => [m.drawId, m]));
  return draws
    .filter((d) => d.status === "ok")
    .map((d) => {
      const m = byDraw.get(d.id);
      const certain = m !== undefined && m.type === "certain";
      return {
        engine: d.engine,
        jdId: d.jdId,
        role: d.jdRole,
        retrieved: d.retrieved,
        named: certain,
        top5: certain && m.rank !== null && m.rank <= 5,
        cited: d.citedDomains.client > 0 || (certain && m.clientUrlCited),
      };
    });
};

const MIN_ENGINE_COVERAGE = 0.8;

const clustersBy = (outcomes: readonly (DrawOutcome & { role: string })[], role: string, pick: (o: DrawOutcome) => boolean): Map<string, ClusterCount> => {
  const byJd = new Map<string, ClusterCount>();
  outcomes
    .filter((o) => o.role === role)
    .forEach((o) => {
      const c = byJd.get(o.jdId) ?? { successes: 0, n: 0 };
      byJd.set(o.jdId, { successes: c.successes + (pick(o) ? 1 : 0), n: c.n + 1 });
    });
  return byJd;
};

/** Pairs two waves on the SAME job descriptions; null when the JD sets differ (mix change ≠ effect). */
const aligned = (a: Map<string, ClusterCount>, b: Map<string, ClusterCount>): [ClusterCount[], ClusterCount[]] | null => {
  const keys = [...a.keys()].sort();
  if (keys.length === 0 || keys.length !== b.size || keys.some((k) => !b.has(k))) return null;
  return [keys.map((k) => a.get(k)!), keys.map((k) => b.get(k)!)];
};

const coverageOf = (draws: readonly StoredDraw[]): ReportData["coverage"] => {
  const out: ReportData["coverage"] = {};
  draws.forEach((d) => {
    const c = out[d.engine] ?? { ok: 0, total: 0 };
    out[d.engine] = { ok: c.ok + (d.status === "ok" ? 1 : 0), total: c.total + 1 };
  });
  return out;
};

const sumSources = (draws: readonly StoredDraw[]): ReportData["sources"] =>
  draws.reduce<ReportData["sources"]>(
    (acc, d) => {
      const platform = { ...acc.platform };
      Object.entries(d.citedDomains.platform).forEach(([k, v]) => (platform[k] = (platform[k] ?? 0) + v));
      return { platform, client: acc.client + d.citedDomains.client, other: acc.other + d.citedDomains.other };
    },
    { platform: {}, client: 0, other: 0 },
  );

const rescoreAgreement = (matches: readonly Match[], rescore: readonly RescoreRecord[] | null): ReportData["rescoreAgreement"] => {
  if (rescore === null || rescore.length === 0) return null;
  const byDraw = new Map(matches.map((m) => [m.drawId, m]));
  const agree = rescore.filter((r) => {
    const m = byDraw.get(r.drawId);
    return m === undefined ? !r.named : r.named && r.rank === m.rank;
  }).length;
  return { agree, total: rescore.length };
};

const manualAgreement = (rows: readonly ManualRow[] | null, wave: WaveData): ReportData["manual"] => {
  if (rows === null) return null;
  const own = rows.filter((r) => r.wave_id === wave.meta.waveId);
  const outcomes = toOutcomes(wave.draws.filter((d) => d.promptId === "P1"), wave.matches);
  const apiPositive = (engine: EngineId, jdId: string): boolean => outcomes.some((o) => o.engine === engine && o.jdId === jdId && o.named);
  // Un refus de nommer quiconque n'est pas une absence : l'app et l'API décriraient deux phénomènes différents,
  // et les compter comme « d'accord » serait un faux accord. Ils sortent du calcul et sont rapportés à part.
  const comparable = own.filter((r) => APP_TO_ENGINE[r.app] !== undefined && !isRefusal(r));
  const agree = comparable.filter((r) => (r.client_present === "true") === apiPositive(APP_TO_ENGINE[r.app]!, r.jd_id)).length;
  const otherApps: Record<string, { present: number; total: number; refusals: number }> = {};
  own
    .filter((r) => APP_TO_ENGINE[r.app] === undefined)
    .forEach((r) => {
      const c = otherApps[r.app] ?? { present: 0, total: 0, refusals: 0 };
      otherApps[r.app] = {
        present: c.present + (r.client_present === "true" ? 1 : 0),
        total: c.total + (isRefusal(r) ? 0 : 1),
        refusals: c.refusals + (isRefusal(r) ? 1 : 0),
      };
    });
  return { agree, total: comparable.length, refusals: own.filter(isRefusal).length, otherApps };
};

export interface BuildInput {
  readonly current: WaveData;
  readonly baseline: WaveData | null;
  readonly rescore: readonly RescoreRecord[] | null;
  readonly manual: readonly ManualRow[] | null;
}

export const buildReportData = ({ current, baseline, rescore, manual }: BuildInput): ReportData => {
  const outcomes = toOutcomes(current.draws, current.matches);
  const targets = outcomes.filter((o) => o.role === "target");
  const controls = outcomes.filter((o) => o.role === "control");
  const sorv = targets.length > 0 ? sorvAt5(targets) : null;
  const jdSource = new Map(current.draws.map((d) => [d.jdId, d]));
  const evidence = current.matches
    .map((m) => ({ m, d: current.draws.find((d) => d.id === m.drawId) }))
    .filter((x) => x.d !== undefined && x.d.jdRole === "target")
    .map(({ m, d }) => ({ jdId: d!.jdId, source: jdSource.get(d!.jdId)!.jdSource, type: m.type }));

  let drift: ReportData["drift"] = null;
  let did: Estimate | null = null;
  let didNote: string | null = null;
  if (baseline !== null) {
    const base = toOutcomes(baseline.draws, baseline.matches);
    const rr = (o: DrawOutcome) => o.retrieved;
    const top5 = (o: DrawOutcome) => o.top5;
    const pool = (cs: ClusterCount[]): ClusterCount => cs.reduce((a, c) => ({ successes: a.successes + c.successes, n: a.n + c.n }), { successes: 0, n: 0 });
    const controlsRr = aligned(clustersBy(base, "control", rr), clustersBy(outcomes, "control", rr));
    const targetsTop5 = aligned(clustersBy(base, "target", top5), clustersBy(outcomes, "target", top5));
    const controlsTop5 = aligned(clustersBy(base, "control", top5), clustersBy(outcomes, "control", top5));
    if (controlsRr === null || targetsTop5 === null || controlsTop5 === null) {
      didNote = "les JD diffèrent entre les deux vagues : DiD et dérive non calculées (un changement de JD n'est pas un effet)";
    } else {
      drift = controlDrift(pool(controlsRr[0]), pool(controlsRr[1]));
      did = differenceInDifferences({ before: targetsTop5[0], after: targetsTop5[1], controlBefore: controlsTop5[0], controlAfter: controlsTop5[1] });
    }
  }
  const coverage = coverageOf(current.draws);
  const incomplete =
    current.meta.stoppedReason !== null || Object.values(coverage).some((c) => c.total === 0 || c.ok / c.total < MIN_ENGINE_COVERAGE);

  const controlRetrieved = controls.filter((o) => o.retrieved).length;
  const errorsByCode: Record<string, number> = {};
  current.draws.filter((d) => d.status === "error").forEach((d) => (errorsByCode[d.errorCode ?? "?"] = (errorsByCode[d.errorCode ?? "?"] ?? 0) + 1));

  return {
    meta: current.meta,
    okDraws: outcomes.length,
    errorsByCode,
    extractionFailures: current.draws.filter((d) => d.extractionFailed).length,
    probableToReview: current.matches.filter((m) => m.type === "probable").length,
    funnel: funnel(targets),
    sorv,
    renderedVisible: !incomplete && sorv !== null && isRenderedVisible(evidence, sorv.low),
    controlRetrieval: wilson(controlRetrieved, controls.length),
    sources: sumSources(current.draws.filter((d) => d.status === "ok")),
    drift,
    did,
    didNote,
    coverage,
    incomplete,
    rescoreAgreement: rescoreAgreement(current.matches, rescore),
    manual: manualAgreement(manual, current),
  };
};

