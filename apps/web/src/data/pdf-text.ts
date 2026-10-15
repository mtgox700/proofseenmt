import { extractText, getDocumentProxy } from "unpdf";

/*
 * The text of a PDF the freelancer uploaded, read on the server. The PDF.js build shipped by unpdf compiles no code
 * from font data; it runs here without system fonts, font loading or XFA forms, and a document longer than a CV is not
 * read at all.
 */

export const MAX_CV_PAGES = 10;

export type PdfText = { readonly kind: "ok"; readonly text: string } | { readonly kind: "too_long" | "unreadable" };

export const pdfText = async (bytes: Uint8Array): Promise<PdfText> => {
  try {
    // PDF.js may take ownership of the buffer it is given: it gets a copy, the caller keeps its bytes.
    const pdf = await getDocumentProxy(new Uint8Array(bytes), { useSystemFonts: false, disableFontFace: true, stopAtErrors: true, enableXfa: false });
    try {
      if (pdf.numPages > MAX_CV_PAGES) return { kind: "too_long" };
      const { text } = await extractText(pdf, { mergePages: true });
      return { kind: "ok", text: text.replace(/[ \t]+/g, " ").trim() };
    } finally {
      await pdf.loadingTask.destroy();
    }
  } catch {
    return { kind: "unreadable" };
  }
};
