import { z } from "zod";
import { CONTENT_ENGINE_ID, contentEngineOf } from "./engine";
import { fail, ok, type Result } from "./errors";
import type { DocumentModel } from "./model";
import { defaultRegistry, type TemplateRegistry } from "./registry";
import { renderTemplate } from "./render";

/*
 * `replayVersion` : recalculer le modèle d'une version rangée au coffre, à l'identique, depuis ses seules données figées
 * (gabarit, version du gabarit, langue, variables résolues, clauses optionnelles, moteur). Il sert à l'aperçu « même
 * empreinte de contenu, vérifiée à l'affichage » et à `/verifier` (L2.7). Règle absolue : un modèle APPROCHE ne se rend jamais.
 * Le rejeu rend exactement l'empreinte de contenu rangée, ou un refus nommé :
 *  - `frozen_invalid`        les données figées n'ont pas la forme attendue ;
 *  - `engine_unavailable`    le moteur de contenu qui a rendu la version n'est plus celui-ci ;
 *  - `template_unavailable`  la version du gabarit n'est plus dans le registre ;
 *  - `template_changed`      le gabarit existe mais son contenu n'est plus celui du rendu (une version publiée ne change pas) ;
 *  - `replay_mismatch`       tout est présent mais l'empreinte recalculée diffère (donnée altérée) ;
 *  - ou l'une des neuf erreurs du rendu (`invalid_variable` quand un calcul ne retombe plus sur la valeur rangée...).
 * L'empreinte du contenu ne dépend ni de pdfmake ni de l'horloge : un autre dessinateur de PDF n'empêche pas le rejeu.
 */

const Digest = z.string().regex(/^[0-9a-f]{64}$/);

/** Ce que l'adaptateur de l'application range dans `DocumentVersion.variables` (document-renderer.ts, `storedVariables`). */
export const FrozenValuesSchema = z.object({
  language: z.enum(["fr", "en"]),
  issuedOn: z.string(),
  contentDigest: Digest,
  templateDigest: Digest,
  hypotheses: z.array(z.string()),
  optionalClauses: z.record(z.string(), z.enum(["included", "excluded"])),
  /** L'avertissement de relecture figurait-il dans le document ? Une relecture attestée plus tard ne change pas ce qui a été émis. */
  reviewNotice: z.boolean().optional(),
  /** Rendu de test (filigrane) : le coffre n'en range jamais, mais un rejeu doit savoir le refaire à l'identique. */
  watermark: z.boolean().optional(),
  values: z.record(z.string(), z.unknown()),
});

export interface FrozenVersion {
  readonly templateId: string;
  /** Le numéro de version du gabarit, tel que le coffre le range (texte). */
  readonly templateVersion: string | number;
  /** L'identité du moteur rangée avec la version (`DocumentVersion.engine`). */
  readonly engine: string;
  /** `DocumentVersion.variables`. */
  readonly variables: unknown;
}

export interface ReplayOptions {
  readonly registry?: TemplateRegistry;
}

export const replayVersion = (frozen: FrozenVersion, options: ReplayOptions = {}): Result<DocumentModel> => {
  const parsed = FrozenValuesSchema.safeParse(frozen.variables);
  const version = Number(frozen.templateVersion);
  if (!parsed.success || !Number.isInteger(version) || version < 1) return fail("frozen_invalid", "les données figées de cette version n'ont pas la forme attendue");
  if (contentEngineOf(frozen.engine) !== CONTENT_ENGINE_ID) return fail("engine_unavailable", `le moteur ${frozen.engine} n'est plus disponible (ce moteur est ${CONTENT_ENGINE_ID})`);
  const registry = options.registry ?? defaultRegistry();
  const template = registry.find(frozen.templateId, version);
  if (template === undefined) return fail("template_unavailable", `le gabarit ${frozen.templateId} version ${version} n'est plus disponible`);
  const data = parsed.data;
  if (template.digest !== data.templateDigest) return fail("template_changed", `le gabarit ${frozen.templateId} version ${version} n'a plus le contenu qui a servi au rendu`);
  // Les valeurs prises à un défaut HYPOTHESE reviennent du gabarit, pour que `hypotheses` se recompose comme au rendu.
  const values = Object.fromEntries(Object.entries(data.values).filter(([name]) => !data.hypotheses.includes(name)));
  const rendered = renderTemplate(frozen.templateId, version, data.language, values, {
    registry,
    optionalClauses: data.optionalClauses,
    watermark: data.watermark === true,
    ...(data.reviewNotice === undefined ? {} : { reviewNoticeShown: data.reviewNotice }),
  });
  if (!rendered.ok) return rendered;
  if (rendered.value.contentDigest !== data.contentDigest) return fail("replay_mismatch", "le rejeu ne redonne pas l'empreinte de contenu rangée : une donnée figée a été altérée");
  return ok(rendered.value);
};
