import type { DueDigest, MessageDigests } from "@proofseen/db";
import type { Email, Transport } from "@proofseen/notify";
import { describe, expect, it } from "vitest";
import { sendDigests } from "../src/data/digest-mail";
import { erasureTombstoneKey } from "../src/lib/erasure-key";
import { digestUnsubscribeSecret, isUnsubscribeToken, unsubscribeToken, unsubscribeUrl } from "../src/lib/digest-unsubscribe";

/*
 * The one-click unsubscribe of the daily digest (wave-3 review, L12): each digest carries `List-Unsubscribe` and
 * `List-Unsubscribe-Post`, pointing to a link signed for that person only. And the key of the erasure tombstones
 * (L11), derived like the other keys of the site.
 */

const SECRET = "s".repeat(40);
const USER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";

const DUE: DueDigest = {
  userId: USER,
  to: { email: "camille@example.fr", lang: "fr", displayName: "Camille" },
  unread: 2,
  threads: [{ conversationId: "00000000-0000-4000-8000-0000000000aa", counterpart: "Acme", unread: 2 }],
};

const digests = (due: readonly DueDigest[]): MessageDigests => ({
  enabled: async () => true,
  set: async () => undefined,
  claimDue: async () => due,
});

describe("digest unsubscribe link", () => {
  it("is signed for one person, under a key of its own", () => {
    const secret = digestUnsubscribeSecret({ PROOFSEEN_ACCESS_SECRET: SECRET });
    if (secret === null) throw new Error("no secret");
    expect(digestUnsubscribeSecret({ PROOFSEEN_ACCESS_SECRET: "court" })).toBeNull();
    const token = unsubscribeToken(secret, USER);
    expect(isUnsubscribeToken(secret, USER, token)).toBe(true);
    expect(isUnsubscribeToken(secret, OTHER, token)).toBe(false);
    expect(isUnsubscribeToken(secret, USER, `${token}x`)).toBe(false);
    expect(isUnsubscribeToken(secret, USER, "")).toBe(false);
    expect(unsubscribeUrl("https://proofseen.com/", USER, token)).toBe(`https://proofseen.com/api/digest/unsubscribe?u=${USER}&t=${token}`);
  });

  it("goes into every digest as List-Unsubscribe and List-Unsubscribe-Post", async () => {
    const sent: Email[] = [];
    const transport: Transport = {
      send: async (_to, email) => {
        sent.push(email);
        return { ok: true };
      },
    };
    const report = await sendDigests({ digests: digests([DUE]), transport, baseUrl: "https://proofseen.com", now: () => new Date(), unsubscribe: (userId) => `https://proofseen.com/u/${userId}` });
    expect(report).toEqual({ sent: 1, failed: 0 });
    expect(sent[0]?.headers).toEqual({ "List-Unsubscribe": `<https://proofseen.com/u/${USER}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  });
});

describe("erasure tombstone key", () => {
  it("is derived from the access secret, never equal to it, and absent without one", () => {
    const key = erasureTombstoneKey({ PROOFSEEN_ACCESS_SECRET: SECRET });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain(SECRET);
    expect(erasureTombstoneKey({})).toBeNull();
    expect(digestUnsubscribeSecret({ PROOFSEEN_ACCESS_SECRET: SECRET })).not.toBe(key);
  });
});
