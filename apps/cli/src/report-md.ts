import type { Interval, StageCount } from "@proofseen/stats";
import type { ReportData } from "./report-data";

const pct = (x: number): string => `${(x * 100).toFixed(1)} %`;
const ci = (i: Interval | null): string => (i === null ? "—" : `${pct(i.p)} [${pct(i.low)} ; ${pct(i.high)}]`);
const stage = (s: StageCount): string => `${s.successes} · ${ci(s.interval)}`;

const banner = (d: ReportData): string[] =>
  d.meta.dryRun
    ? [
        "> ⚠️ **DRY-RUN — DONNÉES SIMULÉES.** Aucun moteur n'a été interrogé. Ce rapport ne mesure RIEN :",
        "> il vérifie seulement que la chaîne fonctionne. Ne jamais citer ces chiffres.",
        "",
      ]
    : [];

const header = (d: ReportData): string[] => [
  `# Rapport de vague ${d.meta.waveId}`,
  "",
  ...banner(d),
  "| Élément | Valeur |",
  "|---|---|",
  `| Début / fin | ${d.meta.startedAt} → ${d.meta.finishedAt ?? "en cours / interrompue"} |`,
  `| Empreinte du manifeste (SHA-256) | \`${d.meta.manifestSha256.slice(0, 16)}…\` |`,
  `| Tirages réussis / en erreur | ${d.okDraws} / ${d.meta.errors} |`,
  `| Coût ${d.meta.dryRun ? "simulé" : "estimé"} | ${d.meta.spentUsd.toFixed(3)} $ |`,
  `| Arrêt anticipé | ${d.meta.stoppedReason ?? "non"} |`,
  "",
];

const funnelTable = (d: ReportData): string[] => [
  "## Funnel par moteur (JD cibles, appariements **certains** uniquement)",
  "",
  "E1 (indexation) n'est pas mesuré par la CLI : voir les captures Search Console, Bing Webmaster et `site:` sur Brave.",
  "Chaque cellule : succès · taux [IC 95 % de Wilson].",
  "",
  "| Moteur | Tirages | E2 récupéré | E3 nommé | E4 top 5 | E5 cité |",
  "|---|---|---|---|---|---|",
  ...d.funnel.map((f) => `| ${f.engine} | ${f.draws} | ${stage(f.retrieved)} | ${stage(f.named)} | ${stage(f.top5)} | ${stage(f.cited)} |`),
  "",
];

const northStar = (d: ReportData): string[] => [
  "## SoRV@5 et north star",
  "",
  ...(d.incomplete
    ? [
        `> ⚠️ **VAGUE INCOMPLÈTE : SoRV non publiable.** Couverture par moteur : ${Object.entries(d.coverage)
          .map(([e, c]) => `${e} ${c.ok}/${c.total}`)
          .join(", ")}${d.meta.stoppedReason ? ` — arrêt : ${d.meta.stoppedReason}` : ""}.`,
        "",
      ]
    : []),
  d.sorv === null
    ? "Aucun tirage cible exploitable."
    : `**SoRV@5 = ${pct(d.sorv.estimate)}** [IC bootstrap par JD : ${pct(d.sorv.low)} ; ${pct(d.sorv.high)}] — par moteur : ${Object.entries(d.sorv.perEngine)
        .map(([e, v]) => `${e} ${pct(v)}`)
        .join(", ")}`,
  "",
  `Profil « rendu visible » (≥ 2 appariements certains sur ≥ 2 JD de marché ET borne basse > 0) : **${d.renderedVisible ? "OUI" : "NON"}**`,
  "",
];

const controls = (d: ReportData): string[] => [
  "## JD témoins et dérive des moteurs",
  "",
  `Retrieval Rate des témoins : ${ci(d.controlRetrieval)}`,
  d.drift === null ? "Pas de vague de référence fournie (`--baseline`)." : `Dérive des témoins vs référence : ${pct(d.drift.delta)} ${d.drift.flagged ? "⚠️ **> 5 pts : delta à interpréter avec prudence**" : "(sous le seuil de 5 pts)"}`,
  d.didNote ?? (d.did === null ? "" : `Différence-de-différences (TA@5, cibles vs témoins) : ${pct(d.did.estimate)} [IC : ${pct(d.did.low)} ; ${pct(d.did.high)}]`),
  "",
];

const sources = (d: ReportData): string[] => {
  const total = Object.values(d.sources.platform).reduce((a, b) => a + b, 0) + d.sources.client + d.sources.other;
  const share = (n: number) => (total === 0 ? "—" : pct(n / total));
  return [
    "## Mix des sources citées",
    "",
    "| Source | Citations | Part |",
    "|---|---|---|",
    ...Object.entries(d.sources.platform)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `| ${k} | ${v} | ${share(v)} |`),
    `| vos URL vérifiées | ${d.sources.client} | ${share(d.sources.client)} |`,
    `| autres domaines (non conservés) | ${d.sources.other} | ${share(d.sources.other)} |`,
    "",
  ];
};

const quality = (d: ReportData): string[] => [
  "## Qualité de la mesure",
  "",
  `- Extractions échouées (masquage par lexique seul) : ${d.extractionFailures}`,
  `- Appariements « probables » à revoir à la main (exclus des chiffres ci-dessus) : ${d.probableToReview}`,
  `- Erreurs par code : ${Object.keys(d.errorsByCode).length === 0 ? "aucune" : Object.entries(d.errorsByCode).map(([k, v]) => `${k} × ${v}`).join(", ")}`,
  `- Accord extracteur LLM / re-scoring déterministe : ${d.rescoreAgreement === null ? "non calculé (lancer `sim:extract`)" : `${d.rescoreAgreement.agree}/${d.rescoreAgreement.total}`}`,
  d.manual === null
    ? "- Accord API / apps : non calculé (fournir `--manual`)"
    : `- Accord API / apps (ChatGPT, Claude, Perplexity ; P1) : ${d.manual.agree}/${d.manual.total}${d.manual.total > 0 && d.manual.agree / d.manual.total < 0.8 ? " ⚠️ < 80 % : passer aux modèles supérieurs" : ""}`,
  ...(d.manual === null ? [] : Object.entries(d.manual.otherApps).map(([app, c]) => `- Étalonnage manuel ${app} (interne, non revendu) : client présent ${c.present}/${c.total}`)),
  "",
];

const footer = [
  "---",
  "Mesure d'une tendance, pas une garantie. Réponses obtenues par API ; les applications grand public peuvent différer.",
  "Aucun nom de tiers n'est conservé : seuls les domaines de plateforme sont comptés.",
  "",
];

export const renderReport = (d: ReportData): string =>
  [...header(d), ...funnelTable(d), ...northStar(d), ...controls(d), ...sources(d), ...quality(d), ...footer].join("\n");
