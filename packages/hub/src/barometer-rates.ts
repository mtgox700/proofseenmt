import { escapeHtml as e } from "./html";
import { isoDay, longDate, money, type Lang } from "./market-shell";
import { renderFrame } from "./page-frame";
import { datasetJsonLd, DATA_LICENSE, RATE_METHOD, rateDataUrl, type RateBarometerView, type RateSeriesView, type RateStatView } from "./barometer-data";

/*
 * Baromètre des TJM : médiane et quartiles des TJM affichés par les profils publiés et proposés par les missions, par
 * compétence et par ville, chaque groupe avec son effectif n. Sous le seuil, rien : la page le dit en clair au lieu
 * d'afficher un chiffre qui ne décrirait rien. Calculé à la demande, daté, téléchargeable.
 */

const LABELS = {
  fr: {
    title: "Baromètre des TJM freelance",
    lead: (min: number) => `Les TJM réels des profils publiés et des missions de Proofseen, par compétence et par ville. Chaque groupe affiche son effectif n ; aucun groupe de moins de ${min} valeurs n'est publié.`,
    computed: (d: string) => `Calculé le ${d}, à partir des données de la plateforme à cet instant.`,
    notEnough: (min: number) => `Pas encore assez de données : il faut au moins ${min} profils ou missions par groupe. Aucun chiffre n'est publié en dessous.`,
    totals: (p: number, m: number) => `Aujourd'hui, ${p} profil${p > 1 ? "s" : ""} publié${p > 1 ? "s" : ""} affiche${p > 1 ? "nt" : ""} un TJM et ${m} mission${m > 1 ? "s" : ""} en propose${m > 1 ? "nt" : ""} un.`,
    profiles: "TJM affichés par les freelances",
    missions: "TJM proposés par les missions",
    overall: (median: string, p25: string, p75: string, n: number) => `Toutes compétences confondues : médiane ${median} par jour, la moitié des valeurs entre ${p25} et ${p75} (n = ${n}).`,
    noOverall: (min: number) => `Moins de ${min} valeurs : aucune statistique publiée pour cette série.`,
    bySkill: "Par compétence",
    byCity: "Par ville",
    noGroup: (min: number) => `Aucun groupe n'atteint encore ${min} valeurs.`,
    group: { skill: "Compétence", city: "Ville" },
    cols: { n: "n", p25: "1er quartile", median: "Médiane", p75: "3e quartile" },
    method: "Méthode",
    methodText: (min: number, since: string) =>
      `Les profils comptés sont les profils publiés qui affichent un TJM en euros. Les missions comptées sont celles qui sont ouvertes, ou qui ont été publiées depuis le ${since} : leur TJM est le milieu de la fourchette proposée, ou la seule borne donnée. ` +
      `Les deux séries restent séparées : un TJM demandé et un TJM proposé ne mesurent pas la même chose. Un groupe n'est publié qu'à partir de ${min} valeurs. ` +
      "Les quartiles sont calculés par interpolation linéaire entre les rangs (méthode des tableurs, PERCENTILE.INC), puis arrondis à l'euro. Ce baromètre décrit les données de Proofseen, pas tout le marché.",
    data: "Données",
    dataText: "Le même baromètre, en jeu de données réutilisable sous licence CC BY 4.0 (citez Proofseen) :",
    license: "Licence CC BY 4.0",
    skills: "Voir aussi : les compétences demandées par les missions.",
  },
  en: {
    title: "Freelance day-rate barometer",
    lead: (min: number) => `Real day rates of the published profiles and missions on Proofseen, by skill and by city. Every group shows its size n; no group under ${min} values is published.`,
    computed: (d: string) => `Computed on ${d}, from the platform's data at that moment.`,
    notEnough: (min: number) => `Not enough data yet: a group needs at least ${min} profiles or missions. No figure is published below that.`,
    totals: (p: number, m: number) => `Today, ${p} published profile${p > 1 ? "s show" : " shows"} a day rate and ${m} mission${m > 1 ? "s offer" : " offers"} one.`,
    profiles: "Day rates shown by freelancers",
    missions: "Day rates offered by missions",
    overall: (median: string, p25: string, p75: string, n: number) => `All skills together: median ${median} per day, half of the values between ${p25} and ${p75} (n = ${n}).`,
    noOverall: (min: number) => `Fewer than ${min} values: no statistic published for this series.`,
    bySkill: "By skill",
    byCity: "By city",
    noGroup: (min: number) => `No group reaches ${min} values yet.`,
    group: { skill: "Skill", city: "City" },
    cols: { n: "n", p25: "1st quartile", median: "Median", p75: "3rd quartile" },
    method: "Method",
    methodText: (min: number, since: string) =>
      `Profiles counted are published profiles showing a day rate in euros. Missions counted are open, or were published since ${since}: their rate is the middle of the offered range, or the single bound given. ` +
      `The two series stay separate: a rate asked and a rate offered do not measure the same thing. A group is published only from ${min} values. ` +
      "Quartiles use linear interpolation between ranks (the spreadsheet PERCENTILE.INC method), rounded to the euro. This barometer describes Proofseen's data, not the whole market.",
    data: "Data",
    dataText: "The same barometer as a reusable dataset under the CC BY 4.0 licence (credit Proofseen):",
    license: "CC BY 4.0 licence",
    skills: "See also: the skills requested by missions.",
  },
} as const;

const table = (rows: readonly RateStatView[], kind: "skill" | "city", lang: Lang, caption: string): string => {
  const c = LABELS[lang].cols;
  const fmt = (cents: number): string => e(money(cents, "EUR", lang));
  return (
    `<div class="table"><table><caption>${e(caption)}</caption><thead><tr><th scope="col">${LABELS[lang].group[kind]}</th><th scope="col" class="num">${c.n}</th>` +
    `<th scope="col" class="num">${c.p25}</th><th scope="col" class="num">${c.median}</th><th scope="col" class="num">${c.p75}</th></tr></thead><tbody>` +
    rows.map((r) => `<tr><th scope="row">${e(r.label)}</th><td class="num">${r.n}</td><td class="num">${fmt(r.p25Cents)}</td><td class="num">${fmt(r.medianCents)}</td><td class="num">${fmt(r.p75Cents)}</td></tr>`).join("") +
    "</tbody></table></div>"
  );
};

const seriesSection = (id: string, title: string, s: RateSeriesView, min: number, lang: Lang): string => {
  const l = LABELS[lang];
  const fmt = (cents: number): string => e(money(cents, "EUR", lang));
  const overall = s.overall === null ? l.noOverall(min) : l.overall(fmt(s.overall.medianCents), fmt(s.overall.p25Cents), fmt(s.overall.p75Cents), s.overall.n);
  const groups = (rows: readonly RateStatView[], kind: "skill" | "city", heading: string): string =>
    `<h3>${heading}</h3>` + (rows.length === 0 ? `<p class="muted">${l.noGroup(min)}</p>` : table(rows, kind, lang, `${title} — ${heading}`));
  return `<section aria-labelledby="${id}"><h2 id="${id}">${title}</h2><p>${overall}</p>${groups(s.bySkill, "skill", l.bySkill)}${groups(s.byCity, "city", l.byCity)}</section>`;
};

const isEmpty = (b: RateBarometerView): boolean =>
  b.profiles.overall === null && b.missions.overall === null && [b.profiles, b.missions].every((s) => s.bySkill.length === 0 && s.byCity.length === 0);

export const rateBarometerUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/barometre/tjm`;

export const renderRateBarometer = (b: RateBarometerView, o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const base = o.baseUrl.replace(/\/$/, "");
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const csvUrl = rateDataUrl(base, "csv");
  const jsonUrl = rateDataUrl(base, "json");
  const jsonLd = datasetJsonLd({
    name: l.title,
    description: l.lead(b.minSample),
    url: rateBarometerUrl(base, o.lang),
    lang: o.lang,
    baseUrl: base,
    from: b.missionsSince,
    computedAt: b.computedAt,
    csvUrl,
    jsonUrl,
    method: RATE_METHOD,
    variables: [{ name: "n" }, { name: "p25", unitText: "EUR/day" }, { name: "median", unitText: "EUR/day" }, { name: "p75", unitText: "EUR/day" }],
  });
  return renderFrame({
    lang: o.lang,
    title: l.title,
    description: l.lead(b.minSample),
    canonical: rateBarometerUrl(base, o.lang),
    alternates: { fr: rateBarometerUrl(base, "fr"), en: rateBarometerUrl(base, "en") },
    jsonLd,
    otherHref: `/${other}/barometre/tjm`,
    menu: "blog",
    extraHead: [`<link rel="alternate" type="text/csv" href="${e(csvUrl)}">`, `<link rel="alternate" type="application/json" href="${e(jsonUrl)}">`],
    main: [
      `<h1 class="title">${l.title}</h1>`,
      `<p class="headline">${l.lead(b.minSample)}</p>`,
      `<p class="meta"><time datetime="${b.computedAt.toISOString()}">${l.computed(longDate(b.computedAt, o.lang))}</time></p>`,
      isEmpty(b) ? `<p class="note">${l.notEnough(b.minSample)} ${l.totals(b.profiles.total, b.missions.total)}</p>` : `<p class="meta">${l.totals(b.profiles.total, b.missions.total)}</p>`,
      seriesSection("rates-profiles", l.profiles, b.profiles, b.minSample, o.lang),
      seriesSection("rates-missions", l.missions, b.missions, b.minSample, o.lang),
      `<h2>${l.method}</h2>`,
      `<p class="lede">${e(l.methodText(b.minSample, longDate(b.missionsSince, o.lang)))}</p>`,
      `<h2>${l.data}</h2>`,
      `<p>${l.dataText}</p>`,
      `<ul class="links"><li><a href="/barometre/tjm.csv">CSV — ${isoDay(b.computedAt)}</a></li><li><a href="/barometre/tjm.json">JSON — ${isoDay(b.computedAt)}</a></li><li><a href="${DATA_LICENSE}" rel="license noopener">${l.license}</a></li></ul>`,
      `<p class="meta"><a href="/${o.lang}/barometre/competences">${l.skills}</a></p>`,
    ],
  });
};
