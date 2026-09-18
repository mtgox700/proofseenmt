import { verifiedUrls, type EngineId, type Identity } from "@proofseen/core";
import { createRng } from "@proofseen/stats";
import type { Transport } from "@proofseen/engines";

/**
 * --dry-run ONLY. Produces provider-shaped responses (after the documented formats) with fictitious people,
 * so the whole pipeline runs without any network call or cost. The client may appear at random: this is a
 * simulation of the plumbing, never a measurement. Every report built from it carries a DRY-RUN banner.
 */
const FAKE_PEOPLE = ["Camille Laurent", "Julien Martin", "Sarah Petit", "Hugo Bernard", "Léa Moreau", "Thomas Girard", "Emma Roux"];
const FAKE_URLS = ["https://www.linkedin.com/in/fake-profile", "https://github.com/fake-dev", "https://www.malt.fr/profile/fakefreelance", "https://fake-portfolio.io"];

interface SimulatedLine {
  readonly name: string;
  readonly url: string;
}

const lineupFor = (rng: () => number, identity: Identity, engine: EngineId): SimulatedLine[] => {
  const people = [...FAKE_PEOPLE].sort(() => rng() - 0.5).slice(0, 5);
  const lines = people.map((name, i) => ({ name, url: FAKE_URLS[i % FAKE_URLS.length]! }));
  const clientUrl = verifiedUrls(identity)[0]?.url;
  const chance = { openai: 0.25, anthropic: 0.15, perplexity: 0.1 }[engine];
  if (clientUrl !== undefined && rng() < chance) {
    const slot = Math.floor(rng() * 6);
    return [...lines.slice(0, slot), { name: identity.displayName, url: clientUrl }, ...lines.slice(slot)].slice(0, 6);
  }
  return lines;
};

const textOf = (lines: readonly SimulatedLine[], withMarkers: boolean): string =>
  ["Profils suggérés :", ...lines.map((l, i) => `${i + 1}. ${l.name} — ${l.url}${withMarkers ? ` [${i + 1}]` : ""}`)].join("\n");

const bodyFor = (engine: EngineId, lines: readonly SimulatedLine[], model: string): unknown => {
  const usage = { input_tokens: 3000, output_tokens: 400 };
  if (engine === "openai") {
    return {
      model,
      status: "completed",
      output: [
        { type: "web_search_call", action: { type: "search", sources: lines.map((l) => ({ type: "url", url: l.url })) } },
        { type: "message", content: [{ type: "output_text", text: textOf(lines, false), annotations: lines.slice(0, 2).map((l) => ({ type: "url_citation", url: l.url })) }] },
      ],
      usage,
    };
  }
  if (engine === "anthropic") {
    return {
      model,
      stop_reason: "end_turn",
      content: [
        { type: "web_search_tool_result", content: lines.map((l) => ({ type: "web_search_result", url: l.url, title: "sim" })) },
        { type: "text", text: textOf(lines, false), citations: lines.slice(0, 2).map((l) => ({ type: "web_search_result_location", url: l.url })) },
      ],
      usage: { ...usage, server_tool_use: { web_search_requests: 1 } },
    };
  }
  return {
    model,
    status: "completed",
    output: [
      { type: "search_results", results: lines.map((l, i) => ({ id: i + 1, url: l.url, title: "sim" })) },
      { type: "message", content: [{ type: "output_text", text: textOf(lines, true), annotations: [] }] },
    ],
    usage: { ...usage, cost: { total_cost: 0.004 } },
  };
};

const engineOfUrl = (url: string): EngineId =>
  url.includes("openai") ? "openai" : url.includes("anthropic") ? "anthropic" : "perplexity";

export const createSimulatedTransport = (identity: Identity, seed: number): Transport => {
  const rng = createRng(seed);
  return async (url, init) => {
    const engine = engineOfUrl(url);
    const model = String((JSON.parse(init.body) as { model?: unknown }).model ?? "sim");
    return { status: 200, json: async () => bodyFor(engine, lineupFor(rng, identity, engine), model) };
  };
};

/** Dry-run extractor: reads the simulated "n. Name — url" lines; never used on real answers. */
export const simulatedExtract = async (prompt: string): Promise<string> => {
  const candidates = [...prompt.matchAll(/^\s*\d+\.\s+(.+?)\s+—\s+(\S+)/gm)].map((m) => ({ name: m[1]!, urls: [m[2]!] }));
  return JSON.stringify({ candidates });
};
