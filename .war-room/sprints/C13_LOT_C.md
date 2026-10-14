# C13 — lot C : mesure de visibilité IA depuis l'application

Branche `sprint/c13-measure`. Aucun appel payant n'a été fait : tous les tests passent par un transport simulé.

## Ce qui est construit

- **File en base** : modèle `MeasurementRequest` (migration `20261014120000_measurement_requests`) — état
  `queued | running | done | failed | refused`, moteurs mesurés, bail, essais, plafond réservé, coût réel cumulé (centimes
  de dollar), vague produite, code d'erreur court. Une seule demande active par profil, garantie par un index unique
  partiel ; CHECK sur les moteurs, les coûts, les codes.
- **Dépôt** `packages/db/src/measurements.ts` (+ `measurement-queue.ts`) : `eligibility`, `request` (profil publié avec au
  moins une adresse prouvée, une demande active, 2 demandes par 30 jours glissants ; refus typés `no_profile`,
  `not_published`, `no_proven_url`, `already_active`, `monthly_limit` avec la date de la prochaine place), `listMine`,
  `claim` (verrou consultatif, bail de 30 min, plafonds de la plateforme vérifiés et réservés dans la même transaction),
  `complete` (vague écrite par `visibility(db).record`, idempotente : `MEASURE-<id>`), `fail` (reprise à 15 min puis 2 h,
  abandon au 3e essai), `refuse`.
- **RGPD / conservation** : l'export rend vagues et demandes ; l'effacement supprime les vagues du profil (elles
  restaient détachées) et les demandes (cascade) ; les demandes terminées sont purgées après un an.
- **Moteur sans disque** `packages/measure` : identité tirée du profil (une seule variante de nom, comme `identityFor` ;
  seules les adresses prouvées), une offre construite depuis le titre, les compétences, la ville et le mode de travail,
  contrôlée par `assertJdFreeOfIdentity` (un titre qui nomme la personne est écarté) ; le manifeste du protocole réduit
  aux moteurs configurés ; analyse en mémoire par `analyzeAnswer` ; entonnoir par `outcomeOf` + `funnel`.
- **Logique partagée avec la CLI, pas recopiée** : `planDraws`, `promptForStep`, `stepWorstCaseUsd` (dans
  `packages/core/src/plan.ts`) et `outcomeOf` (dans `packages/stats/src/funnel.ts`) sont désormais utilisés par la CLI
  (`run.ts`, `report-data.ts`) et par la mesure de l'application.
- **Tâche planifiée** `apps/web/src/app/api/cron/measurements/route.ts` : une demande par appel, réponse immédiate
  (202), mesure exécutée après la réponse (`after`). `deploy/vps/cron.sh` appelle les deux routes.
- **Écran minimal** `/[lang]/app/visibilite` : bouton « Lancer une mesure », raisons de refus en clair, demandes, et
  entonnoir par moteur de chaque vague. Entrée de menu côté freelance. Dictionnaires FR et EN.

## Décisions

- **Une offre cible, pas d'offre témoin** : l'entonnoir montré au freelance ne compte que les offres cibles ; le témoin
  doublerait la dépense sans changer un chiffre affiché.
- **Moteurs = clés configurées** ; l'extracteur (Haiku, sans outil) exige `ANTHROPIC_API_KEY`. Chaque demande enregistre
  les moteurs réellement interrogés.
- **Interrupteur explicite** `PROOFSEEN_MEASURE_ENABLED=1` : une clé présente ne vaut pas GO API. Sans lui, les demandes
  s'accumulent en file, rien n'est dépensé, l'écran le dit.
- Un bail expiré (processus mort) compte la mesure à son plafond dur : dépense inconnue = pire cas.
- Deux étapes en parallèle, avec réservation du pire cas des étapes en vol : la mesure tient en quelques minutes et le
  plafond dur reste vérifié avant chaque étape.

## Modèle de coût (une mesure = 1 offre × 4 formulations × 5 tirages = 20 tirages par moteur)

| Moteurs | Pire cas | Plafond dur (× 1,15) | Coût attendu (moyennes observées) |
| --- | --- | --- | --- |
| Anthropic seul (production actuelle) | 5,12 $ | **5,89 $** | ~1,01 $ |
| OpenAI + Anthropic + Perplexity | 7,56 $ | **8,70 $** | ~1,93 $ |

Pire cas par tirage = borne `WORST_CASE_DRAW_USD` + 0,006 $ d'extraction. Garde-fou : aucune mesure ne part si son
plafond dépasse 10 $.

## Variables d'environnement

- `PROOFSEEN_MEASURE_ENABLED=1` — **à poser seulement après GO API du founder**.
- `PROOFSEEN_MEASURE_DAILY_USD` (défaut 10) et `PROOFSEEN_MEASURE_MONTHLY_USD` (défaut 50) — glissants 24 h / 30 jours ;
  0 met en pause. Avec Anthropic seul (réserve 5,89 $, ~1 $ réel) : environ 5 mesures par jour au plus, une quarantaine par mois.
- Existantes : `ANTHROPIC_API_KEY` (obligatoire), `OPENAI_API_KEY`, `PERPLEXITY_API_KEY` (facultatives), `CRON_SECRET`,
  `DATABASE_URL`.
- Déploiement : `prisma migrate deploy` (nouvelle migration), puis réinstaller `deploy/vps/cron.sh`.

## Tester

- `pnpm vitest run packages/db/test/measurements.test.ts packages/measure apps/web/test/cron-measurements.test.ts`
- Entonnoir calculé à la main dans `packages/measure/test/run.test.ts` (transport scripté : P1 tout, P2 retrouvée, P3
  nommée 6e, P4 rien → 20 / 15 / 10 / 5 / 5 par moteur, 0,52 $ sur Anthropic seul).

## Non fait

- L'écran complet de visibilité (autre lot) ; la page Preuves (lot `sprint/c13-proofs`).
- Aucune mesure réelle : la première attend le GO API et `PROOFSEEN_MEASURE_ENABLED=1`.
