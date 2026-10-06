import type { Match } from "@proofseen/core";
import { discoverability, type Observation, type PathHits, type ProfileDiscoverability } from "@proofseen/stats";
import type { StoredDraw } from "./records";

/*
 * Bridge between a measured wave and the LLM Discoverability Rate (MEASUREMENT_SPEC, "LDR"). The draws deliberately
 * never keep third-party URLs (RGPD, S1), so a citation is read from the MATCHES: only a "certain" match counts, exactly
 * like the funnel. Our own URL being cited proves the engine had our page — that is the closest thing to "retrieved"
 * a wave can prove; the crawler logs are the other, stronger half.
 */

/** One observation per usable draw and per measured profile: a draw with no match is a draw where nobody was cited. */
export const observationsFrom = (
  draws: readonly StoredDraw[],
  matches: readonly Match[],
  profileIds: readonly string[],
): Observation[] => {
  const usable = draws.filter((d) => d.status === "ok");
  const byDraw = new Map<string, Match[]>();
  for (const match of matches) byDraw.set(match.drawId, [...(byDraw.get(match.drawId) ?? []), match]);
  return usable.flatMap((draw) =>
    profileIds.map((profileId) => {
      const own = (byDraw.get(draw.id) ?? []).filter((m) => m.identityId === profileId);
      return {
        profileId,
        engine: draw.engine,
        queryId: `${draw.jdId}/${draw.promptId}`,
        cited: own.some((m) => m.type === "certain"),
        retrieved: own.some((m) => m.clientUrlCited),
      };
    }),
  );
};

export interface LdrReportInput {
  readonly waveId: string;
  readonly date: string;
  readonly engines: readonly string[];
  readonly observations: readonly Observation[];
  readonly crawler: readonly PathHits[];
}

const pct = (x: number): string => `${(x * 100).toFixed(1)} %`;

/** A rate is printed only when it may be published; otherwise the reason is printed in its place. */
const rateCell = (profile: Pick<ProfileDiscoverability, "rate" | "publishable" | "note">): string => {
  if (profile.rate === null) return "aucun tirage";
  if (!profile.publishable) return `non publiable (${profile.note})`;
  return `${pct(profile.rate.p)} [${pct(profile.rate.low)} ; ${pct(profile.rate.high)}]`;
};

const breakdownLine = (label: string, rows: readonly { key: string; draws: number; cited: number }[]): string =>
  rows.length === 0 ? "" : `  - ${label} : ${rows.map((r) => `${r.key} ${r.cited}/${r.draws}`).join(" · ")}`;

const crawlerSection = (crawler: readonly PathHits[]): string[] => {
  if (crawler.length === 0) return [];
  const never = crawler.filter((c) => c.hits.length === 0);
  return [
    "## Robots venus chercher les pages — **CONTRÔLÉ** (journaux serveur)",
    "",
    "| Page | Robots | Dernière visite |",
    "|---|---|---|",
    ...crawler.map((c) =>
      c.hits.length === 0
        ? `| \`${c.path}\` | **aucun robot d'IA n'est jamais venu** | — |`
        : `| \`${c.path}\` | ${c.hits.map((h) => `${h.bot} (${h.count})`).join(", ")} | ${c.hits.map((h) => h.lastSeen).sort().at(-1)} |`,
    ),
    "",
    never.length === 0
      ? "Toutes les pages suivies ont été visitées au moins une fois."
      : `**${never.length} page(s) jamais visitée(s) par un robot d'IA** : c'est le premier problème à traiter, et il est de notre ressort (robots.txt, sitemap, maillage, soumission).`,
    "",
  ];
};

export const renderLdrReport = ({ waveId, date, engines, observations, crawler }: LdrReportInput): string => {
  const report = discoverability(observations);
  const lines: string[] = [
    `# LLM Discoverability Rate — vague ${waveId}`,
    "",
    `> Mesuré le ${date} sur ${engines.join(", ")} · ${report.global.draws} tirages · ${report.profilesMeasured} profil(s).`,
    "> Une citation n'est comptée que si l'appariement est **certain** (règle du funnel, rang conservateur).",
    "",
    "## Ce que ce rapport mesure",
    "",
    "| Colonne | Contenu |",
    "|---|---|",
    "| **CONTRÔLÉ** | La page est servie, ouverte aux robots, et un robot est venu la chercher (journaux) |",
    "| **OPTIMISÉ** | Fraîcheur, faits sourcés, pages d'intention, maillage : on augmente la probabilité |",
    "| **NON GARANTI** | Être indexé, apparaître, **être cité**, le rang : décidé par le moteur, jamais promis |",
    "",
    "## Taux de citation par profil — **NON GARANTI**",
    "",
    "| Profil | Tirages | Cité | Taux [IC 95 %] | Rendu visible |",
    "|---|---|---|---|---|",
    ...report.profiles.map(
      (p) => `| \`${p.profileId}\` | ${p.draws} | ${p.cited} | ${rateCell(p)} | ${p.visible ? "oui" : "non"} |`,
    ),
    "",
  ];

  for (const profile of report.profiles) {
    const detail = [breakdownLine("par moteur", profile.byEngine), breakdownLine("par requête", profile.byQuery)].filter((l) => l !== "");
    if (detail.length > 0) lines.push(`- \`${profile.profileId}\``, ...detail, "");
  }

  lines.push(
    "## Taux global",
    "",
    report.global.rate === null
      ? "Aucun tirage exploitable : rien à publier."
      : `**${report.global.cited}/${report.global.draws}** tirages cités${report.global.draws >= 10 ? ` — ${pct(report.global.rate.p)} [${pct(report.global.rate.low)} ; ${pct(report.global.rate.high)}]` : " — trop peu de tirages pour publier un taux"}. ${report.visibleProfiles}/${report.profilesMeasured} profil(s) rendus visibles (cités au moins une fois, borne basse > 0).`,
    "",
    ...crawlerSection(crawler),
    "---",
    "Mesure d'une tendance à une date donnée, sur des API officielles. Les applications grand public peuvent différer.",
    "Aucun rang ni aucune citation ne peut être promis : ce qui dépend des moteurs reste hors de notre contrôle.",
    "",
  );
  return lines.join("\n");
};

/**
 * Git Bash on Windows rewrites an argument that looks like a Unix path: `--paths /p/FR-8F42K/` arrives as
 * `P:/FR-8F42K/`. Without this, the report would show a page that does not exist and claim no crawler ever came.
 */
export const normaliseWatchedPath = (value: string): string => {
  const drive = /^([A-Za-z]):[/\\](.*)$/.exec(value.trim());
  if (drive !== null) return `/${drive[1]!.toLowerCase()}/${drive[2]!.replace(/\\/g, "/")}`;
  const path = value.trim();
  return path.startsWith("/") ? path : `/${path}`;
};
