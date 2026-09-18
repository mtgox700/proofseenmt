import { z } from "zod";
import type { EngineAnswer } from "@proofseen/core";
import { postJson, realSleep } from "./http";
import { assertPriced, costFor } from "./pricing";
import { EngineResponseError, type AdapterConfig, type EngineAdapter } from "./types";

/**
 * OpenAI Responses API + web_search tool.
 * Docs (checked 2026-09-18): https://developers.openai.com/api/docs/guides/tools-web-search
 * and https://developers.openai.com/api/reference/resources/responses/methods/create
 */
const ENDPOINT = "https://api.openai.com/v1/responses";

const ResponseSchema = z.object({
  model: z.string(),
  status: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      action: z
        .object({ type: z.string(), sources: z.array(z.object({ url: z.string() })).optional() })
        .optional(),
      content: z
        .array(
          z.object({
            type: z.string(),
            text: z.string().optional(),
            annotations: z.array(z.object({ type: z.string(), url: z.string().optional(), title: z.string().optional() })).optional(),
          }),
        )
        .optional(),
    }),
  ),
  usage: z.object({ input_tokens: z.number().int(), output_tokens: z.number().int() }),
});

export const buildOpenAiRequest = (model: string, prompt: string): Record<string, unknown> => ({
  model,
  input: prompt,
  store: false,
  tools: [{ type: "web_search", search_context_size: "medium", user_location: { type: "approximate", country: "FR" } }],
  tool_choice: "required",
  include: ["web_search_call.action.sources"],
  reasoning: { effort: "low" },
  max_output_tokens: 16_000,
});

export const parseOpenAiResponse = (raw: unknown, requestedModel: string): EngineAnswer => {
  const res = ResponseSchema.parse(raw);
  if (res.status !== "completed") throw new EngineResponseError("openai", `response ${res.status}`);
  const searchCalls = res.output.filter((o) => o.type === "web_search_call" && o.action?.type === "search");
  const parts = res.output.filter((o) => o.type === "message").flatMap((o) => o.content ?? []);
  const outputTexts = parts.filter((p) => p.type === "output_text");
  const usage = { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, searches: searchCalls.length };
  return {
    engine: "openai",
    model: res.model,
    text: outputTexts.map((p) => p.text ?? "").join("\n"),
    citations: outputTexts
      .flatMap((p) => p.annotations ?? [])
      .filter((a) => a.type === "url_citation" && a.url !== undefined)
      .map((a) => (a.title === undefined ? { url: a.url! } : { url: a.url!, title: a.title })),
    searchResults: searchCalls.flatMap((o) => o.action?.sources ?? []).map((s) => ({ url: s.url })),
    usage,
    costUsd: costFor("openai", requestedModel, usage),
  };
};

export const createOpenAiAdapter = ({ apiKey, model, transport, sleep = realSleep }: AdapterConfig): EngineAdapter => {
  assertPriced("openai", model);
  return {
    id: "openai",
    runDraw: async (prompt) => {
      const raw = await postJson({
        transport,
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${apiKey}` },
        body: buildOpenAiRequest(model, prompt),
        sleep,
      });
      return parseOpenAiResponse(raw, model);
    },
  };
};
