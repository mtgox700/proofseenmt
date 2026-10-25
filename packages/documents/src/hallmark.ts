import { PAPER_INKS } from "@proofseen/brand";
import { fingerprintMarkSvg } from "@proofseen/brand/fingerprint-mark";

/*
 * Le poinçon d'empreinte du pied de page : la géométrie de la marque (`packages/brand`, décision de Shogun L1-090 point 1,
 * PASS L1-120), au niveau d'impression 64 (8 x 8 cases) et en vecteur. Dessiné depuis l'empreinte du CONTENU du document.
 * Encre du texte pour le cadre et les cases : le vert est réservé à un document que toutes les parties ont signé, et
 * ce moteur ne rend que des documents avant signature.
 */
export const paperHallmark = (contentDigest: string): string => fingerprintMarkSvg(contentDigest, { frame: PAPER_INKS.text, cells: PAPER_INKS.text });
