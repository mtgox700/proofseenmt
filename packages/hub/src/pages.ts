import { escapeHtml as e, safeJsonLd, STYLES } from "./html";
import { availabilityText, formatDate, formatMonth, LABELS } from "./i18n";
import type { HubProfile, Locale, Mission } from "./schema";

const OTHER: Readonly<Record<Locale, Locale>> = { fr: "en", en: "fr" };

/** Inline SVG favicon (the interval glyph): no extra request, and no 404 on /favicon.ico in the console. */
export const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#070b14"/>' +
      '<path d="M9 12v16M31 12v16M9 20h22" fill="none" stroke="#edf1f7" stroke-width="3" stroke-linecap="round"/><circle cx="22" cy="20" r="5" fill="#3fcf9c"/></svg>',
  );

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
  const other = OTHER[locale];
  return [
    "<!doctype html>",
    `<html lang="${locale}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    '<meta name="theme-color" content="#070b14">',
    `<link rel="icon" href="${FAVICON}">`,
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
    `<header class="top"><div class="wrap"><a class="me" href="${e(pagePath(locale, null))}">${e(profile.person.name)}</a>` +
      `<a class="lang" href="${e(pagePath(other, slug))}" hreflang="${other}" lang="${other}">${LABELS[locale].otherLang}</a></div></header>`,
    '<main class="wrap">',
    body,
    "</main>",
    `<footer class="foot"><div class="wrap"><p>${e(profile.person.name)} · ${e(profile.person.headline[locale])}</p>` +
      `<p>${e(LABELS[locale].updated(formatDate(profile.availability.updatedAt, locale)))}</p></div></footer>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
};

const tags = (items: readonly string[]): string => `<ul class="tags">${items.map((i) => `<li>${e(i)}</li>`).join("")}</ul>`;

const links = (items: HubProfile["person"]["links"]): string =>
  `<ul class="links">${items.map((l) => `<li><a href="${e(l.url)}" rel="me">${e(l.label)}</a></li>`).join("")}</ul>`;

const period = (m: Mission, locale: Locale): string =>
  `${formatMonth(m.period.from, locale)} – ${m.period.to === null ? LABELS[locale].ongoing : formatMonth(m.period.to, locale)}`;

/** Availability pill; "unavailable" is shown in the warning colour, never hidden. */
const status = (p: HubProfile, locale: Locale): string =>
  `<p class="status${p.availability.status === "unavailable" ? " off" : ""}"><i></i>${e(availabilityText(p, locale))}</p>`;

/** Counts derived from the profile itself (never typed by hand): the claim can't drift from the pages. */
const proof = (p: HubProfile, locale: Locale): string => {
  const facts = p.missions.reduce((n, m) => n + m.facts.length, 0);
  return facts === 0 ? "" : `<p class="proof">${e(LABELS[locale].proof(p.missions.length, facts))}</p>`;
};

/** The mission's first verifiable fact, surfaced on the profile card: the proof before the prose. */
const leadFact = (m: Mission, locale: Locale): string => {
  const f = m.facts[0];
  return f === undefined ? "" : `<p class="lead"><b>${e(f.value)}</b><span>${e(f.label[locale])}</span></p>`;
};

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
  const cta =
    p.person.contactEmail === null ? "" : `<a class="cta" href="mailto:${e(p.person.contactEmail)}">${l.contact} · ${e(p.person.contactEmail)}</a>`;
  const missions = p.missions
    .map(
      (m) =>
        `<li class="card"><h3><a href="${e(pagePath(locale, m.slug))}">${e(m.title[locale])}</a></h3>` +
        `<p class="when">${e(m.client[locale])} · ${e(period(m, locale))}</p><p>${e(m.summary[locale])}</p>${leadFact(m, locale)}</li>`,
    )
    .join("\n");
  const body = [
    '<section class="intro">',
    status(p, locale),
    `<h1>${e(p.person.name)}</h1>`,
    `<p class="headline">${e(p.person.headline[locale])}</p>`,
    `<p class="meta">${e(p.person.city)} · ${e(p.person.workMode[locale])}</p>`,
    `<div class="keys">${proof(p, locale)}${rate}<p>${e(l.updated(formatDate(p.availability.updatedAt, locale)))}</p></div>`,
    cta,
    "</section>",
    `<h2>${l.about}</h2><p class="lede">${e(p.person.summary[locale])}</p>`,
    p.missions.length === 0 ? "" : `<h2>${l.missions}</h2>\n<ol class="missions">${missions}</ol>`,
    `<h2>${l.stack}</h2>${tags(p.person.stack)}`,
    p.person.links.length === 0 ? "" : `<h2>${l.links}</h2>${links(p.person.links)}`,
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
  // Each fact: its value (shown first and big), what it measures, and where anyone can check it. dt/dd keep the pairing.
  const facts =
    m.facts.length === 0
      ? ""
      : `<h2>${l.facts}</h2><dl class="facts">${m.facts
          .map((f) => `<div class="fact"><dt>${e(f.label[locale])}</dt><dd class="v">${e(f.value)}</dd><dd class="src">${l.source} ${e(f.source)}</dd></div>`)
          .join("")}</dl>`;
  // Only this person's other missions: a profile page never sends the reader to someone else (research/MALT_VEILLE §2.3).
  const others = p.missions.filter((o) => o.slug !== m.slug);
  const more =
    others.length === 0
      ? ""
      : `<h2>${l.otherMissions}</h2><ul class="more">${others
          .map((o) => `<li><a href="${e(pagePath(locale, o.slug))}">${e(o.title[locale])}<small>${e(period(o, locale))}</small></a></li>`)
          .join("")}</ul>`;
  const body = [
    `<a class="crumb" href="${e(pagePath(locale, null))}">← ${l.back}</a>`,
    `<h1 class="title">${e(m.title[locale])}</h1>`,
    `<p class="byline">${e(p.person.name)} · ${e(p.person.headline[locale])}</p>`,
    `<dl class="context"><div><dt>${l.client}</dt><dd>${e(m.client[locale])}</dd></div>` +
      `<div><dt>${l.period}</dt><dd>${e(period(m, locale))}</dd></div><div><dt>${l.role}</dt><dd>${e(m.role[locale])}</dd></div></dl>`,
    `<p class="lede">${e(m.summary[locale])}</p>`,
    facts,
    m.stack.length === 0 ? "" : `<h2>${l.stack}</h2>${tags(m.stack)}`,
    m.links.length === 0 ? "" : `<h2>${l.links}</h2>${links(m.links)}`,
    more,
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
