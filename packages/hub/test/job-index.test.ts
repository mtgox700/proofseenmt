import { describe, expect, it } from "vitest";
import { renderJobIndex, type JobIndexFilters } from "../src/job-index";
import type { PublicMission } from "../src/job-posting";

const MISSION: PublicMission = {
  id: "0199a1b2-0000-7000-8000-000000000001",
  organisationName: "Acme",
  title: "Développeur Rust",
  description: "Embarqué.",
  skills: ["Rust"],
  durationMonths: 4,
  dailyRateMinCents: 60_000,
  dailyRateMaxCents: 60_000,
  currency: "EUR",
  city: "Lyon",
  workMode: "onsite",
  publishedAt: new Date("2026-10-19T09:00:00Z"),
};

const PLAIN: JobIndexFilters = { mode: [], skill: "", city: "", sort: "recent", page: 1 };
const render = (filters: JobIndexFilters, hasMore = false, items = [MISSION]) =>
  renderJobIndex(items, { baseUrl: "https://proofseen.com", lang: "fr", filters, hasMore });

describe("index public des missions", () => {
  it("se lit et se filtre sans JavaScript", () => {
    const html = render(PLAIN);
    // No script but the JSON-LD: the page as a collection of the missions it lists.
    for (const [, attrs] of html.matchAll(/<script\b([^>]*)>/gi)) expect(attrs).toBe(' type="application/ld+json"');
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as { "@type": string; mainEntity: { numberOfItems: number; itemListElement: Array<{ url: string }> } };
    expect(ld["@type"]).toBe("CollectionPage");
    expect(ld.mainEntity.numberOfItems).toBe(1);
    expect(ld.mainEntity.itemListElement[0]?.url).toBe("https://proofseen.com/fr/missions/0199a1b2-0000-7000-8000-000000000001");
    expect(html).toContain('<form class="filters" method="get" action="/fr/missions">');
    expect(html).toContain('<a href="/fr/missions/0199a1b2-0000-7000-8000-000000000001">Développeur Rust</a>');
    expect(html).toContain("Lyon · Sur site");
    expect(html).not.toContain('name="robots"');
  });

  it("garde les filtres choisis dans le formulaire et dans la pagination", () => {
    const html = render({ mode: ["remote"], skill: "Rust", city: "Lyon", sort: "rate_desc", page: 2 }, true);
    expect(html).toContain('value="remote" checked');
    expect(html).toContain('<option value="rate_desc" selected>');
    expect(html).toContain('href="/fr/missions?mode=remote&amp;competence=Rust&amp;ville=Lyon&amp;tri=rate_desc&amp;page=3"');
    expect(html).toContain('href="/fr/missions?mode=remote&amp;competence=Rust&amp;ville=Lyon&amp;tri=rate_desc"');
    // Une recherche filtrée ne se fait pas indexer : seule la liste nue est canonique.
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
  });

  it("échappe ce que le visiteur a tapé dans les filtres", () => {
    const html = render({ ...PLAIN, skill: '"><script>alert(1)</script>' });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("dit clairement quand rien ne correspond", () => {
    // Aucune mission ouverte du tout : la page le dit, sans formulaire inutile, et propose quoi faire.
    const none = render(PLAIN, false, []);
    expect(none).toContain("Aucune mission n&#39;est ouverte aujourd&#39;hui.");
    expect(none).not.toContain("ne correspond à ces filtres");
    expect(none).not.toContain('<form class="filters"');
    expect(none).toContain('<a href="/fr/creer-un-compte">Vous recrutez : créez un compte et publiez une mission</a>');
    // Des filtres sans résultat : la page le dit autrement, garde le formulaire et propose de les retirer.
    const filtered = render({ ...PLAIN, skill: "Cobol" }, false, []);
    expect(filtered).toContain("Aucune mission ne correspond à ces filtres.");
    expect(filtered).toContain('<form class="filters"');
    expect(filtered).toContain('<a href="/fr/missions">Retirer les filtres</a>');
    expect(filtered).toContain('<details class="drawer" open>');
  });
});
