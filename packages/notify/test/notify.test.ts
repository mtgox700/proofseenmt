import { describe, expect, it, vi } from "vitest";
import { deliver, renderEmail, resendTransport, transportFromEnv, type Claimed } from "../src/index";

const BASE = "https://proofseen.com/";
const TO = { lang: "fr" as const, displayName: "Camille" };

describe("contenu des e-mails", () => {
  it("renvoie vers la conversation sans jamais recopier le message", () => {
    const email = renderEmail({ kind: "message_received", payload: { conversationId: "c-1" }, to: TO }, BASE);
    expect(email.subject).toBe("Nouveau message sur Proofseen");
    expect(email.text).toContain("https://proofseen.com/fr/app/messages/c-1");
    expect(email.html).toContain('href="https://proofseen.com/fr/app/messages/c-1"');
  });

  it("explique au freelance qu'il décide avant tout échange", () => {
    const email = renderEmail({ kind: "contact_received", payload: { conversationId: "c-2" }, to: { ...TO, lang: "en" } }, BASE);
    expect(email.subject).toBe("A company would like to contact you");
    expect(email.text).toMatch(/accept or decline/);
    expect(email.text).toContain("https://proofseen.com/en/app/messages/c-2");
  });

  it("dit où en est une candidature, et liste les missions d'une alerte", () => {
    expect(renderEmail({ kind: "application_status", payload: { status: "shortlisted" }, to: TO }, BASE).text).toContain("retenue pour la suite");
    const alert = renderEmail({ kind: "mission_match", payload: { missionIds: ["m-1", "m-2"] }, to: TO }, BASE);
    expect(alert.subject).toBe("2 nouvelles missions pour votre alerte");
    expect(alert.html).toContain('href="https://proofseen.com/fr/missions/m-2"');
  });

  it("relance une prestation payée jamais validée, sans promettre de versement", () => {
    const email = renderEmail({ kind: "contract_update", payload: { contractId: "k-1", status: "validation_due" }, to: TO }, BASE);
    expect(email.subject).toBe("Une prestation attend sa validation");
    expect(email.text).toContain("l'équipe Proofseen examine le dossier");
    expect(email.text).not.toMatch(/versé|automatique/);
  });

  it("rappelle l'échéance de l'attestation de vigilance et ce qu'elle bloque", () => {
    const email = renderEmail({ kind: "vigilance_expiring", payload: { expiresOn: "2027-03-01" }, to: TO }, BASE);
    expect(email.subject).toBe("Votre attestation de vigilance URSSAF expire bientôt");
    expect(email.text).toContain("Elle expire le 2027-03-01");
    expect(email.text).toContain("5 000 € HT");
  });

  it("annonce un relevé mensuel déposé, validé ou à corriger, avec son mois", () => {
    const submitted = renderEmail({ kind: "contract_update", payload: { contractId: "k-2", status: "timesheet_submitted", month: "2026-12" }, to: TO }, BASE);
    expect(submitted.subject).toBe("Un relevé mensuel attend votre validation");
    expect(submitted.text).toContain("relevé de 2026-12");
    expect(renderEmail({ kind: "contract_update", payload: { contractId: "k-2", status: "timesheet_rejected", month: "2026-12" }, to: TO }, BASE).text).toContain("corrigez-le et redéposez-le");
  });

  it("demande la seconde validation aux autres administrateurs", () => {
    const email = renderEmail({ kind: "contract_update", payload: { contractId: "k-3", status: "second_approval_needed" }, to: TO }, BASE);
    expect(email.subject).toBe("Une prestation attend une seconde validation");
    expect(email.text).toContain("seconde validation avant le versement");
  });

  it("échappe le nom affiché", () => {
    const email = renderEmail({ kind: "application_received", payload: {}, to: { lang: "fr", displayName: "<img src=x onerror=alert(1)>" } }, BASE);
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
  });
});

describe("envoi d'un lot", () => {
  const batch: Claimed[] = [
    { id: "n-1", attempts: 0, kind: "message_received", payload: { conversationId: "c-1" }, to: { ...TO, email: "a@x.fr" } },
    { id: "n-2", attempts: 2, kind: "message_received", payload: { conversationId: "c-2" }, to: { ...TO, email: "b@x.fr" } },
    { id: "n-3", attempts: 0, kind: "message_received", payload: { conversationId: "c-3" }, to: { ...TO, email: "c@x.fr" } },
  ];

  it("marque envoyé ce qui part, échoué ce qui est refusé ou lève une erreur", async () => {
    const outbox = { markSent: vi.fn(), markFailed: vi.fn() };
    const transport = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, error: "HTTP_422" })
        .mockRejectedValueOnce(new TypeError("fetch failed")),
    };
    const now = new Date("2026-10-06T12:00:00Z");
    const report = await deliver(batch, { transport, outbox, baseUrl: BASE, now: () => now });
    expect(report).toEqual({ sent: 1, failed: 2 });
    expect(outbox.markSent).toHaveBeenCalledWith("n-1", now);
    expect(outbox.markFailed).toHaveBeenCalledWith("n-2", 2, "HTTP_422", now);
    expect(outbox.markFailed).toHaveBeenCalledWith("n-3", 0, "TypeError", now);
  });
});

describe("transport Resend", () => {
  it("n'existe pas sans clé ni expéditeur", () => {
    expect(transportFromEnv({})).toBeNull();
    expect(transportFromEnv({ RESEND_API_KEY: "re_x" })).toBeNull();
  });

  it("refuse une configuration mal formée plutôt que d'envoyer au hasard", () => {
    expect(() => resendTransport({ apiKey: "pas-une-cle", from: "Proofseen <bonjour@proofseen.com>" })).toThrow(/clé/);
    expect(() => resendTransport({ apiKey: "re_test", from: "pas une adresse" })).toThrow(/expédition/);
  });

  it("envoie le bon contenu et ne rend qu'un code d'erreur court", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 200 })).mockResolvedValueOnce(new Response("destinataire a@x.fr invalide", { status: 422 }));
    const transport = resendTransport({ apiKey: "re_test", from: "Proofseen <bonjour@proofseen.com>" }, fetchMock);
    const email = { subject: "S", text: "T", html: "<p>H</p>" };
    expect(await transport.send("a@x.fr", email)).toEqual({ ok: true });
    expect(await transport.send("a@x.fr", email)).toEqual({ ok: false, error: "HTTP_422" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body))).toEqual({ from: "Proofseen <bonjour@proofseen.com>", to: ["a@x.fr"], subject: "S", text: "T", html: "<p>H</p>" });
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_test");
  });

  it("transmet les en-têtes d'un e-mail qui en porte, comme la désinscription d'un résumé (revue vague 3, L12)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const transport = resendTransport({ apiKey: "re_test", from: "Proofseen <bonjour@proofseen.com>" }, fetchMock);
    const headers = { "List-Unsubscribe": "<https://proofseen.com/api/digest/unsubscribe?u=1&t=2>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
    await transport.send("a@x.fr", { subject: "S", text: "T", html: "<p>H</p>", headers });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ headers });
  });
});
