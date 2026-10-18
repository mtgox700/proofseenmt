import { z } from "zod";
import { containsContact } from "./contact-detection";
import { urlCarriesContact } from "./contact-urls";
import type { PostReactionKind, PostVisibility } from "./generated/enums";
import { isHttpsUrl } from "./profile-section-schemas";

/*
 * Ce que l'on peut écrire dans la communauté (C22), et ses limites. Le texte d'une publication est du Markdown simple :
 * pas de HTML brut (refusé à l'écriture, échappé au rendu de toute façon), et pas de coordonnées — ni adresse e-mail,
 * ni téléphone, ni pseudonyme de messagerie, ni lien dans le texte : avant une mission payée, le contact reste sur la
 * plateforme. Un lien a son propre champ, une adresse https passée au filtre des adresses de contact.
 */

export const POST_BODY_MAX = 3000;
export const COMMENT_BODY_MAX = 1500;
export const SHARE_COMMENT_MAX = 1000;
export const POST_LINK_MAX = 500;
/** Publications (partages compris) par personne sur 24 heures glissantes. */
export const MAX_POSTS_PER_DAY = 10;
/** Commentaires par personne sur 24 heures glissantes. */
export const MAX_COMMENTS_PER_DAY = 100;
/** Profils suivis par personne. */
export const MAX_FOLLOWED_PROFILES = 1000;
/** Publications par page de fil. */
export const FEED_PAGE_SIZE = 20;
/** Une publication supprimée part pour de bon après ce délai (ses commentaires et réactions avec elle). */
export const DELETED_POST_RETENTION_DAYS = 30;

export const REACTION_KINDS = ["like", "insightful", "celebrate", "support"] as const satisfies readonly PostReactionKind[];
export const POST_VISIBILITIES = ["public", "members"] as const satisfies readonly PostVisibility[];

/** Une balise HTML, un commentaire ou une déclaration : tout ce que le Markdown n'a pas à contenir. */
const RAW_HTML = /<\/?[a-z][^>]*>|<!--|<![a-z]/i;

/** Pourquoi un texte est refusé : `html`, `contact` (coordonnées), `empty`, `long`. */
export type TextProblem = "html" | "contact" | "empty" | "long";

/** Le problème d'un texte de publication ou de commentaire, ou `null` s'il est recevable. */
export const textProblem = (text: string, max: number, allowEmpty = false): TextProblem | null => {
  if (text.length > max) return "long";
  if (text === "") return allowEmpty ? null : "empty";
  if (RAW_HTML.test(text)) return "html";
  return containsContact(text) ? "contact" : null;
};

/** Le problème d'un lien, ou `null` : une adresse https, sans service de contact ni coordonnées. */
export const linkProblem = (url: string): "invalid" | "contact" | null => {
  if (url.length > POST_LINK_MAX || !isHttpsUrl(url)) return "invalid";
  const normalised = new URL(url).toString();
  if (normalised.length > POST_LINK_MAX) return "invalid";
  return urlCarriesContact(normalised) ? "contact" : null;
};

const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v === undefined || v === null || v === "" ? null : v));

/** Ce que le formulaire envoie pour une publication ; le texte et le lien sont relus par `textProblem` et `linkProblem`. */
export const PostInputSchema = z.object({
  body: z.string().trim().max(POST_BODY_MAX * 2),
  linkUrl: optionalText,
  imageFileId: z.uuid().nullish().transform((v) => v ?? null),
  visibility: z.enum(POST_VISIBILITIES).default("public"),
});

export type PostInput = z.input<typeof PostInputSchema>;

export const ReactionKindSchema = z.enum(REACTION_KINDS);
