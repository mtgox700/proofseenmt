import type { ChosenRole, Role } from "./roles";

/*
 * Which side of the marketplace an invitation is for (C23), decided on the server: a company invites a freelancer
 * (`freelance`), a freelancer invites a client company (`client`). Accepting is refused to an account on the other
 * side, and to an operator; an account that has not chosen a side yet chooses it by accepting.
 */

export type InvitationKindName = "freelance" | "client";

export const invitationKindOf = (raw: FormDataEntryValue | null | undefined): InvitationKindName | null => (raw === "freelance" || raw === "client" ? raw : null);

export const requiredSide = (kind: InvitationKindName): ChosenRole => (kind === "freelance" ? "freelance" : "company");

export const sideAllows = (role: Role | null, kind: InvitationKindName): boolean => role === null || role === requiredSide(kind);

/** The notice a page shows after an action, from its `fait` and `erreur` query values; `null` when there is none. */
export interface Notice {
  readonly ok: boolean;
  readonly key: string;
}

const DONE = new Set(["envoyee", "revoquee", "relancee", "refusee", "acceptee-vivier", "acceptee-rattachee", "acceptee-client"]);
const ERRORS = new Set([
  "trop",
  "indisponible",
  "entreprise",
  "invalide",
  "soi",
  "introuvable",
  "profil",
  "deja",
  "limite",
  "mot-contact",
  "mot-html",
  "mot-long",
  "mot-empty",
  "close",
  "trop-tot",
  "deja-relancee",
  "expiree",
  "adresse",
  "cote",
]);

export const noticeOf = (fait: string | undefined, erreur: string | undefined): Notice | null => {
  if (erreur !== undefined && ERRORS.has(erreur)) return { ok: false, key: erreur };
  if (fait !== undefined && DONE.has(fait)) return { ok: true, key: fait };
  return null;
};
