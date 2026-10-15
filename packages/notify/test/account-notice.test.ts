import { describe, expect, it } from "vitest";
import { renderEmail } from "../src/index";

const BASE = "https://proofseen.com/";

describe("e-mail d'une décision d'opérateur (C19)", () => {
  it("dit ce qui est décidé, avec le motif, et comment le contester", () => {
    const email = renderEmail({ kind: "account_notice", payload: { notice: "mission_hidden", reason: "Annonce trompeuse", subject: "Dév Go" }, to: { lang: "fr", displayName: "Camille" } }, BASE);
    expect(email.subject).toBe("Une mission de votre entreprise est masquée");
    expect(email.text).toContain("« Dév Go »");
    expect(email.text).toContain("Motif : Annonce trompeuse");
    expect(email.text).toContain("contester");
    expect(email.text).toContain("https://proofseen.com/fr/app");
  });

  it("existe en anglais, et ne dit jamais quel opérateur a décidé", () => {
    const email = renderEmail({ kind: "account_notice", payload: { notice: "account_suspended", reason: "Spam", subject: "" }, to: { lang: "en", displayName: "Sam" } }, BASE);
    expect(email.subject).toBe("Your Proofseen account is suspended");
    expect(email.text).toContain("Reason: Spam");
    expect(email.text).not.toMatch(/@/);
  });

  it("échappe le motif, texte libre de l'opérateur", () => {
    const email = renderEmail({ kind: "account_notice", payload: { notice: "profile_hidden", reason: "<script>x</script>", subject: "" }, to: { lang: "fr", displayName: "Camille" } }, BASE);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("reste lisible pour une décision inconnue", () => {
    expect(renderEmail({ kind: "account_notice", payload: { notice: "autre", reason: "", subject: "" }, to: { lang: "fr", displayName: "Camille" } }, BASE).subject).toBe("Une décision concerne votre compte");
  });
});
