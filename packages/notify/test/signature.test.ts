import { describe, expect, it } from "vitest";
import { renderConfirmationRequest, renderDigest, renderEmail, renderInvitation, type Email, type Lang } from "../src/index";

/*
 * Kensa N5 : la signature des e-mails texte était séparée du corps par une ligne faite d'un tiret cadratin. Le
 * séparateur est désormais le délimiteur standard « -- » suivi d'une espace, seul sur sa ligne (RFC 3676, 4.3), et
 * aucun e-mail ne porte de tiret cadratin, ni dans l'objet, ni dans le texte, ni dans le HTML.
 */

const BASE = "https://proofseen.com/";
const EM_DASH = String.fromCodePoint(0x2014);

const emails = (lang: Lang): readonly (readonly [string, Email])[] => [
  ["notification", renderEmail({ kind: "message_received", payload: { conversationId: "c-1" }, to: { lang, displayName: "Camille" } }, BASE)],
  [
    "confirmation",
    renderConfirmationRequest({
      lang,
      freelancer: "Camille Martin",
      role: "Lead data engineer",
      clientName: "Acme",
      startedOn: new Date("2025-01-01T00:00:00Z"),
      endedOn: new Date("2025-06-01T00:00:00Z"),
      expiresAt: new Date("2026-11-13T09:00:00Z"),
      link: "https://proofseen.com/fr/confirmer-mission/0192f1c4-0000-7000-8000-000000000001?t=abc",
    }),
  ],
  [
    "invitation",
    renderInvitation({ lang, kind: "freelance", inviter: "Acme", message: "Ravi de retravailler ensemble.", expiresAt: new Date("2026-11-02T09:00:00Z"), link: "https://proofseen.com/fr/app/invitations/x?t=abc", reminder: false }),
  ],
  ["résumé", renderDigest({ to: { lang, displayName: "Camille" }, unread: 2, threads: [{ conversationId: "0198f0aa-1234-7abc-8def-0123456789ab", counterpart: "Acme", unread: 2 }] }, BASE)],
];

describe("signature des e-mails texte", () => {
  for (const lang of ["fr", "en"] as const) {
    it.each(emails(lang))(`${lang} %s : sépare la signature par le délimiteur standard`, (_name, email) => {
      const lines = email.text.split("\n");
      expect(lines.filter((line) => line === "-- ")).toHaveLength(1);
      // Le délimiteur suit une ligne vide et précède la signature : il ne termine jamais le message.
      const at = lines.indexOf("-- ");
      expect(lines[at - 1]).toBe("");
      expect(lines[at + 1]?.length ?? 0).toBeGreaterThan(0);
    });

    it.each(emails(lang))(`${lang} %s : aucun tiret cadratin dans l'objet, le texte ou le HTML`, (_name, email) => {
      for (const part of [email.subject, email.text, email.html]) expect(part).not.toContain(EM_DASH);
    });
  }
});
