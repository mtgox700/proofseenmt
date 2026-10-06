# SPRINT 1 — « Instrument + J0 » (2026-09-21 → 2026-10-04)

> Référence : `ROADMAP.md` §3 S1 + bloc CORRECTIONS · `foundations/CAHIER_DES_CHARGES.md` · `MEASUREMENT_SPEC.md` (corrections).
> Contradiction signalée : le corps de ROADMAP S1 mentionne encore 1 040 appels, 4 adaptateurs et « `sim-extract` sous 7 jours ».
> **TEAM_MEMORY l'emporte : 780 appels, 3 moteurs, masquage à l'ingestion, brut 72 h.**
> Règles : **aucune commande git** (le founder gère), aucun code SaaS, **aucun appel API payant sans « GO API »**.

## Objectif

L'instrument de mesure V0 est prêt, testé et relu, pour que le founder puisse réaliser J0 le **2026-09-28**. Les kits de l'expérience 0,
de la pré-vente et du juridique sont prêts à l'emploi.

## Tâches [WAR ROOM]

| id | Tâche | Owner | Estim. | Dépend. | Definition of Done |
|---|---|---|---|---|---|
| W1 | Monorepo pnpm (TS strict, vitest `pool: forks`, ESLint, tsup), `.env.example`, `.gitignore` | Architect + Maxwell | 2 h | — | `pnpm install`, `typecheck`, `lint`, `test`, `build` exécutés avec succès (sorties collées) |
| W2 | `packages/core` : schémas zod (Identity, OwnedUrl, JobDescription, Cluster, PromptTemplate, Manifest, Draw, Match) + nettoyage de JD | Backend Craftsman | 3 h | W1 | Tests : validation, rejet des entrées invalides, JD nettoyée (e-mail, téléphone, URL), rejet des JD contenant l'identité du client |
| W3 | `packages/stats` : Wilson, bootstrap par grappe (2 000 itérations, graine fixe), DiD, funnel E1-E5, SoRV@5, règle « rendu visible » | Retrieval Scientist + QA | 4 h | W1 | TDD ; valeurs de Wilson vérifiées contre des valeurs de référence calculées indépendamment ; couverture ≥ 80 % |
| W4 | Vérification de la documentation des 3 API (paramètres de recherche web, `store`, `max_uses`, citations, modèle Sonar, tarifs) | docs (sous-agent) | 1 h | — | Rapport `sprints/S1_API_DOCS.md` avec URL et date |
| W5 | `packages/engines` : `runDraw`, 3 adaptateurs, retry avec backoff, coût par tirage, garde de budget, mode `--dry-run` sur fixtures | Backend Craftsman | 5 h | W2, W4 | Tests sur fixtures ; aucun réseau en test ; le nom du client n'apparaît jamais dans un prompt (test) |
| W6 | `packages/extract` : extraction (interface LLM sans outils + fixture), appariement en mémoire, masquage des tiers, liste blanche de domaines, pseudonymisation, AES-256-GCM, purge 72 h | Backend Craftsman + Security Sentinel | 5 h | W2 | Tests : corpus de noms FR/EN, fixtures d'injection, **aucun nom de tiers sur le disque** ; couverture ≥ 80 % |
| W7 | `apps/cli` : `sim-run`, `sim-extract`, `sim-report`, `sim-purge` | Architect | 4 h | W3, W5, W6 | Vague complète en `--dry-run` → rapport Markdown généré |
| W8 | Kit expérience 0 : gabarits, checklist J0, procédure US-F00, checklist `ayoub-hammoudi.dev` | Retrieval Scientist + Elias | 2 h | W2 | Fichiers dans `.war-room/experiment0/`, gabarits JSON validés par les schémas zod |
| W9 | Kit pré-vente et juridique : page d'offre, brief juriste, demandes Anthropic et Perplexity, consentement, script d'interview, 20 profils cibles | Victoria + Legal + Head of Talent | 3 h | — | Fichiers dans `.war-room/presale/` ; aucune promesse de résultat ; aucun nom inventé |
| W10 | Revues : typescript-reviewer, security-reviewer, red-team Scenario Hunter | QA + Security + Scenario Hunter | 2 h | W7 | Constats CRITIQUES et HAUTS corrigés ; le reste dans `S1_REVIEW.md` |
| W11 | Vérification finale + clôture (ROADMAP, TEAM_MEMORY) | QA + Orchestrator | 1 h | W10 | Sorties réelles des commandes collées |

## Tâches [FOUNDER] (charge estimée ~12-15 h, HYPOTHÈSE)

| id | Tâche | Avant le | Estim. |
|---|---|---|---|
| F1 | `git init` dédié + commits (le founder seul) | 2026-09-21 | 0,5 h |
| F2 | Comptes API OpenAI, Anthropic, Perplexity : **plafonds de facturation**, acceptation des conditions et DPA, clés dans `.env` | 2026-09-26 | 1,5 h |
| F3 | Preuve de possession de ses URL (US-F00) : `ayoub-hammoudi.dev`, GitHub, LinkedIn | 2026-09-26 | 1 h |
| F4 | Vérifier `ayoub-hammoudi.dev` avec la checklist d'Elias | 2026-09-26 | 1 h |
| F5 | Collecter à la main les 13 JD (10 cibles, 3 témoins) et les coller dans le manifeste | 2026-09-26 | 2 h |
| F6 | **Confirmer le seuil de 10 % et le plafond de 50 $/vague**, puis geler le manifeste | 2026-09-27 | 0,5 h |
| F7 | Envoyer les demandes écrites à Anthropic et Perplexity ; contacter un juriste | 2026-10-02 | 1 h |
| F8 | Inviter les recruteurs (consentement joint) ; en planifier au moins 3 | 2026-10-02 | 1,5 h |
| F9 | **« GO API »** puis mesure J0 (API + échantillon manuel + captures d'indexation) | **2026-09-28** | 4 h |

## Arbitrage du board sur le périmètre

- **Maxwell** : le juge LLM des appariements « probables » (REQ-M2-02) est **reporté à S2**. En S1, un appariement « probable » est déterministe
  (nom normalisé + un attribut concordant) et **marqué à revoir**. Il ne compte **pas** dans la north star, qui n'utilise que les « certains » (URL vérifiée).
  Écrire aujourd'hui un juge qu'on ne peut pas tester en réel serait du code non vérifié.
- **Security Sentinel** : le masquage repose sur (1) les candidats extraits et (2) une détection heuristique de secours (lexique de prénoms + motifs d'URL de profil).
  C'est **volontairement trop large** : mieux vaut masquer un mot de trop qu'un nom de trop. Ce n'est **pas** un NER exhaustif, et c'est documenté.
- **Ce qui glisse si la capacité du founder manque** : F7 et F8 peuvent passer en S2 sans bloquer J0 ; F2, F3, F5, F6 et F9 sont **bloquants** pour J0.
