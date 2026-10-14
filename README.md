# Proofseen

**Quand un recruteur cherche avec l'IA, êtes-vous trouvé ?**

Proofseen mesure si un freelance tech apparaît quand un recruteur utilise un assistant IA (ChatGPT, Claude, Perplexity…) pour trouver des profils correspondant à une offre de mission. L'outil explique **pourquoi** le profil ressort ou non, aide à le **corriger honnêtement**, puis **re-mesure** pour prouver l'évolution.

> **EN** — Proofseen measures whether a tech freelancer shows up when a recruiter uses an AI assistant to source candidates for a job description, explains why, helps fix it honestly, and re-measures to prove the change. Measurement first, white-hat only.

> **Statut : phase P0 « Preuve » (septembre à novembre 2026).** L'instrument de mesure V0 (CLI) est livré ; aucune plateforme n'est construite
> avant le point de décision du 27/11/2026. Première mesure réelle : le 28/09/2026, sur le profil du fondateur. Voir [Feuille de route](#feuille-de-route).

---

## Le problème

Les recruteurs utilisent de plus en plus l'IA pour sourcer des profils : ils demandent directement des noms à un assistant doté d'une recherche web, ou lui font écrire des requêtes booléennes qu'ils lancent ensuite sur Google, LinkedIn ou GitHub. Côté freelance, personne ne sait :

- s'il apparaît dans ces recherches ;
- quelles sources l'IA consulte pour son métier (LinkedIn, GitHub, Malt, site personnel…) ;
- ce qu'il faudrait corriger pour être trouvé.

Les outils existants mesurent la visibilité des **marques** dans l'IA, ou optimisent un **CV envoyé** à un ATS. Aucun ne mesure la visibilité d'une **personne** face à une **offre de mission**.

## Comment ça marche

```
  Offre cible  ──►  Recruiter Simulator  ──►  Rapport de visibilité  ──►  Plan de correction
  (fournie par      Formulations de            Probabilité d'apparaître,     Site statique lisible
   le freelance)    recruteur, plusieurs       intervalle de confiance,      par les IA, conseils
                    moteurs, tirages           sources citées, étape         LinkedIn / GitHub / Malt,
                    répétés                    qui bloque                    preuves tierces
        ▲                                                                           │
        └──────────────────────── re-mesure à intervalle régulier ◄─────────────────┘
```

1. **Mesurer.** Les réponses d'un LLM varient d'un appel à l'autre. On ne mesure donc jamais « un rang », mais une **probabilité d'apparition** avec son intervalle de confiance, sur un grand nombre de tirages.
2. **Expliquer.** Un funnel en cinq étapes montre où le profil décroche : indexé → récupéré par la recherche → nommé → dans le top 5 → cité comme source.
3. **Corriger.** Des actions priorisées et vérifiables : un site statique lisible par les robots des IA, des réécritures factuelles des profils, des preuves publiées par des tiers.
4. **Prouver.** Une re-mesure avec le même protocole, comparée à des offres témoins pour neutraliser les variations des moteurs.

## Principes non négociables

- **Mesure, pas promesse.** Des tendances avec leur fourchette, jamais de « n°1 garanti ».
- **Aucune manipulation des IA.** Pas de texte caché, pas d'instruction adressée aux modèles, pas de cloaking. Les profils clients sont scannés.
- **Uniquement des informations vraies.** Le produit refuse de générer une compétence, une expérience ou un chiffre que le client n'a pas.
- **Aucune automatisation sur les plateformes tierces.** Pas de scraping, pas de publication automatique sur LinkedIn ou Malt.
- **Protection des tiers.** Les noms des autres professionnels cités par les IA sont masqués avant tout stockage.
- **Résultats privés.** Quand une entreprise offre Proofseen à ses consultants, elle ne voit que des statistiques agrégées.
- **Possession vérifiée.** On ne mesure que les profils dont le client prouve être propriétaire.
- **Conditions d'usage respectées.** Seuls les moteurs dont les conditions autorisent l'analyse des réponses sont mesurés automatiquement.

## Feuille de route

| Phase | Période | Objectif |
|---|---|---|
| **P0 — Preuve** | sept. → nov. 2026 | Instrument de mesure en CLI, expérience sur le profil du fondateur, interviews de recruteurs, pré-ventes. Point de décision le 27/11/2026. |
| P1 — Service | déc. 2026 → févr. 2027 | Audits réalisés à la main, landing page, premières études de cas, pilotes avec des sociétés de portage |
| P2 — Plateforme V1 | févr. → avr. 2027 | SaaS : comptes, tableau de bord, monitoring, offre entreprises |
| P3 → P5 | 2027 → 2029 | Montée en charge en France, ESN, international |

Chaque phase est conditionnée par des seuils de décision fixés **avant** la mesure.

## Architecture prévue

| Couche | Choix |
|---|---|
| Langage | TypeScript (Node 22), monorepo pnpm |
| V0 (instrument) | CLI `proofseen` (23 commandes : mesure, preuve de possession, contrôle de surface, rapport client), fichiers JSONL |
| Moteurs mesurés | OpenAI (Responses + recherche web), Anthropic (Messages + recherche web), Perplexity (Agent API, `perplexity/sonar`), via leurs API officielles |
| V1 (plateforme) | Next.js (SSG/ISR), Inngest, Postgres (Neon) + Prisma, Clerk, Stripe, Resend |
| Statistiques | Intervalles de Wilson, bootstrap par grappe, différence-de-différences avec offres témoins |

```
packages/
  core         schémas partagés (zod) et protocole de mesure figé
  engines      un adaptateur par moteur, interface commune
  extract      extraction des candidats, appariement, masquage des tiers
  stats        intervalles de confiance, funnel, score de visibilité
  profiles     fiches publiques, preuve de possession, détection des manipulations
  hub          site-portfolio statique d'un client
  deliverable  rapport client : modèle de document, rendus Markdown et HTML
  presale      journal des pré-paiements, gate commerciale, suivi de livraison
apps/
  cli          instrument de mesure et chaîne de livraison (V0)
  landing      site public (Astro, FR/EN)
  web          landing, espace freelance, espace entreprise (Next.js 15, FR/EN), lit les données via un instantané
  mcp          serveur MCP
```

### Démarrage rapide (V0, instrument de mesure)

```bash
pnpm install
pnpm test            # 726 tests
pnpm test:coverage   # 80 % minimum
pnpm typecheck && pnpm lint
```

Simulation sans aucun appel réseau ni coût (données fictives, rapport marqué « DRY-RUN ») :

```bash
pnpm sim:run --manifest .war-room/experiment0/templates/manifest.template.json --identity .war-room/experiment0/templates/identity.template.json --dry-run --runs-dir runs-dryrun
# --report-dir est indispensable : sans lui, le rapport d'essai ÉCRASE le rapport réel dans report/.
pnpm sim:report --wave J0 --runs-dir runs-dryrun --report-dir report-dryrun
```

Espace web (données tirées de la vague J0 réelle, jamais inventées) :

```bash
pnpm --filter @proofseen/web snapshot   # régénère apps/web/data/j0-answers.json depuis runs/
pnpm --filter @proofseen/web build && pnpm --filter @proofseen/web start   # http://localhost:3100
```

Une vague réelle exige un manifeste **gelé** (`frozenAt`), les clés dans `.env` (voir `.env.example`) et `--confirm-spend`.
Le plafond de coût du manifeste est un arrêt net.

### Chaîne d'un audit client

Chaque étape refuse d'avancer si la précédente n'a pas eu lieu — et dit pourquoi.

```bash
proofseen client-init --reference FR-XXXXX --name <nom> --url <url,url>   # ouvre le dossier
#   → remplir identity.json et request.json, déposer T01..T03 et C01 dans offres/
proofseen possession --identity clients/FR-XXXXX/identity.json            # consignes de preuve
proofseen possession --identity clients/FR-XXXXX/identity.json --verify   # lit la preuve posée
proofseen surface-check --identity clients/FR-XXXXX/identity.json         # refuse un profil manipulé
proofseen client-wave --request clients/FR-XXXXX/request.json             # chemins déduits du dossier
#   → figer frozenAt dans manifest.json
proofseen preflight --manifest clients/FR-XXXXX/manifest.json --identity clients/FR-XXXXX/identity.json
proofseen run --manifest clients/FR-XXXXX/manifest.json --identity clients/FR-XXXXX/identity.json --confirm-spend
proofseen audit --wave AUDIT-FR-XXXXX --request clients/FR-XXXXX/request.json   # le livrable : .html et .md

proofseen client-status   # où en est chaque client, et la prochaine action
```

Trois verrous ne se contournent pas par étourderie : **pas de mesure sans preuve de possession**, **pas de mesure sans
contrôle de surface de moins de 30 jours**, **pas de dépense sans manifeste figé**. Et une offre qui nomme le client
est refusée à trois endroits : elle fausserait la mesure.

`proofseen` désigne ici `npx tsx apps/cli/src/main.ts`. `proofseen --help` n'existe pas : lancer la commande sans
argument affiche la liste.

## Documentation

Les documents de conception se trouvent dans [`.war-room/`](.war-room/) :

| Document | Contenu |
|---|---|
| [`ROADMAP.md`](.war-room/ROADMAP.md) | Référence unique : phases, sprints, points de décision, risques |
| [`foundations/CAHIER_DES_CHARGES.md`](.war-room/foundations/CAHIER_DES_CHARGES.md) | User stories, critères d'acceptation, exigences |
| [`foundations/STRATEGIE.md`](.war-room/foundations/STRATEGIE.md) | Personas, positionnement, tarification, go-to-market |
| [`foundations/MARQUE.md`](.war-room/foundations/MARQUE.md) | Plateforme de marque, design tokens, charte d'honnêteté |
| [`foundations/CONFORMITE.md`](.war-room/foundations/CONFORMITE.md) | RGPD, AI Act, conditions des fournisseurs |
| [`MEASUREMENT_SPEC.md`](.war-room/MEASUREMENT_SPEC.md) | Protocole de mesure et statistiques |
| [`EXPERIMENT_0.md`](.war-room/EXPERIMENT_0.md) | Protocole pré-enregistré de la première expérience |
| [`RESEARCH_GROUND_TRUTH.md`](.war-room/RESEARCH_GROUND_TRUTH.md) | Synthèse sourcée : comment les LLM récupèrent le web |

## Limites connues

- La mesure passe par les **API** des moteurs ; les réponses des applications grand public peuvent différer. Un étalonnage manuel est prévu à chaque vague.
- Les moteurs dont les conditions interdisent l'analyse des résultats (Gemini, Vertex AI et Bing grounding) ne sont **pas** mesurés automatiquement.
- La part des recruteurs qui sourcent via un LLM n'est chiffrée par aucune étude publique à ce jour ; le projet la documente par ses propres interviews.

## Licence

Tous droits réservés. Ce dépôt n'est pas sous licence open source à ce stade.

---

*Proofseen est un nom de marque en cours de vérification.*
