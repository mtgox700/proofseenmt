import { escapeHtml as e } from "./html";
import { isoDay, longDate, type Lang } from "./market-shell";
import { renderFrame } from "./page-frame";
import { barometerNav, BAROMETER_STYLES, barSvg, thresholdSvg } from "./barometer-chart";
import { datasetJsonLd, DATA_LICENSE, PUBLISHER_RULE, publishedSkills, SKILL_METHOD, skillDataUrl, type SkillBarometerView } from "./barometer-data";
import { blankState, LEDGER_STYLES } from "./ledger";

/*
 * Baromètre des compétences demandées : combien de missions publiées sur la fenêtre demandent chaque compétence. Une
 * compétence n'apparaît qu'à partir de son seuil ; l'ordre est celui du nombre de missions, un fait compté : il classe
 * des compétences, jamais des personnes. Chaque compte porte son n (le nombre de missions) et la date du calcul.
 */

const LABELS = {
  fr: {
    title: "Compétences demandées par les missions freelance",
    lead: (min: number) => `Les compétences les plus demandées par les missions publiées sur Proofseen ces 90 derniers jours, avec leur nombre de missions. Une compétence n'apparaît qu'à partir de ${min} missions.`,
    back: "Blog et guides",
    trace: (d: string, min: number) => `Calculé le ${d} · seuil n ≥ ${min} · données CC BY 4.0`,
    computed: (d: string, since: string) => `Calculé le ${d}, sur les missions publiées depuis le ${since}.`,
    notEnough: (min: number) => `Pas encore assez de données : il faut au moins ${min} missions pour qu'une compétence apparaisse. Aucun chiffre n'est publié en dessous.`,
    notEnoughWhy: (min: number) => `Une compétence apparaît ici, avec son nombre de missions et la date du calcul, dès que ${min} missions la demandent.`,
    gauge: (n: number, min: number) => `Missions publiées sur la période : ${n}, seuil par compétence ${min}`,
    total: (n: number) => `${n} mission${n > 1 ? "s" : ""} publiée${n > 1 ? "s" : ""} sur la période.`,
    list: "Compétences",
    caption: "Nombre de missions qui demandent chaque compétence",
    captionTrace: (d: string, since: string) => `Calculé le ${d}, missions publiées depuis le ${since}`,
    cols: { skill: "Compétence", missions: "Missions (n)", viz: "Part du plus grand nombre" },
    method: "Méthode",
    methodText: (min: number) =>
      `Sont comptées les missions publiées sur Proofseen pendant les 90 derniers jours, qu'elles soient encore ouvertes ou clôturées depuis. Une mission qui demande plusieurs compétences compte pour chacune. Une compétence n'est publiée qu'à partir de ${min} missions, demandées par au moins ${PUBLISHER_RULE.minPublishers} entreprises distinctes ; chaque entreprise n'y compte que pour ${PUBLISHER_RULE.maxPerPublisher} missions au plus, ses plus récentes. Ce baromètre décrit les missions de Proofseen, pas tout le marché.`,
    data: "Données",
    dataText: "Le même baromètre, en jeu de données réutilisable sous licence CC BY 4.0 (citez Proofseen) :",
    license: "Licence CC BY 4.0",
    csv: "Télécharger en CSV",
    json: "Télécharger en JSON",
    missions: "Voir les missions ouvertes",
    rates: "Voir aussi : le baromètre des TJM.",
  },
  en: {
    title: "Skills requested by freelance missions",
    lead: (min: number) => `The skills most requested by the missions published on Proofseen over the last 90 days, with their number of missions. A skill appears only from ${min} missions.`,
    back: "Blog and guides",
    trace: (d: string, min: number) => `Computed on ${d} · threshold n ≥ ${min} · data CC BY 4.0`,
    computed: (d: string, since: string) => `Computed on ${d}, over the missions published since ${since}.`,
    notEnough: (min: number) => `Not enough data yet: a skill needs at least ${min} missions to appear. No figure is published below that.`,
    notEnoughWhy: (min: number) => `A skill shows here, with its number of missions and the date of the computation, as soon as ${min} missions request it.`,
    gauge: (n: number, min: number) => `Missions published over the period: ${n}, threshold per skill ${min}`,
    total: (n: number) => `${n} mission${n > 1 ? "s" : ""} published over the period.`,
    list: "Skills",
    caption: "Number of missions requesting each skill",
    captionTrace: (d: string, since: string) => `Computed on ${d}, missions published since ${since}`,
    cols: { skill: "Skill", missions: "Missions (n)", viz: "Share of the largest count" },
    method: "Method",
    methodText: (min: number) =>
      `Counted are the missions published on Proofseen over the last 90 days, whether still open or closed since. A mission requesting several skills counts for each. A skill is published only from ${min} missions, requested by at least ${PUBLISHER_RULE.minPublishers} distinct companies; each company counts for ${PUBLISHER_RULE.maxPerPublisher} missions at most, its most recent. This barometer describes Proofseen's missions, not the whole market.`,
    data: "Data",
    dataText: "The same barometer as a reusable dataset under the CC BY 4.0 licence (credit Proofseen):",
    license: "CC BY 4.0 licence",
    csv: "Download as CSV",
    json: "Download as JSON",
    missions: "See the open missions",
    rates: "See also: the day-rate barometer.",
  },
} as const;

export const skillBarometerUrl = (baseUrl: string, lang: Lang): string => `${baseUrl.replace(/\/$/, "")}/${lang}/barometre/competences`;

export const renderSkillBarometer = (b: SkillBarometerView, o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const base = o.baseUrl.replace(/\/$/, "");
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const csvUrl = skillDataUrl(base, "csv");
  const jsonUrl = skillDataUrl(base, "json");
  const skills = publishedSkills(b);
  const max = Math.max(0, ...skills.map((s) => s.missions));
  const when = longDate(b.computedAt, o.lang);
  const since = longDate(b.since, o.lang);
  const day = isoDay(b.computedAt);
  const rows = skills.map((s) => `<tr><th scope="row">${e(s.label)}</th><td class="num">${s.missions}</td><td class="viz">${barSvg(s.missions, max)}</td></tr>`).join("");
  const empty = blankState(
    l.notEnough(b.minCount),
    l.notEnoughWhy(b.minCount),
    [
      { text: l.csv, href: "/barometre/competences.csv" },
      { text: l.json, href: "/barometre/competences.json" },
      { text: l.missions, href: `/${o.lang}/missions` },
    ],
    `<ul class="gauges"><li><span>${e(l.gauge(b.totalMissions, b.minCount))}</span>${thresholdSvg(b.totalMissions, b.minCount)}</li></ul>`,
  );
  return renderFrame({
    lang: o.lang,
    title: l.title,
    description: l.lead(b.minCount),
    canonical: skillBarometerUrl(base, o.lang),
    alternates: { fr: skillBarometerUrl(base, "fr"), en: skillBarometerUrl(base, "en") },
    jsonLd: datasetJsonLd({
      name: l.title,
      description: l.lead(b.minCount),
      url: skillBarometerUrl(base, o.lang),
      lang: o.lang,
      baseUrl: base,
      from: b.since,
      computedAt: b.computedAt,
      csvUrl,
      jsonUrl,
      method: SKILL_METHOD,
      variables: [{ name: "skill" }, { name: "missions" }],
    }),
    otherHref: `/${other}/barometre/competences`,
    // The barometer is not a rubric of the menu: no item of the header is marked current here (Kensa m11).
    styles: `${LEDGER_STYLES}${BAROMETER_STYLES}`,
    extraHead: [`<link rel="alternate" type="text/csv" href="${e(csvUrl)}">`, `<link rel="alternate" type="application/json" href="${e(jsonUrl)}">`],
    main: [
      `<header class="head"><a class="crumb" href="/${o.lang}/blog">← ${l.back}</a>`,
      barometerNav(o.lang, "skills"),
      `<p class="ref"><time datetime="${b.computedAt.toISOString()}">${e(l.trace(when, b.minCount))}</time></p>`,
      `<h1 class="title">${l.title}</h1>`,
      `<p class="headline">${l.lead(b.minCount)}</p></header>`,
      `<p class="meta"><time datetime="${b.computedAt.toISOString()}">${l.computed(when, since)}</time> ${l.total(b.totalMissions)}</p>`,
      `<h2 class="part">${l.list}</h2>`,
      skills.length === 0
        ? empty
        : `<div class="table"><table><caption>${l.caption}<span class="trace"><time datetime="${b.computedAt.toISOString()}">${e(l.captionTrace(when, since))}</time></span></caption>` +
          `<thead><tr><th scope="col">${l.cols.skill}</th><th scope="col" class="num">${l.cols.missions}</th><th scope="col" class="viz">${l.cols.viz}</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      `<h2 class="part">${l.method}</h2>`,
      `<p class="lede">${e(l.methodText(b.minCount))}</p>`,
      `<h2 class="part">${l.data}</h2>`,
      `<p>${l.dataText}</p>`,
      `<ul class="links data-links"><li><a href="/barometre/competences.csv">CSV <small>${day}</small></a></li><li><a href="/barometre/competences.json">JSON <small>${day}</small></a></li><li><a href="${DATA_LICENSE}" rel="license noopener">${l.license}</a></li></ul>`,
      `<p class="meta"><a href="/${o.lang}/barometre/tjm">${l.rates}</a></p>`,
    ],
  });
};
