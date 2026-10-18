import { describe, expect, it } from "vitest";
import { SavedFiltersSchema } from "@proofseen/db";
import { companyDirectoryQuery, companySearch } from "../src/lib/company-directory-filters";
import { activeFilterCount, EMPTY_QUERY, savedFiltersOf, searchFilters, searchHref, searchParamsOf, searchQuery } from "../src/lib/freelancer-search";
import { activeChips, clearedQuery } from "../src/lib/search-chips";

const parse = (query: string) => searchQuery(new URLSearchParams(query));

describe("company search address (C22): keywords, job title, facts, photo, portfolio, order", () => {
  it("reads the new filters and writes them back to the same query", () => {
    const q = parse("q=%20migration%20%20cloud%20&poste=data-engineer&maintenant=1&missions=1&photo=on&realisations=1&tri=faits_verifies");
    expect(q).toMatchObject({ text: "migration cloud", jobTitle: "data-engineer", availableNow: true, verifiedMissionsOnly: true, photoOnly: true, portfolioOnly: true, sort: "faits_verifies" });
    expect(searchQuery(searchParamsOf(q))).toEqual(q);
    expect(searchFilters(q)).toMatchObject({ text: "migration cloud", jobTitle: "data-engineer", availableNow: true, verifiedMissionsOnly: true, photoOnly: true, portfolioOnly: true, sort: "verified_facts" });
  });

  it("drops an unknown job title, a too long text and unknown orders", () => {
    expect(parse("poste=astronaute").jobTitle).toBe("");
    expect(parse(`q=${"x".repeat(201)}`).text).toBe("");
    expect(parse("tri=score").sort).toBe("recent");
    expect(parse("tri=pertinence").sort).toBe("recent");
    expect(searchFilters(EMPTY_QUERY)).not.toHaveProperty("text");
    expect(searchFilters(EMPTY_QUERY)).not.toHaveProperty("jobTitle");
  });

  it("merges ticked skills and the comma list, without duplicates in any case", () => {
    expect(parse("competences=React,%20Go&competence=go&competence=Rust&competence=").skills).toEqual(["React", "Go", "Rust"]);
    expect(searchHref("fr", parse("competence=Rust&competence=Go"))).toBe("/fr/app/recherche?competences=Rust%2C+Go");
  });

  it("counts the active filters, order and page aside", () => {
    expect(activeFilterCount(EMPTY_QUERY)).toBe(0);
    expect(activeFilterCount(parse("q=go&competences=A,B&ville=Lyon&mode=remote&siret=1&tri=tjm_croissant&page=2"))).toBe(6);
  });
});

describe("active filter chips", () => {
  it("gives one chip per filter, each removing only itself, back on page 1 with the same order", () => {
    const q = parse("q=go&competences=React,Go&ville=Lyon&langue=en&niveau=b2&mode=remote&tjm_min=400&dispo_avant=2026-12-01&urssaf=1&tri=tjm_decroissant&page=3");
    const chips = activeChips(q);
    expect(chips.map((c) => c.kind)).toEqual(["text", "skill", "skill", "city", "language", "mode", "minRate", "availableBy", "toggle"]);
    const react = chips.find((c) => c.kind === "skill" && c.value === "React");
    expect(react?.query.skills).toEqual(["Go"]);
    expect(react?.query.page).toBe(1);
    expect(react?.query.sort).toBe("tjm_decroissant");
    const urssaf = chips.find((c) => c.kind === "toggle");
    expect(urssaf?.query.vigilanceValidOnly).toBe(false);
    expect(urssaf?.query.city).toBe("Lyon");
    expect(clearedQuery(q)).toEqual({ ...EMPTY_QUERY, sort: "tjm_decroissant" });
    expect(activeChips(EMPTY_QUERY)).toEqual([]);
  });
});

describe("saved search filters", () => {
  it("keeps the filters without order or page, in a form the repository accepts", () => {
    const q = parse("q=go&competences=Rust&poste=devops-sre&ville=Nantes&dispo_avant=2026-11-15&photo=1&tri=faits_verifies&page=4");
    const saved = savedFiltersOf(q);
    expect(saved).not.toHaveProperty("sort");
    expect(saved).not.toHaveProperty("page");
    expect(saved).toMatchObject({ text: "go", skills: ["Rust"], jobTitle: "devops-sre", city: "Nantes", availableBy: "2026-11-15", photoOnly: true });
    expect(SavedFiltersSchema.safeParse(saved).success).toBe(true);
    expect(SavedFiltersSchema.safeParse(JSON.parse(JSON.stringify(saved))).success).toBe(true);
  });
});

describe("companies directory address", () => {
  it("reads city, type, hiring, registry, order and page; anything else is no filter", () => {
    expect(companyDirectoryQuery(new URLSearchParams("ville=Lyon&type=pme&recrute=1&siret=on&tri=missions&page=2"))).toEqual({ city: "Lyon", kind: "pme", hiringOnly: true, registryActiveOnly: true, sort: "missions", page: 2 });
    expect(companyDirectoryQuery(new URLSearchParams("type=banque&tri=score&page=99"))).toEqual({ city: "", kind: "", hiringOnly: false, registryActiveOnly: false, sort: "name", page: 1 });
    expect(companySearch(companyDirectoryQuery(new URLSearchParams("")))).not.toHaveProperty("kind");
  });
});
