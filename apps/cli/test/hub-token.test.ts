import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkEvidence, issueChallenge } from "@proofseen/profiles";
import { commandHub } from "../src/commands";

/*
 * Le site que nous construisons pour le client publie lui-même sa preuve de possession. Recopier un jeton à la main
 * est exactement l'endroit où l'on se trompe d'un caractère sans jamais le voir.
 */

const SECRET = "un-secret-de-preuve-suffisamment-long-pour-le-hmac";
const BASE = "https://client-demo.fr";

const profile = {
  version: 1,
  baseUrl: BASE,
  person: {
    name: "Camille Dupont",
    headline: { fr: "Développeuse full stack TypeScript", en: "Full stack TypeScript engineer" },
    city: "Paris",
    workMode: { fr: "Télétravail, déplacements ponctuels", en: "Remote, occasional travel" },
    summary: {
      fr: "Conçoit et met en production des applications TypeScript, avec des missions vérifiées une à une avant publication.",
      en: "Designs and ships production TypeScript applications, with every mission verified before publication.",
    },
    stack: ["TypeScript", "Node.js"],
    links: [],
    contactEmail: null,
  },
  availability: { status: "available", from: null, updatedAt: "2026-09-26" },
  rate: null,
  missions: [],
  verificationToken: null,
};

const identity = {
  id: "FR-1AB2C",
  displayName: "Camille Dupont",
  nameVariants: ["Camille Dupont"],
  city: "Paris",
  stack: ["TypeScript"],
  ownedUrls: [{ url: `${BASE}/`, proofMethod: "well_known_file", verifiedAt: null }],
};

describe("le hub publie la preuve de possession", () => {
  let dir: string;
  const logs: string[] = [];
  const common = () => ({ runsDir: join(dir, "runs"), env: { PROOFSEEN_PROOF_SECRET: SECRET }, log: (m: string) => void logs.push(m), now: () => new Date("2026-09-26T09:00:00Z") });
  const published = () => readFile(join(dir, "dist", ".well-known", "proofseen-verification.txt"), "utf8");

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "proofseen-hubtoken-"));
    await writeFile(join(dir, "profile.json"), JSON.stringify(profile));
    await writeFile(join(dir, "identity.json"), JSON.stringify(identity));
    logs.length = 0;
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const build = (withIdentity: boolean) =>
    commandHub({
      ...common(),
      profilePath: join(dir, "profile.json"),
      outDir: join(dir, "dist"),
      ...(withIdentity ? { identityPath: join(dir, "identity.json") } : {}),
    });

  it("dépose le jeton que la vérification attend, sans rien recopier", async () => {
    await build(true);
    const challenge = issueChallenge({ secret: SECRET, identityId: identity.id, url: `${BASE}/a-propos/`, method: "well_known_file" });
    expect(checkEvidence(challenge, await published())).toBe(true);
  });

  it("ne dépose pas le jeton d'une autre identité", async () => {
    await build(true);
    const autre = issueChallenge({ secret: SECRET, identityId: "FR-9ZZZZ", url: `${BASE}/`, method: "well_known_file" });
    expect(checkEvidence(autre, await published())).toBe(false);
  });

  it("ne publie aucune preuve quand aucune identité n'est donnée", async () => {
    await build(false);
    await expect(published()).rejects.toThrow();
  });

  it("refuse de dériver un jeton sans secret plutôt que d'en publier un devinable", async () => {
    await expect(
      commandHub({ ...common(), env: {}, profilePath: join(dir, "profile.json"), outDir: join(dir, "dist"), identityPath: join(dir, "identity.json") }),
    ).rejects.toThrow(/PROOFSEEN_PROOF_SECRET/);
  });

  it("n'affiche jamais le secret, seulement le domaine couvert", async () => {
    await build(true);
    const out = logs.join("\n");
    expect(out).not.toContain(SECRET);
    expect(out).toContain(BASE);
  });
});
