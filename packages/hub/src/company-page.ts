import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { pageHead, withBrand } from "./head";
import { monogram } from "./directory-cards";
import { jobCard, JOB_CARD_STYLES } from "./job-card";
import { missionUrl } from "./job-posting";
import { blankState, factLine, LEDGER_STYLES } from "./ledger";
import { isoDay, longDate, marketFooter, marketHeader, type Lang } from "./market-shell";
import { recentPostsSection, type RecentPostItem } from "./post-page";
import { typeset } from "./typography";

/*
 * Page publique d'une entreprise, qui l'a choisie. Trois registres séparés, jamais mélangés :
 * - ce qui est vérifié par un tiers : l'activité au répertoire officiel, datée (le seul vert de la page) ;
 * - ce que Proofseen mesure : la date d'inscription, le délai médian de réponse aux candidatures avec son n ;
 * - ce que l'entreprise déclare : sa présentation et son site, et la page le dit ; le lien sortant ne transmet rien.
 * Puis ses missions ouvertes, ou un état vide honnête. Pas de logo déposé : un monogramme tiré du nom.
 *
 * Données structurées `Organization`. Aucun script exécutable, le même HTML pour tous.
 */

export interface CompanyPageMission {
  readonly id: string;
  readonly title: string;
  readonly workMode: "onsite" | "hybrid" | "remote";
  readonly city: string | null;
  readonly publishedAt: Date;
}

export interface CompanyPageModel {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly website: string | null;
  readonly city: string | null;
  readonly memberSince: Date;
  readonly registryActiveCheckedAt: Date | null;
  readonly response: { readonly medianDays: number; readonly decided: number } | null;
  readonly missions: readonly CompanyPageMission[];
  /** Publications publiques récentes de l'entreprise (C22). */
  readonly posts?: readonly RecentPostItem[];
  readonly generatedAt: Date;
}

const LABELS = {
  fr: {
    lead: (city: string | null) => (city === null ? "Entreprise qui publie ses missions sur Proofseen." : `Entreprise basée à ${city}, qui publie ses missions sur Proofseen.`),
    back: "Toutes les entreprises",
    trace: (d: string) => `Entreprise · page générée le ${d}`,
    facts: "Ce qui est vérifié",
    factsNote: "Contrôlé par Proofseen auprès du répertoire officiel des entreprises. Le numéro SIRET n'est jamais publié.",
    registry: (d: string) => `Entreprise active au répertoire officiel des entreprises (vérifié le ${d}).`,
    noRegistry: "Activité au répertoire officiel des entreprises non confirmée.",
    measured: "Mesuré sur Proofseen",
    since: (d: string) => `Inscrite sur Proofseen depuis le ${d}.`,
    response: (days: number, n: number) => `Répond aux candidatures en ${days} jour${days > 1 ? "s" : ""} (médiane sur ${n} candidatures, six derniers mois).`,
    about: "Présentation",
    declared: "Texte et site déclarés par l'entreprise.",
    website: "Site de l'entreprise",
    missions: "Missions ouvertes",
    order: "Ordre : date de publication, les plus récentes d'abord.",
    count: (n: number) => (n === 0 ? "Aucune mission ouverte" : n === 1 ? "1 mission ouverte" : `${n} missions ouvertes`),
    none: "Aucune mission ouverte en ce moment.",
    noneWhy: "Ses prochaines missions apparaîtront ici, datées. Suivre l'entreprise vous prévient de chacune.",
    allMissions: "Voir toutes les missions ouvertes",
    follow: "Suivre cette entreprise",
    followHint: "Vous serez prévenu de chaque nouvelle mission (compte Proofseen requis).",
    generated: (d: string) => `Page générée le ${d}.`,
    rail: "Suivre et missions de cette entreprise",
  },
  en: {
    lead: (city: string | null) => (city === null ? "A company posting its missions on Proofseen." : `A company based in ${city}, posting its missions on Proofseen.`),
    back: "All companies",
    trace: (d: string) => `Company · page generated on ${d}`,
    facts: "What is verified",
    factsNote: "Checked by Proofseen against the official French company register. The SIRET number is never published.",
    registry: (d: string) => `Business active in the official French company register (checked on ${d}).`,
    noRegistry: "Not confirmed as active in the official French company register.",
    measured: "Measured on Proofseen",
    since: (d: string) => `On Proofseen since ${d}.`,
    response: (days: number, n: number) => `Answers applications within ${days} day${days > 1 ? "s" : ""} (median over ${n} applications, last six months).`,
    about: "About",
    declared: "Text and website stated by the company.",
    website: "Company website",
    missions: "Open missions",
    order: "Order: publication date, most recent first.",
    count: (n: number) => (n === 0 ? "No open mission" : n === 1 ? "1 open mission" : `${n} open missions`),
    none: "No open mission at the moment.",
    noneWhy: "Its next missions will show here, dated. Following the company tells you about each one.",
    allMissions: "See all open missions",
    follow: "Follow this company",
    followHint: "You will be told about each new mission (Proofseen account required).",
    generated: (d: string) => `Page generated on ${d}.`,
    rail: "Follow and missions of this company",
  },
} as const;

const COMPANY_STYLES =
  ".who{display:flex;align-items:center;gap:var(--ps-space-4);margin-top:var(--ps-space-3)}.who .title{margin-top:0}" +
  ".mono{flex:none;display:grid;place-items:center;width:3.5rem;height:3.5rem;border:1px solid var(--ps-line-strong);border-radius:var(--ps-radius);background:var(--ps-raised);font:var(--ps-weight-display) var(--ps-step-1)/1 var(--ps-font-display)}" +
  ".head .headline{margin-top:var(--ps-space-3)}" +
  ".tally{display:inline-flex;align-items:center;min-height:2.75rem;font:var(--ps-weight-mono) var(--ps-step--2)/1.5 var(--ps-font-mono);color:var(--ps-muted)}" +
  "h3.group{margin:var(--ps-space-6) 0 var(--ps-space-3);font:var(--ps-weight-mono) var(--ps-step--2)/1.3 var(--ps-font-mono);letter-spacing:var(--ps-track-label);text-transform:uppercase;color:var(--ps-muted)}" +
  ".body .lede{max-width:var(--ps-measure)}.body .lede+.lede{margin-top:var(--ps-space-4)}" +
  ".site a{display:inline-flex;align-items:center;min-height:2.75rem}" +
  ".closing{margin-top:var(--ps-space-8);padding-top:var(--ps-space-5);border-top:1px solid var(--ps-line)}";

export const companyUrl = (baseUrl: string, lang: Lang, slug: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/entreprises/${encodeURIComponent(slug)}`;

/** Le texte libre de l'entreprise, en paragraphes : une ligne vide sépare deux paragraphes, rien d'autre n'est interprété. */
const paragraphs = (text: string): string =>
  text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "")
    .map((block) => `<p class="lede">${e(block).replace(/\n/g, "<br>")}</p>`)
    .join("\n");

/** Le registre : le fait vérifié (vert, daté) ou l'absence de confirmation (neutre), puis ce que Proofseen mesure. */
const register = (c: CompanyPageModel, lang: Lang): string => {
  const l = LABELS[lang];
  const registry = c.registryActiveCheckedAt === null ? factLine(l.noRegistry, false, "li") : factLine(l.registry(longDate(c.registryActiveCheckedAt, lang)), true, "li");
  const measured = [l.since(longDate(c.memberSince, lang)), ...(c.response === null ? [] : [l.response(c.response.medianDays, c.response.decided)])];
  return (
    `<section aria-labelledby="verifie"><h2 class="part" id="verifie">${l.facts}</h2><p class="part-note">${l.factsNote}</p><ul class="lines">${registry}</ul>` +
    `<h3 class="group">${l.measured}</h3><ul class="lines">${measured.map((m) => factLine(m, false, "li")).join("")}</ul></section>`
  );
};

const about = (c: CompanyPageModel, lang: Lang): string => {
  const l = LABELS[lang];
  if (c.description === null && c.website === null) return "";
  return [
    `<section aria-labelledby="presentation"><h2 class="part" id="presentation">${l.about}</h2>`,
    `<p class="part-note">${l.declared}</p>`,
    c.description === null ? "" : paragraphs(c.description),
    c.website === null ? "" : `<p class="site"><a href="${e(c.website)}" rel="nofollow noopener noreferrer">${l.website}</a></p>`,
    "</section>",
  ].join("\n");
};

const missionList = (c: CompanyPageModel, lang: Lang): string => {
  const l = LABELS[lang];
  const body =
    c.missions.length === 0
      ? blankState(l.none, l.noneWhy, [{ text: l.allMissions, href: `/${lang}/missions` }])
      : `<p class="trace">${l.order}</p><ul class="entries missions">${c.missions.map((m) => jobCard(m, lang)).join("")}</ul>`;
  return `<section aria-labelledby="missions"><h2 class="part" id="missions">${l.missions}</h2>${body}</section>`;
};

export const companyJsonLd = (c: CompanyPageModel, o: { readonly baseUrl: string; readonly lang: Lang }): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: c.name,
  url: companyUrl(o.baseUrl, o.lang, c.slug),
  ...(c.description === null ? {} : { description: c.description }),
  ...(c.website === null ? {} : { sameAs: [c.website] }),
  ...(c.city === null ? {} : { address: { "@type": "PostalAddress", addressLocality: c.city, addressCountry: "FR" } }),
  ...(c.missions.length === 0
    ? {}
    : { subjectOf: c.missions.map((m) => ({ "@type": "JobPosting", title: m.title, url: missionUrl(o.baseUrl, o.lang, m.id), datePosted: isoDay(m.publishedAt) })) }),
});

export const renderCompanyPage = (c: CompanyPageModel, o: { readonly baseUrl: string; readonly lang: Lang }): string => {
  const l = LABELS[o.lang];
  const other: Lang = o.lang === "fr" ? "en" : "fr";
  const url = companyUrl(o.baseUrl, o.lang, c.slug);
  const lead = l.lead(c.city);
  const follow = `<a class="cta" href="${e(`/${o.lang}/app/entreprises-suivies?suivre=${encodeURIComponent(c.slug)}`)}" rel="nofollow">${l.follow}</a>`;
  return typeset(
    o.lang,
    [
      "<!doctype html>",
      `<html lang="${o.lang}">`,
      "<head>",
      ...pageHead({ lang: o.lang, title: withBrand(c.name), description: `${c.name} · ${lead}`.slice(0, 160), canonical: url }),
      `<link rel="alternate" hreflang="fr" href="${e(companyUrl(o.baseUrl, "fr", c.slug))}">`,
      `<link rel="alternate" hreflang="en" href="${e(companyUrl(o.baseUrl, "en", c.slug))}">`,
      `<link rel="alternate" hreflang="x-default" href="${e(companyUrl(o.baseUrl, "fr", c.slug))}">`,
      `<style>${STYLES}${LEDGER_STYLES}${JOB_CARD_STYLES}${COMPANY_STYLES}</style>`,
      `<script type="application/ld+json">${safeJsonLd(companyJsonLd(c, o))}</script>`,
      "</head>",
      "<body>",
      marketHeader(o.lang, companyUrl(o.baseUrl, other, c.slug), "companies"),
      '<main id="contenu" class="sheet">',
      `<header class="head"><a class="crumb" href="/${o.lang}/entreprises">← ${l.back}</a>`,
      `<p class="ref"><time datetime="${isoDay(c.generatedAt)}">${e(l.trace(longDate(c.generatedAt, o.lang)))}</time></p>`,
      `<div class="who"><span class="mono" aria-hidden="true">${e(monogram(c.slug, c.name))}</span><h1 class="title">${e(c.name)}</h1></div>`,
      `<p class="headline">${e(lead)}</p></header>`,
      `<aside class="rail" aria-label="${l.rail}">${follow}<p class="rail-note">${l.followHint}</p><a class="tally" href="#missions">${l.count(c.missions.length)}</a></aside>`,
      '<div class="body">',
      register(c, o.lang),
      about(c, o.lang),
      missionList(c, o.lang),
      recentPostsSection(c.posts, o.lang),
      `<p class="closing trace"><time datetime="${isoDay(c.generatedAt)}">${e(l.generated(longDate(c.generatedAt, o.lang)))}</time></p>`,
      "</div>",
      "</main>",
      marketFooter(o.lang),
      "</body>",
      "</html>",
      "",
    ].join("\n"),
  );
};

export const companySitemap = (baseUrl: string, items: readonly { readonly slug: string; readonly updatedAt: Date }[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items.flatMap((item) => (["fr", "en"] as const).map((lang) => `<url><loc>${e(companyUrl(baseUrl, lang, item.slug))}</loc><lastmod>${isoDay(item.updatedAt)}</lastmod></url>`)),
    "</urlset>",
    "",
  ].join("\n");
