import { z } from "zod";
import type { EngineAnswer } from "@proofseen/core";
import { postJson, realSleep } from "./http";
import { assertPriced, costFor } from "./pricing";
import { EngineResponseError, type AdapterConfig, type EngineAdapter } from "./types";

/**
 * Perplexity Agent API — successor of the Sonar API, which is supported only until 2026-09-27.
 * Docs (checked 2026-09-18): https://docs.perplexity.ai/api-reference/agent-post
 * and https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to
 * Never the /search endpoint (Output not owned by the customer — CONFORMITE §5), never a preset (they run third-party models).
 */
const ENDPOINT = "https://api.perplexity.ai/v1/agent";

const ResponseSchema = z.object({
  model: z.string(),
  status: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      results: z.array(z.object({ id: z.number().int(), url: z.string(), title: z.string().nullable().optional() })).optional(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().optional(), annotations: z.array(z.object({ url: z.string().optional(), title: z.string().optional() })).optional() }))
        .optional(),
    }),
  ),
  usage: z.object({
    input_tokens: z.number().int(),
    output_tokens: z.number().int(),
    cost: z.object({ total_cost: z.number().nonnegative() }).optional(),
  }),
});

const CITATION_FORMAT = "Cite your sources with numbered markers such as [1].";

export const createPerplexityAdapter = ({ apiKey, model, transport, sleep = realSleep }: AdapterConfig): EngineAdapter => {
  if (!model.startsWith("perplexity/")) {
    throw new Error(`perplexity: model must be a native perplexity/ model to measure Perplexity (got ${model})`);
  }
  assertPriced("perplexity", model);

  return {
    id: "perplexity",
    runDraw: async (prompt) => {
      const raw = await postJson({
        transport,
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${apiKey}` },
        body: {
          model,
          input: prompt,
          instructions: CITATION_FORMAT,
          store: false,
          tools: [{ type: "web_search", search_context_size: "medium", max_results: 10, user_location: { country: "FR" } }],
        },
        sleep,
      });
      return parsePerplexityResponse(raw, model);
    },
  };
};

export const parsePerplexityResponse = (raw: unknown, requestedModel: string): EngineAnswer => {
  const res = ResponseSchema.parse(raw);
  if (res.status !== "completed") throw new EngineResponseError("perplexity", `response ${res.status}`);
  const searchItems = res.output.filter((o) => o.type === "search_results");
  const results = searchItems.flatMap((o) => o.results ?? []);
  const texts = res.output.filter((o) => o.type === "message").flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text");
  const text = texts.map((c) => c.text ?? "").join("\n");

  const annotated = texts.flatMap((c) => c.annotations ?? []).filter((a) => a.url !== undefined).map((a) => ({ url: a.url! }));
  const markerIds = [...new Set([...text.matchAll(/\[(\d{1,3})\]/g)].map((m) => Number(m[1])))];
  const fromMarkers = markerIds
    .map((id) => results.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .map((r) => ({ url: r.url }));

  const usage = { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, searches: searchItems.length };
  return {
    engine: "perplexity",
    model: res.model,
    text,
    citations: annotated.length > 0 ? annotated : fromMarkers,
    searchResults: results.map((r) => (r.title ? { url: r.url, title: r.title } : { url: r.url })),
    usage,
    costUsd: res.usage.cost?.total_cost ?? costFor("perplexity", requestedModel, usage),
  };
};
