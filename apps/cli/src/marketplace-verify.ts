import { cityPages, companyPages, getDb, jobTitlePages, missions, publicProfiles, skillPages } from "@proofseen/db";
import {
  cityUrl,
  companyUrl,
  directoryUrl,
  jobTitleIndexUrl,
  jobTitleUrl,
  missionUrl,
  profileName,
  profileUrl,
  simulatorUrl,
  skillIndexUrl,
  skillUrl,
  verifyMarketplace,
  type PageExpectation,
  type Served,
} from "@proofseen/hub";
import { CliError } from "./files";

/*
 * marketplace-verify : vérifie les pages publiques de la marketplace telles que les moteurs les voient. Ce que chaque
 * page doit montrer vient de la base (profils publiés, missions ouvertes) ; ce qu'elle montre vient du réseau, demandé
 * comme un navigateur puis comme chaque robot d'IA. Rien n'est jugé sur le build local : seulement sur ce qui est servi.
 */

export interface MarketplaceVerifyCommand {
  readonly log: (line: string) => void;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  /** Au plus ce nombre de profils et de missions vérifiés : une vérification, pas un aspirateur. */
  readonly limit: number;
  readonly fetchImpl?: typeof fetch;
}

const expectations = async (baseUrl: string, limit: number): Promise<PageExpectation[]> => {
  const db = getDb();
  const pages: PageExpectation[] = [];
  for (const { slug } of (await publicProfiles(db).listForSitemap()).slice(0, limit)) {
    const p = await publicProfiles(db).page(slug);
    if (p === null) continue;
    pages.push({ url: profileUrl(baseUrl, "fr", slug), texts: [profileName(p, "fr"), p.headline, p.summary, p.city, ...p.skills], sitemap: `${baseUrl}/sitemap-profiles.xml` });
  }
  for (const { id } of (await missions(db).listOpenForSitemap()).slice(0, limit)) {
    const m = await missions(db).findPublic(id);
    if (m === null) continue;
    pages.push({ url: missionUrl(baseUrl, "fr", id), texts: [m.title, m.organisationName, ...m.skills], sitemap: `${baseUrl}/sitemap-missions.xml` });
  }
  for (const { key } of (await skillPages(db).listForSitemap()).slice(0, limit)) {
    const s = await skillPages(db).page(key);
    if (s === null) continue;
    pages.push({ url: skillUrl(baseUrl, "fr", key), texts: [s.label, ...s.missions.map((m) => m.title), ...s.profiles.map((p) => p.headline)], sitemap: `${baseUrl}/sitemap-skills.xml` });
  }
  for (const { key } of (await cityPages(db).listForSitemap()).slice(0, limit)) {
    const c = await cityPages(db).page(key);
    if (c === null) continue;
    pages.push({ url: cityUrl(baseUrl, "fr", key), texts: [c.label, ...c.missions.map((m) => m.title)], sitemap: `${baseUrl}/sitemap-missions.xml` });
  }
  for (const { slug } of (await companyPages(db).listForSitemap()).slice(0, limit)) {
    const c = await companyPages(db).page(slug);
    if (c === null) continue;
    pages.push({ url: companyUrl(baseUrl, "fr", slug), texts: [c.name, ...c.missions.map((m) => m.title)], sitemap: `${baseUrl}/sitemap-companies.xml` });
  }
  const titles = (await jobTitlePages(db).listForSitemap()).slice(0, limit);
  for (const { key } of titles) {
    const t = await jobTitlePages(db).page(key);
    if (t === null) continue;
    pages.push({ url: jobTitleUrl(baseUrl, "fr", key), texts: [t.label.fr, ...t.missions.map((m) => m.title), ...t.profiles.map((p) => p.headline)], sitemap: `${baseUrl}/sitemap-job-titles.xml` });
  }
  pages.push({ url: jobTitleIndexUrl(baseUrl, "fr"), texts: titles.map((t) => t.label.fr), sitemap: `${baseUrl}/sitemap-pages.xml` });
  // Le simulateur ne dépend pas de la base : ses taux et leurs sources doivent être dans le HTML servi.
  pages.push({ url: simulatorUrl(baseUrl, "fr"), texts: ["Simulateur de revenu net d'un freelance", "Taux en vigueur au"], sitemap: `${baseUrl}/sitemap-pages.xml` });
  // L'annuaire et l'index des métiers : leur première page porte les profils et les métiers que la base liste.
  const directory = (await publicProfiles(db).directory({})).items.slice(0, limit);
  pages.push({ url: directoryUrl(baseUrl, "fr"), texts: directory.map((c) => c.headline), sitemap: `${baseUrl}/sitemap-pages.xml` });
  const skills = (await skillPages(db).listForSitemap()).slice(0, limit);
  pages.push({ url: skillIndexUrl(baseUrl, "fr"), texts: skills.map((s) => s.label), sitemap: `${baseUrl}/sitemap-pages.xml` });
  return pages;
};

export const commandMarketplaceVerify = async (o: MarketplaceVerifyCommand): Promise<void> => {
  if ((process.env.DATABASE_URL ?? "") === "") throw new CliError("DATABASE_URL absente : la liste des pages publiques vient de la base.");
  const baseUrl = new URL(o.baseUrl).origin;
  // Jamais vide : l'annuaire et l'index des métiers existent même sans profil publié ni mission ouverte.
  const pages = await expectations(baseUrl, o.limit);
  const doFetch = o.fetchImpl ?? fetch;
  o.log(`${pages.length} pages à vérifier sur ${baseUrl}, comme un navigateur puis comme chaque robot d'IA…`);
  const report = await verifyMarketplace({
    baseUrl,
    pages,
    fetchAs: async (url, userAgent): Promise<Served> => {
      try {
        const response = await doFetch(url, { redirect: "follow", signal: AbortSignal.timeout(o.timeoutMs), headers: { "user-agent": userAgent } });
        return { status: response.status, body: await response.text(), contentType: response.headers.get("content-type") ?? "", robotsHeader: response.headers.get("x-robots-tag") };
      } catch {
        return { status: 0, body: "", contentType: "", robotsHeader: null };
      }
    },
  });
  const mark = { ok: "[ ok ]", warn: "[warn]", fail: "[FAIL]" };
  report.checks.forEach((c) => o.log(`${mark[c.status]} ${c.name} : ${c.detail}`));
  if (!report.ok) throw new CliError("des pages publiques ne sont pas servies comme les moteurs doivent les voir (voir les lignes [FAIL]).");
  o.log("Pages publiques conformes : même contenu pour tous les robots, aucun noindex, faits présents sans JavaScript.");
};
