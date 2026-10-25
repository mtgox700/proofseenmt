import { formatDate, typography, type Lang } from "./format";

/*
 * `computed.changeLines` de l'avenant (TEMPLATE_FORMAT.md §6) : une phrase par variable modifiée, calculée depuis les
 * valeurs avant et après, sans modèle de langage. La v1 de l'avenant ne modifie que la date de fin, l'objet et les
 * livrables (jamais le prix : `computed.moneyAfterPayout` vaut `none`). Le nouveau texte de l'objet n'est pas répété ici :
 * l'article « Nouvelle rédaction de l'objet » le porte.
 */

export interface ContractTerms {
  readonly endsOn: string | null;
  readonly scope: string | null;
  readonly deliverables: readonly string[];
}

export interface RequestedChanges {
  readonly endsOn?: string | undefined;
  readonly scope?: string | undefined;
  readonly deliverables?: readonly string[] | undefined;
}

const WORDS = {
  fr: {
    endMoved: (from: string, to: string) => `La date de fin du contrat passe du ${from} au ${to}.`,
    endSet: (to: string) => `Une date de fin est fixée au ${to}.`,
    scope: "L'objet de la prestation est modifié : sa nouvelle rédaction figure à l'article « Nouvelle rédaction de l'objet ».",
    added: (item: string) => `Livrable ajouté : « ${item} ».`,
    removed: (item: string) => `Livrable retiré : « ${item} ».`,
  },
  en: {
    endMoved: (from: string, to: string) => `The end date of the agreement moves from ${from} to ${to}.`,
    endSet: (to: string) => `An end date is set on ${to}.`,
    scope: 'The scope of the services is amended: its new wording appears in the article "New wording of the scope".',
    added: (item: string) => `Deliverable added: "${item}".`,
    removed: (item: string) => `Deliverable removed: "${item}".`,
  },
} as const;

const endLines = (lang: Lang, before: ContractTerms, to: string | undefined): readonly string[] => {
  if (to === undefined || to === before.endsOn) return [];
  const words = WORDS[lang];
  return [before.endsOn === null ? words.endSet(formatDate(to, lang)) : words.endMoved(formatDate(before.endsOn, lang), formatDate(to, lang))];
};

/** Les phrases des changements demandés, dans l'ordre : date de fin, objet, livrables ajoutés puis retirés. */
export const describeChanges = (lang: Lang, before: ContractTerms, requested: RequestedChanges): readonly string[] => {
  const words = WORDS[lang];
  const scope = requested.scope !== undefined && requested.scope !== before.scope ? [words.scope] : [];
  const next = requested.deliverables;
  const added = next === undefined ? [] : next.filter((item) => !before.deliverables.includes(item)).map(words.added);
  const removed = next === undefined ? [] : before.deliverables.filter((item) => !next.includes(item)).map(words.removed);
  return [...endLines(lang, before, requested.endsOn), ...scope, ...added, ...removed].map((line) => typography(lang, line));
};
