import { z } from "zod";
import { postJson, realSleep } from "./http";
import { ANTHROPIC_ENDPOINT, anthropicHeaders } from "./anthropic";
import { assertPriced } from "./pricing";
import type { AdapterConfig } from "./types";

const TextOnly = z.object({ content: z.array(z.object({ type: z.string(), text: z.string().optional() })) });

/**
 * Tool-free completion used by the extractor (REQ-M2-01): no web search, no tool at all,
 * so an injected instruction in the analysed answer cannot trigger any action.
 */
export const createToolFreeCompletion = ({ apiKey, model, transport, sleep = realSleep }: AdapterConfig) => {
  assertPriced("anthropic", model);
  return async (prompt: string): Promise<string> => {
    const raw = await postJson({
      transport,
      url: ANTHROPIC_ENDPOINT,
      headers: anthropicHeaders(apiKey),
      body: { model, max_tokens: 2048, messages: [{ role: "user", content: prompt }] },
      sleep,
    });
    return TextOnly.parse(raw)
      .content.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
  };
};
