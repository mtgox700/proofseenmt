import { describe, expect, it } from "vitest";
import { actor, nextAction, waitingOnClient, type ClientFacts, type NextAction } from "../src/next-action";

/*
 * Ces tests fixent l'ordre dans lequel la chaîne refuse d'avancer. Ils existent parce que la version précédente
 * décidait de la suite en relisant sa propre colonne d'affichage : renommer « ok (2026-09-24) » en « valide » aurait
 * réclamé un contrôle de surface déjà fait, sur tous les clients, sans qu'aucun test ne bouge.
 */

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

const facts = (overrides: Partial<ClientFacts>): ClientFacts => ({ ...ready, ...overrides });

describe("la prochaine action suit l'ordre où la chaîne refuse d'avancer", () => {
  it("ne dit rien d'un client dont l'identité est illisible", () => {
    // Surtout : ne pas réclamer une preuve de possession en s'appuyant sur un `verifiedUrls: 0` qu'on n'a pas lu.
    expect(nextAction(facts({ identityReadable: false, verifiedUrls: 0 }))).toEqual({ kind: "unreadable" });
  });

  it("réclame les champs en attente avant toute mesure", () => {
    expect(nextAction(facts({ hasPlaceholders: true }))).toEqual({ kind: "fill_identity" });
  });

  it("réclame la preuve de possession avant le contrôle de surface", () => {
    // L'ordre compte : contrôler une page qu'on n'a pas prouvé posséder, c'est contrôler la page de quelqu'un d'autre.
    expect(nextAction(facts({ verifiedUrls: 0, surface: "missing" }))).toEqual({ kind: "prove_possession" });
  });

  it("distingue un contrôle jamais fait, une trace illisible, et un contrôle périmé ou refusé", () => {
    // Les trois mènent au même geste, mais pas au même message : « absent » pour un fichier corrompu ferait croire à
    // une étape jamais faite, et masquerait qu'il y a quelque chose à réparer.
    expect(nextAction(facts({ surface: "missing" }))).toEqual({ kind: "check_surface", reason: "missing" });
    expect(nextAction(facts({ surface: "unreadable" }))).toEqual({ kind: "check_surface", reason: "unreadable" });
    expect(nextAction(facts({ surface: "blocked" }))).toEqual({ kind: "check_surface", reason: "blocked" });
  });

  it("monte la vague, la fige, puis mesure — dans cet ordre", () => {
    expect(nextAction(facts({ manifest: "missing", measured: false }))).toEqual({ kind: "build_wave" });
    expect(nextAction(facts({ manifest: "draft", measured: false }))).toEqual({ kind: "freeze_manifest" });
    expect(nextAction(facts({ manifest: "frozen", measured: false }))).toEqual({ kind: "measure" });
  });

  it("n'offre jamais de remonter une vague par-dessus un manifeste illisible", () => {
    // `build_wave` écrirait par-dessus, `frozenAt` compris : on ne peut plus lire s'il avait déjà servi à mesurer un
    // client payant. La réparation est donc manuelle, et le reste.
    expect(nextAction(facts({ manifest: "unreadable", measured: false }))).toEqual({ kind: "repair_manifest" });
    expect(nextAction(facts({ manifest: "unreadable", measured: true }))).toEqual({ kind: "repair_manifest" });
  });

  it("réclame le rapport quand tout est mesuré", () => {
    expect(nextAction(ready)).toEqual({ kind: "deliver_report" });
  });
});

describe("un rapport remis clôt le cycle", () => {
  it("ne réclame plus rien, même si le contrôle de surface s'est périmé depuis", () => {
    // Harceler un client livré pour une trace périmée serait un défaut visible par lui.
    expect(nextAction(facts({ reportDelivered: true, surface: "blocked" }))).toEqual({ kind: "done" });
  });

  it("ne réclame plus rien même si l'identité s'est vidée depuis", () => {
    expect(nextAction(facts({ reportDelivered: true, hasPlaceholders: true, verifiedUrls: 0 }))).toEqual({ kind: "done" });
  });

  it("mais reste muet si l'identité est illisible : on ne peut pas affirmer qu'il est livré", () => {
    expect(nextAction(facts({ identityReadable: false, reportDelivered: true }))).toEqual({ kind: "unreadable" });
  });
});

describe("qui doit agir", () => {
  it("n'attribue au client que ce qui dépend de lui", () => {
    expect(actor({ kind: "fill_identity" })).toBe("client");
    expect(actor({ kind: "prove_possession" })).toBe("client");
  });

  it("garde le reste chez Proofseen, y compris le contrôle de surface", () => {
    // Le contrôle, c'est nous qui le lançons : l'afficher au client en « à faire » créerait une attente sans action.
    for (const kind of ["check_surface", "build_wave", "repair_manifest", "freeze_manifest", "measure", "deliver_report", "done", "unreadable"] as const) {
      const action = (kind === "check_surface" ? { kind, reason: "missing" } : { kind }) as NextAction;
      expect(actor(action)).toBe("proofseen");
      expect(waitingOnClient(action)).toBe(false);
    }
  });
});

describe("aucun état ne reste sans réponse", () => {
  it("rend une action pour chacune des combinaisons possibles", () => {
    const booleans = [true, false];
    const seen = new Set<string>();
    let count = 0;
    for (const identityReadable of booleans)
      for (const hasPlaceholders of booleans)
        for (const verifiedUrls of [0, 1])
          for (const surface of ["missing", "unreadable", "blocked", "fresh"] as const)
            for (const manifest of ["missing", "unreadable", "draft", "frozen"] as const)
              for (const measured of booleans)
                for (const reportDelivered of booleans) {
                  const action = nextAction({ identityReadable, hasPlaceholders, ownedUrls: 1, verifiedUrls, surface, manifest, measured, reportDelivered });
                  expect(action.kind).toBeTypeOf("string");
                  seen.add(action.kind);
                  count += 1;
                }
    expect(count).toBe(2 * 2 * 2 * 4 * 4 * 2 * 2);
    // Toutes les branches sont atteignables : une branche morte serait une étape qu'on ne réclamerait jamais.
    expect([...seen].sort()).toEqual(
      ["build_wave", "check_surface", "deliver_report", "done", "fill_identity", "freeze_manifest", "measure", "prove_possession", "repair_manifest", "unreadable"],
    );
  });
});
