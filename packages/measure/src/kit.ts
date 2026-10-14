import { AUDIT_PROTOCOL, EngineIdSchema, type EngineId } from "@proofseen/core";
import {
  createAnthropicAdapter,
  createOpenAiAdapter,
  createPerplexityAdapter,
  createToolFreeCompletion,
  type EngineAdapter,
  type Sleep,
  type Transport,
} from "@proofseen/engines";
import type { ExtractFn } from "@proofseen/extract";

/*
 * Les moteurs qu'une mesure peut interroger : exactement ceux dont la clé est configurée, rien de plus. Une vague
 * mesurée sur un seul moteur le dit ; elle ne prétend pas avoir interrogé les trois.
 *
 * L'extraction des candidats passe par un modèle Anthropic sans outil (comme la CLI) : sans clé Anthropic, aucune
 * mesure n'est lancée — on compterait « nommé » et « cinq premiers » à zéro par construction.
 *
 * Le transport est injecté : les tests passent un transport simulé, aucun appel réseau ni payant n'en part.
 */

export const ENGINE_KEYS: Readonly<Record<EngineId, string>> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

/** Modèle de l'extracteur : celui que la CLI utilise par défaut. */
export const EXTRACTOR_MODEL = "claude-haiku-4-5";

export type Env = Readonly<Record<string, string | undefined>>;

export interface MeasurementKit {
  readonly engines: readonly EngineId[];
  readonly adapters: Readonly<Partial<Record<EngineId, EngineAdapter>>>;
  readonly extract: ExtractFn;
}

const keyOf = (env: Env, name: string): string => (env[name] ?? "").trim();

/**
 * Interrupteur explicite : une clé présente ne suffit pas à dépenser. Les clés servent déjà ailleurs (la traduction
 * d'un besoin en filtres) ; lancer des mesures payantes est une décision à part (« GO API »), prise en posant
 * `PROOFSEEN_MEASURE_ENABLED=1`. Sans lui, les demandes s'accumulent en file et rien n'est dépensé.
 */
export const measurementsEnabled = (env: Env): boolean => ["1", "true", "yes"].includes(keyOf(env, "PROOFSEEN_MEASURE_ENABLED").toLowerCase());

/** Les moteurs dont la clé est présente, dans l'ordre du protocole. */
export const configuredEngines = (env: Env): EngineId[] => EngineIdSchema.options.filter((engine) => keyOf(env, ENGINE_KEYS[engine]) !== "");

/** Le nécessaire pour mesurer, ou `null` si rien ne peut l'être (aucun moteur, ou pas d'extracteur). */
export const measurementKit = (env: Env, transport: Transport, sleep?: Sleep): MeasurementKit | null => {
  const engines = configuredEngines(env);
  const extractorKey = keyOf(env, ENGINE_KEYS.anthropic);
  if (engines.length === 0 || extractorKey === "") return null;
  const factories = { openai: createOpenAiAdapter, anthropic: createAnthropicAdapter, perplexity: createPerplexityAdapter };
  const timing = sleep === undefined ? {} : { sleep };
  const adapters = Object.fromEntries(
    engines.map((engine) => [engine, factories[engine]({ apiKey: keyOf(env, ENGINE_KEYS[engine]), model: AUDIT_PROTOCOL.models[engine], transport, ...timing })]),
  );
  const extract = createToolFreeCompletion({ apiKey: extractorKey, model: EXTRACTOR_MODEL, transport, ...timing });
  return { engines, adapters, extract };
};
