import { escapeHtml as e } from "@proofseen/hub";
import type { PublicProfile } from "./identity";

/*
 * Public pages of a pseudonymous profile (ARCHITECTURE_ANONYME §2). Static HTML, zero JavaScript, system fonts, no
 * network request: what a crawler reads is exactly what a visitor reads. Every value in the JSON-LD is also on screen,
 * as Google's structured-data policy requires.
 */

export type Locale = "fr" | "en";
export const LOCALES: readonly Locale[] = ["fr", "en"];

export interface IntentRef {
  readonly path: string;
  readonly label: string;
}

export const STYLES = `
:root{--bg:#070b14;--surface:#0e1626;--ink:#edf1f7;--muted:#a3aec2;--line:#1f2a40;--strong:#7c8aa8;--accent:#3fcf9c;--on-accent:#06110c;--warn:#f5a524;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:radial-gradient(50rem 28rem at 85% -6rem,color-mix(in srgb,var(--accent) 12%,transparent),transparent 70%),var(--bg);color:var(--ink);font:1.0625rem/1.6 var(--sans)}
a{color:inherit}a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.wrap{width:min(100% - 2rem,58rem);margin-inline:auto}
.top{border-bottom:1px solid var(--line)}
.top .wrap{display:flex;justify-content:space-between;align-items:center;gap:1rem;min-height:3.5rem;font-size:.9rem}
.top a{text-decoration:none}
main{padding-block:clamp(2rem,6vh,4rem) 4rem}
h1,h2,h3{font-family:var(--serif);font-weight:600;margin:0;letter-spacing:-.015em}
h1{font-size:clamp(2.2rem,1.6rem + 3vw,3.4rem);line-height:1.05}
h2{display:flex;align-items:center;gap:.6rem;margin:3rem 0 1.2rem;font:500 .78rem/1.2 var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--accent)}
h2::before{content:"";width:1rem;height:.6rem;border-inline:2px solid currentColor;background:linear-gradient(currentColor,currentColor) center/100% 1px no-repeat}
h3{font-size:1.2rem}
p{margin:0}
.muted{color:var(--muted)}
.id{margin-top:.7rem;font:500 .78rem/1 var(--mono);color:var(--muted);letter-spacing:.06em}
.status{display:inline-flex;align-items:center;gap:.5rem;margin-bottom:1.2rem;padding:.3rem .75rem;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));border-radius:999px;font:500 .82rem/1.2 var(--mono);color:var(--accent)}
.status.off{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,var(--line))}
.status i{width:.5rem;height:.5rem;border-radius:50%;background:currentColor}
.headline{margin-top:.9rem;font-size:1.2rem;line-height:1.45;color:var(--muted);max-width:42rem}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1px;margin:2rem 0;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.facts div{background:var(--surface);padding:.9rem 1rem}
.facts dt{font:500 .7rem/1.2 var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.facts dd{margin:.35rem 0 0;font-weight:600}
.lede{font-size:1.1rem;line-height:1.7;max-width:44rem}
ul.tags{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.5rem}
ul.tags li,ul.tags a{border:1px solid var(--line);border-radius:8px;padding:.3rem .7rem;background:var(--surface);font:500 .85rem/1.3 var(--mono);text-decoration:none;display:inline-block}
ul.tags a:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.cta{display:inline-flex;align-items:center;gap:.5rem;margin-top:2rem;padding:.85rem 1.3rem;border-radius:999px;background:var(--accent);color:var(--on-accent);font-weight:600;text-decoration:none}
.cards{list-style:none;margin:0;padding:0;display:grid;gap:1rem}
.card{display:grid;gap:.5rem;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:1.2rem 1.3rem}
.card a{text-decoration:none}
.card .meta{font:500 .78rem/1.3 var(--mono);color:var(--muted)}
.foot{border-top:1px solid var(--line);padding-block:2rem;font-size:.85rem;color:var(--muted)}
`;

const LABELS = {
  fr: {
    brand: "Proofseen",
    other: "English version",
    available: "Disponible",
    availableFrom: (d: string) => `Disponible à partir du ${d}`,
    unavailable: "Indisponible pour le moment",
    seniority: "Expérience",
    area: "Zone",
    rate: "TJM",
    missions: "Missions vérifiées",
    updated: (d: string) => `Mis à jour le ${d}`,
    about: "Profil",
    skills: "Compétences",
    sectors: "Secteurs",
    related: "Recherches associées",
    contact: "Demander ce profil",
    contactNote: "Le contact passe par Proofseen : nous transmettons la demande au freelance, qui reste anonyme jusqu'à son accord.",
    profiles: "Profils",
    intentTitle: (skill: string, area: string) => `Freelances ${skill} — ${area}`,
    homeTitle: "Profils vérifiés",
    perDay: "€ HT / jour",
    why: "Pourquoi ce profil est anonyme",
    whyText: "L'identité réelle n'est jamais publiée. Elle est communiquée à l'entreprise uniquement après accord du freelance, avant tout engagement.",
  },
  en: {
    brand: "Proofseen",
    other: "Version française",
    available: "Available",
    availableFrom: (d: string) => `Available from ${d}`,
    unavailable: "Not available at the moment",
    seniority: "Experience",
    area: "Area",
    rate: "Day rate",
    missions: "Verified missions",
    updated: (d: string) => `Updated on ${d}`,
    about: "Profile",
    skills: "Skills",
    sectors: "Sectors",
    related: "Related searches",
    contact: "Request this profile",
    contactNote: "Contact goes through Proofseen: we pass the request to the freelancer, who stays anonymous until they agree.",
    profiles: "Profiles",
    intentTitle: (skill: string, area: string) => `${skill} freelancers — ${area}`,
    homeTitle: "Verified profiles",
    perDay: "€ excl. VAT / day",
    why: "Why this profile is anonymous",
    whyText: "The real identity is never published. It is shared with the company only after the freelancer agrees, before any commitment.",
  },
} as const;

const OTHER: Readonly<Record<Locale, Locale>> = { fr: "en", en: "fr" };

export const profilePath = (locale: Locale, id: string): string => `${locale === "en" ? "/en" : ""}/p/${id}/`;
export const intentPath = (locale: Locale, slug: string): string => `${locale === "en" ? "/en" : ""}/${locale === "en" ? "freelancers" : "freelances"}/${slug}/`;
export const homePath = (locale: Locale): string => (locale === "en" ? "/en/" : "/");
export const contactPath = (locale: Locale): string => `${locale === "en" ? "/en" : ""}/contact/`;

interface LayoutInput {
  readonly locale: Locale;
  readonly baseUrl: string;
  readonly path: string;
  readonly otherPath: string;
  readonly title: string;
  readonly description: string;
  readonly noindex: boolean;
  readonly body: string;
  readonly jsonLd?: unknown;
}

const layout = ({ locale, baseUrl, path, otherPath, title, description, noindex, body, jsonLd }: LayoutInput): string => {
  const l = LABELS[locale];
  return [
    "<!doctype html>",
    `<html lang="${locale}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    noindex ? '<meta name="robots" content="noindex">' : "",
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(description)}">`,
    `<link rel="canonical" href="${e(`${baseUrl}${path}`)}">`,
    `<link rel="alternate" hreflang="${locale}" href="${e(`${baseUrl}${path}`)}">`,
    `<link rel="alternate" hreflang="${OTHER[locale]}" href="${e(`${baseUrl}${otherPath}`)}">`,
    `<style>${STYLES}</style>`,
    jsonLd === undefined ? "" : `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
    "</head>",
    "<body>",
    `<header class="top"><div class="wrap"><a href="${homePath(locale)}"><strong>${l.brand}</strong></a>` +
      `<a href="${otherPath}" hreflang="${OTHER[locale]}" lang="${OTHER[locale]}">${l.other}</a></div></header>`,
    '<main class="wrap">',
    body,
    "</main>",
    `<footer class="foot"><div class="wrap"><p>${l.brand} — ${e(l.whyText)}</p></div></footer>`,
    "</body>",
    "</html>",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
};

const availabilityText = (p: PublicProfile, locale: Locale): string => {
  const l = LABELS[locale];
  if (p.availability.status === "unavailable") return l.unavailable;
  if (p.availability.status === "available_from" && p.availability.from !== null) return l.availableFrom(p.availability.from);
  return l.available;
};

const personJsonLd = (p: PublicProfile, locale: Locale, baseUrl: string) => ({
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  dateModified: p.availability.updatedAt,
  mainEntity: {
    "@type": "Person",
    // Google allows a handle as `name` when it is the only identifier used on the site (ProfilePage doc).
    name: p.handle,
    alternateName: p.handle,
    identifier: p.id,
    description: p.headline[locale],
    knowsAbout: p.skills,
    // No `sameAs`: linking to LinkedIn or GitHub would re-associate the real identity (ARCHITECTURE_ANONYME §3).
  },
  url: `${baseUrl}${profilePath(locale, p.id)}`,
});

export interface ProfilePageInput {
  readonly profile: PublicProfile;
  readonly locale: Locale;
  readonly baseUrl: string;
  readonly intents: readonly IntentRef[];
  readonly noindex: boolean;
}

export const renderProfilePage = ({ profile: p, locale, baseUrl, intents, noindex }: ProfilePageInput): string => {
  const l = LABELS[locale];
  const rate = p.rate === null ? "" : `<div><dt>${l.rate}</dt><dd>${p.rate.min}–${p.rate.max} ${l.perDay}</dd></div>`;
  const body = [
    `<p class="status${p.availability.status === "unavailable" ? " off" : ""}"><i></i>${e(availabilityText(p, locale))}</p>`,
    `<h1>${e(p.handle)}</h1>`,
    `<p class="id">${e(p.id)}</p>`,
    `<p class="headline">${e(p.headline[locale])}</p>`,
    `<dl class="facts"><div><dt>${l.seniority}</dt><dd>${e(p.seniority)}</dd></div><div><dt>${l.area}</dt><dd>${e(p.area)}</dd></div>` +
      `${rate}<div><dt>${l.missions}</dt><dd>${p.verifiedMissions}</dd></div></dl>`,
    `<a class="cta" href="${contactPath(locale)}?p=${e(p.id)}">${l.contact} →</a>`,
    `<h2>${l.about}</h2><p class="lede">${e(p.summary[locale])}</p>`,
    `<h2>${l.skills}</h2><ul class="tags">${p.skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`,
    p.sectors.length === 0 ? "" : `<h2>${l.sectors}</h2><ul class="tags">${p.sectors.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`,
    intents.length === 0
      ? ""
      : `<h2>${l.related}</h2><ul class="tags">${intents.map((i) => `<li><a href="${e(i.path)}">${e(i.label)}</a></li>`).join("")}</ul>`,
    `<h2>${l.why}</h2><p class="lede">${e(l.whyText)} ${e(l.contactNote)}</p>`,
    `<p class="muted" style="margin-top:2rem">${e(l.updated(p.availability.updatedAt))}</p>`,
  ]
    .filter((block) => block !== "")
    .join("\n");
  return layout({
    locale,
    baseUrl,
    path: profilePath(locale, p.id),
    otherPath: profilePath(OTHER[locale], p.id),
    title: `${p.handle} — ${p.headline[locale]}`,
    description: `${p.headline[locale]} · ${p.area} · ${availabilityText(p, locale)}`,
    noindex,
    body,
    jsonLd: personJsonLd(p, locale, baseUrl),
  });
};

const profileCard = (p: PublicProfile, locale: Locale): string =>
  `<li class="card"><h3><a href="${profilePath(locale, p.id)}">${e(p.handle)}</a></h3>` +
  `<p class="meta">${e(p.id)} · ${e(p.seniority)} · ${e(p.area)}${p.rate === null ? "" : ` · ${p.rate.min}–${p.rate.max} €`}</p>` +
  `<p>${e(p.headline[locale])}</p><ul class="tags">${p.skills.slice(0, 6).map((s) => `<li>${e(s)}</li>`).join("")}</ul></li>`;

export interface ListPageInput {
  readonly locale: Locale;
  readonly baseUrl: string;
  readonly path: string;
  readonly otherPath: string;
  readonly title: string;
  readonly intro: string;
  readonly profiles: readonly PublicProfile[];
  readonly links?: readonly IntentRef[];
}

export const renderListPage = ({ locale, baseUrl, path, otherPath, title, intro, profiles, links = [] }: ListPageInput): string => {
  const l = LABELS[locale];
  const body = [
    `<h1>${e(title)}</h1>`,
    `<p class="headline">${e(intro)}</p>`,
    links.length === 0 ? "" : `<h2>${l.related}</h2><ul class="tags">${links.map((i) => `<li><a href="${e(i.path)}">${e(i.label)}</a></li>`).join("")}</ul>`,
    `<h2>${l.profiles}</h2><ul class="cards">${profiles.map((p) => profileCard(p, locale)).join("")}</ul>`,
  ]
    .filter((block) => block !== "")
    .join("\n");
  return layout({ locale, baseUrl, path, otherPath, title, description: intro, noindex: false, body });
};

export const renderContactPage = (locale: Locale, baseUrl: string): string => {
  const l = LABELS[locale];
  const body = [
    `<h1>${l.contact}</h1>`,
    `<p class="lede">${e(l.contactNote)}</p>`,
    `<h2>${l.why}</h2><p class="lede">${e(l.whyText)}</p>`,
  ].join("\n");
  return layout({
    locale,
    baseUrl,
    path: contactPath(locale),
    otherPath: contactPath(OTHER[locale]),
    title: `${l.contact} — ${l.brand}`,
    description: l.contactNote,
    noindex: false,
    body,
  });
};
