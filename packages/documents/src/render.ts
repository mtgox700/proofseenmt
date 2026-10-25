import { canonicalJson, sha256Hex } from "./canonical";
import { CHROME } from "./chrome";
import { composeClauses, composeSignatories, resolveInline, reviewTexts } from "./compose";
import { fail, ok, type Result } from "./errors";
import { isIsoDate, type Lang } from "./format";
import type { DocumentModel, SourceWarning } from "./model";
import { defaultRegistry, type LoadedTemplate, type TemplateRegistry } from "./registry";
import { checkOptionalClauses, requiredBySelection, selectClauses, type ClauseChoice, type Selected } from "./select";
import { expiredSourcesOf, expiringSourcesOf } from "./sources";
import { completeForSelection, ISSUED_ON, resolveVariables, type Resolved, type Values } from "./variables";

/*
 * `renderTemplate` : du gabarit versionné et des variables à un modèle de document. Aucune horloge, aucun fuseau, aucune
 * locale du système : la date d'émission vient des données, la même entrée donne le même modèle, octet pour octet.
 * Ordre des contrôles : gabarit trouvé, date d'émission, entrée en vigueur, langue, clauses optionnelles, variables,
 * choix des clauses (conditions, décisions du founder), variables exigées par ce choix, sources encore valables.
 */

export interface RenderOptions {
  readonly registry?: TemplateRegistry;
  /** Les seuls choix des parties : retenir ou retirer une clause optionnelle. */
  readonly optionalClauses?: Readonly<Record<string, ClauseChoice>>;
  /** Rendu de test : filigrane « Exemple, non signé », jamais rangé au coffre comme document de l'affaire. */
  readonly watermark?: boolean;
  /** Refuse les valeurs par défaut qui ne sont que des HYPOTHESES. */
  readonly refuseHypothesisDefaults?: boolean;
  /** Détecteur de coordonnées (`containsDirectContact`) appliqué aux saisies libres. */
  readonly rejectContact?: (text: string) => string | null;
  /** Rejeu d'une version rangée (`replayVersion`) : l'avertissement de relecture figurait-il dans le document émis ? */
  readonly reviewNoticeShown?: boolean;
}

const checkIssuedOn = (variables: Values): Result<string> => {
  const issuedOn = variables[ISSUED_ON];
  if (issuedOn === undefined || issuedOn === null) return fail("missing_variable", `variable manquante : ${ISSUED_ON}`, { variables: [ISSUED_ON] });
  if (typeof issuedOn !== "string" || !isIsoDate(issuedOn)) return fail("invalid_variable", `${ISSUED_ON} : date AAAA-MM-JJ attendue`, { variables: [ISSUED_ON] });
  return ok(issuedOn);
};

const checkTemplate = (template: LoadedTemplate, lang: Lang, issuedOn: string): Result<null> => {
  const { decl } = template;
  if (decl.status === "retired" || issuedOn < decl.effectiveFrom) {
    return fail("template_not_effective", `le gabarit ${decl.id} v${decl.version} ne s'applique pas à un document émis le ${issuedOn} (en vigueur le ${decl.effectiveFrom}, statut ${decl.status})`);
  }
  if (!decl.languages.includes(lang) || template.texts[lang] === undefined) return fail("language_missing", `langue non disponible pour ${decl.id} : ${lang}`);
  return ok(null);
};

const checkSources = (selected: readonly Selected[], sources: TemplateRegistry["sources"], issuedOn: string): Result<readonly SourceWarning[]> => {
  for (const { clause } of selected) {
    const [expired] = expiredSourcesOf(clause, sources, issuedOn);
    if (expired !== undefined) {
      const until = sources[expired]?.validUntil ?? "";
      return fail("source_expired", `la clause ${clause.id} cite ${expired}, qui cessait de s'appliquer le ${until} : le document est daté du ${issuedOn}`, { clause: clause.id, source: expired });
    }
  }
  return ok(
    selected.flatMap(({ clause }) => expiringSourcesOf(clause, sources, issuedOn).map((s): SourceWarning => ({ code: "source_expiring", clause: clause.id, ...s }))),
  );
};

interface Parts {
  readonly template: LoadedTemplate;
  readonly lang: Lang;
  readonly issuedOn: string;
  readonly resolved: Resolved;
  readonly selected: readonly Selected[];
  readonly warnings: readonly SourceWarning[];
  readonly watermark: boolean;
  readonly reviewNoticeShown: boolean | undefined;
}

const assemble = ({ template, lang, issuedOn, resolved, selected, warnings, watermark, reviewNoticeShown }: Parts): DocumentModel => {
  const context = { template, lang, values: resolved.values };
  const text = template.texts[lang];
  const review = reviewTexts(context, reviewNoticeShown);
  const included = new Set(selected.map((s) => s.clause.id));
  const omitted = template.decl.clauses.filter((c) => c.kind === "optional" && !included.has(c.id)).map((c) => c.id);
  const watermarkText = watermark ? CHROME[lang].watermark : null;
  const canonical = canonicalJson({
    format: 1,
    template: { id: template.decl.id, version: template.decl.version, digest: template.digest },
    language: lang,
    issuedOn,
    watermark: watermarkText,
    reviewNotice: review.notice !== null,
    variables: resolved.values,
    clauses: selected.map((s) => ({ id: s.clause.id, variant: s.variant })),
    omitted,
    hypotheses: resolved.hypotheses,
  });
  return {
    templateId: template.decl.id,
    templateVersion: template.decl.version,
    templateDigest: template.digest,
    language: lang,
    documentType: template.decl.documentType,
    issuedOn,
    title: resolveInline(text?.title ?? "", context),
    subtitle: text?.subtitle === undefined ? null : resolveInline(text.subtitle, context),
    reviewNotice: review.notice,
    reviewFooter: review.footer,
    clauses: composeClauses(selected, context),
    signatories: composeSignatories(context),
    watermark: watermarkText,
    variables: resolved.variables,
    hypotheses: resolved.hypotheses,
    warnings,
    canonical,
    contentDigest: sha256Hex(canonical),
  };
};

export const renderTemplate = (templateId: string, version: number, lang: Lang, variables: Values, options: RenderOptions = {}): Result<DocumentModel> => {
  const registry = options.registry ?? defaultRegistry();
  const template = registry.find(templateId, version);
  if (template === undefined) return fail("template_not_found", `gabarit introuvable : ${templateId} v${version}`);
  const issued = checkIssuedOn(variables);
  if (!issued.ok) return issued;
  const effective = checkTemplate(template, lang, issued.value);
  if (!effective.ok) return effective;
  const choices = options.optionalClauses ?? {};
  const allowed = checkOptionalClauses(template.decl, choices);
  if (!allowed.ok) return allowed;
  const resolved = resolveVariables(template.decl, variables, options);
  if (!resolved.ok) return resolved;
  const selected = selectClauses(template.decl, resolved.value.values, choices);
  if (!selected.ok) return selected;
  const needed = requiredBySelection(template.decl, resolved.value.values, selected.value);
  if (!needed.ok) return needed;
  const complete = completeForSelection(template.decl, resolved.value, needed.value, options);
  if (!complete.ok) return complete;
  const warnings = checkSources(selected.value, registry.sources, issued.value);
  if (!warnings.ok) return warnings;
  return ok(assemble({ template, lang, issuedOn: issued.value, resolved: complete.value, selected: selected.value, warnings: warnings.value, watermark: options.watermark === true, reviewNoticeShown: options.reviewNoticeShown }));
};
