/*
 * Les neuf erreurs nommées du rendu (TEMPLATE_FORMAT.md §5), plus les deux du chargement. Un rendu qui échoue ne lève
 * pas : il rend un `Result` que l'appelant doit lire (le coffre range un refus dans son journal, il ne l'avale pas).
 * Un gabarit mal écrit, lui, est une faute de code : le chargement lève `TemplateLoadError`.
 */

export const RENDER_ERROR_CODES = [
  "missing_variable",
  "invalid_variable",
  "locked_clause_removed",
  "unknown_clause",
  "condition_unresolvable",
  "decision_pending",
  "source_expired",
  "language_missing",
  "template_not_effective",
] as const;

export type RenderErrorCode = (typeof RENDER_ERROR_CODES)[number];

/**
 * Demande de rendu sur un gabarit ou une version que le registre ne contient pas (`template_not_found`) et refus nommés du
 * rejeu d'une version rangée (replay.ts) : données figées illisibles, moteur ou gabarit disparus ou changés, empreinte
 * recalculée différente.
 */
export type LookupErrorCode = "template_not_found" | "frozen_invalid" | "engine_unavailable" | "template_unavailable" | "template_changed" | "replay_mismatch";

export interface RenderError {
  readonly code: RenderErrorCode | LookupErrorCode;
  readonly message: string;
  /** Variables concernées (toutes, pas la première seule), triées. */
  readonly variables: readonly string[];
  /** Clause concernée quand l'erreur en désigne une. */
  readonly clause?: string;
  /** Décision du founder qui bloque (`decision_pending`). */
  readonly decision?: string;
  /** Source citée expirée (`source_expired`). */
  readonly source?: string;
}

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RenderError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = <T = never>(code: RenderError["code"], message: string, extra: Partial<Omit<RenderError, "code" | "message">> = {}): Result<T> => ({
  ok: false,
  error: { ...extra, code, message, variables: [...(extra.variables ?? [])].sort() },
});

/** Un gabarit, un registre de sources ou un fichier de langue qui ne passe pas la validation : jamais chargé. */
export class TemplateLoadError extends Error {
  readonly problems: readonly string[];

  constructor(where: string, problems: readonly string[]) {
    super(`${where}: ${problems.length} problème(s)\n- ${problems.join("\n- ")}`);
    this.name = "TemplateLoadError";
    this.problems = problems;
  }
}
