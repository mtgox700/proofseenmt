import { describe, expect, it } from "vitest";
import { NO_DIRECTORY_FILTERS, directoryQueryString } from "@proofseen/hub";
import { directoryQuery, directorySearch, jobTitleOptions } from "../src/lib/directory-filters";

const parse = (query: string) => directoryQuery(new URLSearchParams(query));

describe("filters of the public freelancer directory", () => {
  it("reads skills, city, modes, job title, availability, facts and page from the address", () => {
    expect(parse("competence=Rust,%20Go&ville=%20Lyon%20&mode=remote&mode=space&poste=data-engineer&disponible=1&adresse=1&missions=on&siret=1&urssaf=1&page=2")).toEqual({
      skills: ["Rust", "Go"],
      city: "Lyon",
      workModes: ["remote"],
      jobTitle: "data-engineer",
      availableNow: true,
      provenOnly: true,
      verifiedMissionsOnly: true,
      registryActiveOnly: true,
      vigilanceValidOnly: true,
      page: 2,
    });
  });

  it("falls back to the plain list on anything malformed", () => {
    expect(parse("")).toEqual(NO_DIRECTORY_FILTERS);
    for (const page of ["0", "51", "abc", "1.5"]) expect(parse(`page=${page}`).page).toBe(1);
    expect(parse(`competence=${"x".repeat(61)}&ville=Lyon`)).toEqual({ ...NO_DIRECTORY_FILTERS, city: "Lyon" });
    expect(parse("poste=astronaute&disponible=yes").jobTitle).toBe("");
    expect(parse("competence=a,b,c,d,e,f,A").skills).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("writes an address that reads back to the same filters", () => {
    const q = parse("competence=Rust&ville=Nantes&mode=hybrid&poste=devops-sre&missions=1&page=3");
    expect(parse(directoryQueryString(q, q.page).slice(1))).toEqual(q);
    expect(directoryQueryString(NO_DIRECTORY_FILTERS, 1)).toBe("");
  });

  it("turns filters into the repository's input, and offers the job title families by label", () => {
    expect(directorySearch(parse("competence=Rust&poste=data-engineer"))).toMatchObject({ skills: ["Rust"], jobTitle: "data-engineer", page: 1 });
    const options = jobTitleOptions("en");
    expect(options.find((o) => o.key === "data-engineer")?.label).toBe("Data engineer");
    expect(options.map((o) => o.label)).toEqual([...options.map((o) => o.label)].sort((a, b) => a.localeCompare(b, "en")));
  });
});
