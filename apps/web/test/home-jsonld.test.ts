import { describe, expect, it } from "vitest";
import { homeJsonLd } from "../src/lib/home-jsonld";

describe("home page JSON-LD", () => {
  it("names the organisation and the site of the page's language, and nothing it cannot prove", () => {
    const json = homeJsonLd("fr", "https://proofseen.com", "La preuve de ce qu'un freelance a vraiment livré.");
    const graph = JSON.parse(json)["@graph"] as Array<Record<string, unknown>>;
    expect(graph.map((node) => node["@type"])).toEqual(["Organization", "WebSite"]);
    expect(graph[1]).toMatchObject({ url: "https://proofseen.com/fr", inLanguage: "fr", publisher: { "@id": "https://proofseen.com/#organisation" } });
    expect(json).not.toMatch(/aggregateRating|review|offers|price/i);
  });

  it("cannot close its script element", () => {
    expect(homeJsonLd("en", "https://proofseen.com", "</script><b>")).not.toContain("<");
  });
});
