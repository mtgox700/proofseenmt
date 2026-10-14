import { describe, expect, it } from "vitest";
import { AUTOMATIC_METHODS, defaultProbe, metaTagProofs, proofKit, proveOwnership, readEvidence, type EvidenceProbe } from "../src/ownership-check";
import { PROOF_PREFIX, issueChallenge, WELL_KNOWN_PATH } from "../src/possession";

const SECRET = "un-secret-de-preuve-suffisamment-long-pour-le-hmac";
const PROFILE = "0192f1c4-0000-7000-8000-000000000001";
const OTHER = "0192f1c4-0000-7000-8000-000000000002";
const SITE = "https://camille.dev/a-propos";

/** Une sonde sans réseau : chaque adresse lue et chaque nom résolu sont notés, les réponses sont fournies par le test. */
const probe = (pages: Record<string, string> = {}, txt: Record<string, readonly string[]> = {}) => {
  const fetched: string[] = [];
  const resolved: string[] = [];
  const impl: EvidenceProbe = {
    fetchText: async (url) => {
      fetched.push(url);
      const body = pages[url];
      if (body === undefined) throw new Error("HTTP 404");
      return body;
    },
    resolveTxt: async (host) => {
      resolved.push(host);
      const records = txt[host];
      if (records === undefined) throw new Error("ENOTFOUND");
      return records;
    },
  };
  return { impl, fetched, resolved };
};

const kit = (identityId = PROFILE) => {
  const value = proofKit(SECRET, identityId, SITE);
  if (value === null) throw new Error("kit attendu");
  return value;
};

describe("les valeurs à poser", () => {
  it("donnent le fichier à la racine du domaine, la balise et l'enregistrement DNS, tous préfixés", () => {
    const k = kit();
    expect(k.wellKnown.url).toBe(`https://camille.dev${WELL_KNOWN_PATH}`);
    expect(k.wellKnown.content).toMatch(new RegExp(`^${PROOF_PREFIX}=[0-9a-f]{32}$`));
    expect(k.metaTag.tag).toMatch(new RegExp(`^<meta name="${PROOF_PREFIX}" content="[0-9a-f]{32}">$`));
    expect(k.dnsTxt).toEqual({ host: "camille.dev", value: k.wellKnown.content });
  });

  it("sont liées au profil : le jeton d'un profil ne prouve rien pour un autre", () => {
    expect(kit(OTHER).wellKnown.content).not.toBe(kit().wellKnown.content);
    expect(kit(OTHER).metaTag.tag).not.toBe(kit().metaTag.tag);
  });

  it("n'existent pas pour LinkedIn ni Malt, vérifiés à la main", () => {
    expect(proofKit(SECRET, PROFILE, "https://www.linkedin.com/in/camille")).toBeNull();
    expect(proofKit(SECRET, PROFILE, "https://www.malt.fr/profile/camille")).toBeNull();
  });
});

describe("la vérification", () => {
  it("trouve le fichier de preuve à la racine du domaine", async () => {
    const p = probe({ [kit().wellKnown.url]: `${kit().wellKnown.content}\n` });
    expect(await proveOwnership({ secret: SECRET, identityId: PROFILE, url: SITE }, p.impl)).toEqual({ kind: "proven", method: "well_known_file" });
  });

  it("trouve la balise meta dans la page déclarée", async () => {
    const html = `<html><head>${kit().metaTag.tag}</head><body>Camille</body></html>`;
    const p = probe({ [SITE]: html });
    expect(await proveOwnership({ secret: SECRET, identityId: PROFILE, url: SITE }, p.impl)).toEqual({ kind: "proven", method: "meta_tag" });
  });

  it("lit la balise quel que soit l'ordre des attributs, les guillemets ou la casse", async () => {
    const token = kit().metaTag.tag.split('content="')[1]?.slice(0, 32) ?? "";
    for (const tag of [`<meta content="${token}" name="${PROOF_PREFIX}" />`, `<META NAME='${PROOF_PREFIX}' CONTENT='${token}'>`, `<meta name=${PROOF_PREFIX} content=${token}>`]) {
      expect(metaTagProofs(`<head>${tag}</head>`), tag).toEqual([token]);
    }
  });

  it("sur un attribut répété, le premier fait foi, comme pour un navigateur", () => {
    const token = kit().metaTag.tag.split('content="')[1]?.slice(0, 32) ?? "";
    // Une page qui laisse un tiers ajouter des attributs à sa balise ne doit pas lui laisser remplacer ceux du site.
    expect(metaTagProofs(`<meta name="description" name="${PROOF_PREFIX}" content="${token}">`)).toEqual([]);
    expect(metaTagProofs(`<meta name="${PROOF_PREFIX}" content="vrai" content="${token}">`)).toEqual(["vrai"]);
  });

  it("n'accepte pas le jeton posé en simple texte dans la page : un commentaire ne prouve pas la page d'un autre", async () => {
    const token = kit().metaTag.tag.split('content="')[1]?.slice(0, 32) ?? "";
    const html = `<html><head><meta name="description" content="${token}"></head><body><p>${PROOF_PREFIX}=${token}</p><p>&lt;meta name="${PROOF_PREFIX}" content="${token}"&gt;</p></body></html>`;
    const p = probe({ [SITE]: html });
    expect(await proveOwnership({ secret: SECRET, identityId: PROFILE, url: SITE, methods: ["meta_tag"] }, p.impl)).toEqual({
      kind: "not_found",
      failures: [{ method: "meta_tag", reason: "absent" }],
    });
  });

  it("trouve l'enregistrement TXT, même entouré de guillemets", async () => {
    const p = probe({}, { "camille.dev": ["v=spf1 -all", `"${kit().dnsTxt.value}"`] });
    expect(await proveOwnership({ secret: SECRET, identityId: PROFILE, url: SITE }, p.impl)).toEqual({ kind: "proven", method: "dns_txt" });
    expect(p.resolved).toEqual(["camille.dev"]);
  });

  it("refuse le jeton d'un autre profil posé sur le site", async () => {
    const p = probe({ [kit().wellKnown.url]: kit(OTHER).wellKnown.content, [SITE]: kit(OTHER).metaTag.tag }, { "camille.dev": [kit(OTHER).dnsTxt.value] });
    const outcome = await proveOwnership({ secret: SECRET, identityId: PROFILE, url: SITE }, p.impl);
    expect(outcome).toEqual({
      kind: "not_found",
      failures: [
        { method: "well_known_file", reason: "absent" },
        { method: "meta_tag", reason: "absent" },
        { method: "dns_txt", reason: "absent" },
      ],
    });
  });

  it("distingue une ressource illisible d'une preuve absente, sans rendre la cause", async () => {
    const outcome = await proveOwnership({ secret: SECRET, identityId: PROFILE, url: SITE }, probe().impl);
    expect(outcome).toEqual({ kind: "not_found", failures: AUTOMATIC_METHODS.map((method) => ({ method, reason: "unreachable" })) });
  });

  it("préfère la preuve de domaine quand plusieurs tiennent", async () => {
    const p = probe({ [kit().wellKnown.url]: kit().wellKnown.content, [SITE]: kit().metaTag.tag });
    expect(await proveOwnership({ secret: SECRET, identityId: PROFILE, url: SITE }, p.impl)).toEqual({ kind: "proven", method: "well_known_file" });
  });

  it("n'essaie que les méthodes demandées", async () => {
    const p = probe({ [SITE]: kit().metaTag.tag });
    await proveOwnership({ secret: SECRET, identityId: PROFILE, url: SITE, methods: ["dns_txt"] }, p.impl);
    expect(p.fetched).toEqual([]);
  });

  it("n'émet aucune requête vers LinkedIn ni Malt", async () => {
    const p = probe();
    for (const url of ["https://www.linkedin.com/in/camille", "https://fr.malt.fr/profile/camille", "https://malt.com/p/camille"]) {
      expect(await proveOwnership({ secret: SECRET, identityId: PROFILE, url }, p.impl)).toEqual({ kind: "manual_only" });
    }
    expect(p.fetched).toEqual([]);
    expect(p.resolved).toEqual([]);
  });

  it("lève une erreur de configuration sur un secret trop court, avant toute requête", async () => {
    const p = probe();
    await expect(proveOwnership({ secret: "court", identityId: PROFILE, url: SITE }, p.impl)).rejects.toThrow(/secret de preuve trop court/);
    expect(p.fetched).toEqual([]);
  });

  it("refuse de lire une preuve manuelle, même appelée directement", async () => {
    const challenge = issueChallenge({ secret: SECRET, identityId: PROFILE, url: "https://www.linkedin.com/in/camille", method: "profile_token" });
    await expect(readEvidence(challenge, probe().impl)).rejects.toThrow(/manuelle/);
  });
});

describe("la sonde de production", () => {
  it("refuse une adresse en clair sans ouvrir de connexion", async () => {
    await expect(defaultProbe(500).fetchText("http://camille.dev/")).rejects.toThrow(/https/);
  });
});
