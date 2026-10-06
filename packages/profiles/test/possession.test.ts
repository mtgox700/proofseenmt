import { describe, expect, it } from "vitest";
import {
  MIN_SECRET_LENGTH,
  PROOF_PREFIX,
  checkEvidence,
  isManual,
  issueChallenge,
  wellKnownUrl,
  type Challenge,
} from "../src/possession";

const SECRET = "un-secret-de-preuve-suffisamment-long-pour-le-hmac";
const URL_A = "https://exemple.fr/p/FR-1AB2C/";
const issue = (over: Partial<Parameters<typeof issueChallenge>[0]> = {}): Challenge =>
  issueChallenge({ secret: SECRET, identityId: "FR-1AB2C", url: URL_A, method: "well_known_file", ...over });

describe("le jeton de possession", () => {
  it("est reproductible : réémettre ne demande pas au client de recommencer", () => {
    expect(issue().token).toBe(issue().token);
  });

  it("change avec le domaine, avec l'identité et avec le secret", () => {
    const base = issue().token;
    expect(issue({ url: "https://autre.fr/p/FR-1AB2C/" }).token).not.toBe(base);
    expect(issue({ identityId: "FR-9ZZZZ" }).token).not.toBe(base);
    expect(issue({ secret: `${SECRET}-autre` }).token).not.toBe(base);
  });

  it("est le même pour toutes les pages d'un domaine quand la preuve porte sur le domaine", () => {
    // Le fichier de preuve est unique par domaine : quatre pages ne peuvent pas demander quatre lignes différentes.
    for (const method of ["well_known_file", "dns_txt"] as const) {
      expect(issue({ method, url: "https://exemple.fr/en/n/x/" }).token).toBe(issue({ method, url: URL_A }).token);
    }
  });

  it("diffère d'une page à l'autre quand la preuve porte sur la page", () => {
    expect(issue({ method: "meta_tag", url: "https://exemple.fr/en/n/x/" }).token).not.toBe(issue({ method: "meta_tag", url: URL_A }).token);
  });

  it("refuse un secret trop court plutôt que d'émettre un jeton devinable", () => {
    expect(() => issue({ secret: "court" })).toThrow(/secret/i);
    expect(() => issue({ secret: "x".repeat(MIN_SECRET_LENGTH - 1) })).toThrow(/secret/i);
  });

  it("suit ce que la méthode prouve, pas son nom : deux méthodes qui prouvent le domaine donnent le même jeton", () => {
    // Le client peut donc passer du fichier au DNS sans rien reposer.
    expect(issue({ method: "well_known_file" }).token).toBe(issue({ method: "dns_txt" }).token);
  });

  it("porte une consigne qui contient le jeton et l'endroit où le poser", () => {
    const challenge = issue();
    expect(challenge.instruction).toContain(challenge.token);
    expect(challenge.instruction).toContain("/.well-known/proofseen-verification.txt");
  });
});

describe("le fichier bien connu se déduit de l'origine, jamais du chemin", () => {
  it("vise la racine du domaine quelle que soit la page déclarée", () => {
    expect(wellKnownUrl("https://exemple.fr/p/FR-1AB2C/?x=1")).toBe("https://exemple.fr/.well-known/proofseen-verification.txt");
  });

  it("refuse une URL qui n'est pas en https", () => {
    expect(() => wellKnownUrl("http://exemple.fr/")).toThrow(/https/i);
    expect(() => wellKnownUrl("pas-une-url")).toThrow();
  });
});

describe("la preuve apportée", () => {
  const challenge = issue();

  it("accepte le jeton seul dans le fichier, espaces et retours à la ligne compris", () => {
    expect(checkEvidence(challenge, `\n  ${challenge.token}  \n`)).toBe(true);
  });

  it("accepte la forme préfixée, celle des enregistrements DNS et des balises", () => {
    expect(checkEvidence(challenge, `${PROOF_PREFIX}=${challenge.token}`)).toBe(true);
    expect(checkEvidence(challenge, `"${PROOF_PREFIX}=${challenge.token}"`)).toBe(true);
  });

  it("accepte un fichier qui porte d'autres lignes autour", () => {
    expect(checkEvidence(challenge, `# ma vérification\n${PROOF_PREFIX}=${challenge.token}\n# fin\n`)).toBe(true);
  });

  it("refuse un jeton tronqué, un jeton voisin et une preuve vide", () => {
    expect(checkEvidence(challenge, challenge.token.slice(0, -1))).toBe(false);
    expect(checkEvidence(challenge, issue({ identityId: "FR-9ZZZZ" }).token)).toBe(false);
    expect(checkEvidence(challenge, "")).toBe(false);
  });

  it("refuse une page entière qui ne contient le jeton nulle part", () => {
    expect(checkEvidence(challenge, "<html><body>Bienvenue sur mon site</body></html>")).toBe(false);
  });
});

describe("les plateformes où aucune requête automatisée ne part", () => {
  // La ligne rouge ne peut pas dépendre d'une saisie correcte : sans ce refus, une URL LinkedIn déclarée en
  // « well_known_file » aurait déclenché une requête vers LinkedIn.
  const hosts = ["https://www.linkedin.com/in/x", "https://linkedin.com/in/x", "https://www.malt.fr/profile/x", "https://malt.com/profile/x"];

  it("refuse d'émettre une consigne automatisable sur ces plateformes", () => {
    for (const url of hosts) {
      for (const method of ["well_known_file", "meta_tag", "dns_txt"] as const) {
        expect(() => issue({ url, method }), `${url} / ${method}`).toThrow(/à la main|profile_token/);
      }
    }
  });

  it("accepte la seule méthode manuelle sur ces mêmes plateformes", () => {
    for (const url of hosts) expect(issue({ url, method: "profile_token" }).manual).toBe(true);
  });

  it("ne bloque pas un domaine qui ressemble sans en être un", () => {
    expect(() => issue({ url: "https://malt.fr.exemple.com/", method: "meta_tag" })).not.toThrow();
    expect(() => issue({ url: "https://notmalt.fr/", method: "meta_tag" })).not.toThrow();
  });
});

describe("ce que la machine n'a pas le droit de vérifier", () => {
  it("marque la preuve par profil de plateforme comme manuelle", () => {
    expect(isManual("profile_token")).toBe(true);
    for (const method of ["well_known_file", "meta_tag", "dns_txt"] as const) expect(isManual(method)).toBe(false);
  });

  it("explique au vérificateur humain que la visite doit être normale, sans automatisation", () => {
    const challenge = issue({ method: "profile_token", url: "https://www.linkedin.com/in/exemple" });
    expect(challenge.instruction).toMatch(/à la main|manuelle/i);
    expect(challenge.manual).toBe(true);
  });
});
