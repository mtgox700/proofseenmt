import { z } from "zod";
import { isManualOnlyHost } from "@proofseen/profiles";

/*
 * L'entrée d'un client : ce qu'un formulaire envoie, et ce qu'on accepte d'en faire.
 *
 * Jusqu'ici, ouvrir un dossier demandait à l'opérateur de taper la référence, le nom et les URL à la main. Personne ne
 * pouvait donc s'inscrire seul — ce qui suffit à bloquer une phase de test, où des gens arrivent d'eux-mêmes.
 *
 * Trois refus sont portés ici plutôt que découverts plus tard, parce que chacun coûte cher au moment où on le découvre :
 *
 *  1. **Une inscription qui n'apporte que des plateformes non vérifiables** (LinkedIn, Malt). La possession ne s'y
 *     prouve pas automatiquement — ligne rouge du projet, aucune requête n'est émise vers elles. Accepter, c'est
 *     encaisser pour une mesure qu'on ne pourra jamais commencer.
 *  2. **Deux fois la même URL.** Elle compterait deux fois dans « 2 URL prouvées sur 3 », un chiffre affiché au client.
 *  3. **Un nom trop court ou vide.** C'est lui qu'on cherchera dans les réponses des moteurs ; un nom de deux lettres
 *     produit des correspondances fortuites, et donc un taux de citation inventé.
 */

export const LANGS = ["fr", "en"] as const;
export type Lang = (typeof LANGS)[number];

/** Une URL http(s) publique, sans identifiants ni fragment : c'est une page, pas une session. */
const PublicUrl = z
  .url({ protocol: /^https$/ })
  .max(300)
  .refine((value) => {
    const parsed = new URL(value);
    return parsed.username === "" && parsed.password === "" && parsed.hash === "";
  }, "l'adresse ne doit porter ni identifiants ni ancre");

export const SubmissionSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  /** Adresses publiques que la personne dit posséder. Elles seront vérifiées une à une avant toute mesure. */
  urls: z.array(PublicUrl).min(1).max(10),
  /** Sert uniquement à livrer le rapport. Ne sort jamais vers un profil public ni vers un moteur. */
  email: z.email().max(254),
  lang: z.enum(LANGS),
  /** Horodatage du consentement affiché par le formulaire. Sans lui, rien ne permet de dire qu'il a été donné. */
  consentAt: z.iso.datetime({ offset: true }),
});
export type Submission = z.infer<typeof SubmissionSchema>;

/** Ce qui empêche d'ouvrir le dossier. Vide = on peut ouvrir. Chaque message s'adresse à la personne, pas à nous. */
export const submissionBlockers = (submission: Submission): readonly string[] => {
  const blockers: string[] = [];

  const normalised = submission.urls.map((url) => new URL(url).href.replace(/\/$/, "").toLowerCase());
  if (new Set(normalised).size !== normalised.length) blockers.push("deux adresses identiques ont été saisies : n'en garder qu'une.");

  // Une plateforme non vérifiable peut accompagner le dossier, mais ne peut pas le porter seule.
  const verifiable = submission.urls.filter((url) => !isManualOnlyHost(url));
  if (verifiable.length === 0)
    blockers.push(
      "aucune adresse vérifiable : LinkedIn et Malt ne permettent pas de prouver la possession automatiquement. Ajouter un site, un portfolio ou une page personnelle dont vous contrôlez le contenu.",
    );

  return blockers;
};
