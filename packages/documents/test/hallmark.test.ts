import { PAPER_INKS } from "@proofseen/brand";
import { fingerprintMarkSvg } from "@proofseen/brand/fingerprint-mark";
import { describe, expect, it } from "vitest";
import { paperHallmark } from "../src/hallmark";
import { renderPdf } from "../src/pdf";
import { renderTemplate } from "../src/render";
import { demoContract } from "./support/demo";

const model = (() => {
  const rendered = renderTemplate("service-agreement", 1, "fr", demoContract());
  if (!rendered.ok) throw new Error(rendered.error.message);
  return rendered.value;
})();

describe("the hallmark printed at the foot of every page (L1-090 point 1, Shogun PASS L1-120)", () => {
  it("is the drawing of the brand at the print level 64, in the ink of the text, never in the green of a signed document", () => {
    const svg = paperHallmark(model.contentDigest);
    expect(svg).toBe(fingerprintMarkSvg(model.contentDigest, { frame: PAPER_INKS.text, cells: PAPER_INKS.text }));
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).not.toContain(PAPER_INKS.proof);
  });

  it("is a function of the content fingerprint only: another content, another drawing", () => {
    const other = renderTemplate("service-agreement", 1, "fr", demoContract({ "contract.totalCents": 300_100 }));
    if (!other.ok) throw new Error(other.error.message);
    expect(paperHallmark(model.contentDigest)).toBe(paperHallmark(model.contentDigest));
    expect(paperHallmark(other.value.contentDigest)).not.toBe(paperHallmark(model.contentDigest));
  });

  it("is drawn in the PDF by default (vector, no image), and the PDF stays deterministic", async () => {
    const [a, b] = [await renderPdf(model), await renderPdf(model)];
    expect(a.equals(b)).toBe(true);
    const empty = await renderPdf(model, { hallmarkSvg: null });
    expect(a.equals(empty)).toBe(false);
    expect(a.toString("latin1")).not.toMatch(/\/Subtype \/Image/);
  });
});
