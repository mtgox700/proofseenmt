# S1 / W4 — Vérification des docs API (recherche web) : OpenAI, Anthropic, Perplexity

- **Date de consultation :** 2026-09-18 (toutes les URL ci-dessous ont été lues ce jour-là, en Markdown brut quand le site le permettait : suffixe `.md`).
- **Méthode :** lecture de la doc officielle uniquement. Aucune API payante n'a été appelée. Les extraits JSON sont **recopiés et élagués** à partir de la doc (champs retirés, jamais ajoutés).
- **Convention :** « NON VÉRIFIÉ » = absent de la doc officielle lue, ou contradictoire. À trancher par un appel réel (1 tirage par fournisseur, coût < 0,05 $) avant de figer les types TS.

---

## ⚠️ Trois alertes à traiter AVANT d'écrire les adaptateurs (W5)

| # | Alerte | Source | Impact |
|---|---|---|---|
| A1 | **Sonar Chat Completions est déprécié : « Sonar will be supported until September 27, 2026 »**, soit **dans 9 jours**. Perplexity pousse l'**Agent API** (`POST /v1/agent`). | bandeau présent sur toutes les pages Sonar, par ex. https://docs.perplexity.ai/docs/sonar/quickstart | L'adaptateur Perplexity doit viser **`/v1/agent` + `model: "perplexity/sonar"` + `tools:[{type:"web_search"}]`**. Écrire un adaptateur `/chat/completions` serait du travail jetable. Cette section documente les deux. |
| A2 | **Claude Haiku 4.5 : retrait « Not sooner than October 15, 2026 »** (dans environ 4 semaines, date plancher et non date ferme). | https://platform.claude.com/docs/en/models/haiku-4-5/overview | Le modèle doit être une **config**, pas une constante. Remplaçant bon marché documenté : `claude-sonnet-5` (2 $/10 $). |
| A3 | Chez OpenAI, `gpt-5-mini` fonctionne toujours, mais la doc recommande désormais `gpt-5.6-terra` pour les nouvelles charges. De plus, `gpt-5.6-luna` (tier « nano ») est **moins cher que gpt-5-mini en sortie** et supporte `web_search`. | https://developers.openai.com/api/docs/models/gpt-5-mini , https://developers.openai.com/api/docs/models/gpt-5.6-luna | Choix produit à arbitrer (représentativité face à ChatGPT contre coût). Le modèle doit rester paramétrable. |

---

## 1. OpenAI — Responses API + outil `web_search`

**URL officielles (consultées le 2026-09-18)**
- Guide : https://developers.openai.com/api/docs/guides/tools-web-search (l'ancienne URL platform.openai.com/docs/guides/tools-web-search redirige ici en 301)
- Référence : https://developers.openai.com/api/reference/resources/responses/methods/create
- Données / `store` / ZDR : https://developers.openai.com/api/docs/guides/your-data
- Modèle : https://developers.openai.com/api/docs/models/gpt-5-mini
- Tarifs : https://developers.openai.com/api/docs/pricing

**Endpoint et headers :** `POST https://api.openai.com/v1/responses`, avec `Authorization: Bearer $OPENAI_API_KEY` et `Content-Type: application/json`. Aucun header de version ni header beta requis.

**Type d'outil :**
- `"web_search"` : recommandé pour les nouvelles intégrations. La référence accepte aussi l'alias daté `"web_search_2025_08_26"`.
- `"web_search_preview"` : legacy. Il ne supporte pas `filters` ni `return_token_budget`, et ignore `external_web_access`.

**Paramètres de l'outil `web_search`** (d'après la référence) :
- `search_context_size` : `"low" | "medium" | "high"`, défaut `medium`.
- `user_location` : `{ type: "approximate", country (ISO-2), city, region, timezone (IANA) }`, tous les champs optionnels. Non supporté pour deep research.
- `filters.allowed_domains` : string[], 100 domaines max, sans `https://`, sous-domaines inclus.
- `external_web_access` : boolean, défaut `true` ; `false` = mode cache/offline.
- `return_token_budget` : `"default" | "unlimited"` (guide uniquement ; modèles de raisonnement GPT-5+).
- `search_content_types` / `image_settings` : recherche d'images (guide uniquement).

**Paramètres de requête utiles :**
- `store` : boolean, défaut `true` (« Defaults to true when omitted »). **`store: false` est possible.** Si `true`, la réponse est stockée au moins 30 jours. Sous ZDR (réglage d'**organisation**), `store` est forcé à `false`. Dans les régions non-US, `store=true` est interdit.
- `include: ["web_search_call.action.sources"]` : liste complète des URL consultées (valeur documentée dans la référence). La valeur `"web_search_call.results"` existe aussi (résultats bruts, documentés pour les images).
- `tool_choice` : avec `"auto"`, la recherche est **optionnelle**. Pour forcer une recherche, utiliser `"required"`.
- `reasoning: { effort }` : valeurs globales `none | minimal | low | medium | high | xhigh | max`, qui dépendent du modèle. **« Web search does not support gpt-5 with minimal reasoning. »**
- `max_output_tokens` : si la limite est atteinte, on obtient `status: "incomplete"` et `incomplete_details.reason: "max_output_tokens"`, **parfois avant tout texte visible**. Le guide reasoning recommande de réserver environ 25 000 tokens au départ.

**Requête minimale (d'après le guide) :**
```json
{
  "model": "gpt-5-mini",
  "tools": [{ "type": "web_search", "search_context_size": "low",
              "user_location": { "type": "approximate", "country": "FR" } }],
  "tool_choice": "required",
  "include": ["web_search_call.action.sources"],
  "store": false,
  "input": "…prompt…"
}
```
(Le guide utilise `gpt-6-astra` dans ses exemples. `gpt-5-mini` liste `web_search` dans ses « Supported tools » Responses.)

**Réponse minimale (élagage de l'exemple du guide et du schéma de référence) :**
```json
{
  "id": "…", "object": "response", "model": "…", "status": "completed",
  "output": [
    { "type": "web_search_call", "id": "ws_…", "status": "completed",
      "action": { "type": "search", "query": "latest news about AI",
                  "queries": ["…"],
                  "sources": [ { "type": "url", "url": "https://…" } ] } },
    { "type": "message", "id": "msg_…", "status": "completed", "role": "assistant",
      "content": [ { "type": "output_text", "text": "…",
        "annotations": [ { "type": "url_citation", "start_index": 2606, "end_index": 2758,
                           "url": "https://…", "title": "Title..." } ] } ] }
  ],
  "usage": { "input_tokens": 0, "input_tokens_details": { "cached_tokens": 0, "cache_write_tokens": 0 },
             "output_tokens": 0, "output_tokens_details": { "reasoning_tokens": 0 }, "total_tokens": 0 }
}
```
- Types d'`action` possibles : `search` {`query?`, `queries?`, `sources?`}, `open_page` {`url?`}, `find_in_page` {`pattern`, `url`}. Il peut y avoir **plusieurs** items `web_search_call`, ainsi que des items `reasoning`.
- `status` de `web_search_call` : `in_progress | searching | completed | failed | incomplete`.
- Les sources peuvent contenir des flux tiers étiquetés `oai-sports`, `oai-weather` ou `oai-finance` (guide).

**Pièges OpenAI**
1. **Il n'y a pas de compteur de recherches dans `usage`.** Il faut compter soi-même les items `web_search_call` dont `action.type === "search"` : ce sont eux qui sont facturés (« Search actions incur a tool call cost »). NON VÉRIFIÉ : le fait qu'un `open_page` ou un `find_in_page` ne soit pas facturé n'est pas écrit explicitement.
2. `action.query` (singulier, dans l'exemple) et `action.queries` (pluriel, dans le schéma) sont **tous deux optionnels**. Il faut lire les deux. Le guide précise que les requêtes sont incluses « usually (but not always) ».
3. `filters.blocked_domains` apparaît dans le guide (exemple curl, « up to 100 blocked_domains »), mais **pas dans le schéma de référence**, qui ne liste que `allowed_domains`. Statut : NON VÉRIFIÉ, à éviter en V0.
4. `web_search_call.results` figure dans l'enum `include`, mais le schéma `WebSearchCall` ne liste que {id, action, status, type}. Ne pas en dépendre.
5. `output_text` apparaît dans l'exemple de réponse de la référence, mais le guide le présente comme un raccourci SDK. **Pour reconstituer le texte, concaténer les `output_text` des items `message`.**
6. Les `start_index` / `end_index` sont relatifs au `text` de la **partie de contenu**, pas à la réponse entière.
7. Le champ `model` de la réponse pour `gpt-5-mini` (alias ou snapshot daté `gpt-5-mini-2025-08-07`) est NON VÉRIFIÉ dans un exemple. Stocker la valeur renvoyée telle quelle.
8. Le support de `temperature` par gpt-5-mini est NON VÉRIFIÉ. Ne pas l'envoyer.
9. Rétention : il n'y a pas d'option d'organisation en self-service dans la doc lue. La **ZDR** est un statut d'organisation qui force `store:false`. Pour le reste, le paramètre de requête `store:false` suffit à ne pas conserver l'état applicatif (hors mode background).

---

## 2. Anthropic — Messages API + outil web search

**URL officielles (consultées le 2026-09-18)**
- Outil : https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool (l'ancienne URL docs.anthropic.com redirige ici en 301)
- Outils serveur (pause_turn, ZDR, allowed_callers) : https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools
- Référence des outils : https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-reference
- Référence Messages (usage) : https://platform.claude.com/docs/en/api/messages
- Versioning : https://platform.claude.com/docs/en/api/versioning
- Modèles : https://platform.claude.com/docs/en/about-claude/models/overview
- Rétention : https://platform.claude.com/docs/en/manage-claude/api-and-data-retention et https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data

**Endpoint et headers :** `POST https://api.anthropic.com/v1/messages`, avec `x-api-key: $ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01` (dernière version listée) et `content-type: application/json`. **Aucun header beta** n'est requis pour web search (référence des outils : « Beta header: None »).

**Versions de l'outil (`type`)** — le `name` doit valoir `"web_search"` :
- `web_search_20250305` : recherche basique. Éligible ZDR. `allowed_callers` vaut `["direct"]` par défaut.
- `web_search_20260209` : ajoute le **dynamic filtering** (le modèle filtre les résultats via code execution). `allowed_callers` vaut par défaut `["code_execution_20260120"]`. Réservé aux modèles Claude 4.6 et suivants. Non éligible ZDR sauf avec `allowed_callers:["direct"]`.
- `web_search_20260318` : ajoute `response_inclusion` (`"full"` par défaut, ou `"excluded"`).
- **Pour Haiku 4.5, utiliser `web_search_20250305`.** Haiku 4.5 ne supporte pas le programmatic tool calling, donc les versions 2026 exigent `allowed_callers:["direct"]`, sinon la requête échoue en 400.

**Paramètres de l'outil :** `max_uses` (int), `allowed_domains` **ou** `blocked_domains` (jamais les deux, sinon 400 ; domaines sans schéma, chemin optionnel), `user_location` = `{ type:"approximate", city, region, country (ISO-2 ; un pays non supporté donne 400), timezone (IANA) }` avec au moins un champ.

**Identifiants de modèles (API Claude) :**
- Claude Haiku 4.5 : **`claude-haiku-4-5-20251001`** (alias `claude-haiku-4-5`). 1 $/5 $ par MTok. Contexte 200K.
- Sonnet actuel : **Claude Sonnet 5**, `claude-sonnet-5` (identifiant sans date ; c'est lui-même un snapshot figé). 2 $/10 $ par MTok. Ce tarif, initialement introductif, est désormais standard : la hausse prévue au 1er septembre 2026 n'aura pas lieu.
- Legacy encore disponible : `claude-sonnet-4-6`, à 3 $/15 $.

**Requête minimale (d'après la doc) :**
```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 1024,
  "messages": [{ "role": "user", "content": "…prompt…" }],
  "tools": [{ "type": "web_search_20250305", "name": "web_search", "max_uses": 5,
              "user_location": { "type": "approximate", "country": "FR", "timezone": "Europe/Paris" } }]
}
```

**Réponse minimale (élagage de l'exemple officiel) :**
```json
{
  "id": "msg_…", "type": "message", "role": "assistant", "model": "…",
  "content": [
    { "type": "text", "text": "I'll search for when Claude Shannon was born." },
    { "type": "server_tool_use", "id": "srvtoolu_01…", "name": "web_search",
      "input": { "query": "claude shannon birth date" } },
    { "type": "web_search_tool_result", "tool_use_id": "srvtoolu_01…",
      "content": [ { "type": "web_search_result", "url": "https://en.wikipedia.org/wiki/Claude_Shannon",
                     "title": "Claude Shannon - Wikipedia", "encrypted_content": "EqgfCioI…",
                     "page_age": "April 30, 2025" } ] },
    { "type": "text", "text": "Claude Shannon was born on April 30, 1916, in Petoskey, Michigan",
      "citations": [ { "type": "web_search_result_location", "url": "https://en.wikipedia.org/wiki/Claude_Shannon",
                       "title": "Claude Shannon - Wikipedia", "encrypted_index": "Eo8BCioI…",
                       "cited_text": "Claude Elwood Shannon (April 30, 1916 – …" } ] }
  ],
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 6039, "output_tokens": 931,
             "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
             "server_tool_use": { "web_search_requests": 1, "web_fetch_requests": 0 } }
}
```
La référence Messages liste aussi, dans `usage`, les champs `cache_creation{ephemeral_5m_input_tokens, ephemeral_1h_input_tokens}`, `inference_geo`, `output_tokens_details.thinking_tokens` et `service_tier`.

**Pièges Anthropic**
1. **Le texte final est fragmenté en plusieurs blocs `text`**, entre lesquels s'intercalent des blocs `server_tool_use` et `web_search_tool_result`. Le premier bloc `text` est souvent un préambule (« I'll search… »). Pour reconstituer la réponse, concaténer les blocs `text`. Pour la métrique GEO, décider si le préambule compte.
2. **Les erreurs de recherche arrivent en HTTP 200.** Dans ce cas, `web_search_tool_result.content` est un **objet** `{type:"web_search_tool_result_error", error_code}` au lieu d'un tableau. Codes possibles : `too_many_requests`, `invalid_tool_input`, `max_uses_exceeded`, `query_too_long`, `request_too_large`, `unavailable`. Un `content: []` vide signifie « aucun résultat », pas une erreur. Les recherches en erreur ne sont pas facturées.
3. **`stop_reason: "pause_turn"`** : il faut renvoyer le message assistant tel quel dans une nouvelle requête et **boucler, avec un plafond**. Chaque relance est facturée.
4. `cited_text` fait 150 caractères au maximum. `cited_text`, `title` et `url` ne comptent pas dans les tokens. En revanche, les résultats de recherche sont comptés en **input tokens**.
5. La recherche peut être **désactivée au niveau de l'organisation** (Console → Settings → Privacy) : on obtient alors un 400 `invalid_request_error`. La même page permet de restreindre les domaines.
6. Les citations Anthropic n'ont **pas d'offsets** (pas de start/end index). La position se déduit du bloc `text` qui porte la citation.
7. **Rétention :** il n'y a **pas de paramètre de requête**. Par défaut, les entrées et sorties API sont supprimées « within 30 days » (jusqu'à 2 ans si la requête est signalée par les systèmes Trust & Safety). La **ZDR** est un arrangement **par organisation**, à demander aux ventes (sales). `web_search_20250305` est éligible ZDR, contrairement au dynamic filtering.

---

## 3. Perplexity — Sonar (déprécié le 27/09/2026) et Agent API (successeur)

**URL officielles (consultées le 2026-09-18)**
- Quickstart Sonar : https://docs.perplexity.ai/docs/sonar/quickstart
- OpenAPI Sonar : https://docs.perplexity.ai/api-reference/sonar-post
- Compatibilité OpenAI (alias d'endpoint) : https://docs.perplexity.ai/docs/sonar/openai-compatibility
- Migration Sonar → Agent : https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview et https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to
- OpenAPI Agent : https://docs.perplexity.ai/api-reference/agent-post
- Search API (distincte) : https://docs.perplexity.ai/api-reference/search-post
- Tarifs : https://docs.perplexity.ai/docs/getting-started/pricing
- FAQ (rétention) : https://docs.perplexity.ai/docs/resources/faq

### 3a. Sonar Chat Completions (legacy, supporté jusqu'au 2026-09-27)

**Endpoint :** l'endpoint canonique est désormais **`POST https://api.perplexity.ai/v1/sonar`**. **`POST /chat/completions` est accepté comme alias** : « Perplexity's canonical Sonar API endpoint is `POST /v1/sonar`. For OpenAI SDK compatibility, `POST /chat/completions` is also accepted as an alias. » Headers : `Authorization: Bearer $PERPLEXITY_API_KEY` et `Content-Type: application/json`.

**Modèles (enum) :** `sonar`, `sonar-pro`, `sonar-deep-research`, `sonar-reasoning-pro`.

**Paramètres de recherche :**
- `web_search_options` :
  - `search_context_size` : `low | medium | high`, **défaut `low`** (attention : chez OpenAI, le défaut est `medium`).
  - `search_type` : `fast | pro | auto`, uniquement pour Pro Search avec Sonar Pro, et exige `stream: true`.
  - `user_location` : {latitude, longitude, country, city, region}.
  - `image_results_enhanced_relevance`.
- Paramètres de premier niveau : `search_mode` (`web | academic | sec`), `search_domain_filter`, `search_language_filter`, `search_recency_filter` (`hour…year`), `search_after_date_filter`, `search_before_date_filter`, `last_updated_after_filter`, `last_updated_before_filter` (format MM/DD/YYYY), `disable_search`, `enable_search_classifier`, `return_images`, `return_related_questions`, `reasoning_effort`, `language_preference`, `temperature`, `max_tokens`, `response_format`.

**Requête minimale :**
```json
{ "model": "sonar",
  "messages": [{ "role": "user", "content": "…prompt…" }],
  "web_search_options": { "search_context_size": "low" } }
```

**Réponse minimale (élagage de l'exemple du quickstart) :**
```json
{
  "id": "74c299b6-…", "model": "sonar-pro", "created": 1779896060, "object": "chat.completion",
  "choices": [ { "index": 0, "finish_reason": "stop",
                 "message": { "role": "assistant", "content": "… [1][2][7] …" } } ],
  "citations": [ "https://scienceexchange.caltech.edu/…", "https://aws.amazon.com/what-is/quantum-computing/" ],
  "search_results": [ { "title": "What is Quantum Computing? - AWS", "url": "https://aws.amazon.com/what-is/quantum-computing/",
                        "date": "2026-05-13", "last_updated": "2026-05-18", "snippet": "…", "source": "web" } ],
  "usage": { "prompt_tokens": 28, "completion_tokens": 1541, "total_tokens": 1569,
             "search_context_size": "low", "citation_tokens": null, "num_search_queries": null, "reasoning_tokens": null,
             "cost": { "input_tokens_cost": 8e-05, "output_tokens_cost": 0.02312, "request_cost": 0.006,
                       "citation_tokens_cost": null, "reasoning_tokens_cost": null, "search_queries_cost": null,
                       "total_cost": 0.0292 } }
}
```
Les citations prennent la forme de marqueurs inline `[n]`, qui correspondent à `citations[n-1]` (tableau d'URL). `search_results[].date` peut valoir `null`.

**Distinct de `/search` : CONFIRMÉ.** `POST https://api.perplexity.ai/search` est la **Search API**, qui renvoie des résultats bruts classés, sans LLM. Elle coûte 5 $ / 1 000 requêtes et ne facture aucun token.

### 3b. Agent API (successeur, à utiliser pour W5)

**Endpoint :** `POST https://api.perplexity.ai/v1/agent`, avec les mêmes headers Bearer. Le format est de type « Open Responses ».

**Points clés :**
- `model: "perplexity/sonar"` correspond au modèle Sonar dans l'Agent API.
- **La recherche n'est PAS automatique :** « on the Agent API you turn it on by adding `web_search` to the request's `tools` — otherwise the model answers from its own knowledge ».
- Les `preset` (`fast`, `low`, …) utilisent **des modèles tiers**. D'après les données de tarifs, `fast` utilise `openai/gpt-5.6-luna` ; l'exemple de migration affiche `openai/gpt-5.4-mini`. **Pour mesurer « Perplexity », il ne faut donc PAS utiliser de preset**, mais `model: "perplexity/sonar"`.
- `store: false` est supporté : la réponse n'est alors plus récupérable via GET.

**Requête minimale (champs tirés de l'OpenAPI et du guide de migration) :**
```json
{ "model": "perplexity/sonar",
  "input": "…prompt…",
  "store": false,
  "tools": [ { "type": "web_search", "search_context_size": "low", "max_results": 10,
               "user_location": { "country": "FR" } } ] }
```

**Réponse minimale (élagage de l'exemple de migration et de l'OpenAPI) :**
```json
{
  "id": "resp_…", "object": "response", "created_at": 1784292159, "model": "…", "status": "completed",
  "output": [
    { "type": "search_results", "queries": ["…"],
      "results": [ { "id": 1, "title": "…", "url": "https://…", "snippet": "…",
                     "date": "2026-02-26", "last_updated": "2026-07-12", "source": "web" } ] },
    { "type": "message", "id": "msg_…", "status": "completed", "role": "assistant",
      "content": [ { "type": "output_text", "text": "… [1][3] …", "annotations": [] } ] }
  ],
  "usage": { "input_tokens": 0, "output_tokens": 0, "total_tokens": 0,
             "tool_calls_details": { "…": { "invocation": 0 } },
             "cost": { "currency": "…", "input_cost": 0, "output_cost": 0, "tool_calls_cost": 0, "total_cost": 0 } }
}
```

**Pièges Perplexity**
1. **Date butoir : 2026-09-27** pour Sonar. Après cette date, le comportement de `/v1/sonar` et de `/chat/completions` est NON VÉRIFIÉ (probablement une erreur).
2. Avec l'Agent API, **les `annotations` peuvent être vides** (exemple officiel : `[]`). Le lien de citation se fait via les marqueurs `[n]` du texte → `search_results.results[].id == n`. Sans preset, la doc recommande de **demander explicitement les citations numérotées dans `instructions`**, sinon leur présence n'est pas garantie.
3. La clé exacte de `tool_calls_details` (probablement `"web_search"`) est NON VÉRIFIÉE : l'OpenAPI la déclare en `additionalProperties`.
4. `usage.cost` est fourni par l'API (en USD) : c'est la source de vérité pour le coût par tirage, à préférer à un recalcul.
5. Sonar : `num_search_queries` et `citation_tokens` valent `null` hors Deep Research. Il n'y a donc **pas de compteur de recherches fiable sur Sonar standard** : le coût est un forfait par requête (`request_cost`).
6. Rétention (FAQ) : « By default, the API has zero day retention of user prompt data ».

---

## 4. Tarifs (consultés le 2026-09-18, en USD)

| Modèle | Input / 1M | Cached input / 1M | Output / 1M | Frais de recherche | Source |
|---|---|---|---|---|---|
| **gpt-5-mini** (OpenAI, Standard) | 0,25 $ | 0,025 $ | 2,00 $ | **10 $ / 1 000 appels** web search + **tokens de contenu de recherche facturés au tarif du modèle** | https://developers.openai.com/api/docs/pricing |
| gpt-5.6-luna (alternative OpenAI) | 0,20 $ | 0,02 $ | 1,20 $ | idem | idem |
| **claude-haiku-4-5** (Anthropic) | 1 $ | 0,10 $ (cache read) | 5 $ | **10 $ / 1 000 recherches** + résultats comptés en input tokens | https://platform.claude.com/docs/en/about-claude/pricing |
| claude-sonnet-5 (alternative) | 2 $ | 0,20 $ | 10 $ | idem | idem |
| **sonar** (Perplexity, Sonar API legacy) | 1 $ | — | 1 $ | **frais par requête : 5 $ (low) / 8 $ (medium) / 12 $ (high) pour 1 000 requêtes** | https://docs.perplexity.ai/docs/getting-started/pricing |
| sonar-pro (legacy) | 3 $ | — | 15 $ | 6 $ / 10 $ / 14 $ pour 1 000 requêtes (Pro Search : 14 / 18 / 22) | idem |
| **perplexity/sonar** (Agent API) | 0,25 $ | 0,0625 $ | 2,50 $ | outil `web_search` : **0,0025 $ par invocation** (2,50 $ / 1 000) | idem (bloc de données de tarifs) |
| Search API `/search` (hors périmètre) | — | — | — | 5 $ / 1 000 requêtes | idem |

Notes sur les tarifs :
- OpenAI facture le web search 10 $ / 1k appels pour « all models ». Le tarif de 25 $ / 1k (avec tokens de recherche gratuits) ne concerne que `web_search_preview` sur les modèles non-raisonneurs. Pour gpt-4o-mini et gpt-4.1-mini avec l'outil non-preview, les tokens de contenu de recherche sont facturés comme un bloc fixe de 8 000 tokens d'input par appel. **Cette règle ne s'applique pas à gpt-5-mini.**
- Batch API : -50 % chez OpenAI (gpt-5-mini à 0,125 $ / 1,00 $) et chez Anthropic. L'applicabilité des frais de recherche en batch n'a pas été vérifiée pour OpenAI. Chez Anthropic, la doc indique « priced the same ».
- Formule de coût par tirage :
  - OpenAI : `in×rate_in + out×rate_out + n_search_calls×0,01`.
  - Anthropic : `… + web_search_requests×0,01`.
  - Perplexity : lire `usage.cost.total_cost`.

---

## 5. Synthèse des incertitudes (NON VÉRIFIÉ, à lever par 1 tirage réel par fournisseur)

1. OpenAI : la facturation éventuelle de `open_page` et `find_in_page`, et le contenu exact de `model` dans la réponse de gpt-5-mini.
2. OpenAI : le statut réel de `filters.blocked_domains` (présent dans le guide, absent de la référence).
3. OpenAI : le support de `temperature` par gpt-5-mini.
4. Anthropic : aucune liste officielle ne cite nommément Haiku 4.5 comme compatible web search. La compatibilité est déduite de la doc PTC/allowed_callers, qui prévoit le cas « models that don't support programmatic tool calling ».
5. Perplexity Agent : la clé de `tool_calls_details` et la présence réelle d'`annotations` avec `model: "perplexity/sonar"`.
6. Perplexity : le comportement des endpoints Sonar après le 2026-09-27.
