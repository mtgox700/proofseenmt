import { z } from "zod";
import { PLACEHOLDER_MARKER, hasPlaceholder } from "@proofseen/core";

/*
 * Demande d'audit : tout ce que la vague mesurée ne contient pas et qui ne peut donc pas être deviné — qui est le
 * client, ce qu'il possède déjà (vérifié à la main), et le libellé des offres.
 *
 * Le texte des offres n'entre pas ici : il reste local et n'est jamais republié. Seul un libellé court figure au
 * rapport, avec son origine.
 */

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date au format AAAA-MM-JJ");
/**
 * Texte libre d'une seule ligne. Un saut de ligne dans une valeur recopiée au rapport permettrait d'y injecter un faux
 * titre — donc une fausse promesse de résultat dans un document qui s'engage à n'en faire aucune. On refuse à la
 * frontière plutôt que de rattraper au rendu.
 */
const singleLine = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    // eslint-disable-next-line no-control-regex -- on refuse explicitement les caractères de contrôle, sauts de ligne compris
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "une seule ligne, sans caractère de contrôle")
    // Un squelette de dossier client ne franchit aucun portail : un brief laissé en attente partirait tel quel dans
    // les formulations envoyées aux moteurs, et un intitulé en attente figurerait au rapport remis au client.
    .refine((value) => !hasPlaceholder(value), `champ laissé en attente (« ${PLACEHOLDER_MARKER} ») : le remplir avant de continuer`);
/** Domaine nu : ni schéma, ni chemin. Le rapport ne cite que des domaines de plateforme. */
const domain = z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "domaine attendu, sans https:// ni chemin");

export const AuditRequestSchema = z.object({
  client: z.object({
    displayName: singleLine(120),
    /**
     * Identifiant public du profil : c'est lui qui figure au rapport, jamais un identifiant interne. Alphabet restreint
     * parce qu'il entre dans un nom de fichier — sans quoi un `..` ferait écrire le rapport hors du dossier prévu.
     */
    reference: z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "identifiant public : lettres, chiffres, - et _ uniquement"),
  }),
  surface: z.object({
    readableWithoutJs: z.boolean(),
    robotsTxt: z.boolean(),
    sitemap: z.boolean(),
    structuredData: z.boolean(),
    verifiedPlatforms: z.array(domain).max(20),
  }),
  /** `null` = l'indexation n'a pas été relevée : le rapport ne conclut alors rien sur elle. */
  indexation: z
    .object({ pagesDeclared: z.number().int().positive(), pagesIndexed: z.number().int().nonnegative(), checkedAt: isoDay })
    .nullable()
    .refine((value) => value === null || value.pagesIndexed <= value.pagesDeclared, "plus de pages indexées que déclarées"),
  jobDescriptions: z
    .array(
      z.object({
        id: z.string().min(1).max(20),
        /**
         * Libellé court de l'offre, rédigé par nous. **Aucun nom de personne** n'y a sa place : la garantie « seuls des
         * domaines » ne couvre que les sources mesurées, pas ce champ — ici, c'est la relecture avant envoi qui tient.
         */
        label: singleLine(160),
        provenance: z.enum(["client", "proofseen"]),
        /**
         * Rôle de l'offre dans la mesure. Facultatif ici : il ne sert qu'à **monter** la vague. Au moment du rapport,
         * le rôle est relu dans la vague elle-même — une seule source de vérité, et c'est celle qui a été mesurée.
         */
        role: z.enum(["target", "control"]).optional(),
        /** Reformulation d'une ligne, telle qu'un recruteur la dirait. Nécessaire à la formulation P2. */
        brief: singleLine(300).optional(),
      }),
    )
    .min(1)
    // Même plafond que le manifeste de mesure (core/schemas.ts) : une demande d'audit ne porte pas plus d'offres qu'une vague.
    .max(50),
  /** Réserves reprises telles quelles au rapport (moteurs non couverts, incidents de mesure…). Mêmes règles que `label`. */
  caveats: z.array(singleLine(400)).max(10).default([]),
});
export type AuditRequest = z.infer<typeof AuditRequestSchema>;
