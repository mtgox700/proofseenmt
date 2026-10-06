import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { purgeExpired } from "@proofseen/extract";

/*
 * Application du délai de conservation des réponses brutes (CONFORMITE T3, et affirmation publique de la FAQ :
 * « les réponses brutes sont chiffrées puis supprimées au bout de 72 heures »).
 *
 * Le problème qu'on ferme : la suppression n'existait que dans la commande `purge`. Elle dépendait donc de quelqu'un
 * qui y pense — alors qu'on l'annonce comme un fait, sur une page publique, à propos de données personnelles.
 *
 * Il n'y a pas de démon dans ce produit, et il n'en faut pas : **chaque appel de la CLI applique le délai**. Un outil
 * qu'on lance de temps en temps suffit à tenir une promesse de 72 h, là où une tâche planifiée qu'on oublierait de
 * surveiller donnerait une fausse assurance.
 */

/** Supprime les réponses expirées de toutes les vagues. Retourne le nombre de fichiers effacés. */
export const enforceRawTtl = async (runsDir: string, now: Date, log: (message: string) => void): Promise<number> => {
  let waves: string[];
  try {
    waves = await readdir(runsDir);
  } catch {
    return 0;
  }
  const purged = await Promise.all(waves.map((wave) => purgeExpired(join(runsDir, wave, "sealed"), now)));
  const total = purged.reduce((sum, files) => sum + files.length, 0);
  // Silencieux quand il n'y a rien à faire : un message à chaque commande cesserait d'être lu.
  if (total > 0) log(`${total} réponse(s) brute(s) expirée(s) supprimée(s) — délai de 72 h (CONFORMITE T3).`);
  return total;
};
