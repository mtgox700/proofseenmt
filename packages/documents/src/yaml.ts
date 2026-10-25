import { parseDocument } from "yaml";
import { TemplateLoadError } from "./errors";

/**
 * YAML 1.2, schéma « core » : `yes`, `no` et `2026-10-24` restent des chaînes, aucune conversion implicite. Une clé en
 * double ou une erreur de syntaxe lève `TemplateLoadError` (un gabarit se lit en entier ou pas du tout).
 */
export const parseYaml = (text: string, where: string): unknown => {
  const document = parseDocument(text, { schema: "core", uniqueKeys: true, prettyErrors: true });
  if (document.errors.length > 0) throw new TemplateLoadError(where, document.errors.map((error) => error.message));
  return document.toJS();
};
