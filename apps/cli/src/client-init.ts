import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { AUDIT_CONTROLS, AUDIT_TARGETS } from "@proofseen/core";
import { identityFor } from "@proofseen/intake";
import { CliError, writeText } from "./files";
import type { CommonOptions } from "./commands";

/*
 * Ouverture du dossier d'un client.
 *
 * Ce que ça supprime : trois fichiers JSON écrits à la main pour chaque client. À dix clients, trente fichiers — et
 * deux jours de travail ont montré assez de JSON manuel mal formé pour ne pas en vouloir trente de plus.
 *
 * Ce que ça ne fait **pas** : produire quelque chose qui ressemble à un dossier prêt. Les champs qu'on ne peut pas
 * deviner sortent vides ou faux, de sorte que le préflight refuse tant qu'ils n'ont pas été renseignés à la main. Un
 * squelette qui passerait les contrôles serait pire que pas de squelette.
 */

export interface ClientInitCommand extends Pick<CommonOptions, "log"> {
  readonly reference: string;
  readonly displayName: string;
  /** URL publiques du client, séparées par des virgules. */
  readonly urls: string;
  readonly outDir: string;
}

const REFERENCE = /^[A-Za-z0-9_-]{1,40}$/;

export const commandClientInit = async (o: ClientInitCommand): Promise<string> => {
  if (!REFERENCE.test(o.reference)) {
    throw new CliError(`référence « ${o.reference} » : lettres, chiffres, - et _ uniquement (elle entre dans des noms de fichiers)`);
  }
  const dir = join(o.outDir, o.reference);
  // Ne jamais écraser le dossier d'un client existant : ses preuves et ses offres y sont.
  if (existsSync(dir)) throw new CliError(`${dir} existe déjà : ouvrir un dossier n'écrase jamais un client en cours`);

  const urls = o.urls
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url !== "");
  if (urls.length === 0) throw new CliError("aucune URL : sans surface publique, il n'y a rien à mesurer");

  // Une seule définition de « identité neuve », partagée avec le formulaire d'inscription.
  const identity = identityFor({ id: o.reference, displayName: o.displayName, urls });

  const jobDescriptions = [
    ...Array.from({ length: AUDIT_TARGETS }, (_, index) => ({
      id: `T0${index + 1}`,
      label: "À RENSEIGNER : intitulé court de l'offre",
      provenance: "client" as const,
      role: "target" as const,
      brief: "À RENSEIGNER : la mission en une phrase, comme un recruteur la dirait",
    })),
    ...Array.from({ length: AUDIT_CONTROLS }, (_, index) => ({
      id: `C0${index + 1}`,
      label: "À RENSEIGNER : offre témoin, choisie par nous, qui ne correspond PAS au client",
      provenance: "proofseen" as const,
      role: "control" as const,
      brief: "À RENSEIGNER : la mission témoin en une phrase",
    })),
  ];

  const request = {
    client: { displayName: o.displayName, reference: o.reference },
    // Tout à faux : le contrôle de surface et le relevé d'indexation diront la vérité, pas ce fichier.
    surface: { readableWithoutJs: false, robotsTxt: false, sitemap: false, structuredData: false, verifiedPlatforms: [] },
    indexation: null,
    jobDescriptions,
    caveats: [],
  };

  await mkdir(join(dir, "offres"), { recursive: true });
  await writeText(join(dir, "identity.json"), `${JSON.stringify(identity, null, 2)}\n`);
  await writeText(join(dir, "request.json"), `${JSON.stringify(request, null, 2)}\n`);
  await writeText(join(dir, "offres", "LISEZ-MOI.md"), corpusReadme(o.reference));

  const manual = identity.ownedUrls.filter((owned) => owned.proofMethod === "profile_token").length;
  o.log(`Dossier ouvert : ${dir}`);
  o.log(`  ${urls.length} URL déclarée(s)${manual > 0 ? `, dont ${manual} à vérifier à la main (aucune requête automatisée)` : ""}`);
  o.log(`  ${AUDIT_TARGETS} offre(s) cible + ${AUDIT_CONTROLS} témoin à déposer dans ${join(dir, "offres")}`);
  o.log("");
  o.log("Les champs « À RENSEIGNER » ne sont pas des valeurs par défaut : le préflight refuse tant qu'ils sont là.");
  o.log("Suite :");
  o.log(`  1. remplir identity.json (ville, technologies) et request.json (intitulés, briefs)`);
  o.log(`  2. déposer T01.txt, T02.txt, T03.txt et C01.txt dans ${join(dir, "offres")}`);
  o.log(`  3. proofseen possession --identity ${join(dir, "identity.json")}`);
  return dir;
};

const corpusReadme = (reference: string): string => `# Offres du client ${reference}

Un fichier texte par offre, nommé par son identifiant : \`T01.txt\`, \`T02.txt\`, \`T03.txt\`, \`C01.txt\`.

- **T01 à T03** : les offres que **le client** a choisies, celles qui correspondent aux missions qu'il vise.
- **C01** : l'offre **témoin**, choisie par nous, qui ne lui correspond pas. Elle vérifie que les moteurs ne citent
  pas n'importe qui au hasard : y apparaître serait un mauvais signe, pas un bon.

Le texte est celui de l'annonce, collé tel quel. Trois règles :

1. **Aucune offre ne doit contenir le nom du client ni l'une de ses adresses.** Elle fausserait la mesure — le moteur
   le retrouverait parce qu'on le lui a soufflé. \`client-wave --identity\` refuse ces offres, et le préflight aussi.
2. **300 caractères minimum.** Une annonce tronquée ne mesure rien.
3. **Pas de doublon.** Deux offres identiques comptent double sans rien apprendre.

Ces textes restent locaux et ne sont jamais republiés.
`;
