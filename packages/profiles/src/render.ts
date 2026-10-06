import { escapeHtml as e } from "@proofseen/hub";
import { EVIDENCE_KINDS, type EvidenceKind, type Mission, type PublicProfile } from "./identity";
import { RELATED_NOTE } from "./related";
import { ORDERING_NOTE } from "./order";

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

/** The brand mark of the header (accent square, soft halo), as an inline SVG data URI. */
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23070b14'/%3E" +
  "%3Crect x='9' y='9' width='14' height='14' rx='3' fill='%233fcf9c'/%3E%3C/svg%3E";

export const STYLES = `
:root{--bg:#070b14;--bg-raised:#0a111f;--surface:#0e1626;--ink:#edf1f7;--muted:#a3aec2;--line:#1f2a40;--strong:#7c8aa8;--accent:#3fcf9c;--on-accent:#06110c;--warn:#f5a524;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
--radius:16px;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:radial-gradient(60rem 30rem at 88% -8rem,color-mix(in srgb,var(--accent) 13%,transparent),transparent 70%),radial-gradient(40rem 24rem at -10% 40rem,color-mix(in srgb,#8ab0ff 6%,transparent),transparent 70%),var(--bg);color:var(--ink);font:1.0625rem/1.6 var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit}a:focus-visible,.cta:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}
.wrap{width:min(100% - 2rem,68rem);margin-inline:auto}
.top{border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 80%,transparent)}
.top .wrap{display:flex;justify-content:space-between;align-items:center;gap:1rem;min-height:3.5rem;font-size:.9rem}
.top a{text-decoration:none}.brand{display:inline-flex;align-items:center;gap:.55rem;font-weight:700;letter-spacing:-.01em}
.brand::before{content:"";width:.8rem;height:.8rem;border-radius:3px;background:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
main{padding-block:clamp(1.75rem,5vh,3.5rem) 4.5rem}
h1,h2,h3{font-family:var(--serif);font-weight:600;margin:0;letter-spacing:-.018em}
h1{font-size:clamp(2.4rem,1.7rem + 3.2vw,4rem);line-height:1.02}
h2{display:flex;align-items:center;gap:.6rem;margin:3rem 0 1.2rem;font:500 .78rem/1.2 var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--accent)}
h2::before{content:"";width:1rem;height:.6rem;border-inline:2px solid currentColor;background:linear-gradient(currentColor,currentColor) center/100% 1px no-repeat}
h3{font-size:1.2rem}p{margin:0}
.muted{color:var(--muted)}
.eyebrow{margin-bottom:.9rem;font:500 .78rem/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.headline{margin-top:1rem;font-size:clamp(1.1rem,1rem + .4vw,1.3rem);line-height:1.5;color:var(--muted);max-width:44rem}
.lede{font-size:1.1rem;line-height:1.75;max-width:46rem}
.crumbs ol{list-style:none;margin:0 0 1.5rem;padding:0;display:flex;flex-wrap:wrap;gap:.4rem;font:500 .78rem/1.4 var(--mono);color:var(--muted)}
.crumbs li+li::before{content:"/";margin-right:.4rem;color:var(--strong)}
.crumbs a{text-decoration:none}.crumbs a:hover{color:var(--ink)}
.status{display:inline-flex;align-items:center;gap:.5rem;padding:.3rem .75rem;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));border-radius:999px;font:500 .8rem/1.2 var(--mono);color:var(--accent);justify-self:start}
.status.off{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,var(--line))}
.status i{width:.5rem;height:.5rem;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px color-mix(in srgb,currentColor 25%,transparent)}
ul.tags{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.5rem}
ul.tags li,ul.tags a{border:1px solid var(--line);border-radius:8px;padding:.3rem .7rem;background:var(--surface);font:500 .84rem/1.3 var(--mono);text-decoration:none;display:inline-block}
ul.tags a:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.cta{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.9rem 1.35rem;border-radius:999px;background:var(--accent);color:var(--on-accent);font-weight:650;text-decoration:none;box-shadow:0 10px 30px -12px color-mix(in srgb,var(--accent) 70%,transparent)}
.cta:hover{background:color-mix(in srgb,var(--accent) 88%,#fff)}
.ghost{font-size:.9rem;color:var(--muted);text-align:center}
.profile{display:grid;gap:2rem;grid-template-areas:"head" "aside" "main"}
.profile>header{grid-area:head}.profile>aside{grid-area:aside}.profile>.content{grid-area:main;min-width:0}
.panel{background:linear-gradient(180deg,color-mix(in srgb,var(--surface) 92%,var(--accent)),var(--surface) 40%);border:1px solid var(--line);border-radius:var(--radius);padding:1.4rem;display:grid;gap:1.15rem}
.panel dl{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:0}
.panel dt,.band dt{font:500 .7rem/1.2 var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.panel dd{margin:.3rem 0 0;font-weight:650}
.trust{font:500 .78rem/1.55 var(--mono);color:var(--muted);border-top:1px solid var(--line);padding-top:1rem}
.trust strong{color:var(--accent);font-weight:600}
@media (min-width:60rem){.profile{grid-template-columns:minmax(0,1fr) 21rem;grid-template-areas:"head aside" "main aside";column-gap:3.5rem}.profile>aside .panel{position:sticky;top:1.5rem}}
.hero{padding-bottom:.5rem}
.band{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:1px;margin:2.2rem 0 1rem;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.band div{background:var(--surface);padding:1.1rem 1.2rem}
.band dd{margin:.45rem 0 0;font:600 clamp(1.5rem,1.2rem + 1vw,2rem)/1.05 var(--serif);letter-spacing:-.02em}
.trustline{font:500 .82rem/1.5 var(--mono);color:var(--muted)}.trustline a{color:var(--accent)}
.cards{list-style:none;margin:0;padding:0;display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,21rem),1fr))}
.card{position:relative;display:grid;gap:.6rem;align-content:start;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:1.25rem 1.35rem;transition:border-color .2s ease,transform .2s ease,box-shadow .2s ease}
.card:hover{border-color:color-mix(in srgb,var(--accent) 50%,var(--line));box-shadow:0 18px 40px -24px color-mix(in srgb,var(--accent) 55%,transparent)}
.card:focus-within{outline:2px solid var(--accent);outline-offset:3px}
.card h3 a{text-decoration:none}.card h3 a::after{content:"";position:absolute;inset:0;border-radius:inherit}
.card .row{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .8rem;font:500 .78rem/1.3 var(--mono);color:var(--muted)}
.card .row .status{padding:.2rem .6rem;font-size:.74rem}
.card .rate{color:var(--ink);font-weight:600}
@media (prefers-reduced-motion:no-preference){.card:hover{transform:translateY(-2px)}}
.foot{border-top:1px solid var(--line);padding-block:2rem;font-size:.85rem;color:var(--muted)}
ol.missions{list-style:none;margin:0;padding:0;display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.mission{background:var(--surface);padding:1.3rem 1.4rem;display:grid;gap:.75rem}
.mission h3{font-size:1.1rem}
.mission .meta{margin:0;font:500 .78rem/1.5 var(--mono);color:var(--muted)}
.mission .meta a{color:var(--accent)}
ul.did{margin:0;padding-left:1.1rem;display:grid;gap:.35rem}
ol.steps{margin:1.5rem 0 0;padding:0;list-style:none;display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;counter-reset:step}
ol.steps li{background:var(--surface);padding:1.1rem 1.3rem 1.1rem 3.4rem;position:relative;counter-increment:step}
ol.steps li::before{content:counter(step);position:absolute;left:1.2rem;top:1.05rem;width:1.5rem;height:1.5rem;border-radius:50%;display:grid;place-items:center;font:600 .78rem/1 var(--mono);color:var(--on-accent);background:var(--accent)}
`;

export const LABELS = {
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
    missionDetail: "Missions",
    duration: (months: number) => (months < 12 ? `${months} mois` : `${Math.floor(months / 12)} an${months >= 24 ? "s" : ""}${months % 12 === 0 ? "" : ` et ${months % 12} mois`}`),
    verifiedOn: (d: string) => `Vérifiée le ${d}`,
    clientKinds: {
      startup: "Startup",
      scaleup: "Scale-up",
      grand_groupe: "Grand groupe",
      eti: "ETI",
      pme: "PME",
      secteur_public: "Secteur public",
      editeur_logiciel: "Éditeur de logiciels",
      esn: "ESN",
      association: "Association",
    },
    updated: (d: string) => `Mis à jour le ${d}`,
    about: "Profil",
    skills: "Compétences",
    sectors: "Secteurs",
    related: "Recherches associées",
    crumbs: "Fil d'Ariane",
    method: "Comment nous vérifions",
    eyebrowProfile: (id: string) => `Profil vérifié · ${id}`,
    eyebrowNamed: "Profil vérifié",
    eyebrowList: "Profils vérifiés sur pièce",
    trustMissions: (n: number) => `${n} mission${n > 1 ? "s" : ""} vérifiée${n > 1 ? "s" : ""} sur pièce`,
    trustAnon: "Identité révélée après accord du freelance, avant tout engagement.",
    trustline: "Chaque mission affichée a été vérifiée sur pièce —",
    howItWorks: "Comment ça marche",
    contactSteps: [
      "Vous décrivez la mission : besoin, durée, démarrage, budget.",
      "Nous la transmettons au freelance. Il reste anonyme tant qu'il n'a pas accepté.",
      "S'il accepte, son identité vous est communiquée avant tout engagement.",
    ],
    contactWrite: "Écrire à Proofseen",
    contactPending: "Le canal de contact ouvrira au lancement. Aucune demande ne peut encore être transmise.",
    mailSubject: (ref: string) => `Demande de profil ${ref}`,
    mailBody: (ref: string, url: string) =>
      `Profil : ${ref} (${url})\n\nMission :\nDurée et démarrage :\nBudget ou TJM :\nEntreprise et contact :\n`,
    listCount: "Profils",
    listAvailable: "Disponibles maintenant",
    listRates: "TJM affichés",
    listMissions: "Missions vérifiées",
    methodLink: "méthode",
    methodEvidence: "Pièces contrôlées",
    methodIntro:
      "Chaque mission publiée sur Proofseen a été contrôlée sur au moins une pièce. La pièce elle-même n'est jamais publiée : seule la nature du contrôle l'est, pour que chacun sache ce qu'une mention « vérifiée » veut dire.",
    methodLimits: "Ce que la vérification ne garantit pas",
    methodLimitsText:
      "Elle établit qu'une mission a eu lieu, avec ce rôle et cette durée. Elle ne juge ni la qualité du travail, ni l'adéquation à votre besoin, ni la disponibilité future : c'est l'échange avec le freelance qui en décide.",
    evidenceShort: { facture: "facture", contrat: "contrat", attestation_client: "attestation client", acces_depot: "accès au dépôt", livrable_public: "livrable public" },
    evidenceLong: {
      facture: "Facture — nous contrôlons une facture émise pour la mission : émetteur, période, montant cohérent avec la durée. La facture n'est jamais publiée.",
      contrat: "Contrat — nous contrôlons le contrat ou le bon de commande : parties, objet, durée. Le document n'est jamais publié.",
      attestation_client: "Attestation client — le client confirme par écrit la mission, le rôle et la période. Son nom n'est jamais publié.",
      acces_depot: "Accès au dépôt — le freelance nous montre ses contributions dans le dépôt du projet. Ni le code ni le nom du dépôt ne sont publiés.",
      livrable_public: "Livrable public — le résultat est consultable publiquement et la contribution du freelance a été contrôlée. Le lien n'est pas publié : il désignerait le client.",
    },
    relatedProfiles: "Profils proches",
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
    missionDetail: "Missions",
    duration: (months: number) => (months < 12 ? `${months} months` : `${Math.floor(months / 12)} year${months >= 24 ? "s" : ""}${months % 12 === 0 ? "" : ` ${months % 12} months`}`),
    verifiedOn: (d: string) => `Verified on ${d}`,
    clientKinds: {
      startup: "Startup",
      scaleup: "Scale-up",
      grand_groupe: "Large corporation",
      eti: "Mid-market company",
      pme: "Small business",
      secteur_public: "Public sector",
      editeur_logiciel: "Software vendor",
      esn: "IT services company",
      association: "Non-profit",
    },
    updated: (d: string) => `Updated on ${d}`,
    about: "Profile",
    skills: "Skills",
    sectors: "Sectors",
    related: "Related searches",
    crumbs: "Breadcrumb",
    method: "How we verify",
    eyebrowProfile: (id: string) => `Verified profile · ${id}`,
    eyebrowNamed: "Verified profile",
    eyebrowList: "Profiles verified against evidence",
    trustMissions: (n: number) => `${n} mission${n > 1 ? "s" : ""} verified against evidence`,
    trustAnon: "Identity revealed once the freelancer agrees, before any commitment.",
    trustline: "Every mission shown was verified against evidence —",
    howItWorks: "How it works",
    contactSteps: [
      "You describe the mission: need, duration, start date, budget.",
      "We pass it to the freelancer, who stays anonymous until they agree.",
      "If they agree, their identity is shared with you before any commitment.",
    ],
    contactWrite: "Write to Proofseen",
    contactPending: "The contact channel opens at launch. No request can be passed on yet.",
    mailSubject: (ref: string) => `Profile request ${ref}`,
    mailBody: (ref: string, url: string) =>
      `Profile: ${ref} (${url})\n\nMission:\nDuration and start date:\nBudget or day rate:\nCompany and contact:\n`,
    listCount: "Profiles",
    listAvailable: "Available now",
    listRates: "Day rates shown",
    listMissions: "Verified missions",
    methodLink: "method",
    methodEvidence: "What we check",
    methodIntro:
      "Every mission published on Proofseen was checked against at least one document. The document itself is never published: only the kind of check is, so everyone knows what \"verified\" means.",
    methodLimits: "What verification does not guarantee",
    methodLimitsText:
      "It establishes that a mission took place, with that role and that duration. It does not judge the quality of the work, the fit with your needs or future availability: the conversation with the freelancer decides that.",
    evidenceShort: { facture: "invoice", contrat: "contract", attestation_client: "client attestation", acces_depot: "repository access", livrable_public: "public deliverable" },
    evidenceLong: {
      facture: "Invoice — we check an invoice issued for the mission: issuer, period, an amount consistent with the duration. The invoice is never published.",
      contrat: "Contract — we check the contract or purchase order: parties, scope, duration. The document is never published.",
      attestation_client: "Client attestation — the client confirms the mission, the role and the period in writing. The client's name is never published.",
      acces_depot: "Repository access — the freelancer shows us their contributions in the project repository. Neither the code nor the repository name is published.",
      livrable_public: "Public deliverable — the result is publicly visible and the freelancer's contribution was checked. The link is not published: it would name the client.",
    },
    relatedProfiles: "Related profiles",
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
export const methodPath = (locale: Locale): string => (locale === "en" ? "/en/method/" : "/methode/");
/** Named arm of the three-arm test only (PIVOT_ANONYME §5) — never used for a client profile. */
export const namedPath = (locale: Locale, slug: string): string => `${locale === "en" ? "/en" : ""}/n/${slug}/`;

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
  /** Defaults to the anonymity notice; the named test page must not claim an anonymity it does not offer. */
  readonly footer?: string | undefined;
}

const layout = ({ locale, baseUrl, path, otherPath, title, description, noindex, body, jsonLd, footer }: LayoutInput): string => {
  const l = LABELS[locale];
  return [
    "<!doctype html>",
    `<html lang="${locale}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    '<meta name="theme-color" content="#070b14">',
    // Inline icon: no extra request, and no /favicon.ico 404 logged in the console of every visitor.
    `<link rel="icon" href="${FAVICON}">`,
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
    `<header class="top"><div class="wrap"><a class="brand" href="${homePath(locale)}">${l.brand}</a>` +
      `<a href="${otherPath}" hreflang="${OTHER[locale]}" lang="${OTHER[locale]}">${l.other}</a></div></header>`,
    '<main class="wrap">',
    body,
    "</main>",
    `<footer class="foot"><div class="wrap"><p>${l.brand} — ${e(footer ?? l.whyText)} · <a href="${methodPath(locale)}">${l.method}</a></p></div></footer>`,
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
    named === undefined ? "" : `<ul class="tags" style="margin-top:1rem">${named.sameAs.map((u) => `<li><a href="${e(u)}" rel="me">${e(u)}</a></li>`).join("")}</ul>`,
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
      : `<h2>${l.relatedProfiles}</h2><p class="muted" style="margin-bottom:1rem">${e(RELATED_NOTE[locale])}</p>` +
        `<ul class="cards">${related.map((other) => profileCard(other, locale)).join("")}</ul>`,
    named === undefined ? `<h2>${l.why}</h2><p class="lede">${e(l.whyText)} ${e(l.contactNote)}</p>` : "",
    `<p class="muted" style="margin-top:2rem">${e(l.updated(p.availability.updatedAt))}</p>`,
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
    title: `${heading} — ${p.headline[locale]}`,
    description: `${p.headline[locale]} · ${p.area} · ${availabilityText(p, locale)}`,
    noindex,
    body,
    jsonLd: [personJsonLd(p, locale, baseUrl, named), crumbs.jsonLd],
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
    `<h2>${l.profiles}</h2><p class="muted" style="margin-bottom:1rem">${e(ORDERING_NOTE[locale])}</p><ul class="cards">${profiles.map((p) => profileCard(p, locale)).join("")}` +
      `${namedEntries.map((entry) => profileCard(entry.profile, locale, entry.named)).join("")}</ul>`,
  ]
    .filter((block) => block !== "")
    .join("\n");
  return layout({ locale, baseUrl, path, otherPath, title, description: intro, noindex: false, body, jsonLd: crumbs === undefined ? list : [crumbs.jsonLd, list] });
};

export const renderContactPage = (locale: Locale, baseUrl: string, contactEmail?: string | undefined): string => {
  const l = LABELS[locale];
  const crumbs = breadcrumb(locale, baseUrl, [{ label: l.brand, path: homePath(locale) }, { label: l.contact, path: contactPath(locale) }]);
  const action =
    contactEmail === undefined
      ? `<p class="status off" style="margin-top:2rem"><i></i>${e(l.contactPending)}</p>`
      : `<p style="margin-top:2rem"><a class="cta" href="${e(`mailto:${contactEmail}?subject=${encodeURIComponent(l.mailSubject("—"))}&body=${encodeURIComponent(l.mailBody("—", `${baseUrl}${homePath(locale)}`))}`)}">${l.contactWrite} →</a></p>`;
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
    title: `${l.contact} — ${l.brand}`,
    description: l.contactNote,
    noindex: false,
    body,
    jsonLd: crumbs.jsonLd,
  });
};

/** Public method page: what each kind of evidence means, and what verification does not guarantee. */
export const renderMethodPage = (locale: Locale, baseUrl: string): string => {
  const l = LABELS[locale];
  const body = [
    breadcrumb(locale, baseUrl, [{ label: l.brand, path: homePath(locale) }, { label: l.method, path: methodPath(locale) }]).html,
    `<h1>${l.method}</h1>`,
    `<p class="lede" style="margin-top:1rem">${e(l.methodIntro)}</p>`,
    `<h2>${l.methodEvidence}</h2><ol class="missions">${EVIDENCE_KINDS.map((kind) => `<li class="mission"><p>${e(l.evidenceLong[kind])}</p></li>`).join("")}</ol>`,
    `<h2>${l.methodLimits}</h2><p class="lede">${e(l.methodLimitsText)}</p>`,
  ].join("\n");
  return layout({
    locale,
    baseUrl,
    path: methodPath(locale),
    otherPath: methodPath(OTHER[locale]),
    title: `${l.method} — ${l.brand}`,
    description: l.methodIntro,
    noindex: false,
    body,
    jsonLd: breadcrumb(locale, baseUrl, [{ label: l.brand, path: homePath(locale) }, { label: l.method, path: methodPath(locale) }]).jsonLd,
  });
};
