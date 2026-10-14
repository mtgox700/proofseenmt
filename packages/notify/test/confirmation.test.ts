import { describe, expect, it } from "vitest";
import { renderConfirmationRequest, renderEmail } from "../src/index";

const BASE = "https://proofseen.com";
const LINK = "https://proofseen.com/fr/confirmer-mission/0192f1c4-0000-7000-8000-000000000001?t=abc";

const input = {
  lang: "fr" as const,
  freelancer: "Camille Martin",
  role: "Lead data engineer",
  clientName: "Acme <script>",
  startedOn: new Date("2025-01-01T00:00:00Z"),
  endedOn: new Date("2025-06-01T00:00:00Z"),
  expiresAt: new Date("2026-11-13T09:00:00Z"),
  link: LINK,
};

describe("e-mail de confirmation adressé au contact du client", () => {
  it("dit qui demande, quoi, sur quelle période, et jusqu'à quand le lien vaut", () => {
    const email = renderConfirmationRequest(input);
    expect(email.subject).toBe("Camille Martin vous demande de confirmer une mission");
    expect(email.text).toContain("Rôle : Lead data engineer");
    expect(email.text).toContain("de janvier 2025 à juin 2025");
    expect(email.text).toContain(LINK);
    expect(email.text).toContain("expire le 13 novembre 2026");
    expect(email.text).toContain("rien n'est publié");
  });

  it("échappe la déclaration du freelance et ne laisse aucun saut de ligne dans le sujet", () => {
    const email = renderConfirmationRequest({ ...input, freelancer: "Eve\r\nBcc: x" });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).toContain("Acme &lt;script&gt;");
    expect(email.html).not.toContain("<script>");
  });

  it("existe en anglais, avec une seule date quand la mission tient dans un mois", () => {
    const email = renderConfirmationRequest({ ...input, lang: "en", endedOn: input.startedOn });
    expect(email.subject).toBe("Camille Martin asks you to confirm a mission");
    expect(email.text).toContain("Period : January 2025");
    expect(email.text).not.toContain("from January");
  });
});

describe("notifications de confirmation de mission", () => {
  const to = { lang: "fr" as const, displayName: "Alex" };

  it("envoie les administrateurs de l'entreprise vers leurs demandes à traiter", () => {
    const email = renderEmail({ kind: "mission_confirmation", payload: { status: "requested" }, to }, BASE);
    expect(email.subject).toBe("Un freelance demande la confirmation d'une mission");
    expect(email.text).toContain("https://proofseen.com/fr/app/confirmations");
  });

  it("prévient le freelance de la réponse, et dit qu'un refus ne publie rien", () => {
    expect(renderEmail({ kind: "mission_confirmation", payload: { status: "confirmed" }, to }, BASE).text).toContain("profil public");
    const refused = renderEmail({ kind: "mission_confirmation", payload: { status: "refused" }, to: { ...to, lang: "en" } }, BASE);
    expect(refused.subject).toBe("The client did not confirm your mission");
    expect(refused.text).toContain("https://proofseen.com/en/app/preuves");
  });
});
