import { describe, expect, it } from "vitest";
import { describeChanges } from "../src/changes";

const NNBSP = " ";
const NBSP = " ";

describe("describeChanges (one sentence per changed variable, no language model)", () => {
  const before = { endsOn: "2026-12-18", scope: "Refonte de l'espace client.", deliverables: ["Audit", "Maquettes"] };

  it("says the end date moved, in French, from and to", () => {
    expect(describeChanges("fr", before, { endsOn: "2027-01-29" })).toEqual(["La date de fin du contrat passe du 18 décembre 2026 au 29 janvier 2027."]);
  });

  it("says an end date is set when the contract had none, and says nothing when the date is unchanged", () => {
    expect(describeChanges("fr", { ...before, endsOn: null }, { endsOn: "2027-01-01" })).toEqual(["Une date de fin est fixée au 1er janvier 2027."]);
    expect(describeChanges("fr", before, { endsOn: "2026-12-18" })).toEqual([]);
  });

  it("points to the new wording of the scope without repeating it, and only when it differs", () => {
    const lines = describeChanges("fr", before, { scope: "Refonte de l'espace client et de l'espace admin." });
    expect(lines).toEqual([`L'objet de la prestation est modifié${NBSP}: sa nouvelle rédaction figure à l'article «${NNBSP}Nouvelle rédaction de l'objet${NNBSP}».`]);
    expect(describeChanges("fr", before, { scope: before.scope })).toEqual([]);
  });

  it("names each added and each removed deliverable", () => {
    const lines = describeChanges("fr", before, { deliverables: ["Audit", "Prototype"] });
    expect(lines).toEqual([`Livrable ajouté${NBSP}: «${NNBSP}Prototype${NNBSP}».`, `Livrable retiré${NBSP}: «${NNBSP}Maquettes${NNBSP}».`]);
  });

  it("keeps the order: end date, scope, deliverables", () => {
    const lines = describeChanges("fr", before, { endsOn: "2027-01-29", scope: "Autre objet.", deliverables: ["Audit"] });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("date de fin");
    expect(lines[1]).toContain("objet");
    expect(lines[2]).toContain("retiré");
  });

  it("writes English too", () => {
    expect(describeChanges("en", before, { endsOn: "2027-01-29" })).toEqual(["The end date of the agreement moves from 18 December 2026 to 29 January 2027."]);
  });

  it("returns nothing when nothing is asked, so the engine refuses an amendment that changes nothing", () => {
    expect(describeChanges("fr", before, {})).toEqual([]);
  });
});
