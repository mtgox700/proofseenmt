import { describe, expect, it } from "vitest";
import { directoryQuery } from "../src/lib/directory-filters";

const parse = (query: string) => directoryQuery(new URLSearchParams(query));

describe("filters of the public freelancer directory", () => {
  it("reads skill, city and page from the address", () => {
    expect(parse("competence=Rust&ville=%20Lyon%20&page=2")).toEqual({ skill: "Rust", city: "Lyon", page: 2 });
  });

  it("falls back to the plain list on anything malformed", () => {
    expect(parse("")).toEqual({ skill: "", city: "", page: 1 });
    expect(parse("page=0")).toEqual({ skill: "", city: "", page: 1 });
    expect(parse("page=51")).toEqual({ skill: "", city: "", page: 1 });
    expect(parse("page=abc")).toEqual({ skill: "", city: "", page: 1 });
    expect(parse("page=1.5")).toEqual({ skill: "", city: "", page: 1 });
    expect(parse(`competence=${"x".repeat(61)}&ville=Lyon`)).toEqual({ skill: "", city: "Lyon", page: 1 });
  });
});
