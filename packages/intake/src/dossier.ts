import { IdentitySchema, PLACEHOLDER_MARKER, type Identity } from "@proofseen/core";
import { isManualOnlyHost } from "@proofseen/profiles";
import { z } from "zod";
import { SubmissionSchema, type Submission } from "./submission";

/*
 * Ce qu'une inscription devient sur le disque.
 *
 * Décision structurelle : **l'e-mail ne descend pas dans `identity.json`.** Ce fichier-là alimente le profil public et
 * le hub ; tout ce qu'on y met peut finir indexé. L'adresse ne sert qu'à livrer un rapport, elle vit donc dans un
 * fichier de contact séparé que rien de public ne lit. Séparer les deux au moment où on écrit coûte une ligne ; les
 * séparer après une fuite ne se fait pas.
 *
 * Deuxième décision : **la ville et la stack partent en « à renseigner »** plutôt qu'en chaînes vides. Le formulaire
 * ne les demande pas (on ne réclame pas des données avant de savoir si on mesurera quoi que ce soit), et le marqueur
 * est déjà ce que le tableau de bord sait lire : le dossier s'affichera « remplir identity.json » au lieu de partir
 * en mesure avec une ville vide, ce qui fausserait la formulation P3.
 */

/** Alphabet sans caractères confondables (pas de I, L, O, 0, 1) : une référence se lit au téléphone et se retape. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const REFERENCE_LENGTH = 5;

export const ReferenceSchema = z.string().regex(/^[A-Z]{2}-[A-Z0-9]{5}$/);

/**
 * Une référence tirée au hasard, jamais dérivée du nom.
 *
 * Elle apparaît dans les URL (`/p/FR-7H2XK/`). La dériver du nom la rendrait devinable, et devinable veut dire qu'on
 * peut énumérer les clients d'un concurrent à partir d'une liste de noms.
 */
export const newReference = (random: () => number = Math.random): string => {
  const body = Array.from({ length: REFERENCE_LENGTH }, () => ALPHABET[Math.floor(random() * ALPHABET.length)] ?? ALPHABET[0]).join("");
  return `FR-${body}`;
};

export const ContactSchema = z.object({
  reference: ReferenceSchema,
  email: z.email().max(254),
  lang: z.enum(["fr", "en"]),
  consentAt: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Contact = z.infer<typeof ContactSchema>;

export interface Dossier {
  readonly reference: string;
  /** Ce qui sera mesuré. Ne porte aucune donnée de contact. */
  readonly identity: Identity;
  /** Ce qui sert à joindre la personne. Ne sort jamais vers un profil, un rapport ou un moteur. */
  readonly contact: Contact;
}

export interface OpenDossierOptions {
  readonly reference?: string;
  readonly now: Date;
}

/** La méthode de preuve se déduit de l'hôte : sur LinkedIn ou Malt, aucune vérification automatique n'est permise. */
const proofMethodFor = (url: string): "profile_token" | "well_known_file" => (isManualOnlyHost(url) ? "profile_token" : "well_known_file");

export interface NewIdentityInput {
  /** Identifiant du dossier. Le format est contrôlé par l'appelant : l'opérateur et le formulaire n'ont pas les mêmes. */
  readonly id: string;
  readonly displayName: string;
  readonly urls: readonly string[];
}

/**
 * La seule définition de « une identité qui vient d'être ouverte ».
 *
 * Elle existe parce que `client-init` et le formulaire d'inscription la construisaient chacun de leur côté : deux
 * copies des mêmes marqueurs « à renseigner » et de la même déduction de méthode de preuve. Les trois derniers défauts
 * de ce dépôt venaient tous de deux endroits en désaccord sur un même fait.
 */
export const identityFor = ({ id, displayName, urls }: NewIdentityInput): Identity =>
  IdentitySchema.parse({
    id,
    displayName,
    // Une seule variante au départ : celle donnée. En inventer (initiales, inversions) ferait compter des
    // correspondances qui ne désignent pas forcément la personne.
    nameVariants: [displayName],
    // Ville et technologies ne se devinent pas : marqueurs manifestement à remplir, jamais des valeurs plausibles.
    city: PLACEHOLDER_MARKER,
    stack: [PLACEHOLDER_MARKER],
    ownedUrls: urls.map((url) => ({ url, proofMethod: proofMethodFor(url), verifiedAt: null })),
  });

/**
 * Transforme une inscription validée en dossier. Fonction pure : elle n'écrit rien, pour que le web et la CLI en
 * produisent exactement le même, et qu'un test puisse la faire tourner sans disque.
 */
export const openDossier = (input: Submission, options: OpenDossierOptions): Dossier => {
  const submission = SubmissionSchema.parse(input);
  const reference = ReferenceSchema.parse(options.reference ?? newReference());
  const identity = identityFor({ id: reference, displayName: submission.displayName, urls: submission.urls });
  const contact = ContactSchema.parse({
    reference,
    email: submission.email,
    lang: submission.lang,
    consentAt: submission.consentAt,
    createdAt: options.now.toISOString(),
  });
  return { reference, identity, contact };
};
