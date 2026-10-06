import { dirname, join } from "node:path";

/*
 * Les chemins d'un dossier client, dérivés les uns des autres.
 *
 * `client-init` crée une disposition ; `client-wave` doit y écrire ; `client-status` doit l'y retrouver. Tant que
 * chaque commande demandait ses chemins en ligne, trois occasions de se tromper — et deux défauts déjà payés : la
 * trace du contrôle de surface écrite dans le répertoire courant, puis le rapport cherché au mauvais endroit.
 *
 * Une seule définition, que toutes lisent. L'opérateur peut toujours imposer un chemin ; simplement, il n'a plus à le
 * faire pour que les commandes s'accordent.
 */

/** Dossier des offres créé par `client-init`, relatif au fichier de demande. */
export const corpusDirFor = (requestPath: string): string => join(dirname(requestPath), "offres");

/** Manifeste du client, là où `client-status` le cherche. */
export const manifestPathFor = (requestPath: string): string => join(dirname(requestPath), "manifest.json");

/** Identité du client, à côté de sa demande. */
export const identityPathFor = (requestPath: string): string => join(dirname(requestPath), "identity.json");
