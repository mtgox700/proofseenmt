import { describe, expect, it } from "vitest";
import { DEFAULT_TTL_MS, checkAccess, issueAccess } from "../src";

/*
 * Ces tests visent les trois attaques qui cassent la plupart des jetons faits maison : changer la référence, repousser
 * l'expiration, et deviner la signature. Chacune doit échouer, et la troisième doit échouer *en temps constant*.
 */

const SECRET = "un-secret-de-plus-de-trente-deux-caracteres";
const NOW = new Date("2026-09-30T09:00:00+02:00");
const token = (reference = "FR-1AB2C") => issueAccess({ reference, secret: SECRET, now: NOW });

describe("un jeton d'accès ouvre un dossier, et un seul", () => {
  it("ouvre le dossier pour lequel il a été émis", () => {
    const check = checkAccess({ token: token(), secret: SECRET, now: NOW, expected: "FR-1AB2C" });
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.reference).toBe("FR-1AB2C");
  });

  it("n'ouvre pas celui du voisin, même en changeant la référence dans l'URL", () => {
    // La référence entre dans le message signé : la modifier casse la signature.
    const forged = token().replace("FR-1AB2C", "FR-9ZZZZ");
    expect(checkAccess({ token: forged, secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuse un jeton valide présenté sur la page d'un autre dossier", () => {
    // Deuxième garde : même bien signé, un jeton de FR-1AB2C ne doit rien ouvrir sur FR-9ZZZZ.
    expect(checkAccess({ token: token(), secret: SECRET, now: NOW, expected: "FR-9ZZZZ" })).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("l'expiration ne se repousse pas", () => {
  it("refuse un jeton dont on a édité la date", () => {
    // L'erreur classique : mettre l'échéance à côté de la signature plutôt que dedans. Ici elle est dedans.
    const [reference, expiry, signature] = token().split(".") as [string, string, string];
    const later = `${reference}.${Number(expiry) + 10 * DEFAULT_TTL_MS}.${signature}`;
    expect(checkAccess({ token: later, secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuse un jeton périmé", () => {
    const after = new Date(NOW.getTime() + DEFAULT_TTL_MS + 1);
    expect(checkAccess({ token: token(), secret: SECRET, now: after })).toEqual({ ok: false, reason: "expired" });
  });

  it("refuse à la seconde exacte de l'échéance, pas une milliseconde après", () => {
    const exact = new Date(NOW.getTime() + DEFAULT_TTL_MS);
    expect(checkAccess({ token: token(), secret: SECRET, now: exact })).toEqual({ ok: false, reason: "expired" });
  });
});

describe("ce qui ne doit pas passer", () => {
  it("refuse un jeton signé avec un autre secret", () => {
    const other = "un-autre-secret-de-plus-de-trente-deux-car";
    expect(checkAccess({ token: token(), secret: other, now: NOW })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuse une signature forgée sans révéler que le reste du format était bon", () => {
    // La signature se vérifie avant l'expiration : répondre « expiré » à un jeton forgé confirmerait le format.
    const [reference] = token().split(".") as [string];
    const forged = `${reference}.${NOW.getTime() - 1}.signature-inventee`;
    expect(checkAccess({ token: forged, secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuse ce qui n'a pas la forme d'un jeton", () => {
    for (const bad of ["", "abc", "FR-1AB2C", "FR-1AB2C.pas-un-nombre.sig", "pas-une-ref.123.sig", "a.b.c.d"]) {
      expect(checkAccess({ token: bad, secret: SECRET, now: NOW }).ok).toBe(false);
    }
  });

  it("refuse d'émettre avec un secret trop court plutôt que d'émettre un jeton faible", () => {
    expect(() => issueAccess({ reference: "FR-1AB2C", secret: "court", now: NOW })).toThrow(/secret trop court/);
    expect(() => checkAccess({ token: token(), secret: "court", now: NOW })).toThrow(/secret trop court/);
  });

  it("refuse d'émettre pour une référence hors format", () => {
    expect(() => issueAccess({ reference: "../../etc/passwd", secret: SECRET, now: NOW })).toThrow(/référence invalide/);
  });

  it("ne dit jamais pourquoi c'est invalide autrement qu'en trois mots", () => {
    // Le détail sert aux journaux, jamais à la page : « signature fausse » aide celui qui essaie.
    const reasons = new Set(["malformed", "expired", "invalid"]);
    const check = checkAccess({ token: "n'importe quoi", secret: SECRET, now: NOW });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(reasons.has(check.reason)).toBe(true);
  });
});
