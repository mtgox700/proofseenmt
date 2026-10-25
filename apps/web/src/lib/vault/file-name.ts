/*
 * The one name of a version's file (L1-159): the API serves it in its Content-Disposition, the screens say it in
 * « Vérifier ». Its kind, its version, and the first eight characters of its CONTENT fingerprint, so two files of two
 * different contents never share a name in a download folder: « contrat-de-prestation-v3-6763a4fe.pdf ».
 */

export const FILE_NAMES: Readonly<Record<string, string>> = {
  service_agreement: "contrat-de-prestation",
  quote: "devis",
  acceptance_report: "proces-verbal-de-recette",
  nda: "accord-de-confidentialite",
  amendment: "avenant",
};

export const fileName = (type: string, number: number, contentDigest: string): string => `${FILE_NAMES[type] ?? "document"}-v${number}-${contentDigest.slice(0, 8).toLowerCase()}.pdf`;
