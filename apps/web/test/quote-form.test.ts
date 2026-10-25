import { describe, expect, it } from "vitest";
import { SCOPE_REQUIRED } from "@proofseen/db";
import { invalid } from "../src/lib/api";
import { quoteFromForm } from "../src/lib/quote-form";

/*
 * A NEW quote states the object of the work (Code civil 1163); the deliverables stay optional. The form is read into the
 * input of a new quote and names the problem, so the page says which field to fix; the API answers 422 with a sentence
 * of its own. Quotes written before the rule stay readable without an object (see packages/db/test/vault.test.ts).
 */

const SCOPE = "Refonte de l'espace client : audit, maquettes et intégration des écrans.";

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ rate: "600", days: "10", ...fields })) data.set(name, value);
  return data;
};

describe("the quote form", () => {
  it("accepts a quote with an object, with or without deliverables", () => {
    expect(quoteFromForm(form({ scope: SCOPE }))).toMatchObject({ ok: true, data: { dailyRateCents: 60_000, days: 10, billing: "fixed", scope: SCOPE } });
    const withDeliverables = quoteFromForm(form({ scope: SCOPE, deliverables: "Audit\r\n\r\n  Maquettes validées  \nIntégration" }));
    expect(withDeliverables).toMatchObject({ ok: true, data: { deliverables: ["Audit", "Maquettes validées", "Intégration"] } });
  });

  it("refuses a quote without an object, and says so", () => {
    for (const scope of [undefined, "", "   \n  "]) {
      expect(quoteFromForm(form(scope === undefined ? {} : { scope }))).toEqual({ ok: false, problem: "scope_missing" });
    }
    // Deliverables alone do not replace the object.
    expect(quoteFromForm(form({ deliverables: "Audit" }))).toEqual({ ok: false, problem: "scope_missing" });
  });

  it("names a direct contact detail in the object, and a bad rate or number of days as an invalid form", () => {
    expect(quoteFromForm(form({ scope: "Écrivez-moi à marie.durand@example.com pour le détail" }))).toEqual({ ok: false, problem: "scope_contact" });
    expect(quoteFromForm(form({ scope: SCOPE, rate: "5", days: "1" }))).toEqual({ ok: false, problem: "invalid" });
    expect(quoteFromForm(form({ scope: SCOPE, rate: "abc" }))).toEqual({ ok: false, problem: "invalid" });
    expect(quoteFromForm(form({ scope: SCOPE, days: "0" }))).toEqual({ ok: false, problem: "invalid" });
    expect(quoteFromForm(form({ scope: SCOPE, days: "1,5" }))).toEqual({ ok: false, problem: "invalid" });
  });
});

describe("the API answer to a quote without an object", () => {
  it("is a 422 with a sentence of its own, not the generic « requête invalide »", async () => {
    const response = invalid([{ message: SCOPE_REQUIRED }]);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ ok: false, error: "objet de la prestation manquant" });
    expect((invalid([{ message: "autre chose" }])).status).toBe(400);
  });
});
