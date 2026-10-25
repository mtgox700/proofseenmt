/*
 * The download of one version (storyboard L1.6, §4 E4): a plain link to the API, with `download`, no button and no
 * script. The API serves it as an attachment, checks the bytes against their fingerprint first, and sends a failed
 * navigation back to the document's page (download-fallback.ts).
 */

const FILE_NAMES: Readonly<Record<string, string>> = {
  service_agreement: "contrat-de-prestation",
  quote: "devis",
  acceptance_report: "proces-verbal-de-recette",
  nda: "accord-de-confidentialite",
  amendment: "avenant",
};

/** The name the API gives the file (vault.ts): « contrat-de-prestation-v3.pdf ». */
export const fileName = (type: string, number: number): string => `${FILE_NAMES[type] ?? "document"}-v${number}.pdf`;
export const downloadHref = (documentId: string, number: number): string => `/api/documents/${documentId}/versions/${number}`;

export interface DownloadLinkProps {
  readonly documentId: string;
  readonly type: string;
  readonly number: number;
  readonly label: string;
  readonly className?: string;
}

export function DownloadLink({ documentId, type, number, label, className = "btn" }: DownloadLinkProps) {
  return (
    <a className={className === "" ? undefined : className} href={downloadHref(documentId, number)} download={fileName(type, number)} type="application/pdf">
      {label}
    </a>
  );
}
