/*
 * The download of one version (storyboard L1.6, §4 E4): a plain link to the API, no button and no script. No `download`
 * attribute (L1-159 B4): with it, Chrome followed the 303 of a failed download and saved the HTML page under the PDF's
 * name. Without it, the API's `Content-Disposition: attachment` still saves the PDF under its own name
 * (file-name.ts), and a failure shows the document's page, which says it in words (download-fallback.ts).
 */

export const downloadHref = (documentId: string, number: number): string => `/api/documents/${documentId}/versions/${number}`;

export interface DownloadLinkProps {
  readonly documentId: string;
  readonly type: string;
  readonly number: number;
  readonly label: string;
  readonly className?: string;
}

export function DownloadLink({ documentId, number, label, className = "btn" }: DownloadLinkProps) {
  return (
    <a className={className === "" ? undefined : className} href={downloadHref(documentId, number)} type="application/pdf">
      {label}
    </a>
  );
}
