import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { IdentitySchema, JobDescriptionSchema, assertJdFreeOfIdentity, buildAuditManifest, drawsOf, estimatedCostUsd, type JobDescription } from "@proofseen/core";
import { AuditRequestSchema, type AuditRequest } from "@proofseen/deliverable";
import { CliError, loadJson, writeText } from "./files";
import type { CommonOptions } from "./commands";

/*
 * Monte la vague d'un client à partir de sa demande d'audit et du dossier de ses offres.
 *
 * Ce que cette commande supprime : le manifeste écrit à la main. Recopier les moteurs, les modèles et les quatre
 * formulations à chaque client, c'est accepter qu'un jour deux clients soient mesurés avec deux instruments
 * différents — et deux rapports produits avec des instruments différents ne se comparent ni entre eux, ni à notre
 * mesure de référence. L'instrument vient désormais du protocole (`core/protocol.ts`) ; seules les offres changent.
 *
 * La vague sort **non figée** : la figer déclare que le protocole ne bougera plus, et cet acte reste délibéré.
 */

export interface ClientWaveCommand extends Pick<CommonOptions, "log"> {
  readonly requestPath: string;
  /** Dossier contenant un fichier `<ID>.txt` par offre de la demande. */
  readonly jdDir: string;
  readonly outPath: string;
  readonly costCapUsd: number | undefined;
  /**
   * Identité du client. Fournie, les offres sont refusées si elles le nomment — au moment où elles entrent, pas au
   * moment de dépenser. On peut alors lui en redemander une autre avant d'avoir figé quoi que ce soit.
   */
  readonly identityPath?: string | undefined;
}

/** Identifiant de vague dérivé de la référence du client : lisible, et accepté par le schéma. */
const waveIdFor = (reference: string): string => `AUDIT-${reference}`.replace(/[^A-Za-z0-9+_-]/g, "-").slice(0, 32);

const readJobDescription = async (dir: string, entry: AuditRequest["jobDescriptions"][number]): Promise<JobDescription> => {
  if (entry.role === undefined) throw new CliError(`l'offre ${entry.id} n'a pas de \`role\` ("target" ou "control") dans la demande d'audit`);
  if (entry.brief === undefined) throw new CliError(`l'offre ${entry.id} n'a pas de \`brief\` : la formulation P2 en a besoin`);
  // Mêmes extensions et mêmes refus que `jd-import` : deux commandes qui lisent les mêmes fichiers ne doivent pas
  // se comporter différemment, sinon l'opérateur apprend une règle qui ne vaut qu'une fois sur deux.
  const found = [join(dir, `${entry.id}.txt`), join(dir, `${entry.id}.md`)].find((candidate) => existsSync(candidate));
  if (found === undefined) throw new CliError(`offre ${entry.id} introuvable : ni ${entry.id}.txt ni ${entry.id}.md dans ${dir}`);
  const raw = (await readFile(found, "utf8")).replace(/\r\n/g, "\n").trim();
  if (raw.length === 0) throw new CliError(`${found} est vide`);
  const text = raw;
  return JobDescriptionSchema.parse({
    id: entry.id,
    lang: "fr",
    // L'offre témoin est choisie par nous : la tracer comme venant du client serait faux, et c'est ce champ qui
    // permet ensuite de reconnaître une vague d'audit client d'une vague de référence.
    source: entry.provenance === "client" ? "client" : "market",
    role: entry.role,
    text,
    brief: entry.brief,
  });
};

export const commandClientWave = async (o: ClientWaveCommand): Promise<string> => {
  const request = await loadJson(o.requestPath, AuditRequestSchema, "demande d'audit");
  const jobDescriptions = await Promise.all(request.jobDescriptions.map((entry) => readJobDescription(o.jdDir, entry)));

  if (o.identityPath !== undefined) {
    const identity = await loadJson(o.identityPath, IdentitySchema, "identité");
    for (const jd of jobDescriptions) {
      try {
        assertJdFreeOfIdentity(jd.text, identity);
        if (jd.brief !== undefined) assertJdFreeOfIdentity(jd.brief, identity);
      } catch (error) {
        // Une offre qui nomme le client truque la mesure : le moteur le retrouve parce qu'on le lui a soufflé.
        throw new CliError(`l'offre ${jd.id} nomme le client (${(error as Error).message}) : en demander une autre, elle fausserait la mesure`);
      }
    }
    o.log(`${jobDescriptions.length} offre(s) vérifiée(s) : aucune ne nomme le client.`);
  }

  const manifest = buildAuditManifest({
    waveId: waveIdFor(request.client.reference),
    jobDescriptions,
    ...(o.costCapUsd === undefined ? {} : { costCapUsd: o.costCapUsd }),
  });

  await writeText(o.outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const targets = jobDescriptions.filter((jd) => jd.role === "target").length;
  o.log(
    `Manifeste écrit : ${o.outPath} · vague ${manifest.waveId} · ${targets} offre(s) cible + ${jobDescriptions.length - targets} témoin(s)`,
  );
  o.log(
    `${drawsOf(manifest)} tirages prévus · coût estimé ${estimatedCostUsd(manifest).toFixed(2)} $ · plafond ${manifest.costCapUsd} $ · non figé`,
  );
  o.log("Suite : `preflight`, puis figer `frozenAt`, puis `run --confirm-spend`.");
  return o.outPath;
};
