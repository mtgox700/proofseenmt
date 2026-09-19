import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { availabilityText, formatDate, formatMonth, LABELS } from "./i18n";
import type { HubProfile, Locale, Mission } from "./schema";

const OTHER: Readonly<Record<Locale, Locale>> = { fr: "en", en: "fr" };

/** Site-relative path of a page: "/" or "/en/", "/missions/<slug>/" or "/en/missions/<slug>/". */
export const pagePath = (locale: Locale, slug: string | null): string =>
  `${locale === "en" ? "/en" : ""}/${slug === null ? "" : `missions/${slug}/`}`;

interface LayoutInput {
  readonly profile: HubProfile;
  readonly locale: Locale;
  readonly slug: string | null;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly jsonLd: unknown | null;
}

const layout = ({ profile, locale, slug, title, description, body, jsonLd }: LayoutInput): string => {
  const url = (l: Locale) => `${profile.baseUrl}${pagePath(l, slug)}`;
  return [
    "<!doctype html>",
    `<html lang="${locale}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(description)}">`,
    `<link rel="canonical" href="${e(url(locale))}">`,
    `<link rel="alternate" hreflang="fr" href="${e(url("fr"))}">`,
    `<link rel="alternate" hreflang="en" href="${e(url("en"))}">`,
    `<link rel="alternate" hreflang="x-default" href="${e(url("fr"))}">`,
    `<style>${STYLES}</style>`,
    jsonLd === null ? "" : `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
    "</head>",
    "<body>",
    "<main>",
    body,
    `<p class="muted"><a href="${e(pagePath(OTHER[locale], slug))}" hreflang="${OTHER[locale]}">${LABELS[locale].otherLang}</a></p>`,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
};

const tags = (items: readonly string[]): string => `<ul class="tags">${items.map((i) => `<li>${e(i)}</li>`).join("")}</ul>`;

const links = (items: HubProfile["person"]["links"]): string =>
  `<ul>${items.map((l) => `<li><a href="${e(l.url)}" rel="me">${e(l.label)}</a></li>`).join("")}</ul>`;

const period = (m: Mission, locale: Locale): string =>
  `${formatMonth(m.period.from, locale)} – ${m.period.to === null ? LABELS[locale].ongoing : formatMonth(m.period.to, locale)}`;

const personJsonLd = (p: HubProfile, locale: Locale) => ({
  "@context": "https://schema.org",
  "@type": "Person",
  name: p.person.name,
  jobTitle: p.person.headline[locale],
  address: { "@type": "PostalAddress", addressLocality: p.person.city },
  url: `${p.baseUrl}${pagePath(locale, null)}`,
  sameAs: p.person.links.map((l) => l.url),
  knowsAbout: p.person.stack,
});

export const renderHome = (p: HubProfile, locale: Locale): string => {
  const l = LABELS[locale];
  const rate = p.rate === null ? "" : `<p>${e(l.rate(p.rate.min, p.rate.max))}</p>`;
  const contact = p.person.contactEmail === null ? "" : `<h2>${l.contact}</h2><p><a href="mailto:${e(p.person.contactEmail)}">${e(p.person.contactEmail)}</a></p>`;
  const missions = p.missions
    .map(
      (m) =>
        `<div class="card"><h3><a href="${e(pagePath(locale, m.slug))}">${e(m.title[locale])}</a></h3><p class="muted">${e(m.client[locale])} · ${e(period(m, locale))}</p><p>${e(m.summary[locale])}</p></div>`,
    )
    .join("\n");
  const body = [
    `<h1>${e(p.person.name)}</h1>`,
    `<p><strong>${e(p.person.headline[locale])}</strong></p>`,
    `<p>${e(p.person.city)} · ${e(p.person.workMode[locale])}</p>`,
    `<p class="status">${e(availabilityText(p, locale))}</p>`,
    `<p class="muted">${e(l.updated(formatDate(p.availability.updatedAt, locale)))}</p>`,
    rate,
    `<h2>${l.about}</h2><p>${e(p.person.summary[locale])}</p>`,
    `<h2>${l.stack}</h2>${tags(p.person.stack)}`,
    p.missions.length === 0 ? "" : `<h2>${l.missions}</h2>\n${missions}`,
    p.person.links.length === 0 ? "" : `<h2>${l.links}</h2>${links(p.person.links)}`,
    contact,
  ].join("\n");
  return layout({
    profile: p,
    locale,
    slug: null,
    title: `${p.person.name} — ${p.person.headline[locale]}`,
    description: `${p.person.headline[locale]} · ${p.person.city} · ${availabilityText(p, locale)}`,
    body,
    jsonLd: personJsonLd(p, locale),
  });
};

export const renderMission = (p: HubProfile, m: Mission, locale: Locale): string => {
  const l = LABELS[locale];
  const facts =
    m.facts.length === 0
      ? ""
      : `<h2>${l.facts}</h2><table><thead><tr><th>${l.fact}</th><th>${l.value}</th><th>${l.source}</th></tr></thead><tbody>${m.facts
          .map((f) => `<tr><td>${e(f.label[locale])}</td><td>${e(f.value)}</td><td>${e(f.source)}</td></tr>`)
          .join("")}</tbody></table>`;
  const body = [
    `<p><a href="${e(pagePath(locale, null))}">← ${l.back}</a></p>`,
    `<h1>${e(m.title[locale])}</h1>`,
    `<p class="muted">${e(p.person.name)} · ${e(p.person.headline[locale])}</p>`,
    `<table><tbody><tr><th>${l.client}</th><td>${e(m.client[locale])}</td></tr><tr><th>${l.period}</th><td>${e(period(m, locale))}</td></tr><tr><th>${l.role}</th><td>${e(m.role[locale])}</td></tr></tbody></table>`,
    `<p>${e(m.summary[locale])}</p>`,
    facts,
    m.stack.length === 0 ? "" : `<h2>${l.stack}</h2>${tags(m.stack)}`,
    m.links.length === 0 ? "" : `<h2>${l.links}</h2>${links(m.links)}`,
  ].join("\n");
  return layout({
    profile: p,
    locale,
    slug: m.slug,
    title: `${m.title[locale]} — ${p.person.name}`,
    description: m.summary[locale].slice(0, 160),
    body,
    jsonLd: null,
  });
};
