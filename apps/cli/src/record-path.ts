/*
 * Où se range la trace d'un contrôle de surface.
 *
 * Trois défauts successifs, chacun trouvé en exécutant plutôt qu'en relisant :
 *
 * 1. Un nom global (`./surface-check.json`) faisait s'écraser deux clients contrôlés l'un après l'autre. Le tableau
 *    de bord ne trouvait jamais la trace dans leur dossier, et le préflight du second lisait celle du premier —
 *    refusée pour cause d'identité différente, mais la confusion n'avait pas lieu d'être.
 * 2. La ranger dans le **dossier** de l'identité ne suffisait pas : les deux bras du test à 2 bras vivent dans le
 *    même dossier, et se seraient écrasés à leur tour.
 * 3. Le **nom du fichier** d'identité, lui, est unique par construction — dans un dossier par client comme dans un
 *    dossier partagé.
 */

/** Chemin par défaut de la trace, dérivé du fichier d'identité contrôlé. */
export const recordPathFor = (identityPath: string): string => `${identityPath.replace(/\.json$/i, "")}.surface-check.json`;
