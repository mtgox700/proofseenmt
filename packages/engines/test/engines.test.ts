import { describe, expect, it, vi } from "vitest";
import { createOpenAiAdapter } from "../src/openai";
import { createAnthropicAdapter } from "../src/anthropic";
import { createPerplexityAdapter } from "../src/perplexity";
import { postJson, EngineHttpError, type Transport } from "../src/http";
import { assertCanSpend, charge, createBudget, BudgetExceededError } from "../src/budget";
import { costFor, PricingError } from "../src/pricing";
import { createToolFreeCompletion } from "../src/completion";
import { anthropicFinal, anthropicPause, openaiResponse, perplexityResponse } from "./fixtures";

interface Call {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

const scripted = (bodies: unknown[], statuses: number[] = []): { transport: Transport; calls: Call[] } => {
  const calls: Call[] = [];
  let i = 0;
  const transport: Transport = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    const status = statuses[i] ?? 200;
    const body = bodies[Math.min(i, bodies.length - 1)];
    i += 1;
    return { status, json: async () => body };
  };
  return { transport, calls };
};

const noSleep = async (): Promise<void> => undefined;

describe("OpenAI adapter", () => {
  it("sends store:false, the web_search tool and a required tool choice", async () => {
    const { transport, calls } = scripted([openaiResponse]);
    await createOpenAiAdapter({ apiKey: "sk-test", model: "gpt-5-mini", transport, sleep: noSleep }).runDraw("PROMPT");
    const body = calls[0]!.body;
    expect(calls[0]!.url).toBe("https://api.openai.com/v1/responses");
    expect(body).toMatchObject({ model: "gpt-5-mini", input: "PROMPT", store: false, tool_choice: "required" });
    expect(body.tools).toEqual([expect.objectContaining({ type: "web_search" })]);
    expect(body.include).toEqual(["web_search_call.action.sources"]);
    expect(calls[0]!.headers.Authorization).toBe("Bearer sk-test");
  });

  it("parses text, citations, sources, search count and cost", async () => {
    const { transport } = scripted([openaiResponse]);
    const answer = await createOpenAiAdapter({ apiKey: "k", model: "gpt-5-mini", transport, sleep: noSleep }).runDraw("P");
    expect(answer.text).toContain("Camille Laurent");
    expect(answer.citations).toEqual([{ url: "https://www.linkedin.com/in/camille-laurent-dev", title: "Camille" }]);
    expect(answer.searchResults).toEqual([{ url: "https://github.com/someone" }]);
    expect(answer.usage).toEqual({ inputTokens: 4000, outputTokens: 600, searches: 1 });
    expect(answer.model).toBe("gpt-5-mini-2025-08-07");
    // 4000*0.25e-6 + 600*2e-6 + 1*0.01
    expect(answer.costUsd).toBeCloseTo(0.001 + 0.0012 + 0.01, 10);
  });

  it("treats an incomplete response as an error", async () => {
    const { transport } = scripted([{ ...openaiResponse, status: "incomplete" }]);
    await expect(createOpenAiAdapter({ apiKey: "k", model: "gpt-5-mini", transport, sleep: noSleep }).runDraw("P")).rejects.toThrow(/incomplete/);
  });
});

describe("Anthropic adapter", () => {
  it("uses web_search_20250305 with max_uses and continues after pause_turn", async () => {
    const { transport, calls } = scripted([anthropicPause, anthropicFinal]);
    const answer = await createAnthropicAdapter({ apiKey: "a", model: "claude-haiku-4-5", transport, sleep: noSleep, maxUses: 3 }).runDraw("PROMPT");
    expect(calls).toHaveLength(2);
    expect(calls[0]!.headers["anthropic-version"]).toBe("2023-06-01");
    expect(calls[0]!.headers["x-api-key"]).toBe("a");
    expect(calls[0]!.body.tools).toEqual([expect.objectContaining({ type: "web_search_20250305", name: "web_search", max_uses: 3 })]);
    expect((calls[1]!.body.messages as unknown[]).length).toBe(2);
    expect(answer.text).toContain("Julien Martin");
    expect(answer.citations).toEqual([{ url: "https://github.com/julienmartin", title: "Julien" }]);
    expect(answer.searchResults).toEqual([{ url: "https://github.com/someone", title: "someone" }]);
    expect(answer.usage).toEqual({ inputTokens: 8000, outputTokens: 400, searches: 2 });
    expect(answer.costUsd).toBeCloseTo(8000e-6 + 400 * 5e-6 + 0.02, 10);
  });

  it("stops after the continuation cap", async () => {
    const { transport, calls } = scripted([anthropicPause]);
    await expect(
      createAnthropicAdapter({ apiKey: "a", model: "claude-haiku-4-5", transport, sleep: noSleep, maxContinuations: 2 }).runDraw("P"),
    ).rejects.toThrow(/pause_turn/);
    expect(calls).toHaveLength(3);
  });
});

describe("Perplexity adapter (Agent API)", () => {
  it("targets /v1/agent with perplexity/sonar, store:false and the web_search tool", async () => {
    const { transport, calls } = scripted([perplexityResponse]);
    await createPerplexityAdapter({ apiKey: "p", model: "perplexity/sonar", transport, sleep: noSleep }).runDraw("PROMPT");
    expect(calls[0]!.url).toBe("https://api.perplexity.ai/v1/agent");
    expect(calls[0]!.body).toMatchObject({ model: "perplexity/sonar", input: "PROMPT", store: false });
    expect(calls[0]!.body.tools).toEqual([expect.objectContaining({ type: "web_search" })]);
    expect(calls[0]!.body).not.toHaveProperty("preset");
  });

  it("maps [n] markers to search results when annotations are empty and uses the reported cost", async () => {
    const { transport } = scripted([perplexityResponse]);
    const answer = await createPerplexityAdapter({ apiKey: "p", model: "perplexity/sonar", transport, sleep: noSleep }).runDraw("P");
    expect(answer.citations.map((c) => c.url)).toEqual(["https://www.malt.fr/profile/hugobernard", "https://sarah-oconnor.io/about"]);
    expect(answer.searchResults).toHaveLength(2);
    expect(answer.usage.searches).toBe(1);
    expect(answer.costUsd).toBe(0.0057);
  });

  it("refuses to be configured with a preset model (they run third-party models)", () => {
    expect(() => createPerplexityAdapter({ apiKey: "p", model: "openai/gpt-5.6-luna", transport: scripted([]).transport })).toThrow(/perplexity\//);
  });
});

describe("postJson retry policy", () => {
  it("retries 429 and 5xx with backoff, then succeeds", async () => {
    const { transport, calls } = scripted([{}, {}, { ok: true }], [429, 503, 200]);
    const sleep = vi.fn(noSleep);
    const body = await postJson({ transport, url: "https://x", headers: {}, body: {}, sleep });
    expect(body).toEqual({ ok: true });
    expect(calls).toHaveLength(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400 and never leaks the API key in the error", async () => {
    const { transport, calls } = scripted([{ error: { type: "invalid_request_error", message: "bad" } }], [400]);
    const promise = postJson({ transport, url: "https://x", headers: { Authorization: "Bearer sk-secret" }, body: {}, sleep: noSleep });
    await expect(promise).rejects.toBeInstanceOf(EngineHttpError);
    await expect(promise).rejects.not.toThrow(/sk-secret/);
    expect(calls).toHaveLength(1);
  });

  it("retries network failures and gives up after the retry budget", async () => {
    const transport: Transport = async () => {
      throw new Error("ECONNRESET");
    };
    await expect(postJson({ transport, url: "https://x", headers: {}, body: {}, sleep: noSleep, retries: 2 })).rejects.toThrow(/network/);
  });
});

describe("budget", () => {
  it("stops before a draw that could exceed the cap", () => {
    const spent = charge(createBudget(1), 0.95);
    expect(spent.spentUsd).toBe(0.95);
    expect(() => assertCanSpend(spent, 0.1)).toThrow(BudgetExceededError);
    expect(() => assertCanSpend(spent, 0.05)).not.toThrow();
  });

  it("rejects negative charges", () => {
    expect(() => charge(createBudget(1), -1)).toThrow(RangeError);
  });
});

describe("pricing", () => {
  it("refuses an unknown model instead of guessing its price", () => {
    expect(() => costFor("openai", "gpt-unknown", { inputTokens: 1, outputTokens: 1, searches: 0 })).toThrow(PricingError);
  });
});

describe("tool-free completion (extractor)", () => {
  it("calls Anthropic without any tool and returns the text", async () => {
    const { transport, calls } = scripted([{ content: [{ type: "text", text: '{"candidates":[]}' }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }]);
    const complete = createToolFreeCompletion({ apiKey: "a", model: "claude-haiku-4-5", transport, sleep: noSleep });
    expect(await complete("EXTRACT")).toBe('{"candidates":[]}');
    expect(calls[0]!.body).not.toHaveProperty("tools");
  });
});
