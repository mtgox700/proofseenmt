import type { VisibilityDictionary } from "@/i18n/market/visibility-fr";

/** An engine's display name; an engine the dictionary does not know keeps its stored id. */
export const engineLabel = (engine: string, v: VisibilityDictionary): string => (engine in v.engines ? v.engines[engine as keyof typeof v.engines] : engine);
