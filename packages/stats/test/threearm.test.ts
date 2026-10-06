import { describe, expect, it } from "vitest";
import { relevantIndexation, threeArmVerdict, type ArmDraw, type ArmIndexation, type IndexName, type NamedBaseline } from "../src/threearm";

const THRESHOLDS = { armBoverArmA: 1 / 3, armCcitationRate: 0.05 };

/** n draws; `a`, `b`, `c` = indexes of the draws where that arm is cited. Every draw is a target JD unless stated. */
const wave = (n: number, cited: { a?: number[]; b?: number[]; c?: number[] }, control: number[] = []): ArmDraw[] =>
  Array.from({ length: n }, (_, i) => i).flatMap((i) => {
    const jdRole = control.includes(i) ? ("control" as const) : ("target" as const);
    return [
      { drawId: `d${i}`, arm: "A" as const, cited: (cited.a ?? []).includes(i), jdRole },
      { drawId: `d${i}`, arm: "B" as const, cited: (cited.b ?? []).includes(i), jdRole },
      { drawId: `d${i}`, arm: "C" as const, cited: (cited.c ?? []).includes(i), jdRole },
    ];
  });
const range = (from: number, to: number): number[] => Array.from({ length: to - from }, (_, i) => from + i);

describe("three-arm verdict, as pre-registered", () => {
  it("refutes mechanism A when B is cited in less than a third of the draws that cite A", () => {
    const v = threeArmVerdict(wave(150, { a: range(0, 30), b: range(0, 9) }), 60, THRESHOLDS);
    expect(v.bGivenA).toEqual({ cited: 9, n: 30, share: 0.3 });
    expect(v.mechanismA).toBe("refuted");
  });

  it("does not refute it at exactly one third or above", () => {
    expect(threeArmVerdict(wave(150, { a: range(0, 30), b: range(0, 10) }), 60, THRESHOLDS).mechanismA).toBe("not_refuted");
  });

  it("measures B inside the draws that cite A, not B's overall rate", () => {
    // B cited 20 times overall, but never together with A: the rule looks at the overlap.
    const v = threeArmVerdict(wave(150, { a: range(0, 30), b: range(100, 120) }), 60, THRESHOLDS);
    expect(v.bGivenA.cited).toBe(0);
    expect(v.mechanismA).toBe("refuted");
  });

  it("refutes it when B stays at zero while A's lower bound is above zero", () => {
    const v = threeArmVerdict(wave(150, { a: range(0, 12) }), 60, THRESHOLDS);
    expect(v.mechanismA).toBe("refuted");
    expect(v.reasons.join(" ")).toMatch(/B n'est jamais cité/);
  });

  it("calls it inconclusive when neither A nor B is ever cited", () => {
    expect(threeArmVerdict(wave(150, {}), 60, THRESHOLDS).mechanismA).toBe("inconclusive");
  });

  it("does not refute it when B is cited and A never is", () => {
    expect(threeArmVerdict(wave(150, { b: range(0, 5) }), 60, THRESHOLDS).mechanismA).toBe("not_refuted");
  });

  it("retains mechanism B only at 5 % or more with a lower bound above zero, on target JDs only", () => {
    expect(threeArmVerdict(wave(150, { c: range(0, 12) }), 60, THRESHOLDS).mechanismB).toBe("retained");
    expect(threeArmVerdict(wave(150, { c: range(0, 5) }), 60, THRESHOLDS).mechanismB).toBe("not_retained");
    // Citations on control JDs do not count: here every citing draw is a control JD.
    const onControls = threeArmVerdict(wave(150, { c: range(0, 12) }, range(0, 12)), 60, THRESHOLDS);
    expect(onControls.rates.C.cited).toBe(0);
    expect(onControls.mechanismB).toBe("not_retained");
  });

  it("closes the 'get cited' path when all three arms fail AND their pages were indexed", () => {
    const v = threeArmVerdict(wave(150, {}), 60, THRESHOLDS, indexed);
    expect(v.allFailed).toBe(true);
    expect(v.delivered).toBe("yes");
    expect(v.reasons.join(" ")).toMatch(/close pour P0/);
  });

  it("takes no decision at J+30", () => {
    const v = threeArmVerdict(wave(150, { a: range(0, 30) }), 30, THRESHOLDS);
    expect(v.final).toBe(false);
    expect(v.reasons[0]).toMatch(/aucune décision avant J\+60/);
  });

  it("counts draws, not arm lines", () => {
    expect(threeArmVerdict(wave(150, {}), 60, THRESHOLDS).draws).toBe(150);
  });
});

/*
 * Contrôle de délivrance — ajouté le 29/09 après un constat sur Bing Webmaster Tools : `proofseen.com/n/ayoub-hammoudi/`
 * était « Discovered but not crawled » cinq jours après sa découverte. Perplexity s'appuie sur l'index de Bing : une
 * page jamais crawlée ne peut pas être récupérée.
 *
 * Sans ce contrôle, les trois bras auraient lu 0 au J+30 et le verdict aurait déclaré **« la voie se faire citer est
 * close pour P0 »** — c'est-à-dire la thèse du produit morte — alors que le traitement n'avait jamais atteint les
 * moteurs. On ne conclut pas d'une expérience dont la manipulation n'a pas eu lieu.
 *
 * Même principe que le 24/09 pour le bras C non publié, appliqué un cran plus bas : un bras publié mais **absent de
 * l'index** ne peut pas « échouer » non plus.
 */
const indexed: ArmIndexation[] = [
  { arm: "A", index: "bing", indexed: 1, declared: 1, checkedAt: "2026-10-24" },
  { arm: "B", index: "bing", indexed: 1, declared: 1, checkedAt: "2026-10-24" },
  { arm: "C", index: "bing", indexed: 1, declared: 1, checkedAt: "2026-10-24" },
];
const notIndexed: ArmIndexation[] = indexed.map((entry) => ({ ...entry, indexed: 0 }));

describe("un bras absent de l'index ne peut pas échouer", () => {
  it("refuse de clore la voie quand aucune page n'était indexée", () => {
    const v = threeArmVerdict(wave(150, {}), 60, THRESHOLDS, notIndexed);
    expect(v.allFailed).toBe(false);
    expect(v.delivered).toBe("no");
    expect(v.reasons.join(" ")).not.toMatch(/close pour P0/);
    expect(v.reasons.join(" ")).toMatch(/indexé|délivr/i);
  });

  it("refuse de clore la voie quand l'indexation n'a pas été relevée du tout", () => {
    // Zéro partout et aucun relevé : on ne sait pas si l'expérience a eu lieu. On ne conclut donc rien.
    const v = threeArmVerdict(wave(150, {}), 60, THRESHOLDS);
    expect(v.allFailed).toBe(false);
    expect(v.delivered).toBe("unknown");
    expect(v.reasons.join(" ")).toMatch(/indexation n'a pas été relevée/i);
  });

  it("ne déclare pas le pseudonyme meilleur que le nom quand le nom n'était pas indexé", () => {
    // Sans ce garde-fou : « B est cité alors que A ne l'est jamais » — une conclusion sur un bras absent de l'index.
    const partial = [
      { arm: "A" as const, index: "bing" as const, indexed: 0, declared: 1, checkedAt: "2026-10-24" },
      { arm: "B" as const, index: "bing" as const, indexed: 1, declared: 1, checkedAt: "2026-10-24" },
      { arm: "C" as const, index: "bing" as const, indexed: 1, declared: 1, checkedAt: "2026-10-24" },
    ];
    const v = threeArmVerdict(wave(150, { b: range(0, 30) }), 60, THRESHOLDS, partial);
    expect(v.mechanismA).toBe("inconclusive");
    expect(v.delivered).toBe("partial");
    expect(v.reasons.join(" ")).toMatch(/bras A[^.]*pas indexé|A n'était pas indexé/i);
  });

  it("ne réfute pas le mécanisme A quand c'est B qui n'était pas indexé", () => {
    // Sinon : « B n'est jamais cité alors que A l'est » → réfuté, sur un bras que les moteurs ne pouvaient pas voir.
    const partial = [
      { arm: "A" as const, index: "bing" as const, indexed: 1, declared: 1, checkedAt: "2026-10-24" },
      { arm: "B" as const, index: "bing" as const, indexed: 0, declared: 1, checkedAt: "2026-10-24" },
      { arm: "C" as const, index: "bing" as const, indexed: 1, declared: 1, checkedAt: "2026-10-24" },
    ];
    const v = threeArmVerdict(wave(150, { a: range(0, 30) }), 60, THRESHOLDS, partial);
    expect(v.mechanismA).toBe("inconclusive");
    expect(v.reasons.join(" ")).toMatch(/B[^.]*pas indexé|B n'était pas indexé/i);
  });

  it("laisse le verdict intact quand tout est indexé et que les chiffres parlent", () => {
    // Le garde-fou ne doit rien changer au cas nominal : il ne se déclenche que sur une délivrance manquante.
    const v = threeArmVerdict(wave(150, { a: range(0, 30), b: range(0, 9) }), 60, THRESHOLDS, indexed);
    expect(v.mechanismA).toBe("refuted");
    expect(v.delivered).toBe("yes");
  });

  it("compte une page indexée sur plusieurs déclarées comme délivrée", () => {
    // Une seule page atteignable suffit à rendre le bras mesurable ; exiger 100 % inventerait un seuil non pré-enregistré.
    const partial = [{ arm: "A" as const, index: "bing" as const, indexed: 1, declared: 4, checkedAt: "2026-10-24" }];
    const v = threeArmVerdict(wave(150, { a: range(0, 30), b: range(0, 9) }), 60, THRESHOLDS, partial);
    expect(v.mechanismA).toBe("refuted");
  });
});

/*
 * Le piège que ces tests ferment, constaté le 01/10 : **Google indexait la page nominative que Bing n'avait jamais
 * crawlée.** Or aucun des trois moteurs mesurés (OpenAI, Anthropic, Perplexity) ne tire son web de Google. Un relevé
 * qui dirait « 1 page indexée » sans nommer l'index aurait fait conclure « traitement délivré », donc autorisé à
 * clore la thèse, sur des moteurs qui n'avaient jamais vu la page.
 */
describe("être indexé quelque part ne veut pas dire être délivré", () => {
  const RELEVANT: IndexName[] = ["bing", "brave", "other"];

  it("ignore un relevé qui ne porte que sur Google, et ne clôt donc rien", () => {
    const googleOnly: ArmIndexation[] = [
      { arm: "A", index: "google", indexed: 2, declared: 2, checkedAt: "2026-10-24" },
      { arm: "B", index: "google", indexed: 2, declared: 2, checkedAt: "2026-10-24" },
      { arm: "C", index: "google", indexed: 2, declared: 2, checkedAt: "2026-10-24" },
    ];
    expect(relevantIndexation(googleOnly, RELEVANT)).toBeUndefined();
    const v = threeArmVerdict(wave(150, {}), 60, THRESHOLDS, relevantIndexation(googleOnly, RELEVANT));
    expect(v.delivered).toBe("unknown");
    expect(v.allFailed).toBe(false);
  });

  it("retient Bing et écarte Google quand les deux sont relevés et se contredisent", () => {
    // Le cas réel du 01/10 : Google dit indexé, Bing dit jamais crawlé. C'est Bing qui décide, pas Google.
    const mixed: ArmIndexation[] = [
      { arm: "A", index: "google", indexed: 2, declared: 2, checkedAt: "2026-10-24" },
      { arm: "A", index: "bing", indexed: 0, declared: 2, checkedAt: "2026-10-24" },
      { arm: "B", index: "bing", indexed: 0, declared: 2, checkedAt: "2026-10-24" },
      { arm: "C", index: "bing", indexed: 0, declared: 2, checkedAt: "2026-10-24" },
    ];
    const v = threeArmVerdict(wave(150, {}), 60, THRESHOLDS, relevantIndexation(mixed, RELEVANT));
    expect(v.delivered).toBe("no");
    expect(v.allFailed).toBe(false);
    expect(v.reasons.join(" ")).toMatch(/pas indexés|pas indexé/);
  });

  it("suffit qu'un seul index pertinent porte le bras", () => {
    // Claude lit Brave, Perplexity lit Bing : un bras absent de l'un mais présent dans l'autre reste mesurable.
    const either: ArmIndexation[] = [
      { arm: "A", index: "bing", indexed: 0, declared: 2, checkedAt: "2026-10-24" },
      { arm: "A", index: "brave", indexed: 1, declared: 2, checkedAt: "2026-10-24" },
      { arm: "B", index: "brave", indexed: 1, declared: 2, checkedAt: "2026-10-24" },
      { arm: "C", index: "brave", indexed: 1, declared: 2, checkedAt: "2026-10-24" },
    ];
    const v = threeArmVerdict(wave(150, {}), 60, THRESHOLDS, relevantIndexation(either, RELEVANT));
    expect(v.delivered).toBe("yes");
    expect(v.allFailed).toBe(true);
  });

  it("laisse passer un relevé absent comme avant", () => {
    expect(relevantIndexation(undefined, RELEVANT)).toBeUndefined();
  });
});

/*
 * Le piège fermé ici, posé le 01/10 au moment où le founder a changé de sujet d'expérience.
 *
 * Le nouveau sujet est déjà connu sous son nom réel : fiche Wikidata, site personnel avec FAQPage, articles signés,
 * grands comptes nommés. Le bras A porte ce nom-là ; le bras B un pseudonyme créé pour le test, qui n'existe nulle
 * part. « B cité dans moins d'un tiers des tirages où A l'est » devenait vrai **par construction** — et le rapport
 * aurait imprimé « mécanisme A RÉFUTÉ », c'est-à-dire le pivot pseudonyme du produit déclaré mort, après avoir
 * seulement mesuré que le sujet est déjà célèbre et que son pseudonyme ne l'est pas.
 */
describe("un bras nominatif déjà connu ne réfute rien", () => {
  const biased: NamedBaseline = { preexistingNamedSurfaces: 6, detail: "fiche Wikidata, site personnel indexé, 4 profils plateformes" };
  const neutral: NamedBaseline = { preexistingNamedSurfaces: 0, detail: "aucune surface préexistante sous le nom réel" };

  it("refuse de réfuter le mécanisme A quand A partait avec une empreinte que B n'avait pas", () => {
    // Sans le garde-fou : B cité 9 fois sur 30 tirages citant A → 30 % < 33 % → « RÉFUTÉ ».
    const v = threeArmVerdict(wave(150, { a: range(0, 30), b: range(0, 9) }), 60, THRESHOLDS, indexed, biased);
    expect(v.mechanismA).toBe("inconclusive");
    expect(v.baselineBiased).toBe(true);
    expect(v.reasons.join(" ")).toMatch(/empreinte préexistante/);
  });

  it("refuse aussi quand B n'est jamais cité, le cas le plus trompeur", () => {
    const v = threeArmVerdict(wave(150, { a: range(0, 30) }), 60, THRESHOLDS, indexed, biased);
    expect(v.mechanismA).toBe("inconclusive");
  });

  it("laisse le verdict intact quand les deux bras partent à égalité", () => {
    // Le garde-fou ne doit pas neutraliser le test : sans empreinte préalable, la réfutation reste possible.
    const v = threeArmVerdict(wave(150, { a: range(0, 30), b: range(0, 9) }), 60, THRESHOLDS, indexed, neutral);
    expect(v.mechanismA).toBe("refuted");
    expect(v.baselineBiased).toBe(false);
  });

  it("ne change rien quand aucune empreinte n'est renseignée", () => {
    const v = threeArmVerdict(wave(150, { a: range(0, 30), b: range(0, 9) }), 60, THRESHOLDS, indexed);
    expect(v.mechanismA).toBe("refuted");
    expect(v.baselineBiased).toBe(false);
  });

  it("n'empêche pas de constater que le pseudonyme tient quand il tient", () => {
    // Un biais en faveur de A ne doit pas empêcher de voir B réussir : là, l'écart n'a rien d'inquiétant.
    const v = threeArmVerdict(wave(150, { a: range(0, 30), b: range(0, 20) }), 60, THRESHOLDS, indexed, biased);
    expect(v.mechanismA).toBe("inconclusive");
    expect(v.bGivenA.share).toBeGreaterThan(THRESHOLDS.armBoverArmA);
  });
});
