import { describe, expect, it } from "vitest";
import { renderEmail, renderInvitation } from "../src/index";

const LINK = "https://proofseen.com/fr/app/invitations/0192f1c4-0000-7000-8000-000000000001?t=abc";

const input = {
  lang: "fr" as const,
  kind: "freelance" as const,
  inviter: "Acme <script>",
  message: "Ravi de retravailler ensemble.\nÀ bientôt",
  expiresAt: new Date("2026-11-02T09:00:00Z"),
  link: LINK,
  reminder: false,
};

describe("e-mail d'invitation", () => {
  it("dit qui invite, à quoi, comment répondre, et jusqu'à quand le lien vaut", () => {
    const email = renderInvitation(input);
    expect(email.subject).toBe("Acme <script> vous invite sur Proofseen");
    expect(email.text).toContain("vivier privé");
    expect(email.text).toContain("connectez-vous ou créez votre compte avec cette adresse e-mail");
    expect(email.text).toContain(LINK);
    expect(email.text).toContain("expire le 2 novembre 2026");
    expect(email.text).toContain("> Ravi de retravailler ensemble.");
  });

  it("échappe le nom et le mot de l'expéditeur, et garde le sujet sur une ligne", () => {
    const email = renderInvitation({ ...input, inviter: "Eve\r\nBcc: x", message: "<img src=x>" });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).toContain("&lt;img src=x&gt;");
    expect(email.html).not.toContain("<img");
  });

  it("présente de façon neutre une entreprise dont le nom porte un lien", () => {
    expect(renderInvitation({ ...input, inviter: null }).subject).toBe("Une entreprise vous invite sur Proofseen");
    expect(renderInvitation({ ...input, lang: "en", inviter: null }).text).toContain("A company already works with you");
  });

  it("existe pour une entreprise invitée par un freelance, en anglais, et en relance", () => {
    const email = renderInvitation({ ...input, lang: "en", kind: "client", inviter: "Camille Martin", message: null, reminder: true });
    expect(email.subject).toBe("Reminder: Camille Martin invites you to Proofseen");
    expect(email.text).toContain("a freelancer on Proofseen");
    expect(email.text).not.toContain("Their note");
  });
});

describe("notification d'invitation acceptée", () => {
  const to = { lang: "fr" as const, displayName: "Alex" };

  it("prévient l'expéditeur sans nommer la personne, et renvoie vers ses invitations", () => {
    const pool = renderEmail({ kind: "invitation_accepted", payload: { invitationId: "x", status: "pool" }, to }, "https://proofseen.com");
    expect(pool.subject).toBe("Un freelance a rejoint votre vivier");
    expect(pool.text).toContain("https://proofseen.com/fr/app/invitations");
    const client = renderEmail({ kind: "invitation_accepted", payload: { invitationId: "x", status: "client" }, to: { ...to, lang: "en" } }, "https://proofseen.com");
    expect(client.subject).toBe("A company you invited joined Proofseen");
  });
});
