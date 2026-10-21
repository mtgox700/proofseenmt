import { describe, expect, it } from "vitest";
import { NO_COMPANY_FILTERS, renderCompanyDirectory, type CompanyDirectoryCardView, type CompanyDirectoryFacetsView, type CompanyDirectoryFilters } from "../src/company-directory";
import { llmsTxt } from "../src/llms-txt";
import { marketplaceRobots, verifyMarketplace, type FetchAs, type Served } from "../src/marketplace-verify";
import { NO_DIRECTORY_FILTERS, renderProfileDirectory } from "../src/profile-directory";

const BASE = "https://proofseen.com";

const COMPANIES: readonly CompanyDirectoryCardView[] = [
  {
    slug: "acme-data",
    name: "Acme Data",
    city: "Lyon",
    kind: "pme",
    registryActiveCheckedAt: new Date("2026-10-02T00:00:00Z"),
    memberSince: new Date("2026-09-01T00:00:00Z"),
    openMissions: 3,
    response: { medianDays: 2, decided: 7 },
  },
  { slug: "boite-x", name: "Boîte <X> & fils", city: null, kind: "startup", registryActiveCheckedAt: null, memberSince: new Date("2026-10-01T00:00:00Z"), openMissions: 0, response: null },
];

const FACETS: CompanyDirectoryFacetsView = {
  total: 2,
  cities: [{ key: "lyon", label: "Lyon", count: 1 }],
  kinds: [
    { kind: "startup", count: 1 },
    { kind: "pme", count: 1 },
  ],
  hiring: 1,
  registryActive: 1,
};

const render = (filters: CompanyDirectoryFilters = NO_COMPANY_FILTERS, lang: "fr" | "en" = "fr", items = COMPANIES): string =>
  renderCompanyDirectory(items, { baseUrl: BASE, lang, filters, facets: FACETS, hasMore: false });

const scriptsOutsideJsonLd = (html: string): number => [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/application\/ld\+json/.test(attrs ?? "")).length;

describe("annuaire public des entreprises", () => {
  it("rend des cartes de faits, sans JavaScript, et échappe ce que l'entreprise a déclaré", () => {
    const html = render();
    expect(scriptsOutsideJsonLd(html)).toBe(0);
    expect(html).toContain('<a href="/fr/entreprises/acme-data">Acme Data</a>');
    expect(html).toContain("Boîte &lt;X&gt; &amp; fils");
    expect(html).toContain("3 missions ouvertes");
    expect(html).toContain("Aucune mission ouverte");
    // Le carré vert précède le seul fait contrôlé par un tiers ; ce que Proofseen mesure porte un carré neutre.
    expect(html).toContain('<li class="vline"><span class="pin" aria-hidden="true"></span><span>Entreprise active au répertoire officiel (vérifié le 2 octobre 2026)</span></li>');
    expect(html).toContain('<li class="vline open"><span class="pin open" aria-hidden="true"></span><span>Répond en 2 jours (médiane, 7 candidatures)</span></li>');
    expect(html).toContain('<li class="vline open"><span class="pin open" aria-hidden="true"></span><span>Inscrite sur Proofseen depuis le 1 septembre 2026</span></li>');
    expect(html).toContain('<li class="vline open"><span class="pin open" aria-hidden="true"></span><span>Activité au répertoire officiel non confirmée</span></li>');
    // La liste des faits n'est plus la liste « vérifiés » des freelances, dont chaque ligne reçoit une coche verte.
    expect(html).not.toContain('<ul class="verified">');
    expect(html).toMatch(/<span class="avatar sq tone-\d" aria-hidden="true">AD<\/span>/);
    expect(html).not.toMatch(/rating|score"|aggregateRating/i);
  });

  it("montre l'effectif de chaque option, l'ordre choisi, et sort de l'index une fois filtrée", () => {
    const bare = render();
    expect(bare).toContain('<link rel="canonical" href="https://proofseen.com/fr/entreprises">');
    expect(bare).not.toContain("noindex");
    expect(bare).toContain("<option value=\"Lyon\">Lyon (1)</option>");
    expect(bare).toContain("<option value=\"pme\">PME (1)</option>");
    expect(bare).toContain("Ordre choisi : Nom, de A à Z.");
    const filtered = render({ ...NO_COMPANY_FILTERS, city: "Lyon", kind: "pme", hiringOnly: true, sort: "missions" });
    expect(filtered).toContain('<meta name="robots" content="noindex, follow">');
    expect(filtered).toContain('<option value="Lyon" selected>Lyon (1)</option>');
    expect(filtered).toContain('<option value="pme" selected>PME (1)</option>');
    expect(filtered).toContain('name="recrute" value="1" checked');
    expect(filtered).toContain("Ordre choisi : Nombre de missions ouvertes.");
  });

  it("distingue l'annuaire vide d'une recherche sans résultat, et existe en anglais", () => {
    expect(render(NO_COMPANY_FILTERS, "fr", [])).toContain("Aucune entreprise n&#39;a encore ouvert de page publique.");
    // Personne du tout : pas de panneau de filtres à régler pour rien.
    const nobody = renderCompanyDirectory([], { baseUrl: BASE, lang: "fr", filters: NO_COMPANY_FILTERS, facets: { total: 0, cities: [], kinds: [], hiring: 0, registryActive: 0 }, hasMore: false });
    expect(nobody).toContain('<div class="blank">');
    expect(nobody).not.toContain('<details class="drawer">');
    expect(render({ ...NO_COMPANY_FILTERS, hiringOnly: true }, "fr", [])).toContain("Aucune entreprise ne correspond à ces filtres.");
    // C23 : que faire ensuite, en liens simples et sans invitation (inviter se fait depuis l'espace connecté).
    const none = render(NO_COMPANY_FILTERS, "fr", []);
    expect(none).toContain('<a href="/fr/creer-un-compte">Vous recrutez : créez votre compte et ouvrez la page de votre entreprise</a>');
    expect(none).not.toContain("invitations");
    expect(render({ ...NO_COMPANY_FILTERS, hiringOnly: true }, "fr", [])).toContain('<a href="/fr/entreprises">Retirer les filtres</a>');
    const en = render(NO_COMPANY_FILTERS, "en");
    expect(en).toContain("Companies on Proofseen");
    expect(en).toContain('<a href="/en/entreprises" aria-current="page">Companies</a>');
    expect(en).toContain("SME (1)");
  });

  it("figure dans llms.txt avec son sitemap", () => {
    const text = llmsTxt(BASE, []);
    expect(text).toContain(`- [Companies](${BASE}/fr/entreprises)`);
    expect(text).toContain(`${BASE}/sitemap-companies.xml`);
  });
});

describe("marketplace-verify sur les deux annuaires", () => {
  it("valide l'annuaire des freelances et celui des entreprises tels que les renderers les produisent", async () => {
    const pagesSitemap = `${BASE}/sitemap-pages.xml`;
    const card = {
      slug: "fr-abcde",
      reference: "FR-ABCDE",
      displayName: null,
      headline: "Dev Rust",
      city: "Lyon",
      workMode: "remote" as const,
      skills: ["Rust"],
      facts: { registryActive: false, identityVerified: true, vigilanceValid: false, verifiedMissions: 0, payingClients: 0 },
      updatedAt: new Date("2026-10-14T00:00:00Z"),
    };
    const served: Record<string, string> = {
      [`${BASE}/fr/freelances`]: renderProfileDirectory([card], { baseUrl: BASE, lang: "fr", filters: NO_DIRECTORY_FILTERS, hasMore: false }),
      [`${BASE}/fr/entreprises`]: render(),
    };
    const html = (body: string): Served => ({ status: 200, body, contentType: "text/html; charset=utf-8", robotsHeader: null });
    const text = (body: string): Served => ({ status: 200, body, contentType: "text/plain", robotsHeader: null });
    const fetchAs: FetchAs = async (url) => {
      const body = served[url];
      if (body !== undefined) return html(body);
      if (url === `${BASE}/robots.txt`) return text(marketplaceRobots(BASE));
      if (url === pagesSitemap) return text(`<urlset><url><loc>${BASE}/fr/freelances</loc></url><url><loc>${BASE}/fr/entreprises</loc></url></urlset>`);
      return { status: 404, body: "", contentType: "text/plain", robotsHeader: null };
    };
    const report = await verifyMarketplace({
      baseUrl: BASE,
      fetchAs,
      pages: [
        { url: `${BASE}/fr/freelances`, texts: ["Freelance FR-ABCDE", "Identité vérifiée par le prestataire de paiement"], sitemap: pagesSitemap },
        { url: `${BASE}/fr/entreprises`, texts: ["Acme Data", "3 missions ouvertes", "Répond en 2 jours (médiane, 7 candidatures)"], sitemap: pagesSitemap },
      ],
    });
    expect(report.checks.filter((c) => c.status === "fail")).toEqual([]);
  });
});
