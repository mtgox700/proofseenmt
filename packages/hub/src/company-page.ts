import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { pageHead, withBrand } from "./head";
import { missionUrl } from "./job-posting";
import { isoDay, longDate, marketFooter, marketHeader, type Lang } from "./market-shell";
import { recentPostsSection, type RecentPostItem } from "./post-page";

/*
 * Page publique d'une entreprise, qui l'a choisie. Des faits datés seulement : active au répertoire officiel (date du
 * contrôle), inscrite sur Proofseen depuis, délai médian de réponse aux candidatures (avec son n), missions ouvertes.
 * La présentation et le site sont déclarés par l'entreprise, et la page le dit ; le lien sortant ne transmet rien.
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
    facts: "Faits vérifiés",
    registry: (d: string) => `Entreprise active au répertoire officiel des entreprises (vérifié le ${d}).`,
    noRegistry: "Contrôle au répertoire officiel des entreprises pas encore fait.",
    since: (d: string) => `Inscrite sur Proofseen depuis le ${d}.`,
    response: (days: number, n: number) => `Répond aux candidatures en ${days} jour${days > 1 ? "s" : ""} (médiane sur ${n} candidatures, six derniers mois).`,
    about: "Présentation",
    declared: "Texte et site déclarés par l'entreprise.",
    website: "Site de l'entreprise",
    missions: "Missions ouvertes",
    order: "Ordre : date de publication, les plus récentes d'abord.",
    none: "Aucune mission ouverte en ce moment.",
    modes: { remote: "Télétravail", hybrid: "Hybride", onsite: "Sur site" },
    published: (d: string) => `publiée le ${d}`,
    follow: "Suivre cette entreprise",
    followHint: "Vous serez prévenu de chaque nouvelle mission (compte Proofseen requis).",
    generated: (d: string) => `Page générée le ${d}.`,
    all: "Toutes les missions",
  },
  en: {
    lead: (city: string | null) => (city === null ? "A company posting its missions on Proofseen." : `A company based in ${city}, posting its missions on Proofseen.`),
    facts: "Verified facts",
    registry: (d: string) => `Business active in the official French company register (checked on ${d}).`,
    noRegistry: "Not yet checked against the official French company register.",
    since: (d: string) => `On Proofseen since ${d}.`,
    response: (days: number, n: number) => `Answers applications within ${days} day${days > 1 ? "s" : ""} (median over ${n} applications, last six months).`,
    about: "About",
    declared: "Text and website stated by the company.",
    website: "Company website",
    missions: "Open missions",
    order: "Order: publication date, most recent first.",
    none: "No open mission at the moment.",
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On site" },
    published: (d: string) => `posted on ${d}`,
    follow: "Follow this company",
    followHint: "You will be told about each new mission (Proofseen account required).",
    generated: (d: string) => `Page generated on ${d}.`,
    all: "All missions",
  },
} as const;

export const companyUrl = (baseUrl: string, lang: Lang, slug: string): string => `${baseUrl.replace(/\/$/, "")}/${lang}/entreprises/${encodeURIComponent(slug)}`;

/** Le texte libre de l'entreprise, en paragraphes : une ligne vide sépare deux paragraphes, rien d'autre n'est interprété. */
const paragraphs = (text: string): string =>
  text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "")
    .map((block) => `<p class="lede">${e(block).replace(/\n/g, "<br>")}</p>`)
    .join("\n");

const factList = (c: CompanyPageModel, lang: Lang): readonly string[] => {
  const l = LABELS[lang];
  return [
    c.registryActiveCheckedAt === null ? l.noRegistry : l.registry(longDate(c.registryActiveCheckedAt, lang)),
    l.since(longDate(c.memberSince, lang)),
    ...(c.response === null ? [] : [l.response(c.response.medianDays, c.response.decided)]),
  ];
};

const missionList = (c: CompanyPageModel, lang: Lang): string => {
  const l = LABELS[lang];
  if (c.missions.length === 0) return `<p class="muted">${l.none}</p>`;
  const items = c.missions.map((m) => {
    const where = m.workMode === "remote" || m.city === null ? l.modes[m.workMode] : `${m.city} · ${l.modes[m.workMode]}`;
    return (
      `<li class="card"><h3><a href="${e(`/${lang}/missions/${m.id}`)}">${e(m.title)}</a></h3>` +
      `<p class="when">${e(where)} · <time datetime="${isoDay(m.publishedAt)}">${e(l.published(longDate(m.publishedAt, lang)))}</time></p></li>`
    );
  });
  return `<p class="muted">${l.order}</p><ul class="missions">${items.join("")}</ul>`;
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
  const about =
    c.description === null && c.website === null
      ? ""
      : [
          `<h2>${l.about}</h2>`,
          c.description === null ? "" : paragraphs(c.description),
          c.website === null ? "" : `<p><a href="${e(c.website)}" rel="nofollow noopener noreferrer">${l.website}</a></p>`,
          `<p class="muted">${l.declared}</p>`,
        ].join("\n");
  return [
    "<!doctype html>",
    `<html lang="${o.lang}">`,
    "<head>",
    ...pageHead({ lang: o.lang, title: withBrand(c.name), description: `${c.name} · ${lead}`.slice(0, 160), canonical: url }),
    `<link rel="alternate" hreflang="fr" href="${e(companyUrl(o.baseUrl, "fr", c.slug))}">`,
    `<link rel="alternate" hreflang="en" href="${e(companyUrl(o.baseUrl, "en", c.slug))}">`,
    `<style>${STYLES}</style>`,
    `<script type="application/ld+json">${safeJsonLd(companyJsonLd(c, o))}</script>`,
    "</head>",
    "<body>",
    marketHeader(o.lang, companyUrl(o.baseUrl, other, c.slug)),
    '<main id="contenu" class="wrap">',
    `<a class="crumb" href="/${o.lang}/missions">← ${l.all}</a>`,
    `<h1 class="title">${e(c.name)}</h1>`,
    `<p class="headline">${e(lead)}</p>`,
    `<h2>${l.facts}</h2>`,
    `<ul class="links">${factList(c, o.lang).map((f) => `<li><p>${e(f)}</p></li>`).join("")}</ul>`,
    about,
    `<h2>${l.missions}</h2>`,
    missionList(c, o.lang),
    recentPostsSection(c.posts, o.lang),
    `<p><a class="cta" href="${e(`/${o.lang}/app/entreprises-suivies?suivre=${encodeURIComponent(c.slug)}`)}" rel="nofollow">${l.follow}</a></p>`,
    `<p class="muted">${l.followHint}</p>`,
    `<p class="byline"><time datetime="${isoDay(c.generatedAt)}">${e(l.generated(longDate(c.generatedAt, o.lang)))}</time></p>`,
    "</main>",
    marketFooter(o.lang),
    "</body>",
    "</html>",
    "",
  ].join("\n");
};

export const companySitemap = (baseUrl: string, items: readonly { readonly slug: string; readonly updatedAt: Date }[]): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items.flatMap((item) => (["fr", "en"] as const).map((lang) => `<url><loc>${e(companyUrl(baseUrl, lang, item.slug))}</loc><lastmod>${isoDay(item.updatedAt)}</lastmod></url>`)),
    "</urlset>",
    "",
  ].join("\n");
