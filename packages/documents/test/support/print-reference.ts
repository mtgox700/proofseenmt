import type { Lang } from "../../src/format";
import { referenceFingerprint } from "./reference";

/** Lancé dans un autre processus (parfois avec un autre fuseau) : imprime l'empreinte du document de référence. */
const lang = (process.argv[2] ?? "fr") as Lang;
process.stdout.write(`${await referenceFingerprint(lang)}\n`);
