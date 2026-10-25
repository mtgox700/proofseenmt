import { daysBetween } from "./format";
import type { LoadedTemplate } from "./registry";
import type { ClauseDecl, SourceEntry } from "./schema";

/*
 * Sources citées et fin de validité (TEMPLATE_FORMAT.md §5, `source_expired`). Une règle de droit cesse de s'appliquer à
 * une date : un document émis après cette date ne doit plus la citer, et on prévient 60 jours avant pour laisser le
 * temps d'écrire la version suivante du gabarit. Le moteur ne lit jamais l'horloge : la date d'émission vient des données.
 */

export const EXPIRY_WARNING_DAYS = 60;

export interface ExpiringSource {
  readonly sourceId: string;
  readonly validUntil: string;
  /** Jours restants à la date de référence ; négatif une fois la règle terminée. */
  readonly daysLeft: number;
}

export interface ExpiryAlert extends ExpiringSource {
  readonly templateId: string;
  readonly version: number;
  readonly clause: string;
}

const entryOf = (sources: Readonly<Record<string, SourceEntry>>, sourceId: string): SourceEntry => {
  const entry = sources[sourceId];
  if (entry === undefined) throw new Error(`source inconnue du registre : ${sourceId}`);
  return entry;
};

/** Les sources de la clause dont la fin de validité précède la date d'émission (le dernier jour de validité compte encore). */
export const expiredSourcesOf = (clause: Pick<ClauseDecl, "sources">, sources: Readonly<Record<string, SourceEntry>>, issuedOn: string): readonly string[] =>
  clause.sources.filter((id) => {
    const until = entryOf(sources, id).validUntil;
    return until !== null && until < issuedOn;
  });

/** Les sources de la clause qui finissent dans les `windowDays` jours suivant `referenceDate` (ou qui sont déjà finies). */
export const expiringSourcesOf = (
  clause: Pick<ClauseDecl, "sources">,
  sources: Readonly<Record<string, SourceEntry>>,
  referenceDate: string,
  windowDays: number = EXPIRY_WARNING_DAYS,
): readonly ExpiringSource[] =>
  clause.sources.flatMap((sourceId) => {
    const until = entryOf(sources, sourceId).validUntil;
    if (until === null) return [];
    const daysLeft = daysBetween(referenceDate, until);
    return daysLeft <= windowDays ? [{ sourceId, validUntil: until, daysLeft }] : [];
  });

/** L'alarme du dépôt : toute source encore citée par un gabarit non retiré qui finit dans la fenêtre. */
export const expiryAlerts = (
  templates: readonly LoadedTemplate[],
  sources: Readonly<Record<string, SourceEntry>>,
  today: string,
  windowDays: number = EXPIRY_WARNING_DAYS,
): readonly ExpiryAlert[] =>
  templates
    .filter((template) => template.decl.status !== "retired")
    .flatMap((template) =>
      template.decl.clauses.flatMap((clause) =>
        expiringSourcesOf(clause, sources, today, windowDays).map((source) => ({ ...source, templateId: template.decl.id, version: template.decl.version, clause: clause.id })),
      ),
    );
