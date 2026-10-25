import { z } from "zod";
import { formatDateTime, isIsoDate } from "./format";
import type { VariableDecl } from "./schema";

/*
 * Frontière de saisie : chaque valeur reçue par le moteur passe par un schéma zod construit depuis la déclaration de sa
 * variable (type, bornes, motif). Rien n'est deviné, rien n'est tronqué. Les caractères qui changeraient ce qu'un lecteur
 * voit sans que le texte le montre (contrôles, inversion de sens de lecture, séparateurs de ligne Unicode) sont refusés ;
 * les accents sont ramenés en NFC pour que le même nom donne les mêmes glyphes.
 */

const DEFAULT_STRING_MAX = 500;
const DEFAULT_LIST_MAX = 50;

const isForbidden = (code: number, allowLayout: boolean): boolean => {
  if (allowLayout && (code === 0x0a || code === 0x09 || code === 0x0d)) return false;
  return code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029 || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069) || code === 0xfeff;
};

const hasForbidden = (text: string, allowLayout: boolean): boolean => [...text].some((char) => isForbidden(char.codePointAt(0) ?? 0, allowLayout));

const line = (max: number): z.ZodType<string> =>
  z
    .string()
    .max(max)
    .refine((text) => !hasForbidden(text, false), "caractère de contrôle ou de sens de lecture interdit")
    .transform((text) => text.normalize("NFC"));

const multiline = (max: number): z.ZodType<string> =>
  z
    .string()
    .max(max)
    .refine((text) => !hasForbidden(text, true), "caractère de contrôle ou de sens de lecture interdit")
    .transform((text) => text.replace(/\r\n?/g, "\n").normalize("NFC"));

const PartySchema = z.object({
  legalName: line(200).refine((name) => name.trim() !== "", "raison sociale vide"),
  siret: z.string().regex(/^\d{14}$/, "un SIRET a 14 chiffres").nullable().optional(),
  vatNumber: z.string().regex(/^[A-Z]{2}[A-Z0-9]{2,13}$/, "numéro de TVA mal formé").nullable().optional(),
  address: z.object({
    line1: line(200).refine((v) => v.trim() !== "", "adresse vide"),
    line2: line(200).optional(),
    postalCode: line(12).refine((v) => v.length >= 2, "code postal trop court"),
    city: line(120).refine((v) => v.trim() !== "", "ville vide"),
    country: z.string().regex(/^[A-Z]{2}$/, "code pays ISO 3166-1 alpha-2 attendu"),
  }),
  vatRateBp: z.number().int().nullable().optional(),
});

const bounded = (schema: z.ZodNumber, decl: VariableDecl): z.ZodNumber => {
  const withMin = decl.min === undefined ? schema : schema.min(decl.min);
  return decl.max === undefined ? withMin : withMin.max(decl.max);
};

const patterned = (schema: z.ZodType<string>, decl: VariableDecl): z.ZodType<string> =>
  decl.pattern === undefined ? schema : schema.refine((text) => new RegExp(decl.pattern ?? "", "u").test(text), `ne respecte pas le motif ${decl.pattern}`);

/** Le schéma zod d'une variable. Les nombres sont des entiers sûrs, les montants des centimes jamais négatifs. */
export const validatorFor = (decl: VariableDecl): z.ZodType<unknown> => {
  switch (decl.type) {
    case "string":
      return patterned(line(decl.maxLength ?? DEFAULT_STRING_MAX), decl);
    case "text":
      return multiline(decl.maxLength ?? DEFAULT_STRING_MAX * 10);
    case "enum":
      return z.enum((decl.values ?? []) as [string, ...string[]]);
    case "boolean":
      return z.boolean();
    case "int":
      return bounded(z.number().int(), decl);
    case "money":
      return bounded(z.number().int().nonnegative(), decl);
    case "bp":
      return bounded(z.number().int().min(0).max(10_000), decl);
    case "date":
      return z.string().refine(isIsoDate, "date AAAA-MM-JJ attendue");
    case "datetime":
      return z.string().refine((text) => {
        try {
          formatDateTime(text, "fr");
          return true;
        } catch {
          return false;
        }
      }, "date et heure UTC attendues (AAAA-MM-JJThh:mm:ssZ)");
    case "party":
      return PartySchema;
    case "list":
      return z.array(line(decl.itemMaxLength ?? DEFAULT_STRING_MAX)).max(decl.maxItems ?? DEFAULT_LIST_MAX);
  }
};

/** Vrai quand la valeur est absente : `null`, texte blanc, liste vide. `0` et `false` sont des valeurs. */
export const isAbsent = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);

/** Les textes libres d'une valeur, pour le détecteur de coordonnées injecté par l'appelant. */
export const freeTextsOf = (decl: VariableDecl, value: unknown): readonly string[] => {
  if (decl.source.kind !== "input" && decl.source.kind !== "pending") return [];
  if ((decl.type === "text" || decl.type === "string") && typeof value === "string") return [value];
  return decl.type === "list" && Array.isArray(value) ? (value as string[]) : [];
};
