import { z } from "zod";
import { containsDirectContact, NO_CONTACT, RenderRefusedError, type Db, type DocumentRenderer, type RenderedDocument } from "@proofseen/db";
import { siteOrigin } from "@/lib/brand-metadata";
import { BUILDERS, TEMPLATE_OF, type Engine } from "@/lib/document-variables";

/*
 * L'adaptateur entre le coffre (`DocumentRenderer`, packages/db) et le moteur de documents (`@proofseen/documents`).
 * Il fait trois choses et rien d'autre :
 *  1. il transforme les FAITS de l'affaire (ce que les parties ont accepté, lu en base) et les CHOIX des parties
 *     (`inputs`, reçus par l'API) en variables du gabarit (`document-variables.ts`), sans jamais laisser un choix écraser
 *     un fait : une partie ne peut saisir que les variables que le gabarit déclare de source `input` ;
 *  2. il appelle le moteur avec les garde-fous d'un rendu réel (`refuseHypothesisDefaults`, détecteur de coordonnées) ;
 *  3. il traduit un refus du moteur en `RenderRefusedError`, que l'API rend en 409 « gabarit incomplet » avec les NOMS
 *     des variables à fournir (jamais des valeurs).
 * Le moteur est chargé à la première demande : une route qui ne rend rien ne charge ni pdfmake ni les polices.
 */

const OptionalClauses = z.record(z.string(), z.enum(["included", "excluded"]));

export interface RendererDeps {
  readonly db: () => Db;
  /**
   * La page `/verifier` existe-t-elle (L2.7) ? Faux par défaut : tant qu'elle n'existe pas, aucun PDF figé ne porte son adresse
   * (un PDF émis ne se réécrit jamais, une adresse fausse y resterait). A passer à vrai le jour où la page est en ligne.
   */
  readonly verifyPage?: boolean;
}

export interface SplitInputs {
  readonly values: Readonly<Record<string, unknown>>;
  readonly optionalClauses: Readonly<Record<string, "included" | "excluded">>;
}

/**
 * Les choix des parties : les variables que le gabarit déclare saisies par une partie (`allowed`) et le choix des clauses
 * optionnelles (`optionalClauses`). Toute autre clé est refusée, y compris un fait du contrat (`contract.totalCents`,
 * `seller`) et un calcul (`computed.moneyAfterPayout`) : l'API reçoit ce que le client envoie, le contrat figé fait foi.
 */
export const splitInputs = (inputs: Readonly<Record<string, unknown>>, allowed: ReadonlySet<string>): SplitInputs => {
  const { optionalClauses, ...rest } = inputs;
  const refused = Object.keys(rest).filter((key) => !allowed.has(key));
  if (refused.length > 0) throw new RenderRefusedError("invalid_variable", refused);
  const clauses = OptionalClauses.safeParse(optionalClauses ?? {});
  if (!clauses.success) throw new RenderRefusedError("invalid_variable", ["optionalClauses"]);
  return { values: rest, optionalClauses: clauses.data };
};

/** Les variables d'un gabarit qu'une partie saisit : celles de source `input` et pas celles que les faits portent déjà. */
const partyInputs = (engine: Engine, templateId: string): { readonly version: number; readonly allowed: ReadonlySet<string> } => {
  const template = engine.defaultRegistry().latest(templateId);
  if (template === undefined) throw new RenderRefusedError("template_not_found");
  const names = Object.entries(template.decl.variables).filter(([, variable]) => variable.source.kind === "input").map(([name]) => name);
  return { version: template.decl.version, allowed: new Set(names) };
};

/** Le contenu rangé avec la version : de quoi comparer et rejouer, jamais lu par l'API ni journalisé (données personnelles). */
const storedVariables = (model: { readonly variables: Readonly<Record<string, { readonly value: unknown }>>; readonly language: string; readonly issuedOn: string; readonly contentDigest: string; readonly templateDigest: string; readonly hypotheses: readonly string[]; readonly reviewNotice: string | null }, optionalClauses: SplitInputs["optionalClauses"]): Readonly<Record<string, unknown>> => ({
  language: model.language,
  // Ce que le document émis disait de sa relecture : un rejeu (`replayVersion`) le reprend, une relecture attestée depuis ne le change pas.
  reviewNotice: model.reviewNotice !== null,
  issuedOn: model.issuedOn,
  contentDigest: model.contentDigest,
  templateDigest: model.templateDigest,
  hypotheses: model.hypotheses,
  optionalClauses,
  values: Object.fromEntries(Object.entries(model.variables).map(([name, resolved]) => [name, resolved.value])),
});

export const createDocumentRenderer = (deps: RendererDeps): DocumentRenderer => ({
  async render(request): Promise<RenderedDocument> {
    const templateId = TEMPLATE_OF[request.type];
    const engine = await import("@proofseen/documents");
    const { version, allowed } = partyInputs(engine, templateId);
    const { values, optionalClauses } = splitInputs(request.inputs, allowed);
    const variables = await BUILDERS[request.type]({ db: deps.db(), request, engine, choices: values });
    const rendered = engine.renderTemplate(templateId, version, request.lang, variables, {
      optionalClauses,
      refuseHypothesisDefaults: true,
      rejectContact: (text) => (containsDirectContact(text) ? NO_CONTACT : null),
    });
    if (!rendered.ok) {
      const { code, variables: names, clause } = rendered.error;
      throw new RenderRefusedError(code, names.length > 0 ? names : clause === undefined ? [] : [clause]);
    }
    return {
      // L'empreinte imprimée en pied de page est celle du CONTENU ; l'adresse de vérification ne s'imprime que si la page existe.
      bytes: await engine.renderPdf(rendered.value, deps.verifyPage === true ? { verifyUrl: `${siteOrigin()}/verifier` } : {}),
      templateId: rendered.value.templateId,
      templateVersion: String(rendered.value.templateVersion),
      engine: engine.ENGINE_ID,
      contentDigest: rendered.value.contentDigest,
      variables: storedVariables(rendered.value, optionalClauses),
    };
  },
});
