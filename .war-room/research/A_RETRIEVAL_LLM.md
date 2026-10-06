# Recherche A — Comment les LLM récupèrent le web (Retrieval Scientist, 2026-09-18)

> Rapport brut du sous-agent. « daté » = source de plus de 12 mois. Les pages help.openai.com et le
> Trust Center d'Anthropic n'ont pas pu être lus directement (403 ou JS) : les points qui en
> dépendent reposent sur des sources secondaires.

## 1. Par assistant

| Assistant | Index | User-agents | robots.txt | Login / JS |
|---|---|---|---|---|
| **ChatGPT** | **Hybride** : fournisseurs tiers, Bing « important » (S1-S2, daté) ; index propre en construction depuis 2023, objectif 80 % « nowhere near close » (S3, avril 2025, daté) ; Semrush suggère un repli sur Google (S5, août 2025) | GPTBot : entraînement ; **OAI-SearchBot** : index de ChatGPT search (un site qui le bloque n'apparaît pas dans ChatGPT search) ; ChatGPT-User : fetch utilisateur (S6) ; l'agent navigue avec l'UA d'un navigateur et Web Bot Auth (S7-S8) | GPTBot et OAI-SearchBot : oui ; ChatGPT-User : « may not apply » (S6), mais il s'arrête sur robots.txt dans le test Cloudflare (S9) | Agent : pour un login, l'utilisateur prend la main (S10) ; les crawlers ne rendent pas le JS (S11, daté) |
| **Claude** | **Brave Search** depuis le 19/03/2025 (S12, daté ; statut actuel non vérifié) | ClaudeBot : entraînement ; **Claude-SearchBot** : recherche ; **Claude-User** : fetch utilisateur (S13, avril 2026) | **Les 3 bots respectent robots.txt** (S13) ; web fetch renvoie `url_not_allowed` (S14) | Web fetch : pas de JS, uniquement des URL déjà présentes dans la conversation (S14) ; **Claude in Chrome / Cowork utilise les sessions connectées de l'utilisateur** (S15) |
| **Perplexity** | **Index propriétaire** (Vespa, S16-S17) | PerplexityBot : index ; Perplexity-User : fetch ; Comet : navigateur connecté (S18-S19) | PerplexityBot : oui ; Perplexity-User ignore généralement robots.txt ; **controverse Cloudflare** : crawlers furtifs, statut de bot vérifié retiré (S9, S20) | Pas de JS pour PerplexityBot ; Comet = vrai navigateur |
| **Gemini / AI Overviews / AI Mode** | **Index Google** : la page doit être indexée et éligible au snippet ; **query fan-out** (S21) | Googlebot ; Google-Extended = jeton d'entraînement/grounding, **sans effet sur Search** ; Google-Agent (S23-S25) | Googlebot : oui ; fetchers utilisateur : généralement non (S24) | Rendu JS complet (S11) |
| **Copilot** | **Index Bing** ; Bing Webmaster Tools « AI Performance » suit les citations dans Copilot (S27) ; API Bing publique retirée le 11/08/2025 (S28) | Bingbot ; NOARCHIVE / NOCACHE contrôlent l'usage dans Copilot (S29, non vérifié en direct) | oui (HYPOTHÈSE standard) | NON VÉRIFIÉ |

**LinkedIn** : son robots.txt autorise pleinement seulement LinkedInBot ; Googlebot, Bingbot et une trentaine d'autres sont restreints par chemins ; GPTBot, OAI-SearchBot, ClaudeBot et PerplexityBot ne sont pas nommés ; l'accès automatisé est interdit sans permission (S30, vérifié le 2026-09-18). Un LLM voit donc LinkedIn **via l'index Google/Bing** ou **via un agent dans le navigateur connecté du recruteur**.

## 2. Facteurs de citation

| Facteur | Constat | Source |
|---|---|---|
| Papier GEO (KDD 2024) | jusqu'à +40 % de visibilité ; les plus efficaces : statistiques et citations. Benchmark simulé, pas la production | S31 |
| **Mentions de marque plutôt que backlinks** | AI Overviews (Spearman) : mentions 0,664 / ancres 0,527 / volume de marque 0,392 / DR 0,326 / backlinks 0,218 | S32 (mai 2025) |
| Fraîcheur | contenu cité 25,7 % plus frais que dans les SERP ; ChatGPT est le plus sensible | S34 (juil. 2025) |
| **JSON-LD** | **Aucun gain démontré** : différence-de-différences sur 1 885 pages → AI Overviews −4,6 %, AI Mode +2,4 % et ChatGPT +2,2 % (non significatifs) ; « JSON-LD is NOT read by AI chatbots » en fetch direct | S35 (mai 2026), S26, S21 |
| **llms.txt** | 97 % des fichiers ne reçoivent aucune requête (137 k domaines) ; Google : pas besoin de fichiers dédiés à l'IA | S36 (juin 2026), S21 |
| **LinkedIn** | **domaine n°1 pour les requêtes pro sur 6 plateformes** ; part des *profils* 33,9 % → 14,5 %, part des *posts et articles* 26,9 % → 34,9 % | S39 (mars 2026) |
| LinkedIn dans AI Mode | cité dans près de 15 % des réponses | S38 |
| Erreurs 404 | ~34 % des fetchs de ChatGPT et Claude, contre 8 % pour Googlebot | S11 (daté) |

## 3. Implications pour un profil freelance

1. PROUVÉ : il faut être indexé par **Google, Bing et Brave** (un index par assistant).
2. PROUVÉ : autoriser OAI-SearchBot, Claude-SearchBot, Claude-User et PerplexityBot sur le site perso.
3. PROUVÉ : **HTML statique rendu côté serveur** ; une SPA côté client est illisible pour ces bots.
4. PROUVÉ (négatif) : llms.txt et schema.org ne sont **pas** des leviers de citation ; tout doit être en **texte visible**.
5. PROUVÉ (corrélation) : LinkedIn est la source n°1, avec une bascule des profils vers les posts et articles.
6. PROUVÉ (corrélation) : les mentions tierces comptent plus que les backlinks.
7. PROUVÉ : la fraîcheur compte, surtout pour ChatGPT.
8. HYPOTHÈSE : une JD collée déclenche un query fan-out → des pages qui reprennent intitulé, stack, localisation et mode, avec des chiffres vérifiables, seraient favorisées. À tester par notre banc de mesure.

## Sources
S1 https://openai.com/index/introducing-chatgpt-search/ · S2 https://yoast.com/chatgpt-search/ · S3 https://www.bloomberg.com/news/articles/2025-04-22/chatgpt-chief-calls-search-crucial-for-openai-in-google-trial · S4 https://peec.ai/blog/chatgpt-built-its-own-search-index · S5 https://www.semrush.com/blog/chatgpt-definitely-uses-google/ · S6 https://developers.openai.com/api/docs/bots · S7 https://help.openai.com/en/articles/11845367-chatgpt-agent-allowlisting · S8 https://blog.cloudflare.com/signed-agents/ · S9 https://blog.cloudflare.com/perplexity-is-using-stealth-undeclared-crawlers-to-evade-website-no-crawl-directives/ · S10 https://help.openai.com/en/articles/11752874-chatgpt-agent · S11 https://vercel.com/blog/the-rise-of-the-ai-crawler · S12 https://simonwillison.net/2025/Mar/21/anthropic-use-brave/ · S13 https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler · S14 https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool · S15 https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome · S16 https://theaiengineer.substack.com/p/how-perplexity-built-their-search · S17 https://www.infoworld.com/article/4064296/ · S18 https://docs.perplexity.ai/guides/bots · S19 https://www.humansecurity.com/ai-agent/perplexity-comet/ · S20 https://www.searchenginejournal.com/cloudflare-delists-and-blocks-perplexity-from-crawling-websites/552899/ · S21 https://developers.google.com/search/docs/appearance/ai-features · S22 https://ai.google.dev/gemini-api/docs/google-search · S23 https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers · S24 https://developers.google.com/search/docs/crawling-indexing/google-user-triggered-fetchers · S25 https://www.seo-kreativ.de/en/blog/google-user-agent-for-ai-agents-explained/ · S26 https://www.searchviu.com/en/schema-markup-and-ai-in-2025-what-chatgpt-claude-perplexity-gemini-really-see/ · S27 https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview · S28 https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement · S29 https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/ · S30 https://www.linkedin.com/robots.txt · S31 https://arxiv.org/abs/2311.09735 · S32 https://ahrefs.com/blog/ai-overview-brand-correlation/ · S33 https://www.businesswire.com/news/home/20260526119691/en/ · S34 https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/ · S35 https://ahrefs.com/blog/schema-ai-citations/ · S36 https://ahrefs.com/blog/llmstxt-study/ · S37 https://www.tryprofound.com/blog/ai-platform-citation-patterns · S38 https://www.semrush.com/blog/most-cited-domains-ai/ · S39 https://www.tryprofound.com/blog/linkedin-is-the-most-cited-domain-for-professional-queries-in-ai-search
