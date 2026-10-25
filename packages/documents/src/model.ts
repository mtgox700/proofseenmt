import type { Lang } from "./format";

/*
 * Le modèle de document : ce que `renderTemplate` rend et ce que `renderPdf` consomme. Il ne contient aucune
 * instruction de mise en page, seulement le contenu retenu, numéroté, formaté et sa typographie. Deux rendus des mêmes
 * entrées donnent deux modèles égaux octet pour octet (le contenu canonique est dans `canonical`).
 */

/** Un morceau de texte d'un paragraphe ; `value` marque une valeur venue des données (montant, date, nom). */
export interface Run {
  readonly text: string;
  readonly value?: boolean;
}

export interface PartyLine {
  readonly text: string;
  readonly strong?: boolean;
}

export type Block =
  | { readonly kind: "paragraph"; readonly runs: readonly Run[] }
  | { readonly kind: "bullet"; readonly runs: readonly Run[] }
  | { readonly kind: "party"; readonly lines: readonly PartyLine[] };

export interface ModelClause {
  readonly id: string;
  /** Numéro d'article, calculé à la sélection : la comparaison de versions se fait par `id`, jamais par numéro. */
  readonly number: number;
  readonly heading: string;
  readonly variant: string | null;
  readonly blocks: readonly Block[];
}

export interface ModelSignatory {
  readonly role: string;
  readonly label: string;
  readonly name: string | null;
  /** Ce que fait le signataire : émet, accepte, prend connaissance, ou signe. */
  readonly caption: string;
}

export type VariableOrigin = "input" | "default" | "derived";

export interface ResolvedVariable {
  readonly value: unknown;
  readonly origin: VariableOrigin;
}

export interface SourceWarning {
  readonly code: "source_expiring";
  readonly clause: string;
  readonly sourceId: string;
  readonly validUntil: string;
  readonly daysLeft: number;
}

export interface DocumentModel {
  readonly templateId: string;
  readonly templateVersion: number;
  /** SHA-256 du contenu du gabarit (structure et textes) : le coffre le garde pour comparer et pour la relecture. */
  readonly templateDigest: string;
  readonly language: Lang;
  readonly documentType: string;
  readonly issuedOn: string;
  readonly title: string;
  readonly subtitle: string | null;
  /** Avertissement de relecture : présent tant que le gabarit n'est pas relu, ou que sa relecture est tombée. */
  readonly reviewNotice: string | null;
  readonly reviewFooter: string | null;
  readonly clauses: readonly ModelClause[];
  readonly signatories: readonly ModelSignatory[];
  /** Texte du filigrane d'un rendu de test, sinon null. */
  readonly watermark: string | null;
  readonly variables: Readonly<Record<string, ResolvedVariable>>;
  /** Variables prises à une valeur par défaut qui n'est qu'une HYPOTHESE : la clôture du sprint les liste. */
  readonly hypotheses: readonly string[];
  readonly warnings: readonly SourceWarning[];
  /** Contenu canonique (JSON aux clés triées) et son SHA-256 : ce que le pied de page imprime (PDF sans sa propre empreinte). */
  readonly canonical: string;
  readonly contentDigest: string;
}
