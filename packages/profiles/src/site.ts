import { AI_SEARCH_BOTS, escapeHtml } from "@proofseen/hub";
import type { PublicProfile } from "./identity";
import {
  LABELS,
  LOCALES,
  contactPath,
  homePath,
  intentPath,
  namedPath,
  profilePath,
  methodPath,
  renderContactPage,
  renderMethodPage,
  renderListPage,
  renderProfilePage,
  type IntentRef,
  type Locale,
  type NamedIdentity,
} from "./render";
import { publicApi } from "./query";
import { relatedProfiles } from "./related";
import { publishedOrder } from "./order";
import { indexNowKeyFile } from "./indexnow";
import { reidentificationRisk } from "./risk";

/*
 * Assembles the public site: one page per profile, intent pages that only exist when they carry real content, internal
 * links both ways, sitemap and robots. Google's scaled-content and doorway policies are the reason an intent page is
 * NOT generated for every skill × area combination, and the reason a thin profile is noindex.
 */

export interface SiteFile {
  readonly path: string;
  readonly content: string;
}

/**
 * Named arm of the three-arm test (PIVOT_ANONYME §5): the same facts as `profileId`, published under a real identity.
 * Reserved for a subject who publishes his own identity — never a client profile (PIVOT_ANONYME §11).
 */
export interface NamedArm {
  readonly profileId: string;
  readonly identity: NamedIdentity;
}

export interface SiteOptions {
  readonly baseUrl: string;
  readonly namedArm?: NamedArm | undefined;
  /** Proofseen's own address, used by every "request this profile" button. Absent: the pages say the channel is not open. */
  readonly contactEmail?: string | undefined;
  /** IndexNow key: served as `<key>.txt` at the root to prove we own the host (indexnow.ts). */
  readonly indexNowKey?: string | undefined;
}

/** Below this, an intent page would be an empty template — exactly what "doorway pages" means. HYPOTHÈSE. */
export const MIN_PROFILES_PER_INTENT = 3;
/** A profile with less than this is not worth indexing (thin content); it stays reachable, but noindex. */
export const MIN_SUMMARY_CHARS = 120;
export const MIN_SKILLS = 3;

export const isThin = (p: PublicProfile): boolean =>
  p.summary.fr.length < MIN_SUMMARY_CHARS || p.summary.en.length < MIN_SUMMARY_CHARS || p.skills.length < MIN_SKILLS;

const slugify = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** "Paris / Île-de-France" → "paris": the first part is the searched term. */
const areaSlug = (area: string): string => slugify(area.split("/")[0]!.trim());
const areaLabel = (area: string): string => area.split("/")[0]!.trim();

interface Intent {
  readonly slug: string;
  readonly skill: string;
  readonly area: string;
  readonly profiles: readonly PublicProfile[];
}

/** One intent per (skill, area) actually shared by enough profiles — never a cartesian product. */
const intentsOf = (profiles: readonly PublicProfile[]): Intent[] => {
  const groups = new Map<string, { skill: string; area: string; profiles: PublicProfile[] }>();
  for (const profile of profiles) {
    for (const skill of profile.skills) {
      const slug = `${slugify(skill)}-${areaSlug(profile.area)}`;
      const group = groups.get(slug) ?? { skill, area: areaLabel(profile.area), profiles: [] };
      group.profiles.push(profile);
      groups.set(slug, group);
    }
  }
  return [...groups.entries()]
    .filter(([, group]) => group.profiles.length >= MIN_PROFILES_PER_INTENT)
    .map(([slug, group]) => ({ slug, skill: group.skill, area: group.area, profiles: group.profiles }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
};

const intentRefs = (intents: readonly Intent[], locale: Locale, filter: (i: Intent) => boolean): IntentRef[] =>
  intents.filter(filter).map((i) => ({ path: intentPath(locale, i.slug), label: `${i.skill} · ${i.area}` }));

const robots = (baseUrl: string): string =>
  [...AI_SEARCH_BOTS.map((bot) => `User-agent: ${bot}\nAllow: /\n`), "User-agent: *\nAllow: /\n", `Sitemap: ${baseUrl}/sitemap.xml`, ""].join("\n");

const sitemap = (baseUrl: string, paths: readonly string[], lastmod: string): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${escapeHtml(`${baseUrl}${path}`)}</loc><lastmod>${lastmod}</lastmod></url>`),
    "</urlset>",
    "",
  ].join("\n");

const fileFor = (urlPath: string): string => `${urlPath.replace(/^\//, "")}index.html`;

const INTRO = {
  fr: (count: number) => `${count} profil${count > 1 ? "s" : ""} publié${count > 1 ? "s" : ""}. Identité révélée uniquement après accord du freelance.`,
  en: (count: number) => `${count} published profile${count > 1 ? "s" : ""}. Identity revealed only after the freelancer agrees.`,
} as const;

export class RiskyProfileError extends Error {
  constructor(id: string, score: number, reasons: readonly string[]) {
    super(`profil ${id} : risque de ré-identification ${score}/100, publication refusée — ${reasons.join(" · ")}`);
    this.name = "RiskyProfileError";
  }
}

/** Pure: profiles in, files out. Refuses to publish a profile whose combination of attributes identifies the person. */
export const buildProfilesSite = (profiles: readonly PublicProfile[], { baseUrl, namedArm, contactEmail, indexNowKey }: SiteOptions): SiteFile[] => {
  for (const profile of profiles) {
    const risk = reidentificationRisk(profile);
    if (risk.blocking) throw new RiskyProfileError(profile.id, risk.score, risk.reasons.map((r) => r.signal));
  }
  const namedTwin = namedArm === undefined ? undefined : profiles.find((p) => p.id === namedArm.profileId);
  if (namedArm !== undefined && namedTwin === undefined) {
    throw new Error(`bras nominatif : aucun profil ${namedArm.profileId} dans le lot, les deux bras doivent porter les mêmes faits`);
  }
  const namedEntries = namedTwin === undefined || namedArm === undefined ? [] : [{ profile: namedTwin, named: namedArm.identity }];
  const lastmod = profiles.map((p) => p.availability.updatedAt).sort().at(-1) ?? "1970-01-01";
  const indexable = publishedOrder(profiles.filter((p) => !isThin(p)));
  // Une page d'entrée ne compte et ne liste que des profils publiables : sinon elle renverrait vers des pages noindex.
  const intents = intentsOf(indexable);

  const files: SiteFile[] = [];
  const indexablePaths: string[] = [];

  for (const locale of LOCALES) {
    for (const profile of profiles) {
      const thin = isThin(profile);
      files.push({
        path: fileFor(profilePath(locale, profile.id)),
        content: renderProfilePage({
          profile,
          locale,
          baseUrl,
          intents: intentRefs(intents, locale, (i) => i.profiles.some((p) => p.id === profile.id)),
          noindex: thin,
          // Un lien vers une page noindex gaspille l'exploration : on ne relie qu'entre profils publiables.
          related: relatedProfiles(profile, indexable),
          contactEmail,
        }),
      });
      if (!thin) indexablePaths.push(profilePath(locale, profile.id));
    }

    // Bras nominatif : mêmes faits, même gabarit, même maillage interne — seule l'identité change.
    for (const entry of namedEntries) {
      files.push({
        path: fileFor(namedPath(locale, entry.named.slug)),
        content: renderProfilePage({
          profile: entry.profile,
          locale,
          baseUrl,
          intents: intentRefs(intents, locale, (i) => i.profiles.some((p) => p.id === entry.profile.id)),
          noindex: isThin(entry.profile),
          named: entry.named,
          related: relatedProfiles(entry.profile, indexable),
          contactEmail,
        }),
      });
      if (!isThin(entry.profile)) indexablePaths.push(namedPath(locale, entry.named.slug));
    }

    for (const intent of intents) {
      files.push({
        path: fileFor(intentPath(locale, intent.slug)),
        content: renderListPage({
          locale,
          baseUrl,
          path: intentPath(locale, intent.slug),
          otherPath: intentPath(locale === "fr" ? "en" : "fr", intent.slug),
          title: LABELS[locale].intentTitle(intent.skill, intent.area),
          intro: INTRO[locale](intent.profiles.length),
          profiles: intent.profiles,
        }),
      });
      indexablePaths.push(intentPath(locale, intent.slug));
    }

    files.push({
      path: fileFor(homePath(locale)),
      content: renderListPage({
        locale,
        baseUrl,
        path: homePath(locale),
        otherPath: homePath(locale === "fr" ? "en" : "fr"),
        title: LABELS[locale].homeTitle,
        intro: INTRO[locale](indexable.length),
        profiles: indexable,
        links: intentRefs(intents, locale, () => true),
        namedEntries,
      }),
    });
    indexablePaths.push(homePath(locale));

    files.push({ path: fileFor(contactPath(locale)), content: renderContactPage(locale, baseUrl, contactEmail) });
    indexablePaths.push(contactPath(locale));

    files.push({ path: fileFor(methodPath(locale)), content: renderMethodPage(locale, baseUrl) });
    indexablePaths.push(methodPath(locale));
  }

  // API de lecture statique : un agent peut interroger le catalogue sans serveur, avec la même règle de tri publiée.
  files.push(publicApi(profiles, baseUrl));
  files.push({ path: "robots.txt", content: robots(baseUrl) });
  if (indexNowKey !== undefined) files.push(indexNowKeyFile(indexNowKey));
  files.push({ path: "sitemap.xml", content: sitemap(baseUrl, indexablePaths.sort(), lastmod) });
  return files.sort((a, b) => a.path.localeCompare(b.path));
};
