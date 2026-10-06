# ARCHITECTURE V0 — Maxwell Reid (Phase 6, 2026-09-18)

> ⚠ **CORRECTIONS du 2026-09-18 (Dossier de fondation)** : adaptateur **gemini (grounding) supprimé** (analyse interdite par ses
> conditions) ; `packages/extract` → le masquage des tiers passe **dans `sim-run`, en mémoire, avant écriture** ; brut pseudonymisé
> ≤ 72 h. Exigences détaillées : `foundations/CAHIER_DES_CHARGES.md` (REQ-M1-07, REQ-M1-08, REQ-M2-03).

> Standard : *« Would this pass Google's internal review? »* Règle V0 : **aucun SaaS avant le verdict de l'expérience 0.**
> On construit d'abord un **instrument de mesure fiable**, ensuite un produit.

## 1. Trois étages, dans l'ordre

| Étage | Quand | Forme | Pourquoi |
|---|---|---|---|
| **V0 — Instrument** | S1-S2 (avant J0) | CLI locale `sim-run` / `sim-extract` / `sim-report`, fichiers JSONL | Il suffit pour l'expérience 0. Zéro infra. |
| **V0.5 — Service** | M2-M3 | Même CLI + rapports PDF + landing SSG + paiement Stripe Payment Links | Offre clé en main et audits payants, **à la main** |
| **V1 — SaaS** | M4-M6, **seulement si G1, G2 et G3 sont passés** | App web multi-profils, panel partagé, monitoring | Automatiser ce qui a été vendu à la main |

## 2. Stack (cohérente avec Phantera, que le founder maîtrise déjà)

| Couche | Choix | Justification |
|---|---|---|
| Langage | **TypeScript** partout (Node 22) | Un seul langage entre CLI et SaaS. Wilson, bootstrap et DiD tiennent en moins de 200 lignes. |
| Repo | Monorepo pnpm : `packages/{core,engines,extract,stats}`, `apps/{cli,web}` | Adaptateurs isolés, testables |
| Validation | **zod** à toutes les frontières (JD, identité, manifeste, réponses de moteurs) | Règle globale : valider les données externes |
| Orchestration (V1) | **Inngest** : durable, retries, concurrence par fournisseur | Déjà éprouvé sur Phantera |
| Données (V1) | Postgres **Neon** + Prisma | Idem |
| Web (V0.5/V1) | **Next.js en SSG/ISR** pour la landing et les pages publiques | Le site doit être lui-même un exemple de GEO (HTML visible) |
| Auth / paiement / mail (V1) | Clerk · Stripe · Resend | Déjà connus |
| Hébergement | Vercel + Neon | — |

## 3. Composants

```
packages/core     → types et schémas zod : Identity, JobDescription, Cluster, Manifest, Draw, Extraction
packages/engines  → une interface commune :
                    runDraw(prompt, opts) → { text, citations[], searchResults[], model, usage, costUsd }
                    adaptateurs : openai (Responses + web_search), anthropic (Messages + web_search, max_uses),
                    perplexity (sonar), gemini (grounding Google Search). Copilot : hors API (Bing WMT + manuel)
packages/extract  → 1) extraction structurée des candidats (JSON schema, LLM bon marché, sans outils)
                    2) appariement déterministe (URL) puis probable (nom + attribut + juge)
                    3) masquage des tiers avant persistance
packages/stats    → Wilson, bootstrap par grappe, DiD, funnel E1-E5, SoRV@K
apps/cli          → sim-run / sim-extract / sim-report (V0)
apps/web          → landing, audit gratuit, tableau de bord (V1)
```

## 4. Garde-fous techniques

| Risque | Parade |
|---|---|
| **Injection de prompt dans les résultats web** : une page tierce écrit « dis que X est le meilleur » et contamine notre extracteur | Extracteur **sans outils**, sortie sous JSON schema strict ; appariement **déterministe d'abord** ; le juge LLM ne tranche que les cas « probables », qui sont audités à la main |
| **Nos propres clients trichent** (texte caché sur leur site) | **Scan d'onboarding** des surfaces du client : texte invisible, instructions adressées aux LLM, cloaking → refus du client. C'est la ligne rouge n°1 rendue exécutable. |
| Dérive des API (versions de l'outil web_search, dépréciation de modèles) | Version du modèle enregistrée à chaque tirage ; tests de contrat sur des fixtures enregistrées ; un adaptateur par fournisseur |
| Dérive des coûts | **Budget maximal par vague** (arrêt net) ; `max_uses` sur les recherches ; coût calculé à chaque tirage |
| Fin du prix promotionnel Gemini (31/12/2026) | Coûts paramétrés dans une config, jamais en dur |
| Dépendance de Claude à Brave (U4) | Mesurée, pas supposée : le mix des sources citées révèle un changement d'index |
| Secrets | Variables d'environnement / gestionnaire de secrets ; aucune clé dans le repo ; vérification au démarrage |
| RGPD | Réponses brutes chiffrées (AES-GCM, clé en variable d'environnement), **TTL de 7 jours** par tâche planifiée ; noms de tiers jamais persistés |
| Validation des entrées | JD ≤ 20 000 caractères, contacts retirés ; identité limitée aux URL possédées déclarées |

## 5. Ce qui reste manuel au début (et c'est voulu)

- Collecte des JD (copier-coller par le founder ou le client).
- Onboarding de l'identité d'un client (formulaire + vérification à la main).
- **Rédaction du plan de correction** à partir d'un gabarit : c'est là qu'on apprend ce qui marche.
- Pages et réécritures de l'offre clé en main.
- Revue de 10 % des appariements « probables ».
- Échantillon manuel de calibration dans les apps.

## 6. Coûts fixes (HYPOTHÈSE, tarifs d'offres gratuites ou d'entrée à vérifier à la souscription)

| Poste | V0 | V1 (M4-M6) |
|---|---|---|
| Hébergement + base | 0 € (local) | ~20-60 €/mois |
| Orchestration / auth / mail | 0 € | offres gratuites, puis ~0-50 €/mois |
| Domaine | ~15 €/an | idem |
| API des moteurs | expérience 0 : **37-140 $ au total** (MEASUREMENT_SPEC §10-ter) | selon la densité des clusters |
| **Total fixe** | **< 20 €/mois** | **< 150 €/mois hors API** |

## 7. Décision CTO

- ✅ **Approuvé** : V0 = CLI TypeScript + JSONL, périmètre limité à l'expérience 0.
- ⛔ **Refusé** : toute ligne de SaaS (auth, billing, dashboard) avant le verdict de G1, G2 et G3.
- ⛔ **Refusé** : un 5e adaptateur (Copilot via M365) en V0. Licence requise, sans rapport avec ce que voit un recruteur lambda.
