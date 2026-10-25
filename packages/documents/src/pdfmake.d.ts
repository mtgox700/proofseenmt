/*
 * pdfmake 0.3 ne livre pas ses types. Seule la surface utilisée par `pdf.ts` est déclarée ici : c'est aussi la liste de ce
 * que le moteur appelle (polices, politiques d'accès, création, tampon d'octets).
 */
declare module "pdfmake" {
  export interface FontFiles {
    readonly normal: string;
    readonly bold: string;
    readonly italics: string;
    readonly bolditalics: string;
  }

  export interface PdfDocument {
    getBuffer(): Promise<Buffer>;
  }

  export interface PdfMake {
    setFonts(fonts: Readonly<Record<string, FontFiles>>): void;
    setLocalAccessPolicy(policy: (path: string) => boolean): void;
    setUrlAccessPolicy(policy: (url: string) => boolean): void;
    createPdf(definition: Readonly<Record<string, unknown>>): PdfDocument;
  }

  const pdfmake: PdfMake;
  export default pdfmake;
}
