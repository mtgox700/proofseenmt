import { describe, expect, it } from "vitest";
import { confirmationTokenHash, type ConfirmationMail, type PendingConfirmationEmail } from "@proofseen/db";
import type { Email, Transport } from "@proofseen/notify";
import { sendConfirmationEmails } from "../src/data/confirmation-mail";
import { confirmationFromForm, decisionFromForm } from "../src/lib/confirmation-form";
import { confirmationSecret, confirmationToken, confirmationUrl } from "../src/lib/confirmation-secret";
import { proofSecret } from "../src/lib/proof-secret";

const LONG = "a".repeat(32);
const ID = "0192f1c4-0000-7000-8000-000000000001";
const OTHER_ID = "0192f1c4-0000-7000-8000-000000000002";

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

describe("signed confirmation links", () => {
  it("derive their own key from the access secret, distinct from the proof tokens", () => {
    const secret = confirmationSecret({ PROOFSEEN_ACCESS_SECRET: LONG });
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(secret).not.toBe(LONG);
    expect(secret).not.toBe(proofSecret({ PROOFSEEN_ACCESS_SECRET: LONG }));
    expect(confirmationSecret({})).toBeNull();
    expect(confirmationSecret({ PROOFSEEN_ACCESS_SECRET: "court" })).toBeNull();
  });

  it("bind each token to one request, in the format the repository accepts", () => {
    const secret = confirmationSecret({ PROOFSEEN_ACCESS_SECRET: LONG }) ?? "";
    const token = confirmationToken(secret, ID);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(confirmationToken(secret, ID)).toBe(token);
    expect(confirmationToken(secret, OTHER_ID)).not.toBe(token);
    expect(confirmationToken("b".repeat(64), ID)).not.toBe(token);
    // The database keeps the hash, never the token.
    expect(confirmationTokenHash(token)).not.toContain(token);
    expect(confirmationUrl("https://proofseen.com/", "en", ID, token)).toBe(`https://proofseen.com/en/confirmer-mission/${ID}?t=${token}`);
  });
});

describe("confirmation forms", () => {
  it("turn the freelancer's form into repository input, empty optional fields as null", () => {
    const input = confirmationFromForm(
      form({ role: " Lead data ", clientName: "Acme", clientKind: "eti", clientSiret: "", contactEmail: " dsi@acme.fr ", startedOn: "2025-01", endedOn: "2025-06", summary: "Migration." }),
    );
    expect(input).toEqual({ role: "Lead data", clientName: "Acme", clientKind: "eti", clientSiret: null, contactEmail: "dsi@acme.fr", startedOn: "2025-01", endedOn: "2025-06", summary: "Migration." });
  });

  it("publish the client's name only when the box is ticked, and never with a refusal", () => {
    expect(decisionFromForm(form({ decision: "confirm" }))).toEqual({ confirm: true, showClientName: false });
    expect(decisionFromForm(form({ decision: "confirm", showClientName: "on" }))).toEqual({ confirm: true, showClientName: true });
    expect(decisionFromForm(form({ decision: "refuse", showClientName: "on" }))).toEqual({ confirm: false, showClientName: false });
    expect(decisionFromForm(form({ decision: "maybe" }))).toBeNull();
    expect(decisionFromForm(form({}))).toBeNull();
  });
});

const pending = (id: string): PendingConfirmationEmail => ({
  id,
  to: `contact-${id.slice(-1)}@client.fr`,
  lang: "fr",
  attempts: 0,
  freelancer: "Camille",
  role: "Lead data",
  clientName: "Acme",
  startedOn: new Date("2025-01-01T00:00:00Z"),
  endedOn: new Date("2025-06-01T00:00:00Z"),
  expiresAt: new Date("2026-11-13T00:00:00Z"),
});

describe("confirmation e-mails", () => {
  it("send each claimed request with its recomputed link, and record failures for a retry", async () => {
    const sent: { to: string; email: Email }[] = [];
    const marks: string[] = [];
    const outbox: ConfirmationMail = {
      claim: async () => [pending(ID), pending(OTHER_ID)],
      markSent: async (id) => void marks.push(`sent:${id}`),
      markFailed: async (id, attempts) => void marks.push(`failed:${id}:${attempts}`),
    };
    const transport: Transport = {
      send: async (to, email) => {
        if (to.endsWith("2@client.fr")) return { ok: false, error: "HTTP_500" };
        sent.push({ to, email });
        return { ok: true };
      },
    };
    const secret = "c".repeat(64);
    const report = await sendConfirmationEmails({ outbox, transport, secret, baseUrl: "https://proofseen.com", now: () => new Date("2026-10-14T09:00:00Z") });
    expect(report).toEqual({ sent: 1, failed: 1 });
    expect(marks).toEqual([`sent:${ID}`, `failed:${OTHER_ID}:0`]);
    expect(sent[0]?.email.text).toContain(`https://proofseen.com/fr/confirmer-mission/${ID}?t=${confirmationToken(secret, ID)}`);
  });

  it("count a transport that throws as a failure, without losing the batch", async () => {
    const marks: string[] = [];
    const outbox: ConfirmationMail = {
      claim: async () => [pending(ID)],
      markSent: async (id) => void marks.push(`sent:${id}`),
      markFailed: async (id) => void marks.push(`failed:${id}`),
    };
    const transport: Transport = {
      send: async () => {
        throw new TypeError("fetch failed");
      },
    };
    expect(await sendConfirmationEmails({ outbox, transport, secret: "d".repeat(64), baseUrl: "https://x.test", now: () => new Date() })).toEqual({ sent: 0, failed: 1 });
    expect(marks).toEqual([`failed:${ID}`]);
  });
});
