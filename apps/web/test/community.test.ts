import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { communityEn } from "../src/i18n/market/community-en";
import { communityFr } from "../src/i18n/market/community-fr";
import { ERROR_CODES, errorOf, isCommunityError, returnOf, returnPath } from "../src/lib/community";
import { notificationHref } from "../src/lib/notification-link";

/*
 * The community screens (C22): error codes form a closed list that both languages translate, a return address is
 * built from known pieces only, notifications lead to the post, and every server action re-reads the session and is
 * throttled before it writes (read from the files, like the back-office red team).
 */

const here = dirname(fileURLToPath(import.meta.url));
const APP = join(here, "../src/app/[lang]/app");
const ID = "0198f0aa-1234-7abc-8def-0123456789ab";

const keysOf = (value: unknown, prefix = ""): string[] =>
  typeof value === "object" && value !== null
    ? Object.entries(value).flatMap(([key, inner]) => (typeof inner === "function" || typeof inner !== "object" ? [`${prefix}${key}`] : keysOf(inner, `${prefix}${key}.`)))
    : [];

describe("community copy", () => {
  it("has the same keys in French and English, and a sentence for every error code", () => {
    expect(keysOf(communityEn).sort()).toEqual(keysOf(communityFr).sort());
    for (const code of ERROR_CODES) {
      expect(communityFr.errors[code]).not.toBe("");
      expect(communityEn.errors[code]).not.toBe("");
    }
  });

  it("states that the feed is ordered by date only", () => {
    expect(communityFr.order).toMatch(/date/);
    expect(communityEn.order).toMatch(/date/);
  });
});

describe("community outcomes and return addresses", () => {
  it("maps each refusal to a known code", () => {
    expect(errorOf({ kind: "created", id: ID })).toBeNull();
    expect(errorOf({ kind: "text", problem: "contact" })).toBe("text_contact");
    expect(errorOf({ kind: "link", problem: "invalid" })).toBe("link_invalid");
    expect(errorOf({ kind: "limit" })).toBe("limit");
    expect(isCommunityError("text_contact")).toBe(true);
    expect(isCommunityError("<script>")).toBe(false);
  });

  it("only returns to the feed or a post named by a uuid", () => {
    expect(returnPath("fr", returnOf("post", ID))).toBe(`/fr/app/fil/${ID}`);
    expect(returnPath("fr", returnOf("post", "../../evil"))).toBe("/fr/app/fil");
    expect(returnPath("en", returnOf("discover", null), { key: "erreur", value: "limit" })).toBe("/en/app/fil?onglet=decouvrir&erreur=limit");
    expect(returnPath("fr", returnOf("https://evil.example", null), { key: "ok", value: "publie" }, `p-${ID}`)).toBe(`/fr/app/fil?ok=publie#p-${ID}`);
  });

  it("leads community notifications to the post, and followers to the follows page", () => {
    expect(notificationHref("fr", { kind: "post_comment", payload: { postId: ID, commentId: ID } })).toBe(`/fr/app/fil/${ID}`);
    expect(notificationHref("en", { kind: "post_reaction", payload: { postId: "nope" } })).toBe("/en/app/fil");
    expect(notificationHref("fr", { kind: "new_follower", payload: {} })).toBe("/fr/app/abonnements");
  });
});

/** The body of each exported async function of a server-action file, by name. */
const exportedActions = (text: string): [string, string][] => {
  const heads = [...text.matchAll(/export async function (\w+)\(/g)];
  return heads.map((head, i) => [head[1] ?? "?", text.slice(head.index, heads[i + 1]?.index ?? text.length)]);
};

describe("every community server action re-reads the session and is throttled", () => {
  for (const file of ["fil/actions.ts", "abonnements/actions.ts"]) {
    const text = readFileSync(join(APP, file), "utf8");
    it(`${file} is a server-action file exporting only async functions`, () => {
      expect(text.startsWith('"use server";')).toBe(true);
      expect(text).not.toMatch(/^export (const|let|var|function|class|default)\b/m);
    });
    for (const [name, body] of exportedActions(text)) {
      it(`${file}#${name}`, () => {
        const market = body.indexOf("actionMarket(");
        const throttle = body.indexOf("throttled(");
        expect(market).toBeGreaterThan(-1);
        expect(throttle).toBeGreaterThan(market);
        // Nothing is written before the throttle answers.
        const write = body.search(/\.(create|share|edit|remove|react|unreact|comment|follow|unfollow)\(/);
        expect(write === -1 || write > throttle).toBe(true);
      });
    }
  }
});
