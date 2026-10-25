/*
 * The one list of the files that strike the proof green (Shogun, L1-090, point 3): the cartouche (`Seal`) and the struck
 * fingerprint (`kind: "sealed"`). seal.test.ts asserts it against the source tree; fingerprint-mark.test.ts reads the
 * same list. It lives here, not inside a test file, so that importing it never runs another file's tests twice. A file
 * that earns the green adds itself here, in the sorted order of its path, with the fact it reads from the database.
 */

export const GREEN_FILES: readonly string[] = [
  // Lot 4: the SIRET checked active in the official register and the URSSAF certificate an operator verified, each
  // with the day of the check (billing identity of the freelancer, legal identity of the company).
  "app/[lang]/app/facturation/page.tsx",
  // Lot 3: a mission confirmed by the client, read in the database (in the companies the person administers, or
  // with the token of the signed link); a refusal carries no seal.
  "components/market/ConfirmationAck.tsx",
  // Lot 4: the last line of the thread of a deal, only when the verified mission (paid on Proofseen) is in the database.
  "components/market/DealThread.tsx",
  // Lot 6: the operator's acknowledgement of a URSSAF certificate, read back by vigilanceDesk.verified().
  "components/operator/VerificationQueues.tsx",
  // Lot 2, /app/preuves: a verified mission (confirmed by the client, or paid on Proofseen) and an address whose
  // ownership is proven, read from the person's own rows (verifiedMissions.listMine, ownedUrls.list).
  "components/registre/ProofRegister.tsx",
  // L1 adds no screen that strikes the fingerprint: the first one (every signature and the timestamp recorded) comes here.
];

/** A file strikes the green when it imports the cartouche or builds a sealed fingerprint. */
export const STRIKES_GREEN = /from "@\/components\/proof\/Seal"|kind:\s*["']sealed["']|kind=["']sealed["']/;
