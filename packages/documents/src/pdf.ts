// pdfmake ne livre pas ses types : la déclaration locale se charge ici, pas par un import (rien à importer de `pdfmake.d.ts`).
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./pdfmake.d.ts" />
import pdfmake from "pdfmake";
import { fingerprint } from "./canonical";
import type { DocumentModel } from "./model";
import { configureFonts } from "./pdf-fonts";
import { documentDefinition, pageBreakBefore, type LayoutOptions } from "./pdf-layout";

/*
 * Rendu PDF déterministe (décision L1-006). Mêmes octets pour le même modèle, sur Windows comme sur l'image de production :
 * dates de création et de modification venues des données (jamais l'horloge), polices TTF de la marque embarquées en
 * sous-ensembles, compression zlib de Node. Le test d'empreinte de référence détecte tout changement de pdfmake, de
 * pdfkit, d'une police ou de Node ; l'empreinte des octets exacts est scellée par le coffre à l'émission.
 *
 * Ce que le pied de page imprime : l'empreinte du CONTENU CANONIQUE du modèle (`model.contentDigest`), pas celle du PDF,
 * parce qu'un PDF ne peut pas contenir sa propre empreinte. L'empreinte des octets exacts (`fingerprint`) vit au dossier
 * de preuve et dans le coffre.
 */

export { ENGINE_ID } from "./engine";
export type { LayoutOptions };
export { fingerprint };

/** Les octets du PDF d'un modèle de document. */
export const renderPdf = async (model: DocumentModel, options: LayoutOptions = {}): Promise<Buffer> => {
  configureFonts();
  const definition = { ...documentDefinition(model, options), pageBreakBefore: (node: { headlineLevel?: number }, following: readonly unknown[]) => pageBreakBefore(node, following) };
  return pdfmake.createPdf(definition).getBuffer();
};
