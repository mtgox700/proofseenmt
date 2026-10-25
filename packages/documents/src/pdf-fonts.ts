// pdfmake ne livre pas ses types : la déclaration locale se charge ici, pas par un import (rien à importer de `pdfmake.d.ts`).
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./pdfmake.d.ts" />
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import pdfmake from "pdfmake";

/*
 * Les polices de la marque dans pdfmake : instances TTF statiques de `packages/brand/pdf-fonts` (PS Display pour les
 * titres, PS Text pour le corps, PS Mono pour la trace), chargées depuis le dossier que l'export du paquet de la marque nomme. pdfmake est un
 * singleton : les polices et les politiques d'accès se posent une fois.
 *
 * Piège Windows (README des polices) : pdfmake passe à la politique d'accès un chemin à barres inverses ; comparer des
 * chemins passés par `resolve`, jamais un `startsWith` sur un chemin à barres obliques.
 */

export const FONT_TEXT = "PSText";
export const FONT_DISPLAY = "PSDisplay";
export const FONT_MONO = "PSMono";

/**
 * Dossier des polices : celui que nomme l'export `@proofseen/brand/pdf-fonts/*`, à côté de ce paquet dans le monorepo (un
 * test vérifie l'égalité des deux). Aucune résolution CommonJS à l'exécution : webpack la remplace par un numéro de module
 * dans le serveur Next et le rendu échoue (« path must be of type string, received number », prouvé par un vrai `next build`, L1-074).
 */
export const brandFontsDir = (): string => join(dirname(fileURLToPath(import.meta.url)), "..", "..", "brand", "pdf-fonts");

let configuredFor: string | undefined;

/** Pose les polices et les politiques d'accès de pdfmake ; sans effet si c'est déjà fait pour ce dossier. */
export const configureFonts = (dir: string = brandFontsDir()): void => {
  const fonts = resolve(dir);
  if (configuredFor === fonts) return;
  const file = (name: string): string => join(fonts, name);
  pdfmake.setFonts({
    [FONT_TEXT]: { normal: file("ps-text-400.ttf"), bold: file("ps-text-700.ttf"), italics: file("ps-text-400.ttf"), bolditalics: file("ps-text-700.ttf") },
    [FONT_DISPLAY]: { normal: file("ps-display-600.ttf"), bold: file("ps-display-700.ttf"), italics: file("ps-display-600.ttf"), bolditalics: file("ps-display-700.ttf") },
    [FONT_MONO]: { normal: file("ps-mono-500.ttf"), bold: file("ps-mono-500.ttf"), italics: file("ps-mono-500.ttf"), bolditalics: file("ps-mono-500.ttf") },
  });
  pdfmake.setLocalAccessPolicy((path) => resolve(path).startsWith(fonts + sep));
  pdfmake.setUrlAccessPolicy(() => false);
  configuredFor = fonts;
};
