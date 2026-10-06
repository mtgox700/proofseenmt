import { ManifestSchema, drawsOf, estimatedCostUsd, followUpManifest } from "@proofseen/core";
import { loadJson, writeText } from "./files";
import type { CommonOptions } from "./commands";

/*
 * Re-mesure d'une vague antérieure (J+30, J+60, re-mesure client à 45 jours).
 *
 * Une re-mesure ne vaut que si elle est **identique à sa référence sauf son identifiant**. Reconstruire depuis le
 * protocole courant serait plus simple et faux : un modèle ou une formulation qui a bougé entre-temps transformerait
 * la comparaison en illusion de comparaison. Tout est donc repris de la référence — et ce qui a bougé est **nommé**.
 */

export interface FollowUpCommand extends Pick<CommonOptions, "log"> {
  readonly referencePath: string;
  readonly waveId: string;
  readonly outPath: string;
}

export const commandFollowUp = async (o: FollowUpCommand): Promise<string> => {
  const reference = await loadJson(o.referencePath, ManifestSchema, "manifeste de référence");
  const { manifest, divergences } = followUpManifest({ reference, waveId: o.waveId });

  await writeText(o.outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  o.log(`Manifeste écrit : ${o.outPath} · vague ${manifest.waveId}, re-mesure de ${reference.waveId} (figée le ${reference.frozenAt})`);
  o.log(`${manifest.jobDescriptions.length} offre(s), ${manifest.prompts.length} formulation(s), ${manifest.engines.join(", ")} — repris mot pour mot`);
  o.log(`${drawsOf(manifest)} tirages · coût estimé ${estimatedCostUsd(manifest).toFixed(2)} $ · plafond ${manifest.costCapUsd} $ · non figé`);

  if (divergences.length > 0) {
    o.log("");
    o.log("Écarts avec le protocole courant — conservés, parce que la référence fait foi, mais ils bornent la comparaison :");
    for (const divergence of divergences) o.log(`  · ${divergence}`);
  }
  o.log("");
  o.log(`Suite : \`surface-check\`, \`preflight\`, figer \`frozenAt\`, puis \`run --confirm-spend\`.`);
  o.log(`Au rapport, comparer avec \`report --wave ${manifest.waveId} --baseline ${reference.waveId}\`.`);
  return o.outPath;
};
