import { articleUrl, blogIndexUrl } from "./blog-model";
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
const oneLine = (text: string): string => text.replace(FORMAT, "").replace(CONTROL, " ").replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
const linkText = (skill: LlmsSkill): string => oneLine(skill.label) || skill.key;

/** Un article publié du blog, tel que llms.txt le liste. */
export interface LlmsArticle {
  readonly lang: "fr" | "en";
  readonly slug: string;
  readonly title: string;
  readonly description: string;
}

const MAX_SKILLS = 200;
const MAX_ARTICLES = 200;


export const llmsTxt = (baseUrl: string, skills: readonly LlmsSkill[], articles: readonly LlmsArticle[] = []): string => {
  const base = baseUrl.replace(/\/$/, "");
  const sorted = [...skills].sort((a, b) => a.label.localeCompare(b.label, "fr") || a.key.localeCompare(b.key)).slice(0, MAX_SKILLS);
  const posts = articles.slice(0, MAX_ARTICLES).map((a) => `- [${oneLine(a.title)}](${articleUrl(base, a.lang, a.slug)}): ${oneLine(a.description)}`);
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
    `- [Blog and guides](${blogIndexUrl(base, "fr")}): dated articles for freelancers and companies; every figure links to its official source. English: ${blogIndexUrl(base, "en")}`,
    `- [Day-rate barometer](${base}/fr/barometre/tjm): median and quartiles of real day rates by skill and by city, each group with its sample size n, published only above a minimum n. Data: ${base}/barometre/tjm.csv and ${base}/barometre/tjm.json, under the Creative Commons Attribution licence`,
    `- [Skills in demand](${base}/fr/barometre/competences): skills requested by recently published missions, with counts. Data: ${base}/barometre/competences.csv and ${base}/barometre/competences.json, under the Creative Commons Attribution licence`,
    "",
    ...(posts.length === 0 ? [] : ["## Articles", "", ...posts, ""]),
    ...(sorted.length === 0 ? [] : ["## Skill pages", "", ...sorted.map((s) => `- [${linkText(s)}](${skillUrl(base, "fr", s.key)})`), ""]),
    "## Sitemaps",
    "",
    `- [Sitemap index](${base}/sitemap.xml): points to every sitemap below.`,
    `- [Profiles](${base}/sitemap-profiles.xml): one address per published profile (/fr/profils/… and /en/profils/…).`,
    `- [Missions](${base}/sitemap-missions.xml): one address per open mission.`,
    `- [Skills](${base}/sitemap-skills.xml): one address per skill page.`,
    `- [Blog](${base}/sitemap-blog.xml): blog index, barometers and one address per published article.`,
    `- [Fixed pages](${base}/sitemap-pages.xml): home pages, indexes and directory.`,
    "",
    "## Optional",
    "",
    `- [robots.txt](${base}/robots.txt): AI search crawlers are allowed on every public page; private areas are disallowed.`,
    "",
  ].join("\n");
};
