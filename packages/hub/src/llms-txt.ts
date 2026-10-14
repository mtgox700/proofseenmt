import { directoryUrl } from "./profile-directory";
import { skillIndexUrl } from "./skill-index";
import { skillUrl } from "./skill-page";

/*
 * /llms.txt (format de llmstxt.org) : un titre H1, un résumé en citation, puis des sections de liens. Il dit ce que
 * sont les pages publiques et où les trouver, rien d'autre : aucun chiffre qui ne serait pas compté, aucune promesse.
 * Les pages métiers listées sont celles qui existent dans la base au moment de la requête.
 */

export interface LlmsSkill {
  readonly key: string;
  readonly label: string;
}

const MAX_SKILLS = 200;
const FORMAT = new RegExp(String.raw`\p{Cf}`, "gu");
const CONTROL = new RegExp(String.raw`\p{Cc}`, "gu");

/**
 * Le texte d'un lien, sur une seule ligne : un saut de ligne dans un libellé ajouterait une ligne entière (un titre, une
 * consigne) au fichier que lisent les moteurs. Nettoyé ici aussi, et pas seulement à l'écriture : un libellé enregistré
 * avant ce nettoyage reste en base.
 */
const linkText = (skill: LlmsSkill): string =>
  skill.label.replace(FORMAT, "").replace(CONTROL, " ").replace(/[[\]]/g, "").replace(/\s+/g, " ").trim() || skill.key;

export const llmsTxt = (baseUrl: string, skills: readonly LlmsSkill[]): string => {
  const base = baseUrl.replace(/\/$/, "");
  const sorted = [...skills].sort((a, b) => a.label.localeCompare(b.label, "fr") || a.key.localeCompare(b.key)).slice(0, MAX_SKILLS);
  return [
    "# Proofseen",
    "",
    "> Proofseen is a French marketplace for tech freelance missions. Companies publish missions; freelancers publish profiles that carry verified, dated facts (business registry status, social-contribution certificate checked by an operator, proven ownership of their websites). Profiles are never scored or ranked.",
    "",
    "Every public page is plain server-rendered HTML in French (`/fr/`) and English (`/en/`), readable without JavaScript, with schema.org JSON-LD. Pseudonymous profiles show a reference (FR-XXXXX) instead of a name. Contact between companies and freelancers goes through the platform.",
    "",
    "## Public pages",
    "",
    `- [Open missions](${base}/fr/missions): every open freelance mission, newest first, filterable by skill, city and work mode. English: ${base}/en/missions`,
    `- [Freelancers](${directoryUrl(base, "fr")}): directory of published profiles, most recently updated first, filterable by skill and city. English: ${directoryUrl(base, "en")}`,
    `- [Skills](${skillIndexUrl(base, "fr")}): one page per skill that real open missions or published profiles carry, with dated counts. English: ${skillIndexUrl(base, "en")}`,
    "",
    ...(sorted.length === 0 ? [] : ["## Skill pages", "", ...sorted.map((s) => `- [${linkText(s)}](${skillUrl(base, "fr", s.key)})`), ""]),
    "## Sitemaps",
    "",
    `- [Sitemap index](${base}/sitemap.xml): points to every sitemap below.`,
    `- [Profiles](${base}/sitemap-profiles.xml): one address per published profile (/fr/profils/… and /en/profils/…).`,
    `- [Missions](${base}/sitemap-missions.xml): one address per open mission.`,
    `- [Skills](${base}/sitemap-skills.xml): one address per skill page.`,
    `- [Fixed pages](${base}/sitemap-pages.xml): home pages, indexes and directory.`,
    "",
    "## Optional",
    "",
    `- [robots.txt](${base}/robots.txt): AI search crawlers are allowed on every public page; private areas are disallowed.`,
    "",
  ].join("\n");
};
