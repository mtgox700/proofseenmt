import { describe, expect, it } from "vitest";
import type { InvitationMail, PendingInvitationEmail } from "@proofseen/db";
import type { Email, Transport } from "@proofseen/notify";
import { sendInvitationEmails } from "../src/data/invitation-mail";
import { invitationsEn } from "../src/i18n/market/invitations-en";
import { invitationsFr } from "../src/i18n/market/invitations-fr";
import { invitationPath, invitationSecret, invitationToken, invitationUrl } from "../src/lib/invitation-secret";
import { invitationKindOf, noticeOf, requiredSide, sideAllows } from "../src/lib/invitations";
import { confirmationSecret, confirmationToken } from "../src/lib/confirmation-secret";
import { notificationHref } from "../src/lib/notification-link";

/*
 * Invitations (C23), web side: signed links under their own key, the e-mail queue drained the same way whatever the
 * address, the side of the account checked before accepting, and notices only from a closed list.
 */

const ENV = { PROOFSEEN_ACCESS_SECRET: "x".repeat(40) };
const ID = "0198f0aa-1234-7abc-8def-0123456789ab";

describe("signed invitation links", () => {
  it("derive their own key: an invitation token is never a confirmation token", () => {
    const secret = invitationSecret(ENV);
    expect(secret).not.toBeNull();
    expect(secret).not.toBe(confirmationSecret(ENV));
    expect(invitationToken(secret!, ID)).not.toBe(confirmationToken(confirmationSecret(ENV)!, ID));
    expect(invitationToken(secret!, ID)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invitationToken(secret!, ID)).toBe(invitationToken(secret!, ID));
  });

  it("refuse to exist without a long enough secret", () => {
    expect(invitationSecret({ PROOFSEEN_ACCESS_SECRET: "short" })).toBeNull();
    expect(invitationSecret({})).toBeNull();
  });

  it("open the answer page of the connected space", () => {
    expect(invitationPath("fr", ID, "abc")).toBe(`/fr/app/invitations/${ID}?t=abc`);
    expect(invitationUrl("https://proofseen.com/", "en", ID, "a+b")).toBe(`https://proofseen.com/en/app/invitations/${ID}?t=a%2Bb`);
  });
});

const pending = (over: Partial<PendingInvitationEmail> = {}): PendingInvitationEmail => ({
  id: ID,
  to: "camille@client.fr",
  lang: "fr",
  attempts: 0,
  kind: "freelance",
  inviter: "Acme",
  message: null,
  expiresAt: new Date("2026-11-02T09:00:00Z"),
  reminder: false,
  ...over,
});

const fakeOutbox = (batch: readonly PendingInvitationEmail[]) => {
  const sent: string[] = [];
  const failed: string[] = [];
  const outbox: InvitationMail = {
    async claim() {
      return batch;
    },
    async markSent(id) {
      sent.push(id);
    },
    async markFailed(id) {
      failed.push(id);
    },
  };
  return { outbox, sent, failed };
};

describe("invitation e-mails", () => {
  it("send the signed link, mark it sent, and retry a failure later", async () => {
    const other = "0198f0aa-1234-7abc-8def-0123456789ac";
    const { outbox, sent, failed } = fakeOutbox([pending(), pending({ id: other, to: "fail@client.fr", reminder: true })]);
    const mails: { to: string; email: Email }[] = [];
    const transport: Transport = {
      async send(to, email) {
        mails.push({ to, email });
        return to.startsWith("fail") ? { ok: false, error: "rejected" } : { ok: true };
      },
    };
    const secret = invitationSecret(ENV)!;
    const report = await sendInvitationEmails({ outbox, transport, secret, baseUrl: "https://proofseen.com", now: () => new Date() });
    expect(report).toEqual({ sent: 1, failed: 1 });
    expect(sent).toEqual([ID]);
    expect(failed).toEqual([other]);
    expect(mails[0]?.email.text).toContain(invitationUrl("https://proofseen.com", "fr", ID, invitationToken(secret, ID)));
    expect(mails[0]?.email.subject).toBe("Acme vous invite sur Proofseen");
    expect(mails[1]?.email.subject).toBe("Rappel : Acme vous invite sur Proofseen");
  });

  it("are the same for an address with an account and one without: nothing in the queue tells them apart", async () => {
    const a = fakeOutbox([pending({ to: "known@client.fr" })]);
    const b = fakeOutbox([pending({ to: "unknown@client.fr" })]);
    const bodies: string[] = [];
    const transport: Transport = {
      async send(_to, email) {
        bodies.push(email.text);
        return { ok: true };
      },
    };
    const secret = invitationSecret(ENV)!;
    await sendInvitationEmails({ outbox: a.outbox, transport, secret, baseUrl: "https://proofseen.com", now: () => new Date() });
    await sendInvitationEmails({ outbox: b.outbox, transport, secret, baseUrl: "https://proofseen.com", now: () => new Date() });
    expect(bodies[0]).toBe(bodies[1]);
    expect(bodies[0]).toContain("connectez-vous ou créez votre compte");
  });
});

describe("side of the account", () => {
  it("lets a freelancer accept a pool invitation and a company a client one, never the other way round", () => {
    expect(requiredSide("freelance")).toBe("freelance");
    expect(requiredSide("client")).toBe("company");
    expect(sideAllows("freelance", "freelance")).toBe(true);
    expect(sideAllows("company", "freelance")).toBe(false);
    expect(sideAllows("freelance", "client")).toBe(false);
    expect(sideAllows("operator", "client")).toBe(false);
    // Not chosen yet: accepting chooses it.
    expect(sideAllows(null, "client")).toBe(true);
    expect(invitationKindOf("client")).toBe("client");
    expect(invitationKindOf("admin")).toBeNull();
    expect(invitationKindOf(null)).toBeNull();
  });
});

describe("notices and texts", () => {
  it("only read known codes from the query", () => {
    expect(noticeOf("envoyee", undefined)).toEqual({ ok: true, key: "envoyee" });
    expect(noticeOf(undefined, "adresse")).toEqual({ ok: false, key: "adresse" });
    expect(noticeOf("<script>", "../evil")).toBeNull();
  });

  it("lead the accepted-invitation notification to the invitations page", () => {
    expect(notificationHref("fr", { kind: "invitation_accepted", payload: { invitationId: ID, status: "pool" } })).toBe("/fr/app/invitations");
  });

  it("have the same keys in both languages", () => {
    const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v !== null ? keys(v).map((s) => `${k}.${s}`) : [k])).sort();
    expect(keys(invitationsEn)).toEqual(keys(invitationsFr));
  });
});
