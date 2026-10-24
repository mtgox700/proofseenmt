import { escapeHtml as e } from "./html";
import { isoDay, longDate, money, type Lang } from "./market-shell";
import { renderFrame } from "./page-frame";
import { barometerNav, BAROMETER_STYLES, intervalSvg, scaleOf, thresholdSvg } from "./barometer-chart";
import { datasetJsonLd, DATA_LICENSE, PUBLISHER_RULE, publishedSeries, RATE_METHOD, rateDataUrl, type RateBarometerView, type RateSeriesView, type RateStatView } from "./barometer-data";
import { blankState, LEDGER_STYLES } from "./ledger";

/*
 * Baromètre des TJM : médiane et quartiles des TJM affichés par les profils publiés et proposés par les missions, par
 * compétence et par ville, chaque groupe avec son effectif n et la date du calcul. Sous le seuil, rien : la page le dit
 * en clair, montre combien de valeurs existent face au seuil, au lieu d'afficher un chiffre qui ne décrirait rien.
 * Calculé à la demande, daté, téléchargeable. Figures en SVG serveur, encres neutres : une mesure n'est pas un poinçon.
 */

const LABELS = {
  fr: {
    title: "Baromètre des TJM freelance",
    lead: (min: number) => `Les TJM réels des profils publiés et des missions de Proofseen, par compétence et par ville. Chaque groupe affiche son effectif n ; aucun groupe de moins de ${min} valeurs n'est publié.`,
    back: "Blog et guides",
    trace: (d: string, min: number) => `Calculé le ${d} · seuil n ≥ ${min} · données CC BY 4.0`,
    notEnough: (min: number) => `Pas encore assez de données : il faut au moins ${min} profils ou missions par groupe. Aucun chiffre n'est publié en dessous.`,
    notEnoughWhy: (min: number) => `Un groupe apparaît ici, avec sa médiane, ses quartiles, son effectif et sa date, dès qu'il réunit ${min} valeurs.`,
    gauge: (label: string, n: number, min: number) => `${label} : ${n} valeur${n > 1 ? "s" : ""}, seuil de publication ${min}`,
    totals: (d: string, p: number, m: number) => `Au ${d}, ${p} profil${p > 1 ? "s" : ""} publié${p > 1 ? "s" : ""} affiche${p > 1 ? "nt" : ""} un TJM et ${m} mission${m > 1 ? "s" : ""} en propose${m > 1 ? "nt" : ""} un.`,
    profiles: "TJM affichés par les freelances",
    missions: "TJM proposés par les missions",
    profilesShort: "Profils publiés qui affichent un TJM",
    missionsShort: "Missions qui proposent un TJM",
    median: "Médiane, toutes compétences",
    perDay: "/ jour",
    overall: (median: string, p25: string, p75: string, n: number) => `Toutes compétences confondues : médiane ${median} par jour, la moitié des valeurs entre ${p25} et ${p75} (n = ${n}).`,
    figTrace: (n: number, d: string) => `n = ${n} · calculé le ${d}`,
    noOverall: (min: number) => `Moins de ${min} valeurs : aucune statistique publiée pour cette série.`,
    bySkill: "Par compétence",
    byCity: "Par ville",
    noGroup: (min: number) => `Aucun groupe n'atteint encore ${min} valeurs.`,
    group: { skill: "Compétence", city: "Ville" },
    cols: { n: "n", p25: "1er quartile", median: "Médiane", p75: "3e quartile" },
    viz: (lo: string, hi: string) => `Écart interquartile, échelle de ${lo} à ${hi}`,
    captionTrace: (d: string) => `Calculé le ${d}`,
    method: "Méthode",
    methodText: (min: number, since: string) =>
      `Les profils comptés sont les profils publiés qui affichent un TJM en euros. Les missions comptées sont celles qui sont ouvertes, ou qui ont été publiées depuis le ${since} : leur TJM est le milieu de la fourchette proposée, ou la seule borne donnée. ` +
      `Les deux séries restent séparées : un TJM demandé et un TJM proposé ne mesurent pas la même chose. Un groupe n'est publié qu'à partir de ${min} valeurs. ` +
      `Côté missions, un groupe doit aussi réunir au moins ${PUBLISHER_RULE.minPublishers} entreprises distinctes, et chacune n'y compte que pour ${PUBLISHER_RULE.maxPerPublisher} missions au plus, ses plus récentes : une seule entreprise ne fait pas le marché. ` +
      "Les quartiles sont calculés par interpolation linéaire entre les rangs (méthode des tableurs, PERCENTILE.INC), puis arrondis à l'euro. Ce baromètre décrit les données de Proofseen, pas tout le marché.",
    data: "Données",
    dataText: "Le même baromètre, en jeu de données réutilisable sous licence CC BY 4.0 (citez Proofseen) :",
    license: "Licence CC BY 4.0",
    csv: "Télécharger en CSV",
    json: "Télécharger en JSON",
    simulator: "Estimer un revenu net avec le simulateur",
    skills: "Voir aussi : les compétences demandées par les missions.",
  },
  en: {
    title: "Freelance day-rate barometer",
    lead: (min: number) => `Real day rates of the published profiles and missions on Proofseen, by skill and by city. Every group shows its size n; no group under ${min} values is published.`,
    back: "Blog and guides",
    trace: (d: string, min: number) => `Computed on ${d} · threshold n ≥ ${min} · data CC BY 4.0`,
    notEnough: (min: number) => `Not enough data yet: a group needs at least ${min} profiles or missions. No figure is published below that.`,
    notEnoughWhy: (min: number) => `A group shows here, with its median, quartiles, size and date, as soon as it gathers ${min} values.`,
    gauge: (label: string, n: number, min: number) => `${label}: ${n} value${n > 1 ? "s" : ""}, publication threshold ${min}`,
    totals: (d: string, p: number, m: number) => `On ${d}, ${p} published profile${p > 1 ? "s show" : " shows"} a day rate and ${m} mission${m > 1 ? "s offer" : " offers"} one.`,
    profiles: "Day rates shown by freelancers",
    missions: "Day rates offered by missions",
    profilesShort: "Published profiles showing a day rate",
    missionsShort: "Missions offering a day rate",
    median: "Median, all skills",
    perDay: "/ day",
    overall: (median: string, p25: string, p75: string, n: number) => `All skills together: median ${median} per day, half of the values between ${p25} and ${p75} (n = ${n}).`,
    figTrace: (n: number, d: string) => `n = ${n} · computed on ${d}`,
    noOverall: (min: number) => `Fewer than ${min} values: no statistic published for this series.`,
    bySkill: "By skill",
    byCity: "By city",
    noGroup: (min: number) => `No group reaches ${min} values yet.`,
    group: { skill: "Skill", city: "City" },
    cols: { n: "n", p25: "1st quartile", median: "Median", p75: "3rd quartile" },
    viz: (lo: string, hi: string) => `Interquartile range, scale from ${lo} to ${hi}`,
    captionTrace: (d: string) => `Computed on ${d}`,
    method: "Method",
    methodText: (min: number, since: string) =>
      `Profiles counted are published profiles showing a day rate in euros. Missions counted are open, or were published since ${since}: their rate is the middle of the offered range, or the single bound given. ` +
      `The two series stay separate: a rate asked and a rate offered do not measure the same thing. A group is published only from ${min} values. ` +
      `On the mission side, a group also needs at least ${PUBLISHER_RULE.minPublishers} distinct companies, each counting for ${PUBLISHER_RULE.maxPerPublisher} missions at most, its most recent: a single company does not make the market. ` +
      "Quartiles use linear interpolation between ranks (the spreadsheet PERCENTILE.INC method), rounded to the euro. This barometer describes Proofseen's data, not the whole market.",
    data: "Data",
    dataText: "The same barometer as a reusable dataset under the CC BY 4.0 licence (credit Proofseen):",
    license: "CC BY 4.0 licence",
    csv: "Download as CSV",
    json: "Download as JSON",
    simulator: "Estimate a net income with the simulator",
    skills: "See also: the skills requested by missions.",
  },
} as const;

type Labels = (typeof LABELS)[Lang];

const fmt = (cents: number, lang: Lang): string => money(cents, "EUR", lang);

/** Un tableau de groupes : chaque ligne avec son n, ses quartiles et sa figure, la date du calcul dans la légende. */
const table = (rows: readonly RateStatView[], kind: "skill" | "city", lang: Lang, caption: string, computedAt: Date): string => {
  const l = LABELS[lang];
  const c = l.cols;
  const scale = scaleOf(rows.flatMap((r) => [r.p25Cents, r.p75Cents]));
  const lo = Math.min(...rows.map((r) => r.p25Cents));
  const hi = Math.max(...rows.map((r) => r.p75Cents));
  return (
    `<div class="table"><table><caption>${e(caption)}<span class="trace"><time datetime="${computedAt.toISOString()}">${e(l.captionTrace(longDate(computedAt, lang)))}</time></span></caption>` +
    `<thead><tr><th scope="col">${l.group[kind]}</th><th scope="col" class="num">${c.n}</th>` +
    `<th scope="col" class="num">${c.p25}</th><th scope="col" class="num">${c.median}</th><th scope="col" class="num">${c.p75}</th><th scope="col" class="viz">${e(l.viz(fmt(lo, lang), fmt(hi, lang)))}</th></tr></thead><tbody>` +
    rows
      .map(
        (r) =>
          `<tr><th scope="row">${e(r.label)}</th><td class="num">${r.n}</td><td class="num">${e(fmt(r.p25Cents, lang))}</td><td class="num">${e(fmt(r.medianCents, lang))}</td><td class="num">${e(fmt(r.p75Cents, lang))}</td>` +
          `<td class="viz">${intervalSvg(r.p25Cents, r.medianCents, r.p75Cents, scale)}</td></tr>`,
      )
      .join("") +
    "</tbody></table></div>"
  );
};

/** La médiane d'une série en grand, son intervalle, la phrase qui la dit en entier, son n et sa date. */
const figure = (o: RateStatView, l: Labels, lang: Lang, computedAt: Date): string =>
  `<figure class="fig"><p class="ref">${l.median}</p><p class="big">${e(fmt(o.medianCents, lang))} <span>${l.perDay}</span></p>` +
  intervalSvg(o.p25Cents, o.medianCents, o.p75Cents, scaleOf([o.p25Cents, o.p75Cents]), 20) +
  `<figcaption>${e(l.overall(fmt(o.medianCents, lang), fmt(o.p25Cents, lang), fmt(o.p75Cents, lang), o.n))}</figcaption>` +
  `<p class="trace"><time datetime="${computedAt.toISOString()}">${e(l.figTrace(o.n, longDate(computedAt, lang)))}</time></p></figure>`;

const seriesSection = (id: string, title: string, raw: RateSeriesView, min: number, lang: Lang, computedAt: Date): string => {
  const l = LABELS[lang];
  const s = publishedSeries(raw, min);
  const overall = s.overall === null ? `<p class="muted">${l.noOverall(min)}</p>` : figure(s.overall, l, lang, computedAt);
  const groups = (rows: readonly RateStatView[], kind: "skill" | "city", heading: string): string =>
    `<h3 class="sub">${heading}</h3>` + (rows.length === 0 ? `<p class="muted">${l.noGroup(min)}</p>` : table(rows, kind, lang, `${title} · ${heading}`, computedAt));
  return `<section aria-labelledby="${id}"><h2 class="part" id="${id}">${title}</h2>${overall}${groups(s.bySkill, "skill", l.bySkill)}${groups(s.byCity, "city", l.byCity)}</section>`;
};

const isEmpty = (b: RateBarometerView): boolean =>
  [b.profiles, b.missions].map((s) => publishedSeries(s, b.minSample)).every((s) => s.overall === null && s.bySkill.length === 0 && s.byCity.length === 0);

/** L'état vide : ce qui manque, combien de valeurs existent face au seuil, ce qui apparaîtra, et quoi faire. */
const notEnough = (b: RateBarometerView, lang: Lang): string => {
  const l = LABELS[lang];
  const when = longDate(b.computedAt, lang);
  const gauges = [
    [l.profilesShort, b.profiles.total],
    [l.missionsShort, b.missions.total],
  ] as const;
  const detail =
    `<p class="trace"><time datetime="${b.computedAt.toISOString()}">${e(l.totals(when, b.profiles.total, b.missions.total))}</time></p>` +
    `<ul class="gauges">${gauges.map(([label, n]) => `<li><span>${e(l.gauge(label, n, b.minSample))}</span>${thresholdSvg(n, b.minSample)}</li>`).join("")}</ul>`;
  return blankState(
    l.notEnough(b.minSample),
    l.notEnoughWhy(b.minSample),
    [
      { text: l.csv, href: "/barometre/tjm.csv" },
      { text: l.json, href: "/barometre/tjm.json" },
      { text: l.simulator, href: `/${lang}/simulateur` },
    ],
    detail,
  );
};

export const rateBarometerUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/barometre/tjm`;

export const renderRateBarometer = (b: RateBarometerView, o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const base = o.baseUrl.replace(/\/$/, "");
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const csvUrl = rateDataUrl(base, "csv");
  const jsonUrl = rateDataUrl(base, "json");
  const day = isoDay(b.computedAt);
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
  const empty = isEmpty(b);
  return renderFrame({
    lang: o.lang,
    title: l.title,
    description: l.lead(b.minSample),
    canonical: rateBarometerUrl(base, o.lang),
    alternates: { fr: rateBarometerUrl(base, "fr"), en: rateBarometerUrl(base, "en") },
    jsonLd,
    otherHref: `/${other}/barometre/tjm`,
    // The barometer is not a rubric of the menu: no item of the header is marked current here (Kensa m11).
    styles: `${LEDGER_STYLES}${BAROMETER_STYLES}`,
    extraHead: [`<link rel="alternate" type="text/csv" href="${e(csvUrl)}">`, `<link rel="alternate" type="application/json" href="${e(jsonUrl)}">`],
    main: [
      `<header class="head"><a class="crumb" href="/${o.lang}/blog">← ${l.back}</a>`,
      barometerNav(o.lang, "rates"),
      `<p class="ref"><time datetime="${b.computedAt.toISOString()}">${e(l.trace(longDate(b.computedAt, o.lang), b.minSample))}</time></p>`,
      `<h1 class="title">${l.title}</h1>`,
      `<p class="headline">${l.lead(b.minSample)}</p></header>`,
      empty ? notEnough(b, o.lang) : `<p class="meta">${e(l.totals(longDate(b.computedAt, o.lang), b.profiles.total, b.missions.total))}</p>`,
      empty ? "" : seriesSection("rates-profiles", l.profiles, b.profiles, b.minSample, o.lang, b.computedAt),
      empty ? "" : seriesSection("rates-missions", l.missions, b.missions, b.minSample, o.lang, b.computedAt),
      `<h2 class="part">${l.method}</h2>`,
      `<p class="lede">${e(l.methodText(b.minSample, longDate(b.missionsSince, o.lang)))}</p>`,
      `<h2 class="part">${l.data}</h2>`,
      `<p>${l.dataText}</p>`,
      `<ul class="links data-links"><li><a href="/barometre/tjm.csv">CSV <small>${day}</small></a></li><li><a href="/barometre/tjm.json">JSON <small>${day}</small></a></li><li><a href="${DATA_LICENSE}" rel="license noopener">${l.license}</a></li></ul>`,
      `<p class="meta"><a href="/${o.lang}/barometre/competences">${l.skills}</a></p>`,
    ],
  });
};
