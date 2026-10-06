import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Le jeton qui ouvre l'espace d'un client.
 *
 * Contrainte de départ : pas de mot de passe. Un freelance qui vient tester ne crée pas un compte pour lire un
 * rapport ; il suit un lien reçu par e-mail. Le lien doit donc porter la preuve, et cette preuve doit résister à
 * trois attaques bêtes — les trois qui cassent la plupart des jetons faits maison :
 *
 *  1. **Changer la référence** dans l'URL pour lire le dossier de quelqu'un d'autre. La référence entre donc dans le
 *     message signé ; un jeton valide pour FR-AAAAA ne vaut rien sur FR-BBBBB.
 *  2. **Repousser l'expiration** en éditant la date. Elle entre aussi dans le message signé : la modifier invalide
 *     la signature. C'est l'erreur classique — mettre l'échéance à côté de la signature plutôt que dedans.
 *  3. **Deviner la signature octet par octet** en mesurant le temps de réponse. La comparaison est donc à temps
 *     constant, jamais un `===` sur des chaînes.
 *
 * Ce jeton dit « cette personne a reçu le lien ». Il ne dit pas « cette personne possède ces URL » — ça, c'est la
 * preuve de possession, et elle reste exigée avant toute mesure.
 */

/** En deçà, un secret se retrouve par force brute hors ligne. Même seuil que la preuve de possession. */
export const MIN_SECRET_LENGTH = 32;

/** Durée par défaut d'un lien d'accès : assez pour lire un rapport sans se presser, pas assez pour traîner. */
export const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SEPARATOR = ".";
const REFERENCE = /^[A-Z]{2}-[A-Z0-9]{5}$/;

export interface IssueInput {
  readonly reference: string;
  readonly secret: string;
  readonly now: Date;
  readonly ttlMs?: number;
}

const signatureFor = (reference: string, expiresAt: number, secret: string): string =>
  // Le message est un JSON de tableau : les champs y sont séparés sans ambiguïté, alors qu'une concaténation laisserait
  // deux couples distincts produire la même chaîne.
  createHmac("sha256", secret).update(JSON.stringify([reference, expiresAt])).digest("base64url");

/** Émet un jeton. Lève si le secret est trop court : un secret faible ne se rattrape pas en aval. */
export const issueAccess = ({ reference, secret, now, ttlMs = DEFAULT_TTL_MS }: IssueInput): string => {
  if (!REFERENCE.test(reference)) throw new Error(`référence invalide : ${reference}`);
  if (secret.length < MIN_SECRET_LENGTH) throw new Error(`secret trop court : ${MIN_SECRET_LENGTH} caractères minimum`);
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("durée de validité invalide");
  const expiresAt = now.getTime() + ttlMs;
  return `${reference}${SEPARATOR}${expiresAt}${SEPARATOR}${signatureFor(reference, expiresAt, secret)}`;
};

export type AccessCheck =
  | { readonly ok: true; readonly reference: string; readonly expiresAt: Date }
  /** Une seule raison générique côté client ; le détail sert aux journaux, jamais à la page. */
  | { readonly ok: false; readonly reason: "malformed" | "expired" | "invalid" };

export interface CheckInput {
  readonly token: string;
  readonly secret: string;
  readonly now: Date;
  /** Référence attendue par la page. Fournie, un jeton valide pour un autre dossier est refusé. */
  readonly expected?: string;
}

const sameSignature = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // `timingSafeEqual` exige des longueurs égales : les comparer d'abord rendrait la vérification dépendante de la
  // longueur, ce qui est sans intérêt pour l'attaquant ici (la signature est de taille fixe) mais lève sinon.
  return left.length === right.length && timingSafeEqual(left, right);
};

export const checkAccess = ({ token, secret, now, expected }: CheckInput): AccessCheck => {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error(`secret trop court : ${MIN_SECRET_LENGTH} caractères minimum`);
  const parts = token.split(SEPARATOR);
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [reference, rawExpiry, signature] = parts as [string, string, string];
  if (!REFERENCE.test(reference) || !/^\d{1,15}$/.test(rawExpiry)) return { ok: false, reason: "malformed" };

  const expiresAt = Number(rawExpiry);
  // La signature se vérifie **avant** l'expiration : sinon on répond « expiré » à un jeton forgé, ce qui confirme à
  // l'attaquant que le reste du format est bon.
  if (!sameSignature(signature, signatureFor(reference, expiresAt, secret))) return { ok: false, reason: "invalid" };
  if (expected !== undefined && expected !== reference) return { ok: false, reason: "invalid" };
  if (now.getTime() >= expiresAt) return { ok: false, reason: "expired" };
  return { ok: true, reference, expiresAt: new Date(expiresAt) };
};

/**
 * Empreinte courte d'un secret, pour vérifier que deux processus utilisent **le même** sans jamais l'afficher.
 *
 * Le piège qu'elle ferme : la CLI émet les jetons, le web les vérifie. Si le secret diffère entre les deux — un autre
 * est posé sur l'hébergeur, par exemple — **tous les liens deviennent « non valide » en silence**. Rien ne plante,
 * rien ne s'enregistre : les gens cliquent et ne voient pas leur espace. Comparer deux empreintes prend dix secondes ;
 * diagnostiquer ce symptôme-là sans elles prend une soirée.
 *
 * Elle est sûre à imprimer dans un journal : c'est un HMAC du secret sur un message constant, tronqué. Remonter au
 * secret depuis 32 bits demanderait de le deviner entièrement d'abord.
 */
export const secretFingerprint = (secret: string): string => {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error(`secret trop court : ${MIN_SECRET_LENGTH} caractères minimum`);
  return createHmac("sha256", secret).update("proofseen-secret-fingerprint").digest("hex").slice(0, 8);
};
