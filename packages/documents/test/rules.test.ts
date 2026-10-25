import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ENGINE_ID } from "../src/pdf";
import { RECOVERY_FEE_CENTS } from "../src/rules";
import { defaultRegistry } from "../src/registry";

describe("dated rules", () => {
  it("the fixed recovery fee is 40 EUR (D441-5) and is the value the template note announces", () => {
    expect(RECOVERY_FEE_CENTS).toBe(4000);
    expect(defaultRegistry().find("service-agreement", 1)?.decl.variables["rule.recoveryFeeCents"]?.note).toContain("4 000 centimes");
  });
});

describe("engine identifier stored with every version", () => {
  it("names the pdfmake version actually installed, so a stored version says which engine drew it", () => {
    const pdfmake = createRequire(import.meta.url)("pdfmake/package.json") as { version: string };
    expect(ENGINE_ID).toBe(`proofseen-documents/1 pdfmake/${pdfmake.version}`);
    expect(ENGINE_ID.length).toBeLessThanOrEqual(80);
  });
});
