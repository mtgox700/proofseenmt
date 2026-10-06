import { join } from "node:path";
import { getDb, visibility } from "@proofseen/db";
import { AuditRequestSchema, compareWaves, correctionPlan, renderClientReport, renderClientReportHtml, type AuditRequest, type ClientReportInput, type JobDescriptionRef } from "@proofseen/deliverable";
import { CliError, loadJson, readJsonl, wavePaths, writeText } from "./files";
import { loadWave } from "./commands";
import { buildReportData } from "./report-data";
import { RescoreRecordSchema, type StoredDraw } from "./records";
import { loadManualCsv } from "./manual";
import type { CommonOptions } from "./commands";

/*
 * Rapport client (`audit`) : la vague mesurée fournit les chiffres, le fichier de demande fournit ce qui ne se mesure
 * pas (qui est le client, ce qu'il possède, le libellé des offres). Aucune donnée n'est inventée pour combler un trou —
 * ce qui n'a pas été mesuré est déclaré non mesuré.
 */

export interface AuditCommand extends CommonOptions {
  readonly waveId: string;
  readonly requestPath: string;
  readonly manualPath: string | undefined;
  /** Vague antérieure du même client : déclenche la section « ce qui a changé » (re-mesure à 45 jours). */
  readonly baselineWaveId: string | undefined;
  readonly reportDir: string;
}

/** Part de chaque plateforme dans l'ensemble des citations de la vague, clients et autres domaines compris. */
const sourceShareOf = (sources: { platform: Record<string, number>; client: number; other: number }): Record<string, number> => {
  const total = Object.values(sources.platform).reduce((sum, n) => sum + n, 0) + sources.client + sources.other;
  if (total === 0) return {};
  return Object.fromEntries(Object.entries(sources.platform).map(([domain, n]) => [domain, n / total]));
};

/**
 * Part des réponses où le moteur refuse de nommer quiconque, calculée **sur les seuls tirages où le refus a pu être
 * établi**. Un moteur dont aucun tirage n'est concluant n'apparaît pas : il ne reçoit pas un taux de 0 % par défaut.
 */
const refusalRateOf = (draws: readonly StoredDraw[]): { rates: Record<string, number>; measured: number } => {
  const measured = draws.filter((draw) => draw.status === "ok" && draw.refusedToName !== null);
  const rates: Record<string, number> = {};
  for (const engine of new Set(measured.map((draw) => draw.engine))) {
    const own = measured.filter((draw) => draw.engine === engine);
    rates[engine] = own.filter((draw) => draw.refusedToName === true).length / own.length;
  }
  return { rates, measured: measured.length };
};

/** Longueur de l'empreinte affichée au client : assez pour vérifier, assez court pour être recopié. */
const MANIFEST_DIGEST_CHARS = 16;

/**
 * Modèles réellement interrogés par moteur, relevés dans les tirages réussis. **Tous** sont listés : le rapport affirme
 * que le protocole est figé et reproductible, donc si un fournisseur a changé de version en cours de vague, le client
 * doit le voir au lieu de lire un seul nom présenté comme celui de toute la mesure.
 */
const modelsOf = (draws: readonly StoredDraw[]): Record<string, string> => {
  const seen = new Map<string, Set<string>>();
  for (const draw of draws) {
    if (draw.status !== "ok") continue;
    const models = seen.get(draw.engine) ?? new Set<string>();
    seen.set(draw.engine, models.add(draw.model));
  }
  return Object.fromEntries([...seen].map(([engine, models]) => [engine, [...models].sort().join(", ")]));
};

/** Le rôle d'une offre vient de la vague, jamais du fichier de demande : une seule source de vérité. */
const jobDescriptions = (request: AuditRequest, draws: readonly StoredDraw[]): JobDescriptionRef[] => {
  const roles = new Map(draws.map((draw) => [draw.jdId, draw.jdRole]));
  return request.jobDescriptions.map((jd) => {
    const role = roles.get(jd.id);
    if (role === undefined) throw new CliError(`l'offre ${jd.id} de la demande d'audit n'apparaît dans aucun tirage de la vague ${draws[0]?.waveId ?? "?"}`);
    return { ...jd, role };
  });
};

export type AuditInputOptions = Pick<AuditCommand, "runsDir" | "waveId" | "requestPath" | "manualPath" | "baselineWaveId">;

/**
 * Le contenu du rapport client, sans rendu. Exporté pour l'espace freelance (`apps/web`) : l'écran et le fichier remis
 * au client doivent sortir du même calcul, sinon ils finiront par dire deux choses différentes.
 */
export const buildAuditInput = async (o: AuditInputOptions): Promise<{ readonly request: AuditRequest; readonly reportInput: ClientReportInput }> => {
  const request = await loadJson(o.requestPath, AuditRequestSchema, "demande d'audit");
  const wave = await loadWave(o.runsDir, o.waveId);
  const rescore = await readJsonl(wavePaths(o.runsDir, o.waveId).rescore, RescoreRecordSchema);
  const baseline = o.baselineWaveId === undefined ? null : await loadWave(o.runsDir, o.baselineWaveId);
  const data = buildReportData({
    current: wave,
    baseline,
    rescore: rescore.length === 0 ? null : rescore,
    manual: o.manualPath === undefined ? null : await loadManualCsv(o.manualPath),
  });
  if (data.okDraws === 0) throw new CliError(`la vague ${o.waveId} ne porte aucun tirage réussi : aucun rapport client à en tirer`);

  const sourceShare = sourceShareOf(data.sources);
  const refusal = refusalRateOf(wave.draws);
  const caveats = [...request.caveats];
  if (refusal.measured === 0) {
    caveats.push(
      "Le refus de nommer des personnes n'a pas pu être établi sur cette vague : ce rapport ne se prononce donc pas sur ce comportement des moteurs.",
    );
  }
  if (data.incomplete) {
    caveats.push("Un moteur au moins a rendu moins de 80 % de ses réponses : les taux de cette vague sont à lire avec prudence.");
  }
  /*
   * Réserves qui ne peuvent pas dépendre de la mémoire de l'opérateur.
   *
   * Sur J0, 780 extractions sur 780 avaient échoué : les étapes « nommé » et « cinq premiers » ne reposaient plus que
   * sur le recomptage déterministe. Le rapport interne le signalait ; le rapport client ne le disait que parce que la
   * réserve avait été **écrite à la main** dans la demande. Un client qui paie ne doit pas dépendre de ce geste.
   */
  if (data.extractionFailures > 0) {
    caveats.push(
      `L'extraction automatique des candidats a échoué sur ${data.extractionFailures} réponse(s) sur ${data.okDraws} : pour celles-là, les étapes « nommé » et « cinq premiers » reposent sur le seul recomptage déterministe.`,
    );
  }
  if (data.probableToReview > 0) {
    caveats.push(
      `${data.probableToReview} rapprochement(s) jugé(s) seulement probables ont été **exclus** des chiffres ci-dessus : en cas de doute, nous ne comptons pas.`,
    );
  }

  const plan = correctionPlan({
    funnel: data.funnel,
    indexation: request.indexation,
    surface: request.surface,
    sourceShare,
    refusalRate: refusal.rates,
  });
  const reportInput: ClientReportInput = {
    client: request.client,
    wave: {
      id: data.meta.waveId,
      measuredAt: data.meta.startedAt.slice(0, 10),
      // Le modèle réellement interrogé, relevé dans les tirages — pas celui demandé au manifeste.
      models: modelsOf(wave.draws),
      draws: data.okDraws,
      manifestDigest: data.meta.manifestSha256.slice(0, MANIFEST_DIGEST_CHARS),
    },
    jobDescriptions: jobDescriptions(request, wave.draws),
    funnel: data.funnel,
    sourceShare,
    indexation: request.indexation,
    controlRetrieval: data.controlRetrieval,
    // La dérive vient des offres témoins : sans elle, aucun écart n'est attribuable, et le rapport le dit.
    ...(baseline === null ? {} : { comparison: compareWaves({ before: buildReportData({ current: baseline, baseline: null, rescore: null, manual: null }).funnel, after: data.funnel, controlDrift: data.drift }) }),
    plan,
    caveats,
    simulated: data.meta.dryRun,
  };
  return { request, reportInput };
};

export const commandAudit = async (o: AuditCommand): Promise<string> => {
  const { request, reportInput } = await buildAuditInput(o);
  const { plan } = reportInput;
  const dryRun = reportInput.simulated;

  // Le schéma restreint déjà l'alphabet de `reference` ; on ne fait pas confiance à la validation amont pour une
  // écriture de fichier, exactement comme `wavePaths` assainit déjà l'identifiant de vague.
  const reference = request.client.reference.replace(/[^A-Za-z0-9_-]/g, "_");
  // Le nom du fichier porte lui aussi la mention : un rapport de simulation ne doit pas pouvoir être joint par mégarde.
  const base = join(o.reportDir, `audit-${reference}-${wavePaths("", o.waveId).dir}${dryRun ? "-SIMULATION" : ""}`);
  // Les deux rendus viennent du même document : le HTML est ce que le client reçoit, le Markdown ce que nous relisons.
  const out = `${base}.html`;
  await writeText(`${base}.md`, renderClientReport(reportInput));
  await writeText(out, renderClientReportHtml(reportInput));
  o.log(
    `Rapport client écrit : ${out} (et ${base}.md) · étape bloquante : ${plan.blockingStage ?? "aucune"} · ${plan.actions.length} action(s) · ${plan.notActionable.length} constat(s) hors de portée du client`,
  );
  await recordVisibility(request.client.reference, reportInput, o.log);
  return out;
};

/*
 * Les chiffres que le rapport vient de publier, enregistrés tels quels pour le tableau de bord du freelance : jamais un
 * second calcul qui pourrait diverger du rapport. Seulement pour une vraie vague (jamais une simulation), seulement si
 * une base est configurée ; un échec ici ne fait pas échouer le rapport, il est signalé.
 */
const recordVisibility = async (reference: string, input: ClientReportInput, log: (line: string) => void): Promise<void> => {
  if (input.simulated || (process.env.DATABASE_URL ?? "") === "") return;
  try {
    const { linked } = await visibility(getDb()).record({
      waveId: input.wave.id,
      reference,
      measuredAt: new Date(`${input.wave.measuredAt}T00:00:00Z`),
      draws: input.wave.draws,
      funnel: [...input.funnel],
    });
    log(linked ? "Résultats enregistrés pour le tableau de bord du freelance." : "Résultats enregistrés, sans profil correspondant à cette référence.");
  } catch (error) {
    log(`Résultats non enregistrés en base (${error instanceof Error ? error.name : "erreur"}) : le rapport reste valable.`);
  }
};
