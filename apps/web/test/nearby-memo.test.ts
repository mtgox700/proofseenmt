import { describe, expect, it } from "vitest";
import { memoByPage, NEARBY_MAX_ENTRIES, NEARBY_TTL_MS } from "../src/data/nearby";

/*
 * Similar lists on public pages are reused for a short while, keyed by the page (security review C22, matching M1): a
 * random query string on a public URL must not cost a fresh 500-candidate computation per request.
 */

const counting = (result: (key: string) => readonly string[] | null) => {
  const calls: string[] = [];
  const get = memoByPage<string>(async (key) => {
    calls.push(key);
    return result(key);
  });
  return { calls, get };
};

describe("similar lists kept per page", () => {
  it("computes a page once within the delay, and again after it", async () => {
    const { calls, get } = counting((key) => [key]);
    expect(await get("fr a", 0)).toEqual(["fr a"]);
    expect(await get("fr a", NEARBY_TTL_MS - 1)).toEqual(["fr a"]);
    expect(calls).toEqual(["fr a"]);
    await get("fr a", NEARBY_TTL_MS);
    expect(calls).toEqual(["fr a", "fr a"]);
  });

  it("shares one computation between concurrent requests for the same page", async () => {
    const { calls, get } = counting(() => ["x"]);
    await Promise.all([get("fr b", 0), get("fr b", 1), get("fr b", 2)]);
    expect(calls).toEqual(["fr b"]);
  });

  it("does not keep a failed computation, and answers an empty list", async () => {
    let fail = true;
    const { calls, get } = counting(() => (fail ? null : ["ok"]));
    expect(await get("fr c", 0)).toEqual([]);
    fail = false;
    expect(await get("fr c", 1)).toEqual(["ok"]);
    expect(calls).toHaveLength(2);
  });

  it("keeps at most a bounded number of pages, dropping the oldest", async () => {
    const { calls, get } = counting((key) => [key]);
    for (let i = 0; i <= NEARBY_MAX_ENTRIES; i += 1) await get(`fr p${i}`, 0);
    await get("fr p0", 1);
    await get(`fr p${NEARBY_MAX_ENTRIES}`, 1);
    expect(calls.filter((key) => key === "fr p0")).toHaveLength(2);
    expect(calls.filter((key) => key === `fr p${NEARBY_MAX_ENTRIES}`)).toHaveLength(1);
  });
});
