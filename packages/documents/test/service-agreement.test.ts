import { describe, expect, it } from "vitest";
import type { RenderError } from "../src/errors";
import type { Block, DocumentModel } from "../src/model";
import { renderTemplate, type RenderOptions } from "../src/render";
import { demoContract, demoOptionals, demoOptionalVariables, without } from "./support/demo";

const NNBSP = " ";
const NBSP = " ";

type Rendered = ReturnType<typeof renderTemplate>;

const render = (variables: Record<string, unknown>, options: RenderOptions = {}, lang: "fr" | "en" = "fr"): Rendered => renderTemplate("service-agreement", 1, lang, variables, options);

const model = (result: Rendered): DocumentModel => {
  if (!result.ok) throw new Error(`${result.error.code} : ${result.error.message}`);
  return result.value;
};

const error = (result: Rendered): RenderError => {
  if (result.ok) throw new Error("un refus était attendu");
  return result.error;
};

const textOf = (block: Block): string => (block.kind === "party" ? block.lines.map((l) => l.text).join("\n") : block.runs.map((r) => r.text).join(""));
const clauseText = (doc: DocumentModel, id: string): string => (doc.clauses.find((c) => c.id === id)?.blocks ?? []).map(textOf).join("\n");
const fullText = (doc: DocumentModel): string => doc.clauses.map((c) => `${c.heading}\n${c.blocks.map(textOf).join("\n")}`).join("\n");
const ids = (doc: DocumentModel): readonly string[] => doc.clauses.map((c) => c.id);

describe("service agreement v1, French, fixed price (demonstration data)", () => {
  it("renders the 26 locked clauses, numbered from 1, without any optional or conditional clause the data do not call for", () => {
    const doc = model(render(demoContract()));
    expect(doc.clauses[0]).toMatchObject({ id: "parties", number: 1, heading: "Les parties" });
    expect(doc.clauses.map((c) => c.number)).toEqual(doc.clauses.map((_c, i) => i + 1));
    expect(ids(doc)).not.toContain("insurance");
    expect(ids(doc)).not.toContain("non-solicitation");
    expect(ids(doc)).not.toContain("reference");
    expect(ids(doc)).not.toContain("vigilance");
    expect(ids(doc)).not.toContain("monthly-funding");
    expect(ids(doc)).not.toContain("data-processing");
    expect(ids(doc)).not.toContain("cost-center");
    expect(doc.clauses).toHaveLength(26);
  });

  it("computes VAT, total with VAT and the commission itself (R3 and R6) and prints them formatted", () => {
    const doc = model(render(demoContract()));
    const vat = clauseText(doc, "vat");
    expect(vat).toContain(`20${NBSP}%`);
    expect(vat).toContain(`600,00${NBSP}EUR`);
    expect(vat).toContain(`3${NNBSP}600,00${NBSP}EUR`);
    expect(clauseText(doc, "commission")).toContain(`300,00${NBSP}EUR`);
    expect(clauseText(doc, "commission")).toContain(`10${NBSP}%`);
    expect(doc.variables["computed.vatCents"]).toEqual({ value: 60_000, origin: "derived" });
    expect(doc.variables["computed.totalTtcCents"]).toEqual({ value: 360_000, origin: "derived" });
    expect(doc.variables["computed.durationShape"]).toEqual({ value: "fixed_dated", origin: "derived" });
  });

  it("refuses a derived amount that does not equal the calculation (a wrong VAT in a contract is a serious fault)", () => {
    const failure = error(render(demoContract({ "computed.vatCents": 61_000 })));
    expect(failure.code).toBe("invalid_variable");
    expect(failure.variables).toEqual(["computed.vatCents"]);
    expect(render(demoContract({ "computed.vatCents": 60_000 })).ok).toBe(true);
  });

  it("uses the franchise wording instead of VAT when the Provider has a zero rate", () => {
    const exempt = model(render(demoContract({ "seller.vatRateBp": 0, seller: { ...demoContract().seller as object, vatRateBp: 0 } })));
    expect(clauseText(exempt, "vat")).toContain("franchise en base de TVA");
    expect(exempt.variables["computed.vatCents"]?.value).toBe(0);
  });

  it("applies French spacing to the template text: no ordinary space before ; : ! ? and inside quotation marks", () => {
    const doc = model(render(demoContract()));
    // Les saisies des parties (ici l'objet de la mission) ne sont jamais retouchées : la typographie vaut pour le gabarit.
    const literal = doc.clauses.filter((c) => c.id !== "scope").flatMap((c) => c.blocks.flatMap((b) => (b.kind === "party" ? [] : b.runs.filter((r) => r.value !== true).map((r) => r.text))));
    expect(literal.join("")).not.toMatch(/ [;:!?]/);
    expect(literal.join("")).not.toMatch(/« | »/);
    expect(literal.join("")).toContain(`«${NNBSP}le Prestataire${NNBSP}»`);
    expect(fullText(doc)).toContain(`Le présent contrat est conclu entre${NBSP}:`);
  });

  it("prints foreign and accented names without alteration, as NFC", () => {
    const doc = model(render(demoContract()));
    const text = fullText(doc);
    for (const name of ["Łukasz", "Nguyễn-Dvořák", "Çağrı", "L'HAŸ-LES-ROSES", "Bâtiment B"]) expect(text).toContain(name);
    expect(text.normalize("NFC")).toBe(text);
  });

  it("lists deliverables as bullets and keeps the scope as one value", () => {
    const doc = model(render(demoContract()));
    const scope = doc.clauses.find((c) => c.id === "scope");
    expect(scope?.blocks.filter((b) => b.kind === "bullet")).toHaveLength(3);
    expect(clauseText(doc, "scope")).toContain("Refonte de l'espace client");
  });

  it("the review notice is on top while the template is in review", () => {
    const doc = model(render(demoContract()));
    expect(doc.reviewNotice).toContain("pas encore relu par un avocat");
    expect(doc.reviewFooter).toContain("version 1");
    expect(doc.title).toBe("Contrat de prestation de services");
    expect(doc.subtitle).toContain("00000000-0000-4000-8000-000000000001");
    expect(doc.subtitle).toContain("24 octobre 2026");
  });

  it("includes the three optional clauses when both parties choose them, and refuses them without their data", () => {
    const withData = model(render({ ...demoContract(), ...demoOptionalVariables() }, { optionalClauses: demoOptionals }));
    expect(ids(withData)).toEqual(expect.arrayContaining(["insurance", "non-solicitation", "reference"]));
    expect(clauseText(withData, "insurance")).toContain("Assureur Exemple Mutuelle");
    expect(clauseText(withData, "non-solicitation")).toContain("12 mois");
    const missing = error(render(demoContract(), { optionalClauses: { insurance: "included" } }));
    expect(missing.code).toBe("missing_variable");
    expect(missing.variables).toEqual(["input.insurancePolicy", "input.insurerName"]);
  });

  it("shows the vigilance clause when, and only when, the data call for it", () => {
    const required = model(render(demoContract({ "computed.vigilanceRequired": true })));
    expect(ids(required)).toContain("vigilance");
    expect(clauseText(required, "vigilance")).toContain(`5${NNBSP}000,00${NBSP}EUR`);
  });

  it("processes personal data only when the Client says so, and then requires the description", () => {
    const missing = error(render(demoContract({ "input.processesPersonalData": true })));
    expect(missing.code).toBe("missing_variable");
    expect(missing.variables).toEqual(["input.dpaDetails"]);
    const ok = model(render(demoContract({ "input.processesPersonalData": true, "input.dpaDetails": "Hébergement de l'annuaire des clients du Client." })));
    expect(ids(ok)).toContain("data-processing");
  });

  it("requires the purpose, territory and duration of an assignment of rights, but not of retained rights", () => {
    const rest = without(demoContract(), "input.ipPurpose", "input.ipTerritory", "input.ipDurationYears");
    const missing = error(render(rest));
    expect(missing.variables).toEqual(["input.ipDurationYears", "input.ipPurpose", "input.ipTerritory"]);
    const retained = model(render({ ...rest, "input.ipRegime": "retained" }));
    expect(clauseText(retained, "intellectual-property")).toContain("conserve l'ensemble des droits");
  });

  it("prints the cost centre clause only when a cost centre is given", () => {
    const doc = model(render(demoContract({ "contract.costCenter": "CC-EXEMPLE-42" })));
    expect(clauseText(doc, "cost-center")).toContain("CC-EXEMPLE-42");
  });

  it("picks the duration wording from the data: an open fixed price has no end date", () => {
    const doc = model(render(without(demoContract(), "contract.endsOn")));
    expect(doc.clauses.find((c) => c.id === "duration")?.variant).toBe("fixed_open");
  });

  it("lists every default taken from a HYPOTHESIS, and refuses them when asked to (real render)", () => {
    // Le délai de recette (15 jours) n'est plus une HYPOTHESE : décision du conseil L1-030, il reste un défaut tracé.
    const rest = without(demoContract(), "input.acceptanceWindowDays", "input.confidentialityYears", "input.subcontractingAllowed");
    const doc = model(render(rest));
    expect(doc.hypotheses).toEqual(["input.confidentialityYears", "input.subcontractingAllowed"]);
    expect(Object.keys(doc.variables)).not.toContain("input.noticeDays");
    expect(doc.variables["input.acceptanceWindowDays"]).toEqual({ value: 15, origin: "default" });
    const strict = error(render(rest, { refuseHypothesisDefaults: true }));
    expect(strict.code).toBe("missing_variable");
    expect(strict.variables).toEqual(["input.confidentialityYears", "input.subcontractingAllowed"]);
  });

  it("takes a default only for what the document needs: an unused default is neither frozen nor listed as a hypothesis", () => {
    const rest = without(demoContract(), "input.acceptanceWindowDays");
    const plain = model(render(rest));
    expect(plain.variables["input.noticeDays"]).toBeUndefined();
    expect(plain.variables["input.nonSolicitationMonths"]).toBeUndefined();
    expect(plain.hypotheses).toEqual([]);
    const withClause = model(render({ ...rest, ...demoOptionalVariables(), "input.nonSolicitationMonths": undefined }, { optionalClauses: { "non-solicitation": "included" } }));
    expect(withClause.variables["input.nonSolicitationMonths"]).toEqual({ value: 12, origin: "default" });
    expect(withClause.hypotheses).toEqual(["input.nonSolicitationMonths"]);
    expect(clauseText(withClause, "non-solicitation")).toContain("12 mois");
  });

  it("the signature block names the Provider and the Client from their snapshots", () => {
    const doc = model(render(demoContract()));
    expect(doc.signatories.map((s) => [s.role, s.label, s.name])).toEqual([
      ["seller", "Le Prestataire", "Studio Exemple, Łukasz Nguyễn-Dvořák EI"],
      ["buyer", "Le Client", "Société Exemple Çağrı & Fils SAS"],
    ]);
    expect(doc.signatories[0]?.caption).toBe("Signature électronique simple sur Proofseen");
  });
});

describe("service agreement v1, time and materials, blocked by the founder's decision D8", () => {
  const monthly = (extra: Record<string, unknown> = {}) => demoContract({ "contract.billing": "monthly", "contract.endsOn": "2026-12-18", ...extra });

  it("refuses the monthly variant while D8 is not written in the template, whatever the funding mode chosen", () => {
    for (const mode of [undefined, "monthly_provision", "pay_on_timesheet", "single_provision"]) {
      const failure = error(render(monthly(mode === undefined ? {} : { "decision.d8MonthlyFunding": mode })));
      expect(failure.code, String(mode)).toBe("decision_pending");
      expect(failure.decision).toBe("D8");
    }
  });
});

describe("service agreement v1, English", () => {
  it("renders the English text with English month names, money and percentages", () => {
    const doc = model(render(demoContract(), {}, "en"));
    expect(doc.language).toBe("en");
    expect(doc.title.length).toBeGreaterThan(0);
    const text = fullText(doc);
    expect(text).toContain(`EUR${NBSP}3,000.00`);
    expect(text).toContain("2 November 2026");
    expect(text).toContain("VAT number: FR00000000000");
    expect(text).toContain(`20${"%"}`);
    expect(text).not.toMatch(/ [;!?]/u);
    expect(text).not.toContain(NNBSP);
    expect(doc.signatories[0]?.label).toBe("The Provider");
    expect(doc.signatories[0]?.caption).toBe("Simple electronic signature on Proofseen");
  });

  it("is a different document from the French one, with the same clause ids", () => {
    const fr = model(render(demoContract()));
    const en = model(render(demoContract(), {}, "en"));
    expect(ids(en)).toEqual(ids(fr));
    expect(en.contentDigest).not.toBe(fr.contentDigest);
  });
});

describe("source validity of the corrections of L1-040 (Bertrand, Chancelier L1-033)", () => {
  it("renders on 2026-12-31, on 2027-01-01 and on 2028-06-30: the articles 289 and 293 B are still citable", () => {
    for (const day of ["2026-12-31", "2027-01-01", "2027-03-15", "2028-06-30"]) {
      expect(render(demoContract({ "document.issuedOn": day, "contract.startsOn": "2028-07-02", "contract.endsOn": "2028-12-18" })).ok, day).toBe(true);
    }
  });

  it("refuses from 2028-07-01 with source_expired naming the source and the clause", () => {
    const failure = error(render(demoContract({ "document.issuedOn": "2028-07-01" })));
    expect(failure.code).toBe("source_expired");
    expect(["cgi-289", "cgi-293b"]).toContain(failure.source);
    expect(failure.clause).toBeDefined();
  });

  it("warns, from the issue date and not from the clock, when a cited source ends within 60 days", () => {
    expect(model(render(demoContract({ "document.issuedOn": "2028-04-30" }))).warnings).toEqual([]);
    const warned = model(render(demoContract({ "document.issuedOn": "2028-05-01" })));
    expect(warned.warnings.length).toBeGreaterThan(0);
    expect(warned.warnings.every((w) => w.validUntil === "2028-06-30" && w.daysLeft === 60)).toBe(true);
  });
});

describe("the object of the service and the choices of the parties (columns of L1-011, inputs of the API): the contract does not render without them", () => {
  it("names every missing input and refuses, whatever the rest", () => {
    const rest = without(demoContract(), "input.scope", "input.deliverables", "input.workMode", "input.ipRegime", "input.processesPersonalData");
    const failure = error(render(rest));
    expect(failure.code).toBe("missing_variable");
    expect(failure.variables).toEqual(["input.deliverables", "input.ipRegime", "input.processesPersonalData", "input.scope", "input.workMode"]);
    expect(failure.message).toContain("input.scope");
  });

  it("still names the founder's decision D8 as pending when the monthly funding mode is asked for without it", () => {
    const failure = error(render(demoContract({ "contract.billing": "monthly" })));
    expect(failure.code).toBe("decision_pending");
    expect(failure.decision).toBe("D8");
  });

  it("does not render without the commission rate: a contract without a rate opens no payment (veto Tresor)", () => {
    expect(error(render(without(demoContract(), "contract.commissionBp"))).variables).toContain("contract.commissionBp");
  });
});
