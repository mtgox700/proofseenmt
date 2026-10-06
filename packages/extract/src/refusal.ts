/*
 * Détection d'un refus de nommer des personnes réelles.
 *
 * Pourquoi c'est un fait à conserver : un refus n'est **pas** une absence. Compter « le client n'est pas cité » sur une
 * réponse où le moteur refuse de nommer qui que ce soit mélangerait deux phénomènes — un profil trop faible, et un
 * moteur qui ne joue pas à ce jeu. Le premier se corrige, le second non. Comme les réponses brutes sont purgées à 72 h
 * (CONFORMITE T3), le refus doit être dérivé à la mesure et stocké, exactement comme `retrieved` et `citedDomains`.
 *
 * Heuristique **conservatrice** : mieux vaut manquer un refus que d'en inventer un. Un refus inventé retirerait des
 * tirages du dénominateur et gonflerait artificiellement les taux du client.
 */

export interface RefusalInput {
  readonly text: string;
  /** Personnes nommées dans la réponse. Une réponse qui nomme quelqu'un ne refuse pas de nommer, quoi qu'elle dise. */
  readonly namedCandidates: number;
}

/**
 * Chaque motif exige l'appariement d'une **impossibilité** et d'un **objet « personnes »**. « Je ne peux pas garantir »
 * ou « je n'ai pas accès au web en temps réel » ne sont pas des refus de nommer : ce sont des précautions.
 */
const PATTERNS: readonly RegExp[] = [
  /je ne (?:peux|pourrai)s? pas (?:vous )?(?:recommander|proposer|citer|nommer|identifier|fournir|donner)[^.]{0,80}(?:personnes?|individus?|freelances?|profils? (?:réels?|spécifiques?|nominatifs?)|noms?)/i,
  /je ne suis pas en mesure de[^.]{0,80}(?:recommander|nommer|citer|identifier)[^.]{0,80}(?:personnes?|individus?|freelances?|noms?)/i,
  /je (?:préfère|vais)(?: ne)? (?:pas |m'abstenir de )[^.]{0,60}(?:nommer|citer)[^.]{0,60}(?:personnes?|individus?)/i,
  /i (?:can(?:'|no)?t|cannot|am not able to|won't)[^.]{0,80}(?:recommend|name|identify|list)[^.]{0,80}(?:specific|real|actual|named)?\s*(?:people|persons?|individuals?|freelancers?|names?)/i,
  /i'm not going to[^.]{0,60}(?:name|recommend)[^.]{0,60}(?:people|individuals?|freelancers?)/i,
];

/**
 * `true` seulement quand la réponse ne nomme personne **et** décline explicitement de le faire. Limite assumée : les
 * formulations non couvertes par les motifs passent pour des réponses ordinaires.
 */
export const refusesToName = ({ text, namedCandidates }: RefusalInput): boolean =>
  namedCandidates === 0 && PATTERNS.some((pattern) => pattern.test(text));
