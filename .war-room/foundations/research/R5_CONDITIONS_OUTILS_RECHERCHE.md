# R5 — Conditions d'utilisation des outils de recherche web des LLM

> **Vérification juridique préliminaire, PAS un avis juridique.** Date de relevé : 2026-09-18.
> Sources : pages officielles des fournisseurs, lues le 2026-09-18. Citations courtes (< 15 mots), traduites entre crochets si besoin.
> « NON VÉRIFIÉ » = information absente des pages officielles lues ou page illisible.

## 0. Usage évalué (rappel)

1. Appel API d'un LLM **avec son outil de recherche web activé**, sur des requêtes type recruteur générées par nous (« trouve-moi 5 freelances pour cette offre »).
2. **Analyse automatique** de la réponse : le client est-il cité ? quelles URLs sont citées ? à quelle position ?
3. **Stockage** des résultats (historique, évolution du score dans le temps).
4. **Vente** au client d'un score de visibilité (et éventuellement affichage des URLs citées).

Points sensibles au regard des clauses : (a) il n'y a pas d'« utilisateur final qui a soumis le prompt » — c'est notre robot ; (b) on **analyse, stocke et monétise** les citations/URLs ; (c) les réponses peuvent contenir des **noms de personnes physiques** (freelances).

---

## 1. OpenAI — Web search tool (Responses API)

| Document | Clause pertinente | URL |
|---|---|---|
| Doc du tool | « inline citations must be made clearly visible and clickable » (quand on affiche des résultats web à l'utilisateur final) | https://developers.openai.com/api/docs/guides/tools-web-search |
| Services Agreement §4.1 (maj 1 déc. 2025, effectif 1 janv. 2026) | Le client « owns all Output » | https://openai.com/policies/services-agreement/ |
| Services Agreement §3.3(f) | Interdit d'« extract data from the Services other than as permitted » | idem |
| Services Agreement §3.4 | Les services tiers restent soumis aux « applicable Third-Party Service Terms » | idem |
| Service Terms §1 (maj 10 sept. 2026) | Pas d'indemnisation si le client a « disabled, ignored, or did not use any relevant citation » ; ni si l'Output vient d'une « Third Party Offering » | https://openai.com/policies/service-terms/ |
| Usage Policies (effectif 29 oct. 2025) | Interdit d'« aggregate, monitor, profile » des informations privées sans autorisation | https://openai.com/policies/usage-policies/ |

**Constat** : aucune clause trouvée interdisant d'analyser, stocker ou revendre les résultats/citations de l'outil de recherche. Seule obligation explicite : afficher les citations de façon visible et cliquable **si** on affiche des résultats web à un utilisateur final.
**Fournisseur d'index sous-jacent pour l'API** : NON VÉRIFIÉ (non documenté dans les pages lues ; la page d'aide ChatGPT cite Bing, mais c'est pour le produit ChatGPT, pas l'API).

**Verdict : COMPATIBLE sous conditions** (le moins contraignant avec Anthropic).

**À demander** :
- Au fournisseur : quel index alimente l'outil de recherche de l'API, et y a-t-il des « Third-Party Service Terms » applicables (via §3.4) ?
- Au juriste : afficher un score dérivé (sans le texte de la réponse) compte-t-il comme « displaying web results » ? Si on montre les URLs citées au client, les rendre cliquables par précaution.
- Au juriste : la collecte automatisée de citations relève-t-elle de §3.3(f) « extract data » ? (lecture probable : non, puisque l'Output appartient au client, mais à confirmer).

---

## 2. Anthropic — Web search tool / Web fetch tool

| Document | Clause pertinente | URL |
|---|---|---|
| Doc web search | Si on affiche les sorties telles quelles, « citations must be included to the original source » | https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool |
| Doc web search (même note) | En cas de retraitement : « display citations as appropriate based on consultation with your legal team » | idem |
| Doc web fetch | Même règle : « include citations to the original source » si affichage direct | https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool |
| Commercial Terms §B (effectif 17 juin 2025) | Le client « owns its Outputs » | https://www.anthropic.com/legal/commercial-terms |
| Commercial Terms §D.4 | Interdit de « resell the Services except as expressly approved » | idem |
| Commercial Terms §A.2 | Les « Third Party Features » ne sont pas des Services | idem |
| Service Specific Terms (effectif 8 juin 2026) | Aucune section dédiée à la recherche web trouvée | https://www.anthropic.com/legal/service-specific-terms |
| Usage Policy (effectif 15 sept. 2025) | Interdit de violer la vie privée, p. ex. « sharing personal information without consent » | https://www.anthropic.com/legal/aup |

**Brave** : aucune clause Brave n'est reprise dans les Commercial Terms ni les Service Specific Terms lus. Le fait qu'Anthropic utilise Brave (et TurboPuffer) comme sous-traitant de recherche web est rapporté par des sources secondaires (Simon Willison, Xponent21) mais **NON VÉRIFIÉ** sur la page officielle des sous-traitants (Trust Center non lu).
Note technique : le contenu brut des résultats est chiffré (`encrypted_content`) ; on reçoit URL, titre et `cited_text` (≤ 150 caractères).

**Verdict : COMPATIBLE sous conditions.** Analyser un Output qui nous appartient n'est pas interdit ; la vente porte sur notre score, pas sur une revente des Services.

**À demander** :
- Au juriste : notre rapport « retraite » les sorties → quelles citations afficher (la doc renvoie explicitement à cette consultation).
- À Anthropic : confirmer par écrit qu'aucune condition du fournisseur de recherche (Brave ou autre) n'est opposable au client API, et que le suivi de visibilité (monitoring GEO) n'est pas vu comme une « resale ».

---

## 3. Perplexity — Sonar API (et Search API, distincte)

| Document | Clause pertinente | URL |
|---|---|---|
| API Terms §2.1(ii) (maj 23 janv. 2026) | Afficher l'Output « solely within the Customer Applications » | https://www.perplexity.ai/hub/legal/perplexity-api-terms-of-service |
| API Terms §2.3.1 | Le client « owns all Output » | idem |
| API Terms §2.5 | Suspension possible si l'application est « competitive with Perplexity » | idem |
| API Terms §2.6 | Modèles tiers soumis aux « Third-Party Terms » listés par Perplexity | idem |
| AUP (maj 8 juil. 2025) | Interdit de « Compromise the privacy of others » (données perso sans base légale) | https://www.perplexity.ai/hub/legal/aup |
| **Search Addendum** (maj 22 sept. 2025) — endpoint `/search` uniquement | « Customer does not own » l'Output de la Search API | https://www.perplexity.ai/hub/legal/perplexity-api-terms-of-service-search |
| Search Addendum §2.2 | Perplexity peut « retain, copy, distribute and otherwise use Search Data » | idem |
| Search Addendum §2.3 | Interdit de soumettre des données personnelles sans accord écrit | idem |

Obligation d'affichage des citations pour Sonar : **aucune trouvée** dans les pages lues (recherche non exhaustive de la doc développeur).

**Verdict** :
- **Sonar : COMPATIBLE** (l'Output nous appartient, pas d'interdiction d'analyser).
- **Search API (`/search`) : AMBIGU** (pas de propriété de l'Output, réutilisation par Perplexity de nos requêtes, interdiction de données personnelles).

**À demander** :
- À Perplexity : un service de mesure de visibilité *dans Perplexity* est-il « competitive with Perplexity » (§2.5) ? Obtenir une confirmation écrite.
- Au juriste : les noms de freelances dans les requêtes/réponses → base légale RGPD (AUP + Search Addendum §2.3).

---

## 4. Google Vertex AI — Grounding with Google Search (et alternatives)

Source : Google Cloud Service Specific Terms, §20(k) (modifié le 16 sept. 2026) — https://cloud.google.com/terms/service-terms

| Clause §20(k)(i) | Citation courte |
|---|---|
| (1) Application | Uniquement dans une application « owned and operated by the Customer » |
| (1) Affichage | Afficher les Grounded Results « to the End User who submitted the prompt » |
| (2) Analyse | Interdit de « cache, frame, syndicate, resell, analyze, train on » les Grounded Results |
| (2) Collecte | Violation : « using programmatic or automated means to collect Links » |
| (3) Stockage | Interdit de « copy, store » ou de faire du « Link-tracking or other monitoring » |
| (3.1) Exception | Stockage ≤ 2 ans seulement pour optimiser l'affichage ou l'historique de chat |
| (4) Intégrité | Interdit de « modify, or intersperse any other content with » les Grounded Results |

**Différence avec la Gemini API** : sur le fond, **aucune**. Mêmes interdictions (« analyze », « resell », stockage ≤ 2 ans). Seule nuance : Vertex permet de ne pas afficher les Search Suggestions sous conditions tarifaires, alors que les conditions Gemini API (maj 2026-04-28) exigent leur affichage — https://ai.google.dev/gemini-api/terms.

**Alternatives Vertex** :
- **Web Grounding for Enterprise** (§20(l)) : §20(k) « also applies » → mêmes interdictions.
- **Agent Search (ex-Vertex AI Search)** (§21) : utiliser seulement des domaines « that it owns or is authorized to utilize » → ne simule pas la recherche web ouverte d'un LLM.
- **Grounding with your search API** (https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-your-search-api) : §20(k) ne vise pas ce mode, mais les résultats viennent alors de *notre* moteur (p. ex. Brave, §6) → ce sont ses conditions qui s'appliquent, et on ne mesure plus « ce que Google/Gemini voit ».

**Verdict : INCOMPATIBLE** (Grounding with Google Search et Web Grounding for Enterprise). Notre usage coche l'analyse, la collecte automatisée de Links, le stockage/monitoring et la revente.

**À demander** :
- À Google Cloud : existe-t-il un accord commercial dédié (mesure de visibilité, audit) dérogeant à §20(k) ? Sans accord écrit, exclure Gemini/Vertex avec grounding du pipeline de scoring.
- Au juriste : mesurer Gemini **sans** grounding (connaissances du modèle seul) échappe-t-il à §20(k) ? (lecture probable : oui, car il n'y a pas de Grounded Results, mais à confirmer ; cela ne mesure pas la même chose).

---

## 5. Microsoft — Grounding with Bing Search (Azure AI Foundry)

Via Foundry, ce sont les **conditions « Enterprise Integration »** qui s'appliquent (novembre 2025) : https://www.microsoft.com/en-us/bing/apis/grounding-legal-enterprise (les conditions hors Foundry, https://www.microsoft.com/en-us/bing/apis/grounding-legal, sont encore plus strictes : copie/stockage/cache interdits sans exception).

| Clause | Citation courte |
|---|---|
| Annexe — usage | Seulement dans des solutions « that are internet search experiences » |
| Annexe — définition | Contenu « responsive to the end user's direct query » + liens cliquables |
| Annexe — références | « retain and display the References in the exact form provided » |
| Annexe 2(e) | Interdit de « Copy, store, or cache » l'Output, sauf exception du TOU |
| §3(c) — exception | Stockage permis comme « integrated part of its own work product » |
| §3(c) — limite | Mais pas pour p. ex. « indexing links contained in the Bing Services Output » |
| §3(b)(l) | Interdit de « Redistribute, resell, or sublicense » l'Output |
| §3(b)(j) | Pas plus que « the minimum data » nécessaire à l'application |
| §2(e) / Annexe 2(b) | Pas d'entraînement, ni « train, evaluate or improve any AI Model » |

**Verdict : INCOMPATIBLE** (au mieux ambigu). Des requêtes générées par notre robot ne répondent pas à la « direct query » d'un utilisateur ; l'indexation/le suivi des URLs citées est donné comme exemple interdit. L'exception « work product » (§3(c)) est la seule piste, à faire valider.

**À demander** :
- Au juriste : un rapport de visibilité client est-il un « work product » au sens de §3(c), sans constituer un « substitute » ni un index de liens ?
- À Microsoft : accord dérogatoire possible pour un usage de mesure/audit ? Sinon, exclure Bing grounding.
- Obligation annexe à noter : lien « Microsoft Privacy Statement » obligatoire dans nos CGU (§4(a)).

---

## 6. Moteurs en direct (simulateur de requêtes X-ray)

### 6a. Brave Search API

Search API Terms of Use (maj 1er sept. 2026) — https://api-dashboard.search.brave.com/terms-of-service

| Clause « Use Restrictions » | Citation courte |
|---|---|
| (i) | Interdit de « store, cache, or create a database of Search Results » (sauf stockage transitoire) |
| (ii) | Interdit de « create derivative works of the … Search Results » |
| (xii) | Interdit de « redistribute, resell, or sublicense the Search Results » |
| (xiii) | Interdit de les utiliser pour « evaluate … benchmark » des modèles ou services d'IA |
| (xiv) | Pas de conservation des résultats après la fin du contrat |
| Attribution | Facultative (« POWERED BY BRAVE » si choisie) |

Page produit : pour stocker les résultats, il faut un plan qui « explicitly grants storage rights » ; ces plans ont des conditions spéciales hors CGU standard — https://brave.com/search/api/

**Verdict : AMBIGU**, voire incompatible avec le plan standard : un historique de positions = stockage/base de données ; un score = œuvre dérivée probable. La clause (xiii) « benchmark … AI services » peut aussi viser un produit qui note la visibilité dans les LLM.

**À demander** : à Brave, un plan « storage rights » avec un usage écrit (mesure de visibilité, historique des positions, rapport client) ; au juriste, la portée de « derivative works » pour un score calculé.

### 6b. Google Programmable Search / Custom Search JSON API

Source : https://developers.google.com/custom-search/v1/overview (page maj 2026-02-18)
- « The Custom Search JSON API is closed to new customers. »
- Les clients existants ont jusqu'au **1er janvier 2027** pour migrer (arrêt du service).
- Google renvoie vers Vertex AI Search (≤ 50 domaines) ou vers une « full web search solution » sur contact commercial.

**Verdict : INCOMPATIBLE (indisponible)**. Fermé aux nouveaux clients, arrêt annoncé le 2027-01-01. La solution « full web search » est NON VÉRIFIÉE : ni ses conditions ni son prix ne sont publics.

---

## 7. Synthèse

| Fournisseur / outil | Interdiction d'analyser/stocker/revendre ? | Obligation d'affichage | Verdict |
|---|---|---|---|
| OpenAI web search | Non trouvée | Citations visibles et cliquables si affichage | Compatible sous conditions |
| Anthropic web search/fetch | Non trouvée (revente des *Services* interdite) | Citations si affichage direct ; sinon avis juridique | Compatible sous conditions |
| Perplexity Sonar | Non trouvée ; risque « competitive » §2.5 | Non trouvée | Compatible (Search API : ambigu) |
| Gemini API grounding | Oui (analyze, resell, cache) | Search Suggestions obligatoires | Incompatible |
| Vertex grounding Google Search | Oui, identique §20(k) + collecte de Links interdite | Afficher à l'utilisateur qui a soumis le prompt | Incompatible |
| Bing grounding (Foundry) | Oui (store/cache, resell, index de liens) | Références intactes, « internet search experience » | Incompatible (au mieux ambigu) |
| Brave Search API direct | Oui sans plan « storage rights » | Attribution facultative | Ambigu |
| Google Custom Search JSON | — | — | Indisponible (arrêt 2027-01-01) |

## 8. Questions transverses pour le juriste

1. **Données personnelles** : les réponses nomment des freelances (personnes physiques). Base légale RGPD pour stocker et analyser ces mentions ? Les politiques d'usage d'OpenAI, Anthropic et Perplexity visent toutes la vie privée.
2. **« Utilisateur final »** : nos requêtes sont automatisées, sans humain qui les soumet. Plusieurs conditions (Google, Microsoft) supposent une requête directe d'un utilisateur final.
3. **Score dérivé vs contenu** : vendre un score calculé revient-il à « revendre » ou « afficher » les résultats ? Cette qualification décide des verdicts ambigus.
4. **Traçabilité** : archiver la version datée de chaque condition (dates relevées ci-dessus). Toutes sont modifiables unilatéralement.
