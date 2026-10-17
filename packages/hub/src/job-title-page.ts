import { escapeHtml as e } from "./html";
import { missionUrl } from "./job-posting";
import { isoDay, longDate, money, type Lang } from "./market-shell";
import { renderFrame } from "./page-frame";
import { profileUrl } from "./profile-page";

/*
 * Page par poste (intitulé) : les missions ouvertes et les profils publiés dont l'intitulé ou le titre entrent dans une
 * famille de postes. Elle n'existe que remplie de contenu réel (la base décide) ; ce rendu ne fabrique aucun texte de
 * remplissage. Un freelance pseudonyme y apparaît par sa référence, jamais par son nom.
 *
 * Les faits et la FAQ ne disent que ce que la base a compté au moment du rendu, avec sa date. Une fourchette de TJM
 * n'est écrite qu'à partir de MIN_STAT_SAMPLE valeurs, avec son n ; celle des missions, en plus, avec son nombre
 * d'entreprises (au moins trois, la règle des baromètres).
 */

export const MIN_STAT_SAMPLE = 5;
export const MIN_RATE_PUBLISHERS = 3;
const MAX_CITIES = 12;

export interface RateRangeView {
  readonly n: number;
  readonly minCents: number;
  readonly maxCents: number;
  readonly currency: string;
}

export interface JobTitlePageView {
  readonly key: string;
  readonly label: { readonly fr: string; readonly en: string };
  readonly missions: readonly { readonly id: string; readonly title: string; readonly organisationName: string; readonly workMode: "onsite" | "hybrid" | "remote"; readonly city: string | null }[];
  readonly profiles: readonly { readonly slug: string; readonly reference: string; readonly displayName: string | null; readonly headline: string; readonly city: string }[];
  readonly facts: {
    readonly profileCount: number;
    readonly missionCount: number;
    readonly profileRate: RateRangeView | null;
    readonly missionRate: (RateRangeView & { readonly publishers: number }) | null;
    readonly cities: readonly string[];
  };
  readonly generatedAt: Date;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

const LABELS = {
  fr: {
    title: (label: string) => `${label} : missions et freelances`,
    lead: (m: number, p: number) => `${plural(m, "mission ouverte", "missions ouvertes")} et ${plural(p, "profil publié", "profils publiés")} pour ce poste sur Proofseen.`,
    rule: "Une mission entre dans cette page par son intitulé, un profil par son titre, quand ils contiennent l'un des intitulés de ce poste (sans tenir compte des accents ni des majuscules). Un filtre, jamais un classement.",
    missions: "Missions ouvertes",
    profiles: "Freelances",
    facts: "En bref",
    faq: "Questions fréquentes",
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    pseudonym: (ref: string) => `Freelance ${ref}`,
    count: (label: string, p: number, m: number, when: string) =>
      `Au ${when}, Proofseen compte ${plural(p, "profil publié", "profils publiés")} et ${plural(m, "mission ouverte", "missions ouvertes")} pour le poste ${label}.`,
    profileRate: (min: string, max: string, n: number) => `Les TJM affichés par ces profils vont de ${min} à ${max} par jour (n = ${n} profils qui affichent leur TJM).`,
    missionRate: (min: string, max: string, n: number, k: number) =>
      `Les TJM proposés par ces missions vont de ${min} à ${max} par jour (n = ${n} missions de ${k} entreprises, au plus trois par entreprise).`,
    cities: (list: string, more: number) => `Villes représentées : ${list}${more > 0 ? ` et ${plural(more, "autre", "autres")}` : ""}.`,
    qProfiles: (label: string) => `Combien de freelances ${label} sont publiés sur Proofseen ?`,
    aProfiles: (p: number, when: string) => `${plural(p, "profil publié", "profils publiés")} au ${when}.`,
    qMissions: (label: string) => `Combien de missions ${label} sont ouvertes sur Proofseen ?`,
    aMissions: (m: number, when: string) => `${plural(m, "mission ouverte", "missions ouvertes")} au ${when}.`,
    qProfileRate: (label: string) => `Quel TJM affichent les freelances ${label} sur Proofseen ?`,
    qMissionRate: (label: string) => `Quel TJM proposent les missions ${label} sur Proofseen ?`,
    qCities: (label: string) => `Dans quelles villes sont les freelances et les missions ${label} ?`,
    generated: (when: string) => `Page générée le ${when} à partir des profils publiés et des missions ouvertes.`,
  },
  en: {
    title: (label: string) => `${label}: missions and freelancers`,
    lead: (m: number, p: number) => `${plural(m, "open mission", "open missions")} and ${plural(p, "published profile", "published profiles")} for this job title on Proofseen.`,
    rule: "A mission enters this page through its title, a profile through its headline, when they contain one of the titles of this job (ignoring accents and case). A filter, never a ranking.",
    missions: "Open missions",
    profiles: "Freelancers",
    facts: "In short",
    faq: "Frequently asked questions",
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    pseudonym: (ref: string) => `Freelancer ${ref}`,
    count: (label: string, p: number, m: number, when: string) =>
      `On ${when}, Proofseen lists ${plural(p, "published profile", "published profiles")} and ${plural(m, "open mission", "open missions")} for the job title ${label}.`,
    profileRate: (min: string, max: string, n: number) => `The day rates shown by these profiles range from ${min} to ${max} (n = ${n} profiles showing their rate).`,
    missionRate: (min: string, max: string, n: number, k: number) =>
      `The day rates offered by these missions range from ${min} to ${max} (n = ${n} missions from ${k} companies, at most three per company).`,
    cities: (list: string, more: number) => `Cities represented: ${list}${more > 0 ? ` and ${plural(more, "other", "others")}` : ""}.`,
    qProfiles: (label: string) => `How many ${label} freelancers are published on Proofseen?`,
    aProfiles: (p: number, when: string) => `${plural(p, "published profile", "published profiles")} on ${when}.`,
    qMissions: (label: string) => `How many ${label} missions are open on Proofseen?`,
    aMissions: (m: number, when: string) => `${plural(m, "open mission", "open missions")} on ${when}.`,
    qProfileRate: (label: string) => `What day rate do ${label} freelancers show on Proofseen?`,
    qMissionRate: (label: string) => `What day rate do ${label} missions offer on Proofseen?`,
    qCities: (label: string) => `In which cities are the ${label} freelancers and missions?`,
    generated: (when: string) => `Page generated on ${when} from the published profiles and open missions.`,
  },
} as const;

export const jobTitleUrl = (baseUrl: string, lang: Lang, key: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/postes/${encodeURIComponent(key)}`;

interface Faq {
  readonly q: string;
  readonly a: string;
}

/** Les faits, une phrase chacun, et les mêmes en questions-réponses : rien d'autre que ce que la base a compté. */
const factSentences = (s: JobTitlePageView, lang: Lang): { readonly paragraph: readonly string[]; readonly faq: readonly Faq[] } => {
  const l = LABELS[lang];
  const label = s.label[lang];
  const when = longDate(s.generatedAt, lang);
  const f = s.facts;
  const fmt = (cents: number, currency: string): string => money(cents, currency, lang);
  const pr = f.profileRate !== null && f.profileRate.n >= MIN_STAT_SAMPLE ? f.profileRate : null;
  const mr = f.missionRate !== null && f.missionRate.n >= MIN_STAT_SAMPLE && f.missionRate.publishers >= MIN_RATE_PUBLISHERS ? f.missionRate : null;
  const profileRateText = pr === null ? null : l.profileRate(fmt(pr.minCents, pr.currency), fmt(pr.maxCents, pr.currency), pr.n);
  const missionRateText = mr === null ? null : l.missionRate(fmt(mr.minCents, mr.currency), fmt(mr.maxCents, mr.currency), mr.n, mr.publishers);
  const shown = f.cities.slice(0, MAX_CITIES);
  const citiesText = shown.length === 0 ? null : l.cities(shown.join(", "), f.cities.length - shown.length);
  const optional = (text: string | null, q: string): readonly Faq[] => (text === null ? [] : [{ q, a: text }]);
  return {
    paragraph: [l.count(label, f.profileCount, f.missionCount, when), ...[profileRateText, missionRateText, citiesText].filter((t): t is string => t !== null)],
    faq: [
      { q: l.qProfiles(label), a: l.aProfiles(f.profileCount, when) },
      { q: l.qMissions(label), a: l.aMissions(f.missionCount, when) },
      ...optional(profileRateText, l.qProfileRate(label)),
      ...optional(missionRateText, l.qMissionRate(label)),
      ...optional(citiesText, l.qCities(label)),
    ],
  };
};

const missionList = (s: JobTitlePageView, lang: Lang): string => {
  const l = LABELS[lang];
  if (s.missions.length === 0) return "";
  const items = s.missions.map((m) => {
    const where = m.workMode === "remote" || m.city === null ? l.modes[m.workMode] : `${m.city} · ${l.modes[m.workMode]}`;
    return `<li class="card"><h3><a href="${e(`/${lang}/missions/${m.id}`)}">${e(m.title)}</a></h3><p class="when">${e(m.organisationName)} · ${e(where)}</p></li>`;
  });
  return `<h2>${l.missions}</h2><ul class="missions">${items.join("")}</ul>`;
};

const profileList = (s: JobTitlePageView, lang: Lang): string => {
  const l = LABELS[lang];
  if (s.profiles.length === 0) return "";
  const items = s.profiles.map(
    (p) => `<li class="card"><h3><a href="${e(`/${lang}/profils/${p.slug}`)}">${e(p.displayName ?? l.pseudonym(p.reference))}</a></h3><p class="when">${e(p.headline)} · ${e(p.city)}</p></li>`,
  );
  return `<h2>${l.profiles}</h2><ul class="missions">${items.join("")}</ul>`;
};

export const renderJobTitlePage = (s: JobTitlePageView, o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const title = l.title(s.label[o.lang]);
  const url = jobTitleUrl(o.baseUrl, o.lang, s.key);
  const { paragraph, faq } = factSentences(s, o.lang);
  const urls = [...s.missions.map((m) => missionUrl(o.baseUrl, o.lang, m.id)), ...s.profiles.map((p) => profileUrl(o.baseUrl, o.lang, p.slug))];
  const lead = l.lead(s.facts.missionCount, s.facts.profileCount);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: title,
        url,
        about: { "@type": "DefinedTerm", name: s.label[o.lang] },
        inLanguage: o.lang,
        dateModified: isoDay(s.generatedAt),
        mainEntity: { "@type": "ItemList", numberOfItems: urls.length, itemListElement: urls.map((u, i) => ({ "@type": "ListItem", position: i + 1, url: u })) },
      },
      { "@type": "FAQPage", url, mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
  return renderFrame({
    lang: o.lang,
    title,
    description: lead,
    canonical: url,
    alternates: { fr: jobTitleUrl(o.baseUrl, "fr", s.key), en: jobTitleUrl(o.baseUrl, "en", s.key) },
    jsonLd,
    otherHref: jobTitleUrl(o.baseUrl, other, s.key),
    menu: "jobTitles",
    main: [
      `<h1 class="title">${e(title)}</h1>`,
      `<p class="headline">${e(lead)}</p>`,
      `<h2>${l.facts}</h2>`,
      `<p class="lede">${paragraph.map(e).join(" ")}</p>`,
      `<p class="muted">${e(l.rule)}</p>`,
      missionList(s, o.lang),
      profileList(s, o.lang),
      `<h2>${l.faq}</h2>`,
      `<dl class="context">${faq.map((f) => `<div><dt>${e(f.q)}</dt><dd>${e(f.a)}</dd></div>`).join("")}</dl>`,
      `<p class="byline"><time datetime="${isoDay(s.generatedAt)}">${e(l.generated(longDate(s.generatedAt, o.lang)))}</time></p>`,
    ],
  });
};
