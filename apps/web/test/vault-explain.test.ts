import { defaultRegistry, renderTemplate, type DocumentModel, type LoadedTemplate } from "@proofseen/documents";
import { describe, expect, it } from "vitest";
import { vaultFr } from "../src/i18n/market/vault-fr";
import { attribute, type ChainLink } from "../src/lib/vault/attribution";
import { choiceGroups, legendOf } from "../src/lib/vault/choices";
import { compareModels } from "../src/lib/vault/compare";
import { explainChanges, splitUnit, type ExplainTable, type VersionFacts } from "../src/lib/vault/explain";
import { demoContract } from "../../../packages/documents/test/support/demo";

/*
 * L1.6, T7 and T8: « En bref ». One sentence per changed choice, of the storyboard's forms, from the template's labels;
 * no sentence for the number or the date of issue; no line « Pour vous » without a table from the template; and each
 * change attributed to the version, and the party, that made it.
 */

const N = String.fromCharCode(0x202f);
const template = defaultRegistry().latest("service-agreement") as LoadedTemplate;
const groups = choiceGroups(template.decl, "fr", vaultFr.prepare);

const facts = (number: number, overrides: Record<string, unknown> = {}, optionalClauses: Record<string, "included" | "excluded"> = {}): VersionFacts => {
  const values = demoContract({ "document.versionNumber": number, "document.issuedOn": `2026-10-${24 + number}`, ...overrides });
  const rendered = renderTemplate("service-agreement", template.decl.version, "fr", values, { optionalClauses });
  if (!rendered.ok) throw new Error(rendered.error.code);
  const model: DocumentModel = rendered.value;
  return { number, templateVersion: template.decl.version, values: Object.fromEntries(Object.entries(model.variables).map(([k, v]) => [k, v.value])), optionalClauses, model };
};

const explain = (older: VersionFacts, newer: VersionFacts, table?: ExplainTable) =>
  explainChanges({ lang: "fr", template, older, newer, comparison: compareModels(older.model, newer.model), t: vaultFr.compare, legendOf: (name) => legendOf(groups, name), ...(table === undefined ? {} : { table }) });

describe("explainChanges (T7)", () => {
  it("says a number with its unit, from the template's label", () => {
    const { changes } = explain(facts(1), facts(2, { "input.acceptanceWindowDays": 20 }));
    expect(changes.map((c) => c.sentence)).toEqual([`Délai de recette ou de validation du relevé${N}: 15 jours devient 20 jours.`]);
    expect(changes[0]?.clause).toBe("acceptance");
    expect(changes[0]?.parties).toBeNull();
  });

  it("says a choice from a list by its two labels, between guillemets", () => {
    const { changes } = explain(facts(1), facts(2, { "input.workMode": "hybrid" }));
    expect(changes.map((c) => c.sentence)).toEqual([`Lieu d'exécution${N}: «${N}à distance${N}» devient «${N}en partie à distance, en partie dans les locaux du Client${N}».`]);
  });

  it("says yes or no, and free text only by the article it is read in", () => {
    const { changes } = explain(facts(1), facts(2, { "input.subcontractingAllowed": true, "input.ipPurpose": "l'exploitation de l'application d'exemple" }));
    expect(changes.map((c) => c.sentence)).toEqual([
      `Sous-traitance autorisée par le Client${N}: non devient oui.`,
      `Destination des droits (usages prévus)${N}: texte modifié, voir l'article Propriété intellectuelle.`,
    ]);
  });

  it("says an optional article added, and a conditional one with the choice it follows, without repeating its own fields", () => {
    const { changes } = explain(facts(1), facts(2, { "input.processesPersonalData": true, "input.dpaDetails": "Gestion des comptes d'exemple." }, { "non-solicitation": "included" }));
    const sentences = changes.map((c) => c.sentence);
    expect(sentences).toContain(`Article ajouté${N}: Traitement de données personnelles pour le compte du Client (suit le choix Données personnelles).`);
    expect(sentences).toContain(`Article ajouté${N}: Non-sollicitation.`);
    expect(sentences.some((s) => s.startsWith("Description du traitement"))).toBe(false);
    expect(changes.find((c) => c.kind === "clause-added" && c.clause === "non-solicitation")?.key).toBe("clause:non-solicitation");
  });

  it("never counts the number or the date of issue, which always differ", () => {
    expect(explain(facts(1), facts(2)).changes).toEqual([]);
  });

  it("adds the lines for each party only from the template's table", () => {
    const table: ExplainTable = { "input.acceptanceWindowDays": { "*": { provider: "Le Client dispose de {n} jours.", client: "Vous disposez de {n} jours." } } };
    const { changes } = explain(facts(1), facts(2, { "input.acceptanceWindowDays": 20 }), table);
    expect(changes[0]?.parties).toEqual({ provider: "Le Client dispose de 20 jours.", client: "Vous disposez de 20 jours.", both: undefined });
  });

  it("splits a unit off a label, and leaves a label without one", () => {
    expect(splitUnit("Durée des droits, en années", vaultFr.compare.units.suffix)).toEqual({ label: "Durée des droits", unit: "years" });
    expect(splitUnit("Lieu d'exécution", vaultFr.compare.units.suffix)).toEqual({ label: "Lieu d'exécution", unit: null });
  });
});

describe("attribute (T8)", () => {
  const link = (number: number, by: string, days: number, extra: Record<string, string> = {}): ChainLink => ({ number, by, values: { "input.acceptanceWindowDays": days }, optionalClauses: extra });

  it("gives a change made in version 2 to version 2, in the comparison of 1 and 3", () => {
    const chain = [link(1, "l'entreprise", 15), link(2, "le freelance", 20), link(3, "l'entreprise", 20)];
    expect(attribute("input.acceptanceWindowDays", chain)).toEqual({ kind: "one", number: 2, by: "le freelance" });
  });

  it("names every version of a change made, undone and made again", () => {
    const chain = [link(1, "vous", 15), link(2, "le freelance", 20), link(3, "vous", 15), link(4, "le freelance", 20)];
    expect(attribute("input.acceptanceWindowDays", chain)).toEqual({ kind: "many", numbers: [2, 3, 4] });
  });

  it("reads an optional article as excluded until a version adds it", () => {
    const chain = [link(1, "vous", 15), link(2, "le freelance", 15, { reference: "included" })];
    expect(attribute("clause:reference", chain)).toEqual({ kind: "one", number: 2, by: "le freelance" });
    expect(attribute("input.confidentialityYears", chain)).toBeNull();
  });
});
