import { describe, expect, it } from "vitest";
import { recordPathFor } from "../src/record-path";

/*
 * Où se range la trace d'un contrôle de surface.
 *
 * Trois défauts successifs, chacun trouvé en exécutant :
 *  1. un nom global (`./surface-check.json`) faisait s'écraser deux clients contrôlés l'un après l'autre, et le
 *     tableau de bord ne la trouvait jamais dans leur dossier ;
 *  2. la ranger dans le **dossier** de l'identité ne suffisait pas : les deux bras du test vivent dans le même
 *     dossier, et se seraient écrasés à leur tour ;
 *  3. le **nom du fichier** d'identité, lui, est unique par construction.
 */

describe("la trace porte le nom de l'identité qu'elle contrôle", () => {
  it("se range à côté du fichier d'identité", () => {
    expect(recordPathFor("clients/FR-1AB2C/identity.json")).toBe("clients/FR-1AB2C/identity.surface-check.json");
  });

  it("distingue deux identités qui partagent un dossier", () => {
    // Le cas des bras A et B du test : même dossier, deux identités.
    expect(recordPathFor("arms/arm-A.json")).not.toBe(recordPathFor("arms/arm-B.json"));
    expect(recordPathFor("arms/arm-A.json")).toBe("arms/arm-A.surface-check.json");
  });

  it("n'écrit jamais dans le répertoire courant à partir d'un chemin de dossier", () => {
    expect(recordPathFor("clients/FR-1AB2C/identity.json").startsWith("clients/")).toBe(true);
  });

  it("supporte un chemin absolu et une extension en majuscules", () => {
    expect(recordPathFor("C:/clients/FR-X/identity.JSON")).toBe("C:/clients/FR-X/identity.surface-check.json");
  });

  it("reste utilisable si le fichier n'a pas d'extension", () => {
    expect(recordPathFor("clients/FR-X/identity")).toBe("clients/FR-X/identity.surface-check.json");
  });
});
