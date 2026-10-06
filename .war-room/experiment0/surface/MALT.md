# MALT — Profil freelance d'Ayoub Hammoudi (action A6)

> Auteurs : Dr. Elias Voss et Head of Talent · Tâches W13-W14 · 2026-09-18.
> **Aucune automatisation.** Le scraping et l'automatisation de Malt sont interdits (CGU §10.2, `RESEARCH_GROUND_TRUTH.md` §3).
> **Le founder saisit tout lui-même**, dans l'interface Malt, à partir de J1 (2026-09-29) ; action datée dans `actions.log`.
> Si le profil Malt n'existe pas encore : sa création est une action du founder (aucune création de compte par la War Room).
> Codeur.com (optionnel, A6) : réutiliser les mêmes textes, mot pour mot, pour la cohérence d'entité (A8).

## Consignes de saisie

1. Nom affiché : **Ayoub Hammoudi** (identique partout, `COHERENCE.md`). Même photo que LinkedIn et GitHub.
2. Localisation : Paris ; préférence de travail : [À CONFIRMER — sur site / hybride / télétravail, voir `A_CONFIRMER.md` D3].
3. **Tarif journalier** : Malt en demande un pour publier le profil [À CONFIRMER — le vérifier dans l'interface]. La décision
   d'**afficher** un TJM ailleurs (site, `rate: null`) relève de D2 ; sur Malt, le founder saisit le montant qu'il choisit.
4. Disponibilité : la tenir à jour dans Malt **le même jour** que sur le site (`availability.updatedAt`).
5. Liens : site `https://ayoub-hammoudi.dev`, GitHub, LinkedIn (champ « Liens » ou portfolio, selon ce que Malt propose).
6. Aucun marqueur `[À CONFIRMER]` ne doit rester dans le texte saisi.

---

## 1. Titre du profil

```
Développeur Full Stack TypeScript / Next.js & AI/LLM Engineer (RAG, évaluations LLM, agents)
```

Variante courte si Malt limite la longueur : `Full Stack TypeScript / Next.js & AI/LLM Engineer`.
« Senior » : non utilisé tant que D1 n'est pas tranché (`A_CONFIRMER.md`).

## 2. Description (« À propos »)

```
Ingénieur logiciel full stack à Paris, freelance depuis 2022. Je construis des applications TypeScript / Next.js et des systèmes à base de grands modèles de langage (LLM), et j'annonce uniquement des chiffres que l'on peut vérifier dans un dépôt.

Ce que je peux prendre en charge
• Une application web TypeScript / Next.js / React de l'architecture au déploiement : API, Prisma / PostgreSQL, tests Vitest et Playwright, Lighthouse CI.
• Une fonctionnalité LLM fiable : agents orchestrés de façon durable (Inngest, idempotence Redis), évaluations à seuils (accuracy, F1, MAE, Spearman), red-teaming NVIDIA Garak, défense contre l'injection de prompt, grounding contre les chiffres inventés, RAG (LangChain, FAISS).
• Un pipeline de données : streaming Kafka et Spark Structured Streaming, orchestration Airflow, datalake Bronze/Silver/Gold, graphe Neo4j.

Références vérifiables
• Phantera (produit propre) : SaaS B2B d'agents LLM en Next.js 16 ; 222 tests verts, 56 routes API, 0 erreur TypeScript et ESLint.
• Spar-X : site de production Next.js 15 / React 19 d'un cabinet de conseil IA et Data ; 9 specs Playwright, Lighthouse CI.
• AFTERSHOCK : datalake sur 17 526 séismes USGS et 7 939 versions archivées ; rejeu après arrêt brutal prouvé par script, sans duplication.
• Taintrace : criblage de sanctions et traçage de contamination Bitcoin sur n sauts dans Neo4j ; 9 services Docker.

Formation : ingénieur en génie logiciel (ESPRIT, 2025), Mastère Ingénierie logicielle, IA et Big Data (IPSSI, en cours). Français, anglais, arabe.
Études de cas détaillées : https://ayoub-hammoudi.dev
```

Sources : identiques à `LINKEDIN.md` §2 (tableau des sources) et aux `facts` de `hub/ayoub.profile.json`.

## 3. Compétences (ordre de saisie, les 5 premières sont les plus visibles)

Uniquement des compétences portées par une mission ou un projet vérifié :

| # | Compétence | Portée par |
|---|---|---|
| 1 | TypeScript | Phantera, Spar-X, FCT |
| 2 | Next.js | Phantera (16), Spar-X (15) |
| 3 | React | Spar-X (19), Phantera |
| 4 | LLM (évaluation, agents) | Phantera `lib/evals`, `lib/agents` |
| 5 | Node.js | Phantera, CFP Hub (Fastify) |
| 6 | RAG | SoulReader (LangChain, FAISS) |
| 7 | PostgreSQL | Phantera (Neon) |
| 8 | Prisma | Phantera, CFP Hub |
| 9 | Python | AFTERSHOCK, Taintrace |
| 10 | Apache Kafka | AFTERSHOCK, Taintrace, CFP Hub |
| 11 | Apache Spark | AFTERSHOCK |
| 12 | Apache Airflow | AFTERSHOCK, Taintrace |
| 13 | Neo4j | Taintrace |
| 14 | Docker | AFTERSHOCK, Taintrace, CFP Hub |
| 15 | Playwright | Spar-X, FCT |
| 16 | Tailwind CSS | Spar-X |
| 17 | LangChain | SoulReader |
| 18 | MongoDB | Taintrace |
| 19 | Vitest | Phantera, Spar-X |
| 20 | Inngest | Phantera |

Non listées volontairement : **LangGraph** (absent du code de Phantera), **Kubernetes** (aucune preuve), Ruby on Rails (hors cible).

## 4. Texte de mission (référence Malt « Expérience / Projet »)

À saisir comme référence, une par mission. Texte principal :

**Titre :** Site de production Next.js 15 pour un cabinet de conseil IA et Data (Spar-X)
**Période :** mars 2026 – mai 2026 · **Rôle :** Développeur Full Stack freelance
[À CONFIRMER : relation client et accord pour citer Spar-X, `A_CONFIRMER.md` C1]

```
Contexte : un cabinet de conseil IA et Data pour PME avait besoin d'un site de production rapide, accessible et bien référencé.

Réalisation : site livré de bout en bout en Next.js 15 (App Router), React 19, TypeScript strict et Tailwind CSS ; 50 composants React ; blog MDX (Contentlayer) ; e-mails transactionnels (React Email, Resend) ; données structurées JSON-LD ; notification IndexNow.

Qualité : 9 spécifications Playwright de bout en bout (accessibilité, SEO, performance, test de fumée en production), tests Vitest et Lighthouse CI à chaque déploiement.

Résultat : site en ligne sur spar-x.fr.
```

Sources : dépôt `spar-x-tech` (`MyOwnBangers/FirstDownTech`) : `package.json`, `e2e/` (9 fichiers), `components/` (50 `.tsx`),
`.lighthouserc.js`. Période : CV 2026 (`employment.tex`).

Autres références possibles (même format, reprendre le `summary` et les `facts` de `hub/ayoub.profile.json`) :
Phantera (produit propre, à présenter comme tel, pas comme client), AFTERSHOCK et Taintrace (projets de Mastère : les présenter
comme tels, jamais comme missions client).
