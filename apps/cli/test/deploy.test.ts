import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PublicProfileSchema, buildProfilesSite } from "@proofseen/profiles";
import { commandIndexNow, commandSiteVerify } from "../src/commands";
import { syncOutput } from "../src/files";

const BASE = "https://proofseen.example";
const KEY = "a1b2c3d4e5f6a7b8";
const profile = (id: string) =>
  PublicProfileSchema.parse({
    id,
    handle: `Profil.${id.slice(-1)}`,
    headline: { fr: "Ingénieur full stack TypeScript", en: "Full stack TypeScript engineer" },
    seniority: "7+ ans",
    area: "Paris / Île-de-France",
    skills: ["TypeScript", "Node.js", "PostgreSQL"],
    sectors: [],
    availability: { status: "available", updatedAt: "2026-09-21" },
    rate: null,
    verifiedMissions: 0,
    summary: {
      fr: "Conçoit et met en production des applications TypeScript, avec des missions vérifiées une à une par Proofseen avant publication.",
      en: "Designs and ships production TypeScript applications, with every mission verified one by one by Proofseen before publication.",
    },
  });

let dir: string;
let out: string;
const logs: string[] = [];
const log = (m: string): void => void logs.push(m);

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "proofseen-deploy-"));
  out = join(dir, "site");
  logs.length = 0;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const publish = async (withKey = true) => {
  const files = buildProfilesSite([profile("FR-AAAAA"), profile("FR-BBBBB")], { baseUrl: BASE, ...(withKey ? { indexNowKey: KEY } : {}) });
  await syncOutput(out, files);
  return files;
};

describe("indexnow command", () => {
  it("sends nothing without --confirm-submit", async () => {
    await publish();
    let calls = 0;
    const spy = (async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    expect(await commandIndexNow({ log, outDir: out, baseUrl: BASE, confirmSubmit: false, fetchImpl: spy })).toBe(0);
    expect(calls).toBe(0);
    expect(logs.join("\n")).toMatch(/Rien n'est envoyé/);
  });

  it("submits the sitemap URLs with the key once confirmed", async () => {
    await publish();
    let sent: { url: string; body: { host: string; key: string; urlList: string[] } } | undefined;
    const spy = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return new Response(null, { status: 202 });
    }) as unknown as typeof fetch;
    expect(await commandIndexNow({ log, outDir: out, baseUrl: BASE, confirmSubmit: true, fetchImpl: spy })).toBe(202);
    expect(sent!.url).toBe("https://api.indexnow.org/indexnow");
    expect(sent!.body.key).toBe(KEY);
    expect(sent!.body.urlList).toContain(`${BASE}/p/FR-AAAAA/`);
  });

  it("reports a refused submission as an error", async () => {
    await publish();
    const refuse = (async () => new Response(null, { status: 403 })) as typeof fetch;
    await expect(commandIndexNow({ log, outDir: out, baseUrl: BASE, confirmSubmit: true, fetchImpl: refuse })).rejects.toThrow(/clé refusée/);
  });

  it("refuses to prepare anything when the site carries no key", async () => {
    await publish(false);
    await expect(commandIndexNow({ log, outDir: out, baseUrl: BASE, confirmSubmit: false })).rejects.toThrow(/aucun fichier de clé/);
  });
});

describe("site-verify command", () => {
  it("passes against a host that serves the published folder", async () => {
    const files = await publish();
    const faithful = (async (url: string) => {
      const path = url.slice(BASE.length + 1);
      const file = files.find((f) => f.path === path || f.path === `${path}index.html`);
      return file === undefined ? new Response("", { status: 404 }) : new Response(file.content, { status: 200, headers: { "content-type": "text/html" } });
    }) as unknown as typeof fetch;
    await commandSiteVerify({ log, outDir: out, baseUrl: BASE, timeoutMs: 1_000, fetchImpl: faithful });
    expect(logs.join("\n")).toMatch(/\[warn\] AI crawlers/);
    expect(logs.join("\n")).not.toMatch(/\[FAIL\]/);
  });

  it("fails loudly when the site is not deployed", async () => {
    await publish();
    const offline = (async () => {
      throw new Error("ENOTFOUND");
    }) as typeof fetch;
    await expect(commandSiteVerify({ log, outDir: out, baseUrl: BASE, timeoutMs: 1_000, fetchImpl: offline })).rejects.toThrow(/\[FAIL\]/);
  });
});
