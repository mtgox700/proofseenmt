import { z } from "zod";
import type { EngineAnswer } from "@proofseen/core";
import { postJson, realSleep } from "./http";
import { assertPriced, costFor } from "./pricing";
import { EngineResponseError, type AdapterConfig, type EngineAdapter } from "./types";

/**
 * Anthropic Messages API + web search tool (web_search_20250305: basic search, ZDR-eligible, works on Haiku 4.5).
 * Docs (checked 2026-09-18): https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 * and https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools (pause_turn).
 */
export const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

const Block = z.object({
  type: z.string(),
  text: z.string().optional(),
  citations: z.array(z.object({ type: z.string(), url: z.string().optional(), title: z.string().nullable().optional() })).nullable().optional(),
  content: z.unknown().optional(),
});

const MessageSchema = z.object({
  model: z.string(),
  content: z.array(Block),
  stop_reason: z.string().nullable(),
  usage: z.object({
    input_tokens: z.number().int(),
    output_tokens: z.number().int(),
    server_tool_use: z.object({ web_search_requests: z.number().int() }).optional(),
  }),
});
type Message = z.infer<typeof MessageSchema>;

const SearchResults = z.array(z.object({ type: z.string(), url: z.string(), title: z.string().optional() }));

export const anthropicHeaders = (apiKey: string): Record<string, string> => ({
  "x-api-key": apiKey,
  "anthropic-version": ANTHROPIC_VERSION,
});

interface AnthropicConfig extends AdapterConfig {
  readonly maxUses?: number;
  readonly maxContinuations?: number;
}

const resultsOf = (block: z.infer<typeof Block>): { url: string; title?: string }[] => {
  if (block.type !== "web_search_tool_result") return [];
  const parsed = SearchResults.safeParse(block.content); // an error object (HTTP 200) yields no result
  return parsed.success
    ? parsed.data.filter((r) => r.type === "web_search_result").map((r) => (r.title === undefined ? { url: r.url } : { url: r.url, title: r.title }))
    : [];
};

const toAnswer = (messages: readonly Message[], requestedModel: string): EngineAnswer => {
  const blocks = messages.flatMap((m) => m.content);
  const textBlocks = blocks.filter((b) => b.type === "text");
  const usage = {
    inputTokens: messages.reduce((a, m) => a + m.usage.input_tokens, 0),
    outputTokens: messages.reduce((a, m) => a + m.usage.output_tokens, 0),
    searches: messages.reduce((a, m) => a + (m.usage.server_tool_use?.web_search_requests ?? 0), 0),
  };
  return {
    engine: "anthropic",
    model: messages.at(-1)?.model ?? requestedModel,
    text: textBlocks.map((b) => b.text ?? "").join("\n"),
    citations: textBlocks
      .flatMap((b) => b.citations ?? [])
      .filter((c) => c.type === "web_search_result_location" && c.url !== undefined)
      .map((c) => (c.title ? { url: c.url!, title: c.title } : { url: c.url! })),
    searchResults: blocks.flatMap(resultsOf),
    usage,
    costUsd: costFor("anthropic", requestedModel, usage),
  };
};

export const createAnthropicAdapter = ({
  apiKey,
  model,
  transport,
  sleep = realSleep,
  maxUses = 3,
  maxContinuations = 3,
}: AnthropicConfig): EngineAdapter => {
  assertPriced("anthropic", model);
  const tool = { type: "web_search_20250305", name: "web_search", max_uses: maxUses, user_location: { type: "approximate", country: "FR", timezone: "Europe/Paris" } };

  return {
    id: "anthropic",
    runDraw: async (prompt) => {
      const history: unknown[] = [{ role: "user", content: prompt }];
      const received: Message[] = [];
      for (let turn = 0; turn <= maxContinuations; turn += 1) {
        const raw = await postJson({
          transport,
          url: ANTHROPIC_ENDPOINT,
          headers: anthropicHeaders(apiKey),
          body: { model, max_tokens: 2048, messages: history, tools: [tool] },
          sleep,
        });
        const message = MessageSchema.parse(raw);
        received.push(message);
        if (message.stop_reason !== "pause_turn") return toAnswer(received, model);
        // pause_turn: the API requires the assistant content sent back VERBATIM (block ids, encrypted fields),
        // which our narrowed schema does not keep — hence the raw, already status-checked body.
        history.push({ role: "assistant", content: (raw as { content: unknown }).content });
      }
      throw new EngineResponseError("anthropic", `still pause_turn after ${maxContinuations} continuations`);
    },
  };
};
