import { fingerprint } from "../../src/canonical";
import type { Lang } from "../../src/format";
import { renderPdf } from "../../src/pdf";
import { renderTemplate } from "../../src/render";
import { demoContract } from "./demo";

/**
 * Le document de référence : le contrat de prestation de démonstration, au forfait, sans clause optionnelle, filigrané
 * (rendu de test). Tout ce qui peut changer ses octets (pdfmake, pdfkit, fontkit, une police, Node, un mot du gabarit,
 * la mise en page) change son empreinte : c'est le but.
 */
export const referencePdf = async (lang: Lang): Promise<Buffer> => {
  const rendered = renderTemplate("service-agreement", 1, lang, demoContract(), { watermark: true });
  if (!rendered.ok) throw new Error(`${rendered.error.code} : ${rendered.error.message}`);
  return renderPdf(rendered.value);
};

export const referenceFingerprint = async (lang: Lang): Promise<string> => fingerprint(await referencePdf(lang));
