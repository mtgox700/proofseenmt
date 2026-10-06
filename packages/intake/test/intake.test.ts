import { describe, expect, it } from "vitest";
import { hasPlaceholder } from "@proofseen/core";
import { SubmissionSchema, newReference, openDossier, submissionBlockers, type Submission } from "../src";

/*
 * L'entrée d'un client, éprouvée sur ce qui coûte cher quand on le découvre plus tard.
 */

const NOW = new Date("2026-09-30T09:00:00+02:00");

const submission = (over: Partial<Submission> = {}): Submission =>
  SubmissionSchema.parse({
    displayName: "Camille Dupont",
    urls: ["https://camille-dupont.fr/"],
    email: "camille@exemple.fr",
    lang: "fr",
    consentAt: "2026-09-30T08:59:00+02:00",
    ...over,
  });

describe("ce qu'on refuse à l'entrée", () => {
  it("refuse une inscription qui n'apporte que des plateformes non vérifiables", () => {
    // Encaisser ici, c'est encaisser pour une mesure qu'on ne pourra jamais commencer : la possession ne se prouve
    // pas automatiquement sur ces plateformes, et aucune requête n'est émise vers elles.
    const only = submission({ urls: ["https://www.linkedin.com/in/camille-dupont/", "https://www.malt.fr/profile/camilledupont"] });
    expect(submissionBlockers(only).join(" ")).toMatch(/aucune adresse vérifiable/);
  });

  it("les accepte quand elles accompagnent une adresse vérifiable", () => {
    const mixed = submission({ urls: ["https://camille-dupont.fr/", "https://www.linkedin.com/in/camille-dupont/"] });
    expect(submissionBlockers(mixed)).toEqual([]);
  });

  it("refuse deux fois la même adresse, même écrite différemment", () => {
    // Sinon elle compterait deux fois dans « 2 URL prouvées sur 3 » — un chiffre affiché au client.
    const twice = submission({ urls: ["https://camille-dupont.fr/", "https://Camille-Dupont.fr"] });
    expect(submissionBlockers(twice).join(" ")).toMatch(/deux adresses identiques/);
  });

  it("refuse une adresse qui porte des identifiants ou une ancre", () => {
    expect(() => submission({ urls: ["https://user:pass@camille-dupont.fr/"] })).toThrow();
    expect(() => submission({ urls: ["https://camille-dupont.fr/#section"] })).toThrow();
  });

  it("refuse http, un nom trop court, et une adresse e-mail invalide", () => {
    expect(() => submission({ urls: ["http://camille-dupont.fr/"] })).toThrow();
    expect(() => submission({ displayName: "C" })).toThrow();
    expect(() => submission({ email: "pas-une-adresse" })).toThrow();
  });
});

describe("la référence", () => {
  it("n'est jamais dérivée du nom", () => {
    // Devinable voudrait dire qu'on énumère les clients d'un concurrent à partir d'une liste de noms.
    const references = Array.from({ length: 50 }, () => newReference());
    for (const reference of references) expect(reference).not.toMatch(/CAMILLE|DUPONT/i);
    expect(new Set(references).size).toBeGreaterThan(40);
  });

  it("évite les caractères confondables, parce qu'elle se lit au téléphone", () => {
    const body = Array.from({ length: 200 }, () => newReference().slice(3)).join("");
    for (const confusable of ["I", "L", "O", "0", "1"]) expect(body).not.toContain(confusable);
  });

  it("respecte le format publié", () => {
    expect(newReference(() => 0)).toMatch(/^[A-Z]{2}-[A-Z0-9]{5}$/);
  });
});

describe("le dossier ouvert", () => {
  const dossier = openDossier(submission(), { reference: "FR-1AB2C", now: NOW });

  it("garde l'e-mail hors de l'identité, qui alimente le profil public", () => {
    // Le point de la séparation : tout ce qui entre dans `identity.json` peut finir indexé.
    expect(JSON.stringify(dossier.identity)).not.toContain("camille@exemple.fr");
    expect(JSON.stringify(dossier.identity)).not.toMatch(/@/);
    expect(dossier.contact.email).toBe("camille@exemple.fr");
  });

  it("part en « à renseigner » plutôt qu'en champs vides", () => {
    // C'est ce que le tableau de bord sait lire : le dossier s'affichera « remplir identity.json » au lieu de partir
    // en mesure avec une ville vide, ce qui fausserait la formulation P3.
    expect(hasPlaceholder(dossier.identity.city)).toBe(true);
    expect(dossier.identity.stack.some(hasPlaceholder)).toBe(true);
  });

  it("n'invente aucune variante du nom", () => {
    // Des initiales ou une inversion feraient compter des correspondances qui ne désignent pas forcément la personne.
    expect(dossier.identity.nameVariants).toEqual(["Camille Dupont"]);
  });

  it("choisit la méthode de preuve d'après l'hôte", () => {
    const mixed = openDossier(submission({ urls: ["https://camille-dupont.fr/", "https://www.linkedin.com/in/camille-dupont/"] }), { reference: "FR-1AB2C", now: NOW });
    expect(mixed.identity.ownedUrls.map((owned) => owned.proofMethod)).toEqual(["well_known_file", "profile_token"]);
  });

  it("n'ouvre aucune URL comme déjà prouvée", () => {
    // Une possession cochée d'office ferait sauter le garde-fou qui interdit de mesurer sans preuve.
    expect(dossier.identity.ownedUrls.every((owned) => owned.verifiedAt === null)).toBe(true);
  });

  it("conserve la date de consentement telle qu'elle a été donnée", () => {
    expect(dossier.contact.consentAt).toBe("2026-09-30T08:59:00+02:00");
    expect(dossier.contact.createdAt).toBe(NOW.toISOString());
  });
});
