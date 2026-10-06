import { describe, expect, it } from "vitest";
import { refusesToName } from "../src/refusal";

const refuses = (text: string, namedCandidates = 0) => refusesToName({ text, namedCandidates });

describe("un refus de nommer", () => {
  it("reconnaît le refus observé sur Anthropic en français", () => {
    expect(
      refuses(
        "Je ne peux pas vous recommander de personnes réelles pour cette mission. Je peux en revanche vous indiquer où chercher : Malt, LinkedIn, ou des communautés spécialisées.",
      ),
    ).toBe(true);
  });

  it("reconnaît les autres formulations françaises", () => {
    expect(refuses("Je ne suis pas en mesure de nommer des freelances pour cette offre.")).toBe(true);
    expect(refuses("Je préfère ne pas nommer de personnes en particulier.")).toBe(true);
  });

  it("reconnaît le refus en anglais", () => {
    expect(refuses("I can't recommend specific individuals for this role, but here is how to search.")).toBe(true);
    expect(refuses("I cannot name real people. Try a freelance marketplace instead.")).toBe(true);
  });
});

describe("ce qui n'est pas un refus", () => {
  it("ne prend pas une précaution pour un refus", () => {
    expect(refuses("Je ne peux pas garantir que ces profils soient disponibles aujourd'hui.")).toBe(false);
    expect(refuses("Je n'ai pas accès au web en temps réel, mes informations peuvent être datées.")).toBe(false);
    expect(refuses("I can't guarantee availability or current rates for these profiles.")).toBe(false);
  });

  it("ne prend pas une réponse vide ou hors sujet pour un refus", () => {
    expect(refuses("")).toBe(false);
    expect(refuses("Voici cinq plateformes où trouver des freelances TypeScript.")).toBe(false);
  });

  it("ne déclare jamais un refus sur une réponse qui nomme quelqu'un, quoi qu'elle dise par ailleurs", () => {
    // Un moteur peut poser une réserve puis nommer quand même : ce qu'il fait compte plus que ce qu'il annonce.
    const text = "Je ne peux pas vous recommander de personnes réelles avec certitude, mais voici : 1. A. Martin — full stack.";
    expect(refuses(text, 1)).toBe(false);
    expect(refuses(text, 0)).toBe(true);
  });
});
