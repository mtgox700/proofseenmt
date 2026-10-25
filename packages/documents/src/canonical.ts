import { createHash } from "node:crypto";

/*
 * JSON canonique (clés triées à toute profondeur, `undefined` écarté) : la même donnée donne les mêmes octets, d'un
 * processus et d'une machine à l'autre. Sert au contenu canonique d'un document et à l'empreinte d'un gabarit.
 */

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item === undefined ? null : item));
  if (typeof value === "number" && !Number.isFinite(value)) throw new RangeError("canonicalJson: nombre non fini");
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, canonicalize(v)]),
  );
};

export const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));

/** SHA-256 hexadécimal minuscule (64 caractères). Les chaînes sont lues en UTF-8. */
export const sha256Hex = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

/** Empreinte des octets exacts d'un PDF ; le coffre la scelle à l'émission (L1-006, condition 3). */
export const fingerprint = (bytes: Uint8Array): string => sha256Hex(bytes);
