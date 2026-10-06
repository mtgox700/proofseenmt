import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentitySchema } from "@proofseen/core";
import { PROOF_PREFIX, issueChallenge } from "@proofseen/profiles";
import { commandPossession, type PossessionCommand } from "../src/possession";

const SECRET = "un-secret-de-preuve-suffisamment-long-pour-le-hmac";
const SITE = "https://exemple.fr/p/FR-1AB2C/";
const LINKEDIN = "https://www.linkedin.com/in/exemple";
const DOMAIN = "https://autre.fr/";

const identity = {
  id: "FR-1AB2C",
  displayName: "Camille Dupont",
  nameVariants: ["Camille Dupont"],
  city: "Paris",
  stack: ["TypeScript"],
  ownedUrls: [
    { url: SITE, proofMethod: "well_known_file", verifiedAt: null },
    { url: DOMAIN, proofMethod: "dns_txt", verifiedAt: null },
    { url: LINKEDIN, proofMethod: "profile_token", verifiedAt: null },
  ],
};

const tokenFor = (url: string) => issueChallenge({ secret: SECRET, identityId: identity.id, url, method: "well_known_file" }).token;

describe("preuve de possession, de bout en bout", () => {
  let dir: string;
  let path: string;
  const logs: string[] = [];
  const fetched: string[] = [];
  const resolved: string[] = [];

  const run = (over: Partial<PossessionCommand> = {}) =>
    commandPossession({
      identityPath: path,
      mode: "verify",
      timeoutMs: 1000,
      env: { PROOFSEEN_PROOF_SECRET: SECRET },
      log: (m) => void logs.push(m),
      now: () => new Date("2026-09-26T09:00:00Z"),
      fetchText: async (url) => {
        fetched.push(url);
        return `${PROOF_PREFIX}=${tokenFor(SITE)}`;
      },
      resolveTxt: async (host) => {
        resolved.push(host);
        return [`${PROOF_PREFIX}=${tokenFor(DOMAIN)}`];
      },
      ...over,
    });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-poss-"));
    path = join(dir, "identity.json");
    await writeFile(path, JSON.stringify(identity));
    logs.length = 0;
    fetched.length = 0;
    resolved.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("n'émet jamais de requête vers une plateforme dont la vérification est manuelle", async () => {
    await run();
    expect(fetched.some((url) => url.includes("linkedin"))).toBe(false);
    expect(resolved.some((host) => host.includes("linkedin"))).toBe(false);
    expect(logs.join("\n")).toMatch(/vérification manuelle/);
  });

  it("lit le fichier de preuve à la racine du domaine, pas à la page déclarée", async () => {
    await run();
    expect(fetched).toContain("https://exemple.fr/.well-known/proofseen-verification.txt");
    expect(fetched).not.toContain(SITE);
  });

  it("date les URL prouvées et laisse la vérification manuelle intacte", async () => {
    await run();
    const saved = IdentitySchema.parse(JSON.parse(await readFile(path, "utf8")));
    expect(saved.ownedUrls.map((owned) => owned.verifiedAt)).toEqual(["2026-09-26T09:00:00.000Z", "2026-09-26T09:00:00.000Z", null]);
  });

  it("ne date pas une URL dont la preuve est absente, et le dit", async () => {
    await run({ fetchText: async () => "rien ici" });
    const saved = IdentitySchema.parse(JSON.parse(await readFile(path, "utf8")));
    expect(saved.ownedUrls[0]!.verifiedAt).toBeNull();
    expect(logs.join("\n")).toMatch(/jeton absent/);
  });

  it("repasse à non vérifiée une URL dont la preuve a été retirée depuis la dernière fois", async () => {
    await writeFile(path, JSON.stringify({ ...identity, ownedUrls: [{ ...identity.ownedUrls[0], verifiedAt: "2026-01-01T00:00:00.000Z" }] }));
    await run({ fetchText: async () => "la balise a été supprimée" });
    const saved = IdentitySchema.parse(JSON.parse(await readFile(path, "utf8")));
    expect(saved.ownedUrls[0]!.verifiedAt).toBeNull();
  });

  it("survit à une erreur réseau sans planter, et n'en tire aucune vérification", async () => {
    await run({
      fetchText: async () => {
        throw new Error("HTTP 404");
      },
    });
    expect(logs.join("\n")).toMatch(/preuve illisible.*404/);
    const saved = IdentitySchema.parse(JSON.parse(await readFile(path, "utf8")));
    expect(saved.ownedUrls[0]!.verifiedAt).toBeNull();
  });

  it("prévient quand plus aucune URL n'est vérifiée : rien ne sera apparié", async () => {
    await run({ fetchText: async () => "", resolveTxt: async () => [] });
    expect(logs.join("\n")).toContain("aucun appariement ne sera calculé");
  });

  it("refuse de travailler sans secret, plutôt que d'émettre un jeton devinable", async () => {
    await expect(run({ env: {} })).rejects.toThrow(/PROOFSEEN_PROOF_SECRET/);
  });

  it("en mode consigne, n'appelle rien et n'écrit rien", async () => {
    const before = await readFile(path, "utf8");
    await run({ mode: "issue" });
    expect(fetched).toHaveLength(0);
    expect(resolved).toHaveLength(0);
    expect(await readFile(path, "utf8")).toBe(before);
    expect(logs.join("\n")).toContain("/.well-known/proofseen-verification.txt");
  });

  it("n'affiche jamais le secret, même en mode consigne", async () => {
    await run({ mode: "issue" });
    expect(logs.join("\n")).not.toContain(SECRET);
  });
});
