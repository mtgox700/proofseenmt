import { findManipulations, refusesMeasurement } from "@proofseen/profiles";
import { CliError } from "./files";

/*
 * Nos propres pages passent le détecteur que nous appliquons aux clients.
 *
 * Deux raisons, et la seconde est la plus sérieuse.
 *
 * 1. La charte publique promet « aucune manipulation des IA : pas de texte caché, pas d'instruction adressée aux IA ».
 *    Une exigence qu'on applique aux autres et pas à soi n'est pas une exigence, c'est un argument de vente — le même
 *    constat que pour la preuve de possession de notre propre domaine.
 *
 * 2. Nous publions du texte **écrit par le client** sur notre domaine : résumé, description de mission, compétences.
 *    Une instruction glissée dans une de ces phrases serait hébergée par nous, sur nos pages, et orienterait les
 *    moteurs en notre nom. C'est une voie d'injection, pas une question de principe.
 *
 * Le contrôle porte sur le **HTML produit**, pas sur les champs d'entrée : peu importe par quel champ la phrase est
 * arrivée, elle est vue.
 */

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

/**
 * Refuse d'écrire un site dont une page porte une manipulation. Le bourrage de mots-clés ne bloque pas — il est
 * seulement signalé, comme pour un client.
 */
export const assertOwnPagesClean = (files: readonly GeneratedFile[], log: (message: string) => void): void => {
  const problems: string[] = [];
  for (const file of files.filter((candidate) => candidate.path.endsWith(".html"))) {
    const findings = findManipulations(file.content);
    if (findings.length === 0) continue;
    for (const finding of findings) log(`  ${file.path} · ${finding.kind} · ${finding.detail} · « ${finding.excerpt} »`);
    if (refusesMeasurement(findings)) problems.push(`${file.path} (${[...new Set(findings.map((f) => f.kind))].join(", ")})`);
  }
  if (problems.length > 0) {
    throw new CliError(
      `manipulation dans les pages générées : ${problems.join(" · ")} — rien n'est écrit. Corriger le contenu source : nous ne publions pas ce que nous refusons chez nos clients.`,
    );
  }
};
