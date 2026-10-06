import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { corpusDirFor, identityPathFor, manifestPathFor } from "../src/client-paths";
import { recordPathFor } from "../src/record-path";

/*
 * `client-init` crée une disposition, `client-wave` y écrit, `client-status` l'y retrouve. Tant que chaque commande
 * demandait ses chemins en ligne, trois occasions de se tromper — et deux défauts déjà payés : la trace du contrôle
 * écrite dans le répertoire courant, puis le rapport cherché au mauvais endroit.
 *
 * Ces tests fixent l'accord entre les commandes, pour qu'il ne puisse plus se défaire en silence.
 */

const request = join("clients", "FR-1AB2C", "request.json");

describe("les chemins d'un dossier client se déduisent de la demande", () => {
  it("place les offres, le manifeste et l'identité dans le dossier du client", () => {
    expect(corpusDirFor(request)).toBe(join("clients", "FR-1AB2C", "offres"));
    expect(manifestPathFor(request)).toBe(join("clients", "FR-1AB2C", "manifest.json"));
    expect(identityPathFor(request)).toBe(join("clients", "FR-1AB2C", "identity.json"));
  });

  it("n'écrit jamais dans le répertoire courant", () => {
    for (const derived of [corpusDirFor(request), manifestPathFor(request), identityPathFor(request)]) {
      expect(derived.startsWith("clients")).toBe(true);
    }
  });

  it("garde deux clients séparés", () => {
    const other = join("clients", "FR-9ZZZZ", "request.json");
    expect(manifestPathFor(request)).not.toBe(manifestPathFor(other));
  });

  it("s'accorde avec la trace du contrôle de surface, qui vit à côté de l'identité", () => {
    // C'est cet accord qui manquait : le tableau de bord cherchait la trace là où la CLI ne l'écrivait pas.
    expect(recordPathFor(identityPathFor(request))).toBe(join("clients", "FR-1AB2C", "identity.surface-check.json"));
  });
});
