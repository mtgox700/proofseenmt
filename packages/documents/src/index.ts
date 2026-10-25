/*
 * Moteur de documents de Proofseen (sprint L1, le Coffre) : gabarits versionnés du Trésor, rendu en modèle de document,
 * PDF déterministe et empreinte. Ce paquet ne touche ni la base ni le réseau : le coffre (packages/db) lit les données,
 * appelle `renderTemplate`, puis `renderPdf`, scelle `fingerprint(octets)` et range le tout.
 */

export { canonicalJson, fingerprint, sha256Hex } from "./canonical";
export { RENDER_ERROR_CODES, TemplateLoadError, type RenderError, type RenderErrorCode, type Result } from "./errors";
export { daysBetween, formatBp, formatDate, formatDateTime, formatInt, formatMoney, frenchSpacing, isIsoDate, typography, type Lang } from "./format";
export type { Block, DocumentModel, ModelClause, ModelSignatory, PartyLine, ResolvedVariable, Run, SourceWarning, VariableOrigin } from "./model";
export { CONTENT_ENGINE_ID, ENGINE_ID } from "./engine";
export { renderPdf, type LayoutOptions } from "./pdf";
export { replayVersion, type FrozenVersion, type ReplayOptions } from "./replay";
export { RECOVERY_FEE_CENTS } from "./rules";
export { describeChanges, type ContractTerms, type RequestedChanges } from "./changes";
export { digestGroups, fileDigestGroups } from "./pdf-layout";
export { defaultRegistry, loadRegistry, pendingVariables, TEMPLATES_DIR, type LoadedTemplate, type TemplateRegistry } from "./registry";
export { renderTemplate, type RenderOptions } from "./render";
export { EXPIRY_WARNING_DAYS, expiryAlerts, type ExpiryAlert } from "./sources";
