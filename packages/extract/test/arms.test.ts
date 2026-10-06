import { describe, expect, it } from "vitest";
import { IdentitySchema, type EngineAnswer, type Identity } from "@proofseen/core";
import { analyzeAnswer } from "../src/analyze";

const SITE = "https://proofseen.example";
const arm = (id: string, names: string[], paths: string[]): Identity =>
  IdentitySchema.parse({
    id,
    displayName: names[0],
    nameVariants: names,
    city: "Paris",
    stack: ["TypeScript"],
    ownedUrls: paths.map((path) => ({ url: `${SITE}${path}`, proofMethod: "well_known_file", verifiedAt: "2026-09-28T00:00:00Z" })),
  });

const A = arm("arm-A", ["Prénom Nom"], ["/n/prenom-nom/", "/en/n/prenom-nom/"]);
const B = arm("arm-B", ["Ayoub.H", "FR-8F42K"], ["/p/FR-8F42K/", "/en/p/FR-8F42K/"]);
const C = arm("arm-C", ["Proofseen page d'entrée"], ["/freelances/typescript-paris/", "/en/freelancers/typescript-paris/"]);

const answerOf = (text: string, citations: string[], candidates: { name: string; urls: string[] }[]) => ({
  answer: {
    engine: "openai",
    model: "gpt-5-mini",
    text,
    citations: citations.map((url) => ({ url })),
    searchResults: [],
    usage: { inputTokens: 1, outputTokens: 1, searches: 1 },
    costUsd: 0,
  } satisfies EngineAnswer,
  extractorJson: JSON.stringify({ candidates }),
});

const run = async (text: string, citations: string[], candidates: { name: string; urls: string[] }[]) => {
  const { answer, extractorJson } = answerOf(text, citations, candidates);
  let extractions = 0;
  const result = await analyzeAnswer({
    answer,
    identity: B,
    arms: [A, B, C],
    extract: async () => {
      extractions += 1;
      return extractorJson;
    },
  });
  return { result, extractions, byArm: (id: string) => result.arms.find((a) => a.armId === id)! };
};

describe("one answer, three arms", () => {
  it("runs the paid extractor once, whatever the number of arms", async () => {
    const { extractions, result } = await run("Rien de pertinent.", [], []);
    expect(extractions).toBe(1);
    expect(result.arms.map((a) => a.armId)).toEqual(["arm-A", "arm-B", "arm-C"]);
  });

  it("records every arm on every draw, negatives included", async () => {
    const { result } = await run("Rien de pertinent.", [], []);
    for (const outcome of result.arms) expect(outcome).toMatchObject({ cited: false, retrieved: false, type: null, rank: null });
  });

  it("tells the pseudonymous arm from the named arm", async () => {
    const text = `1. Camille Laurent — back-end\n2. Ayoub.H — full stack TypeScript à Paris (${SITE}/p/FR-8F42K/)`;
    const { byArm } = await run(text, [`${SITE}/p/FR-8F42K/`], [
      { name: "Camille Laurent", urls: [] },
      { name: "Ayoub.H", urls: [`${SITE}/p/FR-8F42K/`] },
    ]);
    expect(byArm("arm-B")).toMatchObject({ type: "certain", rank: 2, cited: true });
    expect(byArm("arm-A")).toMatchObject({ type: null, cited: false });
  });

  it("counts the entry page when it is cited as a source, even though it names nobody", async () => {
    const text = `Des freelances TypeScript à Paris sont listés sur ${SITE}/freelances/typescript-paris/ .`;
    const { byArm } = await run(text, [`${SITE}/freelances/typescript-paris/`], []);
    expect(byArm("arm-C")).toMatchObject({ cited: true, retrieved: true, type: null });
    expect(byArm("arm-B").cited).toBe(false);
  });

  it("does not let one arm's URL count for another arm on the same domain", async () => {
    const { byArm } = await run("Voir la page.", [`${SITE}/n/prenom-nom/`], []);
    expect(byArm("arm-A").cited).toBe(true);
    expect(byArm("arm-B").cited).toBe(false);
    expect(byArm("arm-C").cited).toBe(false);
  });

  it("never masks the names of the arms, and still masks third parties", async () => {
    const text = `1. Camille Laurent (https://x.example)\n2. Prénom Nom (${SITE}/n/prenom-nom/)\n3. Ayoub.H (${SITE}/p/FR-8F42K/)`;
    const { result } = await run(text, [], [
      { name: "Camille Laurent", urls: ["https://x.example"] },
      { name: "Prénom Nom", urls: [`${SITE}/n/prenom-nom/`] },
      { name: "Ayoub.H", urls: [`${SITE}/p/FR-8F42K/`] },
    ]);
    expect(result.maskedText).toContain("Prénom Nom");
    expect(result.maskedText).toContain("Ayoub.H");
    expect(result.maskedText).not.toContain("Camille");
  });
});
