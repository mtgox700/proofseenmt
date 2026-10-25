import type { Lang } from "./format";

/*
 * Les quelques mots que le moteur écrit lui-même, hors de tout gabarit juridique : numéro d'article, pagination, filigrane
 * d'un rendu de test, titre du bloc de signatures. Aucune obligation légale ne passe par ici ; tout ce qui oblige vit
 * dans les fichiers du Trésor.
 */

export interface Chrome {
  readonly article: string;
  readonly page: (current: number, total: number) => string;
  readonly digestLabel: string;
  /** Une ligne qui dit ce que l'empreinte imprimée désigne : le contenu du document, pas les octets du fichier. */
  readonly digestNote: string;
  readonly verifyLabel: string;
  readonly watermark: string;
  readonly signatures: string;
  readonly signedOnProofseen: string;
  readonly issuedOnProofseen: string;
  readonly acceptedOnProofseen: string;
  readonly acknowledgedOnProofseen: string;
  readonly reference: string;
}

export const CHROME: Readonly<Record<Lang, Chrome>> = {
  fr: {
    article: "Article",
    page: (current, total) => `Page ${current} / ${total}`,
    digestLabel: "Empreinte du contenu",
    digestNote: "Empreinte du contenu du document, non du fichier.",
    verifyLabel: "Vérification :",
    watermark: "Exemple, non signé",
    signatures: "Signatures",
    signedOnProofseen: "Signature électronique simple sur Proofseen",
    issuedOnProofseen: "Émis électroniquement sur Proofseen",
    acceptedOnProofseen: "Accepté électroniquement sur Proofseen",
    acknowledgedOnProofseen: "Prise de connaissance sur Proofseen",
    reference: "Référence",
  },
  en: {
    article: "Article",
    page: (current, total) => `Page ${current} / ${total}`,
    digestLabel: "Content fingerprint",
    digestNote: "Fingerprint of the document content, not of the file.",
    verifyLabel: "Verification:",
    watermark: "Example, unsigned",
    signatures: "Signatures",
    signedOnProofseen: "Simple electronic signature on Proofseen",
    issuedOnProofseen: "Issued electronically on Proofseen",
    acceptedOnProofseen: "Accepted electronically on Proofseen",
    acknowledgedOnProofseen: "Acknowledged on Proofseen",
    reference: "Reference",
  },
};
