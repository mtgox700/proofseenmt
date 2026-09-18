/**
 * Response bodies shaped after the official examples recorded in .war-room/sprints/S1_API_DOCS.md (2026-09-18).
 * Synthetic content, fictitious names — never real API output.
 */
export const openaiResponse = {
  id: "resp_1",
  object: "response",
  model: "gpt-5-mini-2025-08-07",
  status: "completed",
  output: [
    { type: "reasoning", id: "rs_1" },
    {
      type: "web_search_call",
      id: "ws_1",
      status: "completed",
      action: { type: "search", query: "freelance typescript paris", sources: [{ type: "url", url: "https://github.com/someone" }] },
    },
    { type: "web_search_call", id: "ws_2", status: "completed", action: { type: "open_page", url: "https://example.org" } },
    {
      type: "message",
      id: "msg_1",
      status: "completed",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "1. Camille Laurent (https://www.linkedin.com/in/camille-laurent-dev)",
          annotations: [{ type: "url_citation", start_index: 0, end_index: 10, url: "https://www.linkedin.com/in/camille-laurent-dev", title: "Camille" }],
        },
      ],
    },
  ],
  usage: { input_tokens: 4000, output_tokens: 600, output_tokens_details: { reasoning_tokens: 200 }, total_tokens: 4600 },
};

export const anthropicPause = {
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-haiku-4-5-20251001",
  content: [
    { type: "text", text: "Je recherche des profils." },
    { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "freelance typescript paris" } },
    {
      type: "web_search_tool_result",
      tool_use_id: "srvtoolu_1",
      content: [{ type: "web_search_result", url: "https://github.com/someone", title: "someone", encrypted_content: "x", page_age: null }],
    },
  ],
  stop_reason: "pause_turn",
  usage: { input_tokens: 3000, output_tokens: 100, server_tool_use: { web_search_requests: 1, web_fetch_requests: 0 } },
};

export const anthropicFinal = {
  id: "msg_2",
  type: "message",
  role: "assistant",
  model: "claude-haiku-4-5-20251001",
  content: [
    { type: "server_tool_use", id: "srvtoolu_2", name: "web_search", input: { query: "second" } },
    { type: "web_search_tool_result", tool_use_id: "srvtoolu_2", content: { type: "web_search_tool_result_error", error_code: "unavailable" } },
    {
      type: "text",
      text: "1. Julien Martin",
      citations: [{ type: "web_search_result_location", url: "https://github.com/julienmartin", title: "Julien", cited_text: "…", encrypted_index: "y" }],
    },
  ],
  stop_reason: "end_turn",
  usage: { input_tokens: 5000, output_tokens: 300, server_tool_use: { web_search_requests: 1, web_fetch_requests: 0 } },
};

export const perplexityResponse = {
  id: "resp_p",
  object: "response",
  model: "perplexity/sonar",
  status: "completed",
  output: [
    {
      type: "search_results",
      queries: ["freelance typescript paris"],
      results: [
        { id: 1, title: "A", url: "https://www.malt.fr/profile/hugobernard", snippet: "…", date: null, source: "web" },
        { id: 2, title: "B", url: "https://sarah-oconnor.io/about", snippet: "…", date: "2026-02-26", source: "web" },
      ],
    },
    {
      type: "message",
      id: "msg_p",
      status: "completed",
      role: "assistant",
      content: [{ type: "output_text", text: "1. Hugo Bernard [1]\n2. Sarah O'Connor [2][9]", annotations: [] }],
    },
  ],
  usage: { input_tokens: 2000, output_tokens: 400, total_tokens: 2400, cost: { currency: "USD", total_cost: 0.0057 } },
};
