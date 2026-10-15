import { AI_SEARCH_BOTS } from "./build";
import type { VerifyCheck, VerifyReport } from "./verify";

/*
 * Vérifie les pages publiques de la marketplace (profils, missions) telles qu'un moteur les voit : HTML brut, aucun
 * JavaScript exécuté, et pour chaque robot d'IA le même contenu que pour un navigateur. Pur : l'appelant fait les
 * requêtes, ce module juge.
 *
 * Ce qu'on refuse : une page qui ne répond pas, une page sans ses faits dans le HTML, un script exécutable, un
 * « noindex » (balise ou en-tête), une adresse canonique fausse, un contenu différent selon le robot (cloaking), un
 * robot d'IA bloqué, une page absente de son sitemap.
 */

export const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

/** Les espaces privés : jamais indexés, et rien de public n'y vit. */
export const PRIVATE_PATHS = ["/api/", "/fr/app", "/en/app", "/fr/espace", "/en/espace"] as const;

export const marketplaceRobots = (baseUrl: string): string => {
  const base = baseUrl.replace(/\/$/, "");
  // The machine-readable profile list of the former static site stays public, inside the otherwise private /api/.
  const rules = ["Allow: /", "Allow: /api/profiles.json", ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`)].join("\n");
  return [
    ...AI_SEARCH_BOTS.map((bot) => `User-agent: ${bot}\n${rules}\n`),
    `User-agent: *\n${rules}\n`,
    `Sitemap: ${base}/sitemap-pages.xml`,
    `Sitemap: ${base}/sitemap-profiles.xml`,
    `Sitemap: ${base}/sitemap-missions.xml`,
    `Sitemap: ${base}/sitemap-skills.xml`,
    `Sitemap: ${base}/sitemap-blog.xml`,
    `Sitemap: ${base}/sitemap-companies.xml`,
    "",
  ].join("\n");
};

export interface Served {
  readonly status: number;
  readonly body: string;
  readonly contentType: string;
  /** Valeur de l'en-tête X-Robots-Tag, s'il y en a un. */
  readonly robotsHeader: string | null;
}

export type FetchAs = (url: string, userAgent: string) => Promise<Served>;

export interface PageExpectation {
  readonly url: string;
  /** Les textes qui doivent figurer dans le HTML servi : faits du profil ou de la mission. */
  readonly texts: readonly string[];
  /** Le sitemap où la page doit figurer. */
  readonly sitemap: string;
}

const ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const decode = (html: string): string => html.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);

const executableScripts = (html: string): number =>
  [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/type\s*=\s*["']application\/ld\+json["']/i.test(attrs ?? "")).length;

const noindex = (served: Served): boolean =>
  /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(served.body) || /noindex/i.test(served.robotsHeader ?? "");

/** Le contenu comparé entre robots : le corps sans espaces superflus (un même rendu peut varier d'un octet de fin). */
const fingerprint = (body: string): string => body.replace(/\s+/g, " ").trim();

const check = (name: string, problems: readonly string[], okDetail: string): VerifyCheck =>
  problems.length === 0 ? { name, status: "ok", detail: okDetail } : { name, status: "fail", detail: problems.slice(0, 5).join(" · ") + (problems.length > 5 ? ` · +${problems.length - 5}` : "") };

export const verifyMarketplace = async (input: { readonly baseUrl: string; readonly pages: readonly PageExpectation[]; readonly fetchAs: FetchAs }): Promise<VerifyReport> => {
  const base = input.baseUrl.replace(/\/$/, "");
  const served = await Promise.all(input.pages.map(async (page) => ({ page, browser: await input.fetchAs(page.url, BROWSER_USER_AGENT) })));
  const ok = served.filter((s) => s.browser.status === 200);

  const cloaking: string[] = [];
  for (const { page, browser } of ok) {
    for (const bot of AI_SEARCH_BOTS) {
      const asBot = await input.fetchAs(page.url, `Mozilla/5.0 (compatible; ${bot}/1.0)`);
      if (asBot.status !== browser.status || fingerprint(asBot.body) !== fingerprint(browser.body)) cloaking.push(`${page.url} (${bot})`);
    }
  }

  const robots = await input.fetchAs(`${base}/robots.txt`, BROWSER_USER_AGENT);
  const blocked =
    robots.status !== 200
      ? [`robots.txt : HTTP ${robots.status}`]
      : AI_SEARCH_BOTS.filter((bot) => !new RegExp(`User-agent: ${bot}\\nAllow: /\\n`).test(robots.body)).map((bot) => `${bot} non autorisé`);
  const sitemaps = new Map<string, string>();
  for (const url of new Set(input.pages.map((p) => p.sitemap))) sitemaps.set(url, (await input.fetchAs(url, BROWSER_USER_AGENT)).body);
  const undeclared = [...sitemaps.keys()].filter((url) => !robots.body.includes(`Sitemap: ${url}`));

  return finish([
    check("pages", served.filter((s) => s.browser.status !== 200).map((s) => `${s.page.url} (HTTP ${s.browser.status})`), `${served.length} pages servies en HTTP 200`),
    check("type de contenu", ok.filter((s) => !s.browser.contentType.includes("text/html")).map((s) => s.page.url), "toutes en text/html"),
    check(
      "faits dans le HTML",
      ok.flatMap(({ page, browser }) => {
        const text = decode(browser.body);
        const missing = page.texts.filter((t) => !text.includes(t));
        return missing.length === 0 ? [] : [`${page.url} : « ${missing[0]?.slice(0, 40)} » absent`];
      }),
      "chaque fait présent sans JavaScript",
    ),
    check("aucun JavaScript", ok.filter((s) => executableScripts(s.browser.body) > 0).map((s) => s.page.url), "aucun script hors données structurées"),
    check("indexable", ok.filter((s) => noindex(s.browser)).map((s) => s.page.url), "aucun noindex, ni balise ni en-tête"),
    check("adresse canonique", ok.filter((s) => !s.browser.body.includes(`<link rel="canonical" href="${s.page.url}">`)).map((s) => s.page.url), "chaque page se désigne elle-même"),
    check("même contenu pour les robots", cloaking, `contenu identique pour ${AI_SEARCH_BOTS.length} robots et un navigateur`),
    check("robots.txt", [...blocked, ...undeclared.map((u) => `sitemap non déclaré : ${u}`)], `${AI_SEARCH_BOTS.length} robots d'IA autorisés, sitemaps déclarés`),
    check(
      "sitemaps",
      input.pages.filter((p) => !(sitemaps.get(p.sitemap) ?? "").includes(`<loc>${p.url}</loc>`)).map((p) => p.url),
      "chaque page dans son sitemap",
    ),
  ]);
};

const finish = (checks: readonly VerifyCheck[]): VerifyReport => ({ checks, ok: checks.every((c) => c.status !== "fail") });
