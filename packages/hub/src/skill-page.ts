import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { pageHead, withBrand } from "./head";
import { missionUrl } from "./job-posting";
import { isoDay, longDate, marketFooter, marketHeader, money, type Lang } from "./market-shell";
import { profileUrl } from "./profile-page";

/*
 * Page métier : les missions ouvertes et les profils publiés d'une compétence. Elle n'existe que remplie de contenu réel
 * (la base décide) ; ce rendu ne fabrique aucun texte de remplissage. Un freelance pseudonyme y apparaît par sa
 * référence, jamais par son nom.
 *
 * Le paragraphe factuel et la FAQ ne disent que ce que la base a compté au moment du rendu, avec sa date. Une
 * statistique — la fourchette de TJM — n'est écrite qu'à partir de MIN_STAT_SAMPLE valeurs, et toujours avec son n.
 */

export const MIN_STAT_SAMPLE = 5;
const MAX_CITIES = 12;

export interface SkillPageFactsView {
  readonly profileCount: number;
  readonly missionCount: number;
  readonly dailyRate: { readonly n: number; readonly minCents: number; readonly maxCents: number; readonly currency: string } | null;
  readonly cities: readonly string[];
}

export interface SkillPageView {
  readonly key: string;
  readonly label: string;
  readonly missions: readonly { readonly id: string; readonly title: string; readonly organisationName: string; readonly workMode: "onsite" | "hybrid" | "remote"; readonly city: string | null }[];
  readonly profiles: readonly { readonly slug: string; readonly reference: string; readonly displayName: string | null; readonly headline: string; readonly city: string }[];
  readonly facts: SkillPageFactsView;
  readonly generatedAt: Date;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

const LABELS = {
  fr: {
    title: (label: string) => `${label} : missions et freelances`,
    lead: (m: number, p: number) => `${plural(m, "mission ouverte", "missions ouvertes")} et ${plural(p, "profil publié", "profils publiés")} sur Proofseen.`,
    missions: "Missions ouvertes",
    profiles: "Freelances",
    facts: "En bref",
    faq: "Questions fréquentes",
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    pseudonym: (ref: string) => `Freelance ${ref}`,
    count: (label: string, p: number, m: number, when: string) =>
      `Au ${when}, Proofseen compte ${plural(p, "profil publié", "profils publiés")} et ${plural(m, "mission ouverte", "missions ouvertes")} pour la compétence ${label}.`,
    rate: (min: string, max: string, n: number) => `Les TJM affichés par ces profils vont de ${min} à ${max} par jour (n = ${n} profils qui affichent leur TJM).`,
    cities: (list: string, more: number) => `Villes représentées : ${list}${more > 0 ? ` et ${plural(more, "autre", "autres")}` : ""}.`,
    qProfiles: (label: string) => `Combien de freelances ${label} sont publiés sur Proofseen ?`,
    aProfiles: (p: number, when: string) => `${plural(p, "profil publié", "profils publiés")} au ${when}.`,
    qMissions: (label: string) => `Combien de missions ${label} sont ouvertes sur Proofseen ?`,
    aMissions: (m: number, when: string) => `${plural(m, "mission ouverte", "missions ouvertes")} au ${when}.`,
    qRate: (label: string) => `Quel TJM affichent les freelances ${label} sur Proofseen ?`,
    qCities: (label: string) => `Dans quelles villes sont les freelances et les missions ${label} ?`,
    generated: (when: string) => `Page générée le ${when} à partir des profils publiés et des missions ouvertes.`,
  },
  en: {
    title: (label: string) => `${label}: missions and freelancers`,
    lead: (m: number, p: number) => `${plural(m, "open mission", "open missions")} and ${plural(p, "published profile", "published profiles")} on Proofseen.`,
    missions: "Open missions",
    profiles: "Freelancers",
    facts: "In short",
    faq: "Frequently asked questions",
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    pseudonym: (ref: string) => `Freelancer ${ref}`,
    count: (label: string, p: number, m: number, when: string) =>
      `On ${when}, Proofseen lists ${plural(p, "published profile", "published profiles")} and ${plural(m, "open mission", "open missions")} for the skill ${label}.`,
    rate: (min: string, max: string, n: number) => `The day rates shown by these profiles range from ${min} to ${max} (n = ${n} profiles showing their rate).`,
    cities: (list: string, more: number) => `Cities represented: ${list}${more > 0 ? ` and ${plural(more, "other", "others")}` : ""}.`,
    qProfiles: (label: string) => `How many ${label} freelancers are published on Proofseen?`,
    aProfiles: (p: number, when: string) => `${plural(p, "published profile", "published profiles")} on ${when}.`,
    qMissions: (label: string) => `How many ${label} missions are open on Proofseen?`,
    aMissions: (m: number, when: string) => `${plural(m, "open mission", "open missions")} on ${when}.`,
    qRate: (label: string) => `What day rate do ${label} freelancers show on Proofseen?`,
    qCities: (label: string) => `In which cities are the ${label} freelancers and missions?`,
    generated: (when: string) => `Page generated on ${when} from the published profiles and open missions.`,
  },
} as const;

export const skillUrl = (baseUrl: string, lang: Lang, key: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/metiers/${encodeURIComponent(key)}`;

interface Faq {
  readonly q: string;
  readonly a: string;
}

/** Les faits, une phrase chacun, et les mêmes en questions-réponses : rien d'autre que ce que la base a compté. */
const factSentences = (s: SkillPageView, lang: Lang): { readonly paragraph: readonly string[]; readonly faq: readonly Faq[] } => {
  const l = LABELS[lang];
  const when = longDate(s.generatedAt, lang);
  const f = s.facts;
  const rate = f.dailyRate !== null && f.dailyRate.n >= MIN_STAT_SAMPLE ? f.dailyRate : null;
  const rateText = rate === null ? null : l.rate(money(rate.minCents, rate.currency, lang), money(rate.maxCents, rate.currency, lang), rate.n);
  const shown = f.cities.slice(0, MAX_CITIES);
  const citiesText = shown.length === 0 ? null : l.cities(shown.join(", "), f.cities.length - shown.length);
  return {
    paragraph: [l.count(s.label, f.profileCount, f.missionCount, when), ...(rateText === null ? [] : [rateText]), ...(citiesText === null ? [] : [citiesText])],
    faq: [
      { q: l.qProfiles(s.label), a: l.aProfiles(f.profileCount, when) },
      { q: l.qMissions(s.label), a: l.aMissions(f.missionCount, when) },
      ...(rateText === null ? [] : [{ q: l.qRate(s.label), a: rateText }]),
      ...(citiesText === null ? [] : [{ q: l.qCities(s.label), a: citiesText }]),
    ],
  };
};

const missionList = (s: SkillPageView, lang: Lang): string => {
  const l = LABELS[lang];
  if (s.missions.length === 0) return "";
  const items = s.missions.map((m) => {
    const where = m.workMode === "remote" || m.city === null ? l.modes[m.workMode] : `${m.city} · ${l.modes[m.workMode]}`;
    return `<li class="card"><h3><a href="${e(`/${lang}/missions/${m.id}`)}">${e(m.title)}</a></h3><p class="when">${e(m.organisationName)} · ${e(where)}</p></li>`;
  });
  return `<h2>${l.missions}</h2><ul class="missions">${items.join("")}</ul>`;
};

const profileList = (s: SkillPageView, lang: Lang): string => {
  const l = LABELS[lang];
  if (s.profiles.length === 0) return "";
  const items = s.profiles.map(
    (p) => `<li class="card"><h3><a href="${e(`/${lang}/profils/${p.slug}`)}">${e(p.displayName ?? l.pseudonym(p.reference))}</a></h3><p class="when">${e(p.headline)} · ${e(p.city)}</p></li>`,
  );
  return `<h2>${l.profiles}</h2><ul class="missions">${items.join("")}</ul>`;
};

export const renderSkillPage = (s: SkillPageView, o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const title = l.title(s.label);
  const url = skillUrl(o.baseUrl, o.lang, s.key);
  const { paragraph, faq } = factSentences(s, o.lang);
  const urls = [...s.missions.map((m) => missionUrl(o.baseUrl, o.lang, m.id)), ...s.profiles.map((p) => profileUrl(o.baseUrl, o.lang, p.slug))];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: title,
        url,
        about: s.label,
        dateModified: isoDay(s.generatedAt),
        mainEntity: { "@type": "ItemList", numberOfItems: urls.length, itemListElement: urls.map((u, i) => ({ "@type": "ListItem", position: i + 1, url: u })) },
      },
      {
        "@type": "FAQPage",
        url,
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    ...pageHead({ lang: o.lang, title: withBrand(title), description: l.lead(s.facts.missionCount, s.facts.profileCount), canonical: url }),
    `<link rel="alternate" hreflang="fr" href="${e(skillUrl(o.baseUrl, "fr", s.key))}">`,
    `<link rel="alternate" hreflang="en" href="${e(skillUrl(o.baseUrl, "en", s.key))}">`,
    `<link rel="alternate" hreflang="x-default" href="${e(skillUrl(o.baseUrl, "fr", s.key))}">`,
    `<style>${STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, skillUrl(o.baseUrl, other, s.key)),
    '<main id="contenu" class="wrap">',
    `<h1 class="title">${e(title)}</h1>`,
    `<p class="headline">${e(l.lead(s.facts.missionCount, s.facts.profileCount))}</p>`,
    `<h2>${l.facts}</h2>`,
    `<p class="lede">${paragraph.map(e).join(" ")}</p>`,
    missionList(s, o.lang),
    profileList(s, o.lang),
    `<h2>${l.faq}</h2>`,
    `<dl class="context">${faq.map((f) => `<div><dt>${e(f.q)}</dt><dd>${e(f.a)}</dd></div>`).join("")}</dl>`,
    `<p class="byline"><time datetime="${isoDay(s.generatedAt)}">${e(l.generated(longDate(s.generatedAt, o.lang)))}</time></p>`,
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};

export const skillSitemap = (baseUrl: string, items: readonly { readonly key: string }[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items.flatMap((item) => (["fr", "en"] as const).map((lang) => `<url><loc>${e(skillUrl(baseUrl, lang, item.key))}</loc></url>`)),
    "</urlset>",
    "",
  ].join("\n");
