import { fileURLToPath } from "node:url";

/** Racine d'un registre de fixtures : `sources.yaml` et un dossier par gabarit (TEMPLATE_FORMAT.md §9 et variantes). */
export const EXAMPLE_ROOT = fileURLToPath(new URL("../fixtures/example", import.meta.url));

/** Un registre dont le seul gabarit porte une clé inconnue : il ne doit jamais se charger. */
export const BROKEN_ROOT = fileURLToPath(new URL("../fixtures/broken", import.meta.url));
