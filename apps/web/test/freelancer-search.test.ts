import { describe, expect, it } from "vitest";
import { EMPTY_QUERY, queryFromBrief, SEARCH_PAGE_SIZE, searchFilters, searchHref, searchParamsOf, searchQuery } from "../src/lib/freelancer-search";

const parse = (query: string) => searchQuery(new URLSearchParams(query));

describe("company search address", () => {
  it("reads every filter of a shared address", () => {
    const q = parse("competences=React,%20Node.js,%20React&ville=Lyon&mode=hybrid&mode=remote&tjm_min=450&tjm_max=700,50&dispo_avant=2026-12-01&disponible=1&adresse=on&siret=1&urssaf=1&tri=tjm_croissant&page=3");
    expect(q).toEqual({
      ...EMPTY_QUERY,
      skills: ["React", "Node.js"],
      city: "Lyon",
      languages: [],
      workModes: ["remote", "hybrid"],
      minRateCents: 45_000,
      maxRateCents: 70_050,
      availableBy: "2026-12-01",
      availableOnly: true,
      provenOnly: true,
      registryActiveOnly: true,
      vigilanceValidOnly: true,
      sort: "tjm_croissant",
      page: 3,
    });
  });

  it("drops malformed fields one by one instead of failing", () => {
    const q = parse(`competences=${"x".repeat(61)},Go&ville=${"v".repeat(121)}&mode=space&tjm_min=abc&tjm_max=999999999&dispo_avant=2026-02-30&disponible=yes&tri=score&page=51`);
    expect(q).toEqual({ ...EMPTY_QUERY, skills: ["Go"] });
    expect(parse("page=0").page).toBe(1);
    expect(parse("page=2.5").page).toBe(1);
    expect(parse("tri=relevance").sort).toBe("recent");
  });

  it("keeps ten skills at most", () => {
    expect(parse(`competences=${Array.from({ length: 15 }, (_, i) => `s${i}`).join(",")}`).skills).toHaveLength(10);
  });

  it("turns a query into the repository's filters, with a stated sort and a fixed page size", () => {
    const filters = searchFilters(parse("competences=Go&ville=Paris&tjm_max=600&dispo_avant=2026-11-15&urssaf=1&tri=disponibilite"));
    expect(filters).toEqual({
      skills: ["Go"],
      languages: [],
      workModes: [],
      city: "Paris",
      maxDailyRateCents: 60_000,
      availableBy: new Date("2026-11-15T00:00:00Z"),
      availableOnly: false,
      availableNow: false,
      provenOnly: false,
      verifiedMissionsOnly: false,
      registryActiveOnly: false,
      vigilanceValidOnly: true,
      photoOnly: false,
      portfolioOnly: false,
      sort: "availability",
      page: 1,
      pageSize: SEARCH_PAGE_SIZE,
    });
    expect(searchFilters(EMPTY_QUERY)).not.toHaveProperty("city");
  });

  it("writes a canonical address that reads back to the same query", () => {
    const q = parse("competences=Rust&ville=Nantes&mode=onsite&tjm_min=500&disponible=1&siret=1&tri=tjm_decroissant&page=2");
    expect(searchQuery(searchParamsOf(q))).toEqual(q);
    expect(searchParamsOf(EMPTY_QUERY).toString()).toBe("");
    expect(searchHref("fr", EMPTY_QUERY)).toBe("/fr/app/recherche");
    expect(searchHref("en", { ...EMPTY_QUERY, page: 2 }, { ajout: "added" })).toBe("/en/app/recherche?page=2&ajout=added");
  });

  it("reads language filters as pairs of language and minimum level, three at most, one per language", () => {
    const q = parse("langue=en&niveau=b2&langue=&niveau=c1&langue=DE&niveau=C1&langue=en&niveau=a1&langue=xx&niveau=b2&langue=es&niveau=expert&langue=it&niveau=b1");
    expect(q.languages).toEqual([
      { code: "en", minLevel: "b2" },
      { code: "de", minLevel: "c1" },
      { code: "es", minLevel: "a1" },
    ]);
    expect(parse("langue=en").languages).toEqual([{ code: "en", minLevel: "a1" }]);
    expect(searchFilters(q).languages).toEqual(q.languages);
  });

  it("writes language filters back into the address, and reads them again", () => {
    const q = parse("competences=Go&langue=fr&niveau=native&langue=en&niveau=c1");
    expect(searchParamsOf(q).toString()).toBe("competences=Go&langue=fr&niveau=native&langue=en&niveau=c1");
    expect(searchQuery(searchParamsOf(q))).toEqual(q);
  });

  it("shows a brief's languages as visible filters", () => {
    const q = queryFromBrief({ skills: ["React"], workModes: [], availableOnly: false, languages: [{ code: "en", minLevel: "b2" }] });
    expect(q.languages).toEqual([{ code: "en", minLevel: "b2" }]);
    expect(searchHref("fr", q)).toBe("/fr/app/recherche?competences=React&langue=en&niveau=b2");
  });

  it("shows a brief's filters as an editable query, never with an order of its own", () => {
    const q = queryFromBrief({ skills: ["React", "x".repeat(61)], city: "Lyon", workModes: ["hybrid"], maxDailyRateCents: 60_000, availableOnly: true });
    expect(q).toEqual({ ...EMPTY_QUERY, skills: ["React"], city: "Lyon", workModes: ["hybrid"], maxRateCents: 60_000, availableOnly: true });
    expect(queryFromBrief({ skills: [], workModes: [], availableOnly: false })).toEqual(EMPTY_QUERY);
  });
});
