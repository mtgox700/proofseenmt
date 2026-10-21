import { escapeHtml as e, marketFooter, marketHeader, pageHead, PUBLIC_STYLES, safeJsonLd, typeset, withBrand } from "@proofseen/hub";
import type { EvidenceKind, Mission, PublicProfile } from "./identity";
import { LABELS } from "./render-labels";
import { STYLES } from "./render-styles";
import { RELATED_NOTE } from "./related";
import { ORDERING_NOTE } from "./order";

/*
 * Public pages of a pseudonymous profile (ARCHITECTURE_ANONYME §2). Static HTML, zero JavaScript: what a crawler reads
 * is exactly what a visitor reads. Every value in the JSON-LD is also on screen, as Google's structured-data policy
 * requires. Since the Kensa review (B3) they wear the brand of the marketplace: the hub's head, header, footer and
 * tokens, the same typography, no dash as a separator.
 */

export { LABELS } from "./render-labels";
export { STYLES } from "./render-styles";

export type Locale = "fr" | "en";
export const LOCALES: readonly Locale[] = ["fr", "en"];

export interface IntentRef {
  readonly path: string;
  readonly label: string;
}

const OTHER: Readonly<Record<Locale, Locale>> = { fr: "en", en: "fr" };

export const profilePath = (locale: Locale, id: string): string => `${locale === "en" ? "/en" : ""}/p/${id}/`;
export const intentPath = (locale: Locale, slug: string): string => `${locale === "en" ? "/en" : ""}/${locale === "en" ? "freelancers" : "freelances"}/${slug}/`;
export const homePath = (locale: Locale): string => (locale === "en" ? "/en/" : "/");
export const contactPath = (locale: Locale): string => `${locale === "en" ? "/en" : ""}/contact/`;
export const methodPath = (locale: Locale): string => (locale === "en" ? "/en/method/" : "/methode/");
/** Named arm of the three-arm test only (PIVOT_ANONYME §5) — never used for a client profile. */
export const namedPath = (locale: Locale, slug: string): string => `${locale === "en" ? "/en" : ""}/n/${slug}/`;

interface LayoutInput {
  readonly locale: Locale;
  readonly baseUrl: string;
  readonly path: string;
  readonly otherPath: string;
  /** The page title, without the brand: `withBrand` adds it. */
  readonly title: string;
  readonly description: string;
  readonly noindex: boolean;
  readonly body: string;
  readonly jsonLd?: unknown;
  /** Defaults to the anonymity notice; the named test page must not claim an anonymity it does not offer. */
  readonly footer?: string | undefined;
  /** A page with a grid of its own (profile, list): the full width of the header. A reading page keeps the measure. */
  readonly wide?: boolean;
}

const layout = ({ locale, baseUrl, path, otherPath, title, description, noindex, body, jsonLd, footer, wide = false }: LayoutInput): string => {
  const l = LABELS[locale];
  return typeset(
    locale,
    [
      "<!doctype html>",
      `<html lang="${locale}">`,
      "<head>",
      ...pageHead({ lang: locale, title: withBrand(title), description, canonical: `${baseUrl}${path}` }),
      noindex ? '<meta name="robots" content="noindex">' : "",
      `<link rel="alternate" hreflang="${locale}" href="${e(`${baseUrl}${path}`)}">`,
      `<link rel="alternate" hreflang="${OTHER[locale]}" href="${e(`${baseUrl}${otherPath}`)}">`,
      `<style>${PUBLIC_STYLES}${STYLES}</style>`,
      jsonLd === undefined ? "" : `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`,
      "</head>",
      "<body>",
      marketHeader(locale, otherPath),
      `<main id="contenu" class="wrap${wide ? " wide" : ""}">`,
      body,
      `<p class="page-note">${e(footer ?? l.whyText)} <a href="${methodPath(locale)}">${l.method}</a></p>`,
      "</main>",
      marketFooter(locale),
      "</body>",
      "</html>",
      "",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  );
};

const availabilityText = (p: PublicProfile, locale: Locale): string => {
  const l = LABELS[locale];
  if (p.availability.status === "unavailable") return l.unavailable;
  if (p.availability.status === "available_from" && p.availability.from !== null) return l.availableFrom(p.availability.from);
  return l.available;
};

/**
 * Identity a person deliberately makes public, for the named arm of the three-arm test only
 * (PIVOT_ANONYME §5 and §11). It is never derived from a private identity: the subject writes it himself.
 */
/** A named page cannot carry the anonymity notice: it would be false on screen. */
const NAMED_FOOTER: Readonly<Record<Locale, string>> = {
  fr: "Profil publié sous identité réelle, à la demande de la personne concernée.",
  en: "Profile published under a real identity, at the request of the person concerned.",
};

export interface NamedIdentity {
  readonly displayName: string;
  readonly slug: string;
  /** Corroborating profiles (LinkedIn, GitHub…): the very signal the pseudonymous arm does without. */
  readonly sameAs: readonly string[];
}

const personJsonLd = (p: PublicProfile, locale: Locale, baseUrl: string, named: NamedIdentity | undefined) => ({
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  dateModified: p.availability.updatedAt,
  mainEntity: {
    "@type": "Person",
    // Google allows a handle as `name` when it is the only identifier used on the site (ProfilePage doc).
    name: named === undefined ? p.handle : named.displayName,
    ...(named === undefined
      ? { alternateName: p.handle, identifier: p.id }
      : // The named arm carries `sameAs` on purpose: that is the variable under test.
        { sameAs: [...named.sameAs] }),
    description: p.headline[locale],
    knowsAbout: p.skills,
    // Without `named`, no `sameAs`: linking to LinkedIn or GitHub would re-associate the real identity
    // (ARCHITECTURE_ANONYME §3).
  },
  url: `${baseUrl}${named === undefined ? profilePath(locale, p.id) : namedPath(locale, named.slug)}`,
});

const evidenceText = (evidence: readonly EvidenceKind[], locale: Locale): string =>
  evidence.map((kind) => LABELS[locale].evidenceShort[kind]).join(" + ");

/** One mission: a category of client, a duration, what was delivered, the stack. Never a name, never a date range. */
const missionEntry = (m: Mission, locale: Locale): string => {
  const l = LABELS[locale];
  return (
    `<li class="mission"><h3>${e(m.role[locale])}</h3>` +
    `<p class="meta">${e(l.clientKinds[m.clientKind])} · ${e(l.duration(m.durationMonths))} · ${e(l.verifiedOn(m.verifiedAt))} · ` +
    `${e(evidenceText(m.evidence, locale))} (<a href="${methodPath(locale)}">${l.methodLink}</a>)</p>` +
    `<ul class="did">${m.achievements.map((a) => `<li>${e(a[locale])}</li>`).join("")}</ul>` +
    `<ul class="tags">${m.stack.map((s) => `<li>${e(s)}</li>`).join("")}</ul></li>`
  );
};

export interface ProfilePageInput {
  /** Proofseen's own address. Absent: the contact channel is not open, and the pages say so. */
  readonly contactEmail?: string | undefined;
  readonly profile: PublicProfile;
  readonly locale: Locale;
  readonly baseUrl: string;
  readonly intents: readonly IntentRef[];
  readonly noindex: boolean;
  /** Test only: renders the same facts under a real name. Absent = the normal pseudonymous page. */
  readonly named?: NamedIdentity | undefined;
  /** Profiles this page hands over to (related.ts). The selection rule is printed next to the links. */
  readonly related?: readonly PublicProfile[] | undefined;
}

export const renderProfilePage = ({ profile: p, locale, baseUrl, intents, noindex, named, related = [], contactEmail }: ProfilePageInput): string => {
  const l = LABELS[locale];
  const path = named === undefined ? profilePath(locale, p.id) : namedPath(locale, named.slug);
  const otherPath = named === undefined ? profilePath(OTHER[locale], p.id) : namedPath(OTHER[locale], named.slug);
  const heading = named === undefined ? p.handle : named.displayName;
  // The named page must not carry the public identifier anywhere: it would tie the two arms of the test together.
  const ref = named === undefined ? p.id : named.slug;
  const crumbs = breadcrumb(locale, baseUrl, [{ label: l.brand, path: homePath(locale) }, ...intents.slice(0, 1), { label: heading, path }]);
  const rate = p.rate === null ? "" : `<div><dt>${l.rate}</dt><dd>${p.rate.min}–${p.rate.max} €</dd></div>`;
  const head = [
    crumbs.html,
    `<p class="eyebrow">${e(named === undefined ? l.eyebrowProfile(p.id) : l.eyebrowNamed)}</p>`,
    `<h1>${e(heading)}</h1>`,
    named === undefined ? "" : `<ul class="tags ids">${named.sameAs.map((u) => `<li><a href="${e(u)}" rel="me">${e(u)}</a></li>`).join("")}</ul>`,
    `<p class="headline">${e(p.headline[locale])}</p>`,
  ];
  const panel = [
    `<p class="status${p.availability.status === "unavailable" ? " off" : ""}"><i></i>${e(availabilityText(p, locale))}</p>`,
    `<dl><div><dt>${l.seniority}</dt><dd>${e(p.seniority)}</dd></div><div><dt>${l.area}</dt><dd>${e(p.area.split("/")[0]!.trim())}</dd></div>` +
      `${rate}<div><dt>${l.missions}</dt><dd>${p.verifiedMissions}</dd></div></dl>`,
    contactCta(locale, baseUrl, ref, path, contactEmail, named === undefined ? "p" : "n"),
    `<a class="ghost" href="${contactPath(locale)}">${l.howItWorks}</a>`,
    `<p class="trust"><strong>${e(l.trustMissions(p.verifiedMissions))}</strong> · <a href="${methodPath(locale)}">${l.methodLink}</a>` +
      `${named === undefined ? `<br>${e(l.trustAnon)}` : ""}</p>`,
  ];
  const content = [
    `<h2>${l.about}</h2><p class="lede">${e(p.summary[locale])}</p>`,
    `<h2>${l.skills}</h2><ul class="tags">${p.skills.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`,
    p.missions.length === 0 ? "" : `<h2>${l.missionDetail}</h2><ol class="missions">${p.missions.map((m) => missionEntry(m, locale)).join("")}</ol>`,
    p.sectors.length === 0 ? "" : `<h2>${l.sectors}</h2><ul class="tags">${p.sectors.map((s) => `<li>${e(s)}</li>`).join("")}</ul>`,
    intents.length === 0 ? "" : `<h2>${l.related}</h2><ul class="tags">${intents.map((i) => `<li><a href="${e(i.path)}">${e(i.label)}</a></li>`).join("")}</ul>`,
    related.length === 0
      ? ""
      : `<h2>${l.relatedProfiles}</h2><p class="muted note-line">${e(RELATED_NOTE[locale])}</p>` +
        `<ul class="cards">${related.map((other) => profileCard(other, locale)).join("")}</ul>`,
    named === undefined ? `<h2>${l.why}</h2><p class="lede">${e(l.whyText)} ${e(l.contactNote)}</p>` : "",
    `<p class="muted updated">${e(l.updated(p.availability.updatedAt))}</p>`,
  ];
  const join = (blocks: readonly string[]): string => blocks.filter((block) => block !== "").join("\n");
  const body =
    `<div class="profile"><header>${join(head)}</header>` +
    `<aside aria-label="${e(l.contact)}"><div class="panel">${join(panel)}</div></aside>` +
    `<div class="content">${join(content)}</div></div>`;
  return layout({
    locale,
    baseUrl,
    path,
    otherPath,
    title: `${heading} · ${p.headline[locale]}`,
    description: `${p.headline[locale]} · ${p.area} · ${availabilityText(p, locale)}`,
    noindex,
    body,
    jsonLd: [personJsonLd(p, locale, baseUrl, named), crumbs.jsonLd],
    wide: true,
    ...(named === undefined ? {} : { footer: NAMED_FOOTER[locale] }),
  });
};

/**
 * The one action of the page. With a Proofseen address configured, it opens a pre-filled e-mail TO PROOFSEEN — never to
 * the freelancer. Without one, it leads to the contact page, which says plainly that the channel is not open yet.
 */
const contactCta = (locale: Locale, baseUrl: string, ref: string, path: string, contactEmail: string | undefined, key: "p" | "n"): string => {
  const l = LABELS[locale];
  const href =
    contactEmail === undefined
      ? `${contactPath(locale)}?${key}=${encodeURIComponent(ref)}`
      : `mailto:${contactEmail}?subject=${encodeURIComponent(l.mailSubject(ref))}&body=${encodeURIComponent(l.mailBody(ref, `${baseUrl}${path}`))}`;
  return `<a class="cta" href="${e(href)}">${l.contact} →</a>`;
};

/**
 * Breadcrumb, visible AND structured: Google only honours a BreadcrumbList that matches what the page shows. The last
 * step is the current page — not a link, marked aria-current.
 */
const breadcrumb = (locale: Locale, baseUrl: string, trail: readonly IntentRef[]) => ({
  html:
    `<nav class="crumbs" aria-label="${e(LABELS[locale].crumbs)}"><ol>` +
    trail
      .map((step, index) => (index === trail.length - 1 ? `<li aria-current="page">${e(step.label)}</li>` : `<li><a href="${e(step.path)}">${e(step.label)}</a></li>`))
      .join("") +
    "</ol></nav>",
  jsonLd: {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({ "@type": "ListItem", position: index + 1, name: step.label, item: `${baseUrl}${step.path}` })),
  },
});

const profileCard = (p: PublicProfile, locale: Locale, named?: NamedIdentity | undefined): string => {
  const l = LABELS[locale];
  const href = named === undefined ? profilePath(locale, p.id) : namedPath(locale, named.slug);
  return (
    `<li class="card"><h3><a href="${href}">${e(named === undefined ? p.handle : named.displayName)}</a></h3>` +
    `<p class="row"><span class="status${p.availability.status === "unavailable" ? " off" : ""}"><i></i>${e(availabilityText(p, locale))}</span>` +
    `${named === undefined ? `<span>${e(p.id)}</span>` : ""}<span>${e(p.seniority)}</span>` +
    `${p.rate === null ? "" : `<span class="rate">${p.rate.min}–${p.rate.max} €</span>`}</p>` +
    `<p>${e(p.headline[locale])}</p>` +
    `<p class="row">${e(l.trustMissions(p.verifiedMissions))} · ${e(p.area.split("/")[0]!.trim())}</p>` +
    `<ul class="tags">${p.skills.slice(0, 5).map((s) => `<li>${e(s)}</li>`).join("")}</ul></li>`
  );
};

/**
 * Aggregates an entry page can state truthfully: every figure is computed from the cards shown below it, nothing is
 * rounded up, nothing is estimated. A rate range only appears when at least one profile publishes a rate.
 */
const listSummary = (profiles: readonly PublicProfile[], locale: Locale): string => {
  if (profiles.length === 0) return "";
  const l = LABELS[locale];
  const rates = profiles.flatMap((p) => (p.rate === null ? [] : [p.rate]));
  const available = profiles.filter((p) => p.availability.status === "available").length;
  const missions = profiles.reduce((sum, p) => sum + p.verifiedMissions, 0);
  const cells = [
    [l.listCount, String(profiles.length)],
    [l.listAvailable, String(available)],
    ...(rates.length === 0 ? [] : [[l.listRates, `${Math.min(...rates.map((r) => r.min))}–${Math.max(...rates.map((r) => r.max))} €`]]),
    [l.listMissions, String(missions)],
  ];
  return (
    `<dl class="band">${cells.map(([term, value]) => `<div><dt>${e(term!)}</dt><dd>${e(value!)}</dd></div>`).join("")}</dl>` +
    `<p class="trustline">${e(l.trustline)} <a href="${methodPath(locale)}">${l.methodLink}</a></p>`
  );
};

/** ItemList in the exact order of the visible cards — structured data must mirror the page. */
const itemList = (profiles: readonly PublicProfile[], locale: Locale, baseUrl: string) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListOrder: "https://schema.org/ItemListUnordered",
  numberOfItems: profiles.length,
  itemListElement: profiles.map((p, index) => ({ "@type": "ListItem", position: index + 1, name: p.handle, url: `${baseUrl}${profilePath(locale, p.id)}` })),
});

export interface ListPageInput {
  readonly locale: Locale;
  readonly baseUrl: string;
  readonly path: string;
  readonly otherPath: string;
  readonly title: string;
  readonly intro: string;
  readonly profiles: readonly PublicProfile[];
  readonly links?: readonly IntentRef[];
  /** Test only: named pages listed next to the pseudonymous ones, so both arms get the same internal linking. */
  readonly namedEntries?: readonly { readonly profile: PublicProfile; readonly named: NamedIdentity }[];
}

export const renderListPage = ({ locale, baseUrl, path, otherPath, title, intro, profiles, links = [], namedEntries = [] }: ListPageInput): string => {
  const l = LABELS[locale];
  const crumbs = path === homePath(locale) ? undefined : breadcrumb(locale, baseUrl, [{ label: l.brand, path: homePath(locale) }, { label: title, path }]);
  const list = itemList(profiles, locale, baseUrl);
  const body = [
    `<div class="hero">${crumbs?.html ?? ""}<p class="eyebrow">${l.eyebrowList}</p><h1>${e(title)}</h1><p class="headline">${e(intro)}</p>${listSummary(profiles, locale)}</div>`,
    links.length === 0 ? "" : `<h2>${l.related}</h2><ul class="tags">${links.map((i) => `<li><a href="${e(i.path)}">${e(i.label)}</a></li>`).join("")}</ul>`,
    `<h2>${l.profiles}</h2><p class="muted note-line">${e(ORDERING_NOTE[locale])}</p><ul class="cards">${profiles.map((p) => profileCard(p, locale)).join("")}` +
      `${namedEntries.map((entry) => profileCard(entry.profile, locale, entry.named)).join("")}</ul>`,
  ]
    .filter((block) => block !== "")
    .join("\n");
  return layout({ locale, baseUrl, path, otherPath, title, description: intro, noindex: false, body, jsonLd: crumbs === undefined ? list : [crumbs.jsonLd, list], wide: true });
};

export const renderContactPage = (locale: Locale, baseUrl: string, contactEmail?: string | undefined): string => {
  const l = LABELS[locale];
  const crumbs = breadcrumb(locale, baseUrl, [{ label: l.brand, path: homePath(locale) }, { label: l.contact, path: contactPath(locale) }]);
  const action =
    contactEmail === undefined
      ? `<p class="status off contact-action"><i></i>${e(l.contactPending)}</p>`
      : `<p class="contact-action"><a class="cta" href="${e(`mailto:${contactEmail}?subject=${encodeURIComponent(l.contactSubject)}&body=${encodeURIComponent(l.contactBody(`${baseUrl}${homePath(locale)}`))}`)}">${l.contactWrite} →</a></p>`;
  const body = [
    crumbs.html,
    `<p class="eyebrow">${l.howItWorks}</p>`,
    `<h1>${l.contact}</h1>`,
    `<p class="headline">${e(l.contactNote)}</p>`,
    `<ol class="steps">${l.contactSteps.map((step) => `<li>${e(step)}</li>`).join("")}</ol>`,
    action,
    `<h2>${l.why}</h2><p class="lede">${e(l.whyText)}</p>`,
  ].join("\n");
  return layout({
    locale,
    baseUrl,
    path: contactPath(locale),
    otherPath: contactPath(OTHER[locale]),
    title: l.contact,
    description: l.contactNote,
    noindex: false,
    body,
    jsonLd: crumbs.jsonLd,
  });
};

/** The kinds of document a check on a document can rest on, in the order of the schema. */
const DOCUMENT_KINDS = ["facture", "contrat", "attestation_client", "acces_depot", "livrable_public"] as const satisfies readonly EvidenceKind[];

/**
 * Public method page: the three ways a mission is verified (the labels of the hub's proof register), the other verified
 * facts a profile can carry, and what verification does not guarantee. It says what the product does, nothing more.
 */
export const renderMethodPage = (locale: Locale, baseUrl: string): string => {
  const l = LABELS[locale];
  const crumbs = breadcrumb(locale, baseUrl, [{ label: l.brand, path: homePath(locale) }, { label: l.method, path: methodPath(locale) }]);
  const mode = (m: { readonly title: string; readonly text: string }, extra = ""): string => `<li class="mission"><h3>${e(m.title)}</h3><p>${e(m.text)}</p>${extra}</li>`;
  const documents = `<ul class="method-kinds">${DOCUMENT_KINDS.map((kind) => `<li>${e(l.documents[kind])}</li>`).join("")}</ul>`;
  const body = [
    crumbs.html,
    `<h1>${l.method}</h1>`,
    `<p class="lede headline">${e(l.methodIntro)}</p>`,
    `<h2>${l.methodModes}</h2><ol class="missions">${mode(l.modes.client)}${mode(l.modes.paid)}${mode(l.modes.document, documents)}</ol>`,
    `<h2>${l.methodFacts}</h2><p>${e(l.methodFactsLead)}</p><ul>${l.facts.map((f) => `<li>${e(f)}</li>`).join("")}</ul>`,
    `<h2>${l.methodLimits}</h2><p class="lede">${e(l.methodLimitsText)}</p>`,
  ].join("\n");
  return layout({
    locale,
    baseUrl,
    path: methodPath(locale),
    otherPath: methodPath(OTHER[locale]),
    title: l.method,
    description: l.methodIntro,
    noindex: false,
    body,
    jsonLd: crumbs.jsonLd,
  });
};
