import { describe, expect, it } from "vitest";
import { answersOf, questionsOf } from "../src/lib/mission-form";
import { missionQuery } from "../src/lib/mission-filters";

const NOW = new Date("2026-10-15T12:00:00Z");
const query = (raw: string) => missionQuery(new URLSearchParams(raw), NOW);

describe("public mission filters", () => {
  it("reads every filter into the page's form and the repository's search", () => {
    const { filters, search } = query("q=rust+embarqué&mode=remote&mode=onsite&competence=Rust&ville=Lyon&tjmMin=500&tjmMax=800&dureeMax=6&depuis=7&tri=rate_desc&page=2");
    expect(filters).toEqual({ q: "rust embarqué", mode: ["remote", "onsite"], skill: "Rust", city: "Lyon", rateMin: 500, rateMax: 800, maxDuration: 6, since: 7, sort: "rate_desc", page: 2 });
    expect(search).toEqual({
      q: "rust embarqué",
      workModes: ["remote", "onsite"],
      skills: ["Rust"],
      city: "Lyon",
      minDailyRateCents: 50_000,
      maxDailyRateCents: 80_000,
      maxDurationMonths: 6,
      publishedAfter: new Date("2026-10-08T12:00:00Z"),
      sort: "rate_desc",
      page: 2,
    });
  });

  it("falls back to no filter on anything malformed, never to an error", () => {
    const { filters, search } = query("mode=moon&mode=remote&mode=remote&tjmMin=abc&tjmMax=-3&dureeMax=0&depuis=3&tri=relevance&page=999");
    expect(filters).toMatchObject({ mode: ["remote"], rateMin: null, rateMax: null, maxDuration: null, since: null, sort: "recent", page: 1 });
    expect(search).toEqual({ workModes: ["remote"], skills: [], sort: "recent", page: 1 });
  });

  it("an empty address is the plain list", () => {
    expect(query("").search).toEqual({ workModes: [], skills: [], sort: "recent", page: 1 });
  });
});

describe("mission questions and application answers", () => {
  const form = (fields: Record<string, string>): FormData => {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
  };

  it("keeps the filled questions in order", () => {
    expect(questionsOf(form({ question1: " Pourquoi vous ? ", question2: "", question3: "Quand ?" }))).toEqual(["Pourquoi vous ?", "Quand ?"]);
  });

  it("reads one answer per field the form showed, empty ones included so the repository refuses them", () => {
    expect(answersOf(form({ answer1: " Cinq ans ", answer2: "" }))).toEqual(["Cinq ans", ""]);
    expect(answersOf(form({}))).toEqual([]);
  });
});
