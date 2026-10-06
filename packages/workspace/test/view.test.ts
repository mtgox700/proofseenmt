import { describe, expect, it } from "vitest";
import { buildClientView, byUrgency, summarise, type ClientFacts, type ClientViewInput } from "../src";

const ready: ClientFacts = {
  identityReadable: true,
  hasPlaceholders: false,
  ownedUrls: 2,
  verifiedUrls: 2,
  surface: "fresh",
  manifest: "frozen",
  measured: true,
  reportDelivered: false,
};

const view = (overrides: Partial<ClientViewInput> = {}, facts: Partial<ClientFacts> = {}) =>
  buildClientView({
    reference: "FR-1AB2C",
    displayName: "Camille Dupont",
    facts: { ...ready, ...facts },
    surfaceCheckedAt: "2026-09-24",
    waveId: "AUDIT-FR-1AB2C",
    reportFiles: [],
    unreadable: [],
    ...overrides,
  });

describe("la vue porte l'état, la décision, et qui doit agir", () => {
  it("clôt le dossier quand un rapport est remis", () => {
    const remis = view({ reportFiles: ["audit-FR-1AB2C-2026-10-24.html"] }, { reportDelivered: true });
    expect(remis.action).toEqual({ kind: "done" });
    expect(remis.complete).toBe(true);
  });

  it("nomme le client comme acteur quand c'est à lui d'agir", () => {
    expect(view({}, { verifiedUrls: 0 }).actor).toBe("client");
    expect(view({}, { verifiedUrls: 0 }).complete).toBe(false);
  });

  it("garde ce qui n'a pas pu être lu, nommé", () => {
    // Une case illisible affichée comme une case vide ferait réclamer une étape déjà faite.
    expect(view({ unreadable: ["manifest.json"] }).unreadable).toEqual(["manifest.json"]);
  });
});

describe("l'ordre d'affichage met en tête ce qui attend quelqu'un", () => {
  it("place le client, puis Proofseen, puis les dossiers clos", () => {
    const attendClient = view({ reference: "FR-CCCCC" }, { verifiedUrls: 0 });
    const attendNous = view({ reference: "FR-AAAAA" }, { measured: false });
    const clos = view({ reference: "FR-BBBBB" }, { reportDelivered: true });
    const ordered = [clos, attendNous, attendClient].sort(byUrgency).map((v) => v.reference);
    expect(ordered).toEqual(["FR-CCCCC", "FR-AAAAA", "FR-BBBBB"]);
  });

  it("départage deux dossiers de même urgence par référence, pour un affichage stable", () => {
    const first = view({ reference: "FR-AAAAA" }, { measured: false });
    const second = view({ reference: "FR-ZZZZZ" }, { measured: false });
    expect([second, first].sort(byUrgency).map((v) => v.reference)).toEqual(["FR-AAAAA", "FR-ZZZZZ"]);
  });
});

describe("le résumé se compte une seule fois", () => {
  it("compte les dossiers clos et ceux qui attendent le client", () => {
    const views = [view({ reference: "A" }, { reportDelivered: true }), view({ reference: "B" }, { verifiedUrls: 0 }), view({ reference: "C" }, { measured: false })];
    expect(summarise(views)).toEqual({ total: 3, complete: 1, waitingOnClient: 1 });
  });

  it("ne compte pas un dossier clos comme attendant le client", () => {
    // Un client livré dont l'identité s'est vidée depuis n'attend rien : le relancer serait une erreur visible par lui.
    const livré = view({ reference: "A" }, { reportDelivered: true, hasPlaceholders: true });
    expect(summarise([livré])).toEqual({ total: 1, complete: 1, waitingOnClient: 0 });
  });
});

describe("rien de sensible ne part vers un navigateur", () => {
  const keysOf = (value: unknown, found: string[] = []): readonly string[] => {
    if (Array.isArray(value)) for (const item of value) keysOf(item, found);
    else if (value !== null && typeof value === "object")
      for (const [key, nested] of Object.entries(value)) {
        found.push(key);
        keysOf(nested, found);
      }
    return found;
  };

  it("n'expose aucun champ de secret, de jeton, d'offre ou de réponse", () => {
    // Garde structurelle : elle échouera le jour où quelqu'un ajoutera `secret` ou `answer` à la vue, y compris avec
    // les meilleures intentions. La vue traverse le réseau ; ce qui y entre est public de fait.
    const interdits = /secret|token|apikey|answer|brief|jdtext|rawtext|email/i;
    const offenders = keysOf(view({ reportFiles: ["audit-FR-1AB2C-2026-10-24.html"], unreadable: ["manifest.json"] })).filter((key) => interdits.test(key));
    expect(offenders).toEqual([]);
  });

  it("ne porte que des noms de rapport, jamais un chemin de disque", () => {
    // Un chemin absolu dans un navigateur renseigne sur la machine de l'opérateur et ne sert à rien au client.
    for (const file of view({ reportFiles: ["audit-FR-1AB2C-2026-10-24.html"] }).reportFiles) {
      expect(file.includes("/")).toBe(false);
      expect(file.includes("\\")).toBe(false);
    }
  });
});
