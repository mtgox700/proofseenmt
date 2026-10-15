import { isoDay } from "./market-shell";

/*
 * Les baromètres comme jeux de données : ce que les pages affichent, en CSV et en JSON, sous licence CC BY 4.0. Les
 * mêmes nombres que la page, ni plus ni moins : un groupe sous son seuil d'effectif n'y figure pas davantage.
 *
 * Un libellé de compétence ou de ville vient de la saisie des utilisateurs : dans le CSV, une cellule qui commencerait
 * par =, +, - ou @ serait lue comme une formule par un tableur ; elle est préfixée d'une apostrophe.
 */

export const DATA_LICENSE = "https://creativecommons.org/licenses/by/4.0/";

export interface RateStatView {
  readonly key: string;
  readonly label: string;
  readonly n: number;
  readonly p25Cents: number;
  readonly medianCents: number;
  readonly p75Cents: number;
}

export interface RateSeriesView {
  readonly total: number;
  readonly overall: RateStatView | null;
  readonly bySkill: readonly RateStatView[];
  readonly byCity: readonly RateStatView[];
}

export interface RateBarometerView {
  readonly computedAt: Date;
  readonly currency: "EUR";
  readonly minSample: number;
  readonly missionsSince: Date;
  readonly profiles: RateSeriesView;
  readonly missions: RateSeriesView;
}

export interface SkillBarometerView {
  readonly computedAt: Date;
  readonly since: Date;
  readonly minCount: number;
  readonly totalMissions: number;
  readonly skills: readonly { readonly key: string; readonly label: string; readonly missions: number }[];
}

export const rateDataUrl = (baseUrl: string, format: "csv" | "json"): string => `${baseUrl.replace(/\/$/, "")}/barometre/tjm.${format}`;
export const skillDataUrl = (baseUrl: string, format: "csv" | "json"): string => `${baseUrl.replace(/\/$/, "")}/barometre/competences.${format}`;

export type RateSource = "profiles" | "missions";
export type RateDimension = "all" | "skill" | "city";

export interface RateRow extends RateStatView {
  readonly source: RateSource;
  readonly dimension: RateDimension;
}

export const rateRows = (b: RateBarometerView): readonly RateRow[] =>
  (["profiles", "missions"] as const).flatMap((source) => {
    const s = b[source];
    return [
      ...(s.overall === null ? [] : [{ ...s.overall, source, dimension: "all" as const }]),
      ...s.bySkill.map((stat) => ({ ...stat, source, dimension: "skill" as const })),
      ...s.byCity.map((stat) => ({ ...stat, source, dimension: "city" as const })),
    ];
  });

const cell = (value: string | number): string => {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const csv = (header: readonly string[], rows: readonly (readonly (string | number)[])[]): string => [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";

const euros = (cents: number): number => Math.round(cents / 100);

export const rateCsv = (b: RateBarometerView): string =>
  csv(
    ["source", "dimension", "key", "label", "n", "p25_eur", "median_eur", "p75_eur", "currency", "computed_at"],
    rateRows(b).map((r) => [r.source, r.dimension, r.key, r.label, r.n, euros(r.p25Cents), euros(r.medianCents), euros(r.p75Cents), b.currency, b.computedAt.toISOString()]),
  );

export const RATE_METHOD =
  "Daily rates shown by published profiles, and offered by missions that are open or were published in the recent window (middle of the range, or the single bound given), in euros. " +
  "Grouped by skill and by city; a group is published only from the minimum sample size. Quartiles by linear interpolation between ranks (Hyndman-Fan type 7), rounded to the euro.";

export const rateJson = (b: RateBarometerView, baseUrl: string): string =>
  JSON.stringify(
    {
      name: "Proofseen day-rate barometer",
      license: DATA_LICENSE,
      creator: "Proofseen",
      url: `${baseUrl.replace(/\/$/, "")}/fr/barometre/tjm`,
      computedAt: b.computedAt.toISOString(),
      missionsSince: isoDay(b.missionsSince),
      currency: b.currency,
      minSample: b.minSample,
      method: RATE_METHOD,
      totals: { profilesWithRate: b.profiles.total, missionsWithRate: b.missions.total },
      rows: rateRows(b).map((r) => ({ source: r.source, dimension: r.dimension, key: r.key, label: r.label, n: r.n, p25: euros(r.p25Cents), median: euros(r.medianCents), p75: euros(r.p75Cents) })),
    },
    null,
    2,
  ) + "\n";

export const SKILL_METHOD = "Number of missions published on Proofseen in the window (open, or closed since) that request each skill. A skill is listed only from the minimum count.";

export const skillCsv = (b: SkillBarometerView): string =>
  csv(
    ["key", "label", "missions", "since", "computed_at"],
    b.skills.map((s) => [s.key, s.label, s.missions, isoDay(b.since), b.computedAt.toISOString()]),
  );

export const skillJson = (b: SkillBarometerView, baseUrl: string): string =>
  JSON.stringify(
    {
      name: "Proofseen skills-in-demand barometer",
      license: DATA_LICENSE,
      creator: "Proofseen",
      url: `${baseUrl.replace(/\/$/, "")}/fr/barometre/competences`,
      computedAt: b.computedAt.toISOString(),
      since: isoDay(b.since),
      minCount: b.minCount,
      method: SKILL_METHOD,
      totals: { missions: b.totalMissions },
      rows: b.skills.map((s) => ({ key: s.key, label: s.label, missions: s.missions })),
    },
    null,
    2,
  ) + "\n";

/** Données structurées Dataset communes aux deux baromètres. */
export const datasetJsonLd = (o: {
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly lang: string;
  readonly baseUrl: string;
  readonly from: Date;
  readonly computedAt: Date;
  readonly csvUrl: string;
  readonly jsonUrl: string;
  readonly method: string;
  readonly variables: readonly { readonly name: string; readonly unitText?: string }[];
}): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: o.name,
  description: o.description,
  url: o.url,
  inLanguage: o.lang,
  license: DATA_LICENSE,
  isAccessibleForFree: true,
  creator: { "@type": "Organization", name: "Proofseen", url: o.baseUrl.replace(/\/$/, "") },
  dateModified: o.computedAt.toISOString(),
  temporalCoverage: `${isoDay(o.from)}/${isoDay(o.computedAt)}`,
  measurementTechnique: o.method,
  variableMeasured: o.variables.map((v) => ({ "@type": "PropertyValue", name: v.name, ...(v.unitText === undefined ? {} : { unitText: v.unitText }) })),
  distribution: [
    { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: o.csvUrl },
    { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: o.jsonUrl },
  ],
});
