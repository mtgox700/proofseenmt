import { escapeHtml as e } from "./html";
import { isoDay, longDate, type Lang } from "./market-shell";
import { renderFrame } from "./page-frame";
import { datasetJsonLd, DATA_LICENSE, SKILL_METHOD, skillDataUrl, type SkillBarometerView } from "./barometer-data";

/*
 * Baromètre des compétences demandées : combien de missions publiées sur la fenêtre demandent chaque compétence. Une
 * compétence n'apparaît qu'à partir de son seuil ; l'ordre est celui du nombre de missions, un fait compté — il classe
 * des compétences, jamais des personnes.
 */

const LABELS = {
  fr: {
    title: "Compétences demandées par les missions freelance",
    lead: (min: number) => `Les compétences les plus demandées par les missions publiées sur Proofseen ces 90 derniers jours, avec leur nombre de missions. Une compétence n'apparaît qu'à partir de ${min} missions.`,
    computed: (d: string, since: string) => `Calculé le ${d}, sur les missions publiées depuis le ${since}.`,
    notEnough: (min: number) => `Pas encore assez de données : il faut au moins ${min} missions pour qu'une compétence apparaisse. Aucun chiffre n'est publié en dessous.`,
    total: (n: number) => `${n} mission${n > 1 ? "s" : ""} publiée${n > 1 ? "s" : ""} sur la période.`,
    list: "Compétences",
    caption: "Nombre de missions qui demandent chaque compétence",
    cols: { skill: "Compétence", missions: "Missions (n)" },
    method: "Méthode",
    methodText: (min: number) =>
      `Sont comptées les missions publiées sur Proofseen pendant les 90 derniers jours, qu'elles soient encore ouvertes ou clôturées depuis. Une mission qui demande plusieurs compétences compte pour chacune. Une compétence n'est publiée qu'à partir de ${min} missions. Ce baromètre décrit les missions de Proofseen, pas tout le marché.`,
    data: "Données",
    dataText: "Le même baromètre, en jeu de données réutilisable sous licence CC BY 4.0 (citez Proofseen) :",
    license: "Licence CC BY 4.0",
    rates: "Voir aussi : le baromètre des TJM.",
  },
  en: {
    title: "Skills requested by freelance missions",
    lead: (min: number) => `The skills most requested by the missions published on Proofseen over the last 90 days, with their number of missions. A skill appears only from ${min} missions.`,
    computed: (d: string, since: string) => `Computed on ${d}, over the missions published since ${since}.`,
    notEnough: (min: number) => `Not enough data yet: a skill needs at least ${min} missions to appear. No figure is published below that.`,
    total: (n: number) => `${n} mission${n > 1 ? "s" : ""} published over the period.`,
    list: "Skills",
    caption: "Number of missions requesting each skill",
    cols: { skill: "Skill", missions: "Missions (n)" },
    method: "Method",
    methodText: (min: number) =>
      `Counted are the missions published on Proofseen over the last 90 days, whether still open or closed since. A mission requesting several skills counts for each. A skill is published only from ${min} missions. This barometer describes Proofseen's missions, not the whole market.`,
    data: "Data",
    dataText: "The same barometer as a reusable dataset under the CC BY 4.0 licence (credit Proofseen):",
    license: "CC BY 4.0 licence",
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
  const rows = b.skills
    .map((s) => `<tr><th scope="row">${e(s.label)}</th><td class="num">${s.missions}</td></tr>`)
    .join("");
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
    menu: "blog",
    extraHead: [`<link rel="alternate" type="text/csv" href="${e(csvUrl)}">`, `<link rel="alternate" type="application/json" href="${e(jsonUrl)}">`],
    main: [
      `<h1 class="title">${l.title}</h1>`,
      `<p class="headline">${l.lead(b.minCount)}</p>`,
      `<p class="meta"><time datetime="${b.computedAt.toISOString()}">${l.computed(longDate(b.computedAt, o.lang), longDate(b.since, o.lang))}</time> ${l.total(b.totalMissions)}</p>`,
      `<h2>${l.list}</h2>`,
      b.skills.length === 0
        ? `<p class="note">${l.notEnough(b.minCount)}</p>`
        : `<div class="table"><table><caption>${l.caption}</caption><thead><tr><th scope="col">${l.cols.skill}</th><th scope="col" class="num">${l.cols.missions}</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      `<h2>${l.method}</h2>`,
      `<p class="lede">${e(l.methodText(b.minCount))}</p>`,
      `<h2>${l.data}</h2>`,
      `<p>${l.dataText}</p>`,
      `<ul class="links"><li><a href="/barometre/competences.csv">CSV — ${isoDay(b.computedAt)}</a></li><li><a href="/barometre/competences.json">JSON — ${isoDay(b.computedAt)}</a></li><li><a href="${DATA_LICENSE}" rel="license noopener">${l.license}</a></li></ul>`,
      `<p class="meta"><a href="/${o.lang}/barometre/tjm">${l.rates}</a></p>`,
    ],
  });
};
