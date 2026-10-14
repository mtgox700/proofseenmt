import type { EngineId } from "@proofseen/core";
import type { Transport } from "@proofseen/engines";

/*
 * Transport simulé et scripté : aucune requête ne quitte le processus. Les réponses ont la forme documentée de chaque
 * fournisseur (la même que le transport simulé de la CLI), mais leur contenu suit un script fixe par formulation, pour
 * que les chiffres de l'entonnoir se calculent à la main :
 *
 * - P1 : la personne est 2e de la liste, avec son adresse, et l'adresse est citée → retrouvée, nommée, top 5, citée ;
 * - P2 : son adresse n'apparaît que dans les résultats de recherche → retrouvée seulement ;
 * - P3 : 6e de la liste avec son adresse, non citée → retrouvée, nommée, pas dans les cinq premiers, pas citée ;
 * - P4 : absente → rien.
 */

export interface Client {
  readonly name: string;
  readonly url: string;
}

interface Line {
  readonly name: string;
  readonly url: string;
}

const OTHERS: readonly Line[] = [
  { name: "Camille Laurent", url: "https://www.malt.fr/profile/camillelaurent" },
  { name: "Julien Martin", url: "https://github.com/julien-martin-dev" },
  { name: "Sarah Petit", url: "https://sarah-petit.example.org/" },
  { name: "Hugo Bernard", url: "https://www.linkedin.com/in/hugo-bernard" },
  { name: "Emma Roux", url: "https://emma-roux.example.net/" },
];

type PromptId = "P1" | "P2" | "P3" | "P4";

const promptIdOf = (prompt: string): PromptId => {
  if (prompt.startsWith("Voici une offre")) return "P1";
  if (prompt.startsWith("Je cherche")) return "P2";
  if (prompt.startsWith("Here is")) return "P3";
  return "P4";
};

interface Script {
  readonly lines: readonly Line[];
  readonly cited: readonly Line[];
  readonly searched: readonly Line[];
}

const scriptFor = (id: PromptId, client: Client): Script => {
  const me: Line = { name: client.name, url: client.url };
  if (id === "P1") {
    const lines = [OTHERS[0]!, me, ...OTHERS.slice(1, 4)];
    return { lines, cited: lines.slice(0, 2), searched: lines };
  }
  if (id === "P2") return { lines: OTHERS, cited: OTHERS.slice(0, 2), searched: [...OTHERS, me] };
  if (id === "P3") {
    const lines = [...OTHERS, me];
    return { lines, cited: lines.slice(0, 2), searched: lines };
  }
  return { lines: OTHERS, cited: OTHERS.slice(0, 2), searched: OTHERS };
};

const textOf = (lines: readonly Line[]): string => ["Profils suggérés :", ...lines.map((l, i) => `${i + 1}. ${l.name} — ${l.url}`)].join("\n");

export interface Usage {
  readonly input_tokens: number;
  readonly output_tokens: number;
}

const bodyFor = (engine: EngineId, script: Script, model: string, usage: Usage): unknown => {
  if (engine === "openai") {
    return {
      model,
      status: "completed",
      output: [
        { type: "web_search_call", action: { type: "search", sources: script.searched.map((l) => ({ type: "url", url: l.url })) } },
        { type: "message", content: [{ type: "output_text", text: textOf(script.lines), annotations: script.cited.map((l) => ({ type: "url_citation", url: l.url })) }] },
      ],
      usage,
    };
  }
  if (engine === "anthropic") {
    return {
      model,
      stop_reason: "end_turn",
      content: [
        { type: "web_search_tool_result", content: script.searched.map((l) => ({ type: "web_search_result", url: l.url, title: "sim" })) },
        { type: "text", text: textOf(script.lines), citations: script.cited.map((l) => ({ type: "web_search_result_location", url: l.url })) },
      ],
      usage: { ...usage, server_tool_use: { web_search_requests: 1 } },
    };
  }
  return {
    model,
    status: "completed",
    output: [
      { type: "search_results", results: script.searched.map((l, i) => ({ id: i + 1, url: l.url, title: "sim" })) },
      { type: "message", content: [{ type: "output_text", text: textOf(script.lines), annotations: script.cited.map((l) => ({ type: "url_citation", url: l.url })) }] },
    ],
    usage: { ...usage, cost: { total_cost: 0.004 } },
  };
};

/** Extracteur simulé : relit les lignes « n. Nom — adresse » de la réponse qu'on lui soumet. */
const extractorBody = (prompt: string): unknown => {
  const candidates = [...prompt.matchAll(/^\s*\d+\.\s+(.+?)\s+—\s+(\S+)/gm)].map((m) => ({ name: m[1] ?? "", urls: [m[2] ?? ""] }));
  return { content: [{ type: "text", text: JSON.stringify({ candidates }) }] };
};

const engineOfUrl = (url: string): EngineId => (url.includes("openai") ? "openai" : url.includes("anthropic") ? "anthropic" : "perplexity");

export interface ScriptedTransport {
  readonly transport: Transport;
  /** Appels reçus par moteur (hors extracteur). */
  readonly calls: Record<EngineId, number>;
  readonly extractions: { count: number };
}

export interface ScriptOptions {
  readonly usage?: Usage;
  /** Moteurs qui répondent en erreur serveur. */
  readonly failing?: readonly EngineId[];
}

export const scriptedTransport = (client: Client, options: ScriptOptions = {}): ScriptedTransport => {
  const calls: Record<EngineId, number> = { openai: 0, anthropic: 0, perplexity: 0 };
  const extractions = { count: 0 };
  const usage = options.usage ?? { input_tokens: 3000, output_tokens: 400 };
  const transport: Transport = async (url, init) => {
    const body = JSON.parse(init.body) as { model?: unknown; tools?: unknown; messages?: { content?: unknown }[]; input?: unknown };
    const engine = engineOfUrl(url);
    const model = String(body.model ?? "sim");
    if (engine === "anthropic" && body.tools === undefined) {
      extractions.count += 1;
      return { status: 200, json: async () => extractorBody(String(body.messages?.[0]?.content ?? "")) };
    }
    calls[engine] += 1;
    if (options.failing?.includes(engine)) return { status: 500, json: async () => ({ error: "simulated outage" }) };
    const prompt = typeof body.input === "string" ? body.input : String(body.messages?.[0]?.content ?? "");
    return { status: 200, json: async () => bodyFor(engine, scriptFor(promptIdOf(prompt), client), model, usage) };
  };
  return { transport, calls, extractions };
};
