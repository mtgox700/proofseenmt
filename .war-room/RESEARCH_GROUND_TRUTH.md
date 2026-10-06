# RESEARCH GROUND TRUTH — Phase 1 (2026-09-18)

> Synthèse des 4 recherches parallèles. Détails et URLs complètes : `research/A_RETRIEVAL_LLM.md`,
> `research/B_PLATEFORMES.md`, `research/C_CONCURRENCE.md`, `research/D_MARCHE.md`.
> Légende : **PROUVÉ** = source primaire · **CORRÉLATION** = étude observationnelle · **HYPOTHÈSE** = non sourcé.

## 1. Le scénario du founder confronté au réel

Le founder imagine un LLM qui « va sur LinkedIn / free-work / Malt ». En réalité, **trois canaux coexistent**
et aucun ne ressemble exactement à ce scénario :

| Canal | Comment ça marche | Ce qui décide du classement | Mesurable par nous ? |
|---|---|---|---|
| **1. Index ouvert** | Le LLM interroge un index de recherche puis synthétise : ChatGPT → hybride/Bing/propre ; Claude → **Brave** ; Perplexity → propre ; Gemini → **Google** ; Copilot → **Bing** (A : S3, S12, S16, S21, S27) | Présence dans l'index, texte visible, mentions tierces, fraîcheur | **Oui**, via les API officielles |
| **2. Agent dans le navigateur du recruteur** | Claude in Chrome/Cowork, Comet, ChatGPT agent naviguent **avec la session connectée du recruteur** (A : S10, S15, S19) | Le **moteur de recherche interne** de la plateforme (LinkedIn Search, Malt) | **Non**, sans violer les CGU |
| **3. Bases propriétaires branchées au LLM** | Upwork dans ChatGPT (09/04/2026), SeekOut en MCP dans Claude/ChatGPT/Gemini/Copilot, LinkedIn Hiring Assistant (C) | Le ranking de la plateforme | **Non** |

**Conséquence** : « coller une URL LinkedIn dans ChatGPT » échoue. ChatGPT-User, Claude-User et
Perplexity-User sont **bloqués** par le robots.txt de LinkedIn, alors qu'OAI-SearchBot, Claude-SearchBot,
Googlebot et Bingbot peuvent indexer `/in/` (B, vérifié en direct). Un profil LinkedIn remonte donc **via l'index**,
jamais par un fetch direct.

## 2. Ce qui fait (ou ne fait pas) ressortir une page

| Levier | Verdict | Preuve |
|---|---|---|
| Être indexé par Google **et** Bing **et** Brave | **PROUVÉ** : chaque assistant dépend d'un index différent | A : S12, S21, S27 |
| HTML visible rendu côté serveur (pas de SPA) | **PROUVÉ** : les crawlers IA ne rendent pas le JS, web fetch non plus | A : S11, S14, S26 |
| Autoriser OAI-SearchBot / Claude-SearchBot / PerplexityBot | **PROUVÉ** : un site qui bloque OAI-SearchBot n'apparaît pas dans ChatGPT search | A : S6, S13, S18 |
| Mentions tierces cohérentes (plutôt que backlinks) | **CORRÉLATION** forte (Spearman 0,664 contre 0,218) | A : S32 |
| Fraîcheur | **CORRÉLATION** : contenu cité 25,7 % plus frais ; ChatGPT le plus sensible | A : S34 |
| Statistiques et citations dans le texte | **PROUVÉ en benchmark** (jusqu'à +40 %), pas en production | A : S31 |
| **JSON-LD / schema.org** | **AUCUN gain démontré** (différence-de-différences, 1 885 pages ; « not read by AI chatbots » en fetch direct) | A : S35, S26, S21 |
| **llms.txt** | **Quasi inutile** : 97 % des fichiers ne reçoivent aucune requête | A : S36 |
| LinkedIn | **Domaine n°1 cité** pour les requêtes pro, et la part des **posts/articles** monte (34,9 %) quand celle des profils baisse (14,5 %) | A : S39 |

⚠ **Mon brouillon (`PLAN_V0_DRAFT.md`) est contredit** : la brique « Profile Graph = JSON-LD + llms.txt »
repose sur deux leviers que les données réfutent. B recommandait encore le JSON-LD ; A le réfute par une étude
causale. **A l'emporte.**

## 3. Exposition des plateformes (relevé en direct)

- **Visibles** pour les LLM : GitHub > LinkedIn > Malt > Codeur > dev.to/Medium.
- **Invisibles** (aucun profil public) : **Free-Work, WTTJ, Comet, Crème de la Crème**. Leurs profils ne servent qu'au matching interne.
- Aucune plateforme n'est lisible par les 4 LLM : Perplexity est aveugle sur LinkedIn, GPTBot sur Malt et Medium.
- **Scraping interdit** : LinkedIn, Malt §10.2, WTTJ, Upwork, Stack Overflow ; GitHub interdit la revente aux recruteurs.

## 4. Concurrence

- **Aucun produit** ne mesure la visibilité d'une **personne** face à une **JD** dans les LLM (C, §5).
- Le GEO de marque est **financé et validé** : Profound valorisé 1 Md$, Peec ~10 M$ d'ARR selon TechCrunch.
  Le standard de mesure existe : multi-moteurs, **échantillonnage répété** (Evertune : 100 tirages par prompt).
- Disposition à payer B2C (outils CV/ATS) : **~25-50 $/mois**, en abonnements courts.
- **Cimetière du portfolio** : Read.cv, Polywork et bento.me ont fermé en 13 mois.
- **Menace n°1** : le sourcing via LLM bascule vers les **bases propriétaires** (Upwork app, SeekOut MCP,
  Hiring Assistant). Menaces secondaires : Peec/Otterly/Profound peuvent ajouter une entité « Personne » ;
  Malt peut exposer gratuitement son score de matching.

## 5. Marché

| Indicateur | Valeur | Statut |
|---|---|---|
| Freelances IT France | ~120 000 | secondaire, non retrouvé à l'INSEE |
| Salariés portés / sociétés de portage | 43 127 / 518 (2022) | PROUVÉ (PEPS) |
| Adhérents Numeum (ESN) | ~2 500 | PROUVÉ |
| TJM confirmé | 450-600 €/jour | plusieurs sources |
| Freelances qualifiés aux US | ~30 M | PROUVÉ (Upwork 2023) |
| Recruteurs qui testent/intègrent la GenAI | 37 % | PROUVÉ (LinkedIn 2025) |
| **Recruteurs qui sourcent via ChatGPT ou Claude** | **INCONNU** : aucune enquête publique | **HYPOTHÈSE CENTRALE NON VALIDÉE** |

Arithmétique (D) : 500 K€/mois en B2C France seule = 10 200 abonnés à 49 €, soit **6 à 8,5 % du marché adressable → irréaliste**.
En B2B à 1 500 € : 333 comptes sur ~3 000 structures (portage + ESN) = ~11 % → ambitieux mais concevable.

## 6. Les 5 vérités qui structurent la suite

1. **La demande n'est pas prouvée.** Personne ne sait quelle part des recruteurs source via un LLM. C'est le premier risque, avant la technique.
2. **Le canal 1 (index ouvert) est le seul mesurable et optimisable honnêtement** par un tiers.
3. **Les leviers sont banals et prouvés** (indexation, HTML visible, mentions, fraîcheur, preuves chiffrées).
   La valeur n'est donc pas dans l'astuce : elle est dans **la mesure et la boucle de correction**.
4. **Il existe un trou réel** (aucun GEO « personne × JD »), mais les acteurs du GEO de marque peuvent le combler vite.
5. **La France seule ne suffit pas pour atteindre 500 K€/mois** : il faut du B2B et/ou l'international.

## 7. Inconnues à lever en priorité

| # | Inconnue | Comment la lever | Qui |
|---|---|---|---|
| U1 | Part des recruteurs qui sourcent via un LLM | 15-20 interviews + sondage | Founder (Head of Talent fournit le script) |
| U2 | Les LLM acceptent-ils de **nommer des individus** dans une réponse de sourcing ? (garde-fous RGPD) | Test J0 de l'expérience 0 | Founder |
| U3 | Écart entre résultats API et app grand public | Calibration manuelle | Founder |
| U4 | Statut actuel de Brave comme index de Claude | Test + Trust Center | Elias |
| U5 | Coût réel par appel des outils de recherche des API | Grilles tarifaires officielles | Maxwell |
