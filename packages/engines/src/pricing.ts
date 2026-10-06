import type { EngineId } from "@proofseen/core";

/**
 * Official prices checked on 2026-09-18 (see .war-room/sprints/S1_API_DOCS.md §4):
 * - https://developers.openai.com/api/docs/pricing
 * - https://platform.claude.com/docs/en/about-claude/pricing
 * - https://docs.perplexity.ai/docs/getting-started/pricing
 * An unknown model is refused rather than priced by guess.
 */
interface Price {
  readonly inputPerToken: number;
  readonly outputPerToken: number;
  readonly perSearch: number;
}

const PRICES: Readonly<Record<EngineId, Readonly<Record<string, Price>>>> = {
  openai: {
    "gpt-5-mini": { inputPerToken: 0.25e-6, outputPerToken: 2e-6, perSearch: 0.01 },
    "gpt-5.6-luna": { inputPerToken: 0.2e-6, outputPerToken: 1.2e-6, perSearch: 0.01 },
  },
  anthropic: {
    "claude-haiku-4-5": { inputPerToken: 1e-6, outputPerToken: 5e-6, perSearch: 0.01 },
    "claude-haiku-4-5-20251001": { inputPerToken: 1e-6, outputPerToken: 5e-6, perSearch: 0.01 },
    "claude-sonnet-5": { inputPerToken: 2e-6, outputPerToken: 10e-6, perSearch: 0.01 },
  },
  perplexity: {
    "perplexity/sonar": { inputPerToken: 0.25e-6, outputPerToken: 2.5e-6, perSearch: 0.0025 },
  },
};

// La borne du pire cas appartient au protocole (core/protocol.ts) : le plafond d'une vague et le contrôle du
// préflight doivent la lire au même endroit, sinon ils finissent par ne plus être d'accord.
export { WORST_CASE_DRAW_USD } from "@proofseen/core";

export class PricingError extends Error {
  constructor(engine: EngineId, model: string) {
    super(`no verified price for ${engine}/${model}: add it to pricing.ts with its source before use`);
    this.name = "PricingError";
  }
}

export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly searches: number;
}

export const assertPriced = (engine: EngineId, model: string): void => {
  if (PRICES[engine][model] === undefined) throw new PricingError(engine, model);
};

export const costFor = (engine: EngineId, model: string, usage: Usage): number => {
  const price = PRICES[engine][model];
  if (price === undefined) throw new PricingError(engine, model);
  return usage.inputTokens * price.inputPerToken + usage.outputTokens * price.outputPerToken + usage.searches * price.perSearch;
};
