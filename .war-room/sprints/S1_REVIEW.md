# SPRINT 1 — Revue et vérification (2026-09-18)

## 1. Revues menées

Trois revues indépendantes ont été menées en lecture seule. Une première tentative a calé (arrêt par le watchdog) ; elle a été relancée avec un périmètre resserré.

| Revue | Agent | CRITIQUE | HAUTE | MOYENNE | BASSE |
|---|---|---|---|---|---|
| TypeScript | typescript-reviewer | 0 | 1 | 4 | 3 |
| Sécurité et vie privée | security-reviewer | 0 | 1 | 2 | 1 |
| Red-team mesure (Scenario Hunter) | code-reviewer | 2 | 2 | 1 | 0 |

`pnpm audit --prod` : **aucune vulnérabilité connue**. Aucun secret en dur. Aucune fuite de clé dans les journaux ni dans les erreurs.

## 2. Constats corrigés (tous les CRITIQUES et HAUTS, plus les MOYENS utiles)

| # | Gravité | Constat | Correction | Test ajouté |
|---|---|---|---|---|
| RT-1 | CRITIQUE | SoRV : un moteur en panne disparaissait de la moyenne, ce qui **gonflait** le chiffre | Couverture par moteur ; vague **incomplète** si un moteur < 80 % ou si le budget a stoppé la vague → SoRV non publiable et « rendu visible » forcé à NON | `report-data.test.ts` (3 tests) |
| RT-2 | CRITIQUE | Re-scoring : les concurrents cités **sur la même ligne** (réponse en prose) n'étaient pas comptés | Le rang se calcule depuis la **première mention** du client, sans notion de ligne | `rescore.test.ts` (prose) |
| RT-3 | HAUTE | Un point final collé à l'URL (`…dev.`) donnait un faux négatif **et** masquait l'URL du client | `stripTrailingPunctuation` + point final retiré de l'hôte ; ponctuation préservée hors du masquage | `isClientUrl edge cases` (3 tests) |
| RT-4 | HAUTE | DiD calculée même quand les JD diffèrent entre vagues (changement de mix ≠ effet) | DiD et dérive **seulement sur des JD identiques**, sinon note explicite | `report-data.test.ts` (2 tests) |
| RT-5 | MOYENNE | Noms à particule (« Jean de Vries », « d'Arvor ») non masqués par le lexique | Particules et `d'` gérées | test « particle » |
| SEC-1 | HAUTE | Le rang dépendait de l'extracteur LLM, manipulable par injection | **Rang conservateur** = le plus défavorable entre l'extracteur et le re-scoring déterministe ; désaccord ⇒ `needsReview` | test d'injection « NOTE TO EXTRACTOR » |
| SEC-2 | MOYENNE | Domaines nus masqués seulement sur une liste de TLD | Toute TLD de 2 à 24 lettres, sauf extensions et noms techniques (Next.js, ASP.NET) | test « any TLD » |
| SEC-3 | MOYENNE | Erreurs inattendues affichées avec leur message (qui peut citer une réponse) | Liste blanche : classe d'erreur seulement ; détail uniquement si `PROOFSEEN_DEBUG=1` | — |
| SEC-4 | BASSE | ReDoS potentiel | **Confirmé par mesure** : regex e-mail quadratique (~1 300 ms pour 20 000 caractères). Bornée aux limites RFC 5321 → **~20-55 ms** | tests ReDoS (seuil 500 ms), `core` et `extract` |
| TS-1 | HAUTE | Remplacement des noms de tiers sans limite de mot (« Max » dans « Maxime ») | Limites Unicode `(?<![\p{L}\p{N}])` | test « whole word » |
| TS-2 | MOYENNE | Erreur d'extraction avalée | `extractionError` (classe seule) conservé dans chaque tirage | — |
| TS-3 | MOYENNE | Cast `raw` non commenté (`pause_turn`) | Justification commentée (contenu à renvoyer tel quel) | — |
| TS-4 | MOYENNE | Erreur JSONL sans détail | Chemin et message du premier problème zod | — |
| TS-5 | MOYENNE | Purge séquentielle | `Promise.all` | — |
| TS-6 | BASSE | `</answer>` seul échappé | Variantes de casse et d'espaces échappées | — |
| TS-7 | BASSE | Invariant `models[e]!` implicite | Commenté (garanti par le `refine` du manifeste) | — |
| QA-1 | (vérif.) | **Le build « vert » produisait un artefact non exécutable** (packages internes en TS externes) | `tsup` avec `noExternal: [/^@proofseen\//]` ; artefact exécuté avec Node seul | vérification manuelle collée ci-dessous |

## 3. Constats laissés ouverts (non bloquants, consignés)

| Constat | Pourquoi ce n'est pas corrigé en S1 | Quand |
|---|---|---|
| Parsing CSV par `split(",")` sans guillemets | Sans risque tant que les notes n'acceptent que des codes, sans virgule | Si le format évolue |
| Le masquage repose sur l'extracteur + un lexique : un nom **hors lexique et omis** par l'extracteur survit (dans le texte scellé, chiffré, purgé à 72 h) | Limite connue d'une approche sans NER entraîné | S2 : audit mensuel d'un échantillon déchiffré ; NER plus robuste à étudier |
| Appariement « probable » sans juge LLM | Reporté en S2 par décision du board (S1_PLAN) ; exclu de la north star | S2 |
| Réponses de l'Agent API Perplexity (annotations, `tool_calls_details`) non vérifiées par un appel réel | Aucun appel payant sans « GO API » | 1er tirage réel |

## 4. Vérification finale (QA Guardian), sorties réelles du 2026-09-18

```
== TYPECHECK ==  typecheck exit=0
== LINT ==       lint exit=0
Test Files  9 passed (9)
     Tests  105 passed (105)
All files          |   93.59 |    78.15 |   94.33 |   95.29 |
 packages/core/src |   97.14 |    95.23 |     100 |   96.61 |
 ...es/engines/src |   92.89 |    77.31 |    89.7 |    97.9 |
 ...es/extract/src |   98.84 |    95.19 |     100 |    99.1 |   (masquage inclus)
 ...ages/stats/src |   98.19 |    86.11 |     100 |     100 |
coverage exit=0   (seuils 80 % imposés sur stats/ et extract/)
== BUILD ==  dist\main.js 72.82 KB — Build success — build exit=0
== NODE dist == Wave J0: 780 draws on openai, anthropic, perplexity — worst case 64.48 $, hard cap 50 $
               Done: 780 draws (0 errors), 7.943 $            (DRY-RUN, coût simulé)
== REPORT ==   « DRY-RUN — DONNÉES SIMULÉES » ; 780 / 0 ; SoRV@5 = 0.0 %
               (0 % attendu : l'identité du gabarit n'a aucune URL vérifiée → US-F00 bloque tout appariement)
== GUARD ==    manifest is not frozen: set frozenAt before a real wave (EXPERIMENT_0 §2) — exit=1
```

Le test bout en bout vérifie qu'**aucun nom de tiers n'atteint le disque**, y compris dans les réponses scellées une fois déchiffrées.

## 6. Durcissement avant J0 (2026-09-20)

Constat laissé ouvert en S1 (« parsing CSV par `split(",")` ») **repris** : c'est un risque réel pour le 28/09, parce que l'échantillon
manuel est rempli à la main, très probablement dans un tableur.

| Problème réel | Correction |
|---|---|
| Excel français enregistre le CSV avec `;` | Séparateur détecté depuis l'en-tête (`,` ou `;`) |
| Excel ajoute un BOM UTF-8 | BOM retiré avant lecture |
| Une note contenant `;` (format autorisé) est mise entre guillemets | Vraie lecture CSV (RFC 4180), guillemets doublés gérés |
| Un booléen tapé devient `VRAI`/`FAUX` | `VRAI/FAUX`, `oui/non`, `1/0`, `true/false` acceptés, quelle que soit la casse |
| Ligne invalide = message vague | Message avec **numéro de ligne** et colonne fautive ; rien n'est deviné |

Nouvelle commande **`pnpm sim:check-manual --manual <csv>`** : valide le fichier **seul** (utilisable avant même la vague) et vérifie les
règles du protocole — `client_rank` rempli si et seulement si `client_present=true`, pas de doublon JD × app, une seule vague, 50 lignes
attendues — puis résume (total, présence, répartition par application). Sortie 1 en cas de problème.

Gabarit ajouté : `experiment0/templates/manual_sample.template.csv` (en-tête seul, à ouvrir dans Excel).
Tests : 4 nouveaux cas (fichier « Excel français » complet, oui/non et 1/0, guillemets non fermés, règles du protocole).

## 7. Pré-vol J0 : `pnpm sim:preflight` (2026-09-20)

Le jour de la mesure, aucun problème de configuration ne doit se découvrir **après** la première dépense. Nouvelle commande, sans
aucun appel réseau :

```bash
pnpm sim:preflight --manifest <manifest.json> --identity <identity.json>
```

Elle vérifie, puis conclut par **GO** ou **NO-GO** (sortie 1) : manifeste **gelé** (et pas daté dans le futur) · **clés présentes**
dans `.env` (présence uniquement — aucune valeur n'est lue, affichée ni journalisée ; un test le vérifie) · **clé de chiffrement**
décodable et longue de 32 octets · **preuve de possession** (au moins une URL vérifiée, sinon aucun appariement n'est comptable) ·
**corpus** (10 cibles + 3 témoins) · **budget** (pire cas contre plafond) · **dossier de vague** déjà présent (reprise). Elle imprime
aussi l'empreinte SHA-256 du manifeste, à recopier dans le journal.

**Ce que le pré-vol a trouvé tout de suite, sur les gabarits actuels — décision du founder requise avant le 28/09 :**

> 780 tirages, **pire cas 64,48 $**, plafond du manifeste **50 $**. La vague s'arrêterait au plafond **avant la fin** ; or une vague
> incomplète rend le SoRV **non publiable** (règle RT-1 de ce même sprint). Options : porter `costCapUsd` à ~70 $ (le budget
> investisseur prévoit ≈ 170 $ pour 3 mesures : il faudrait alors revoir ce total), ou réduire la vague (moins de tirages par cellule,
> ou 3 formulations au lieu de 4), ou accepter formellement une vague partielle **avant** la mesure, jamais après.
> Le pire cas suppose que chaque réponse atteint le plafond de jetons et de recherches : le coût réel sera inférieur, mais le plafond
> doit couvrir le pire cas, sinon la vague peut s'arrêter en route.

**TRANCHÉ — [FOUNDER] 2026-09-20 : plafond porté à 70 $ par vague.** `costCapUsd` = 70 dans le gabarit du manifeste ; le pré-vol
affiche désormais `[ ok ] budget: 780 draws, worst case 64.48 $, hard cap 70 # SPRINT 1 — Revue et vérification (2026-09-18)

## 1. Revues menées

Trois revues indépendantes ont été menées en lecture seule. Une première tentative a calé (arrêt par le watchdog) ; elle a été relancée avec un périmètre resserré.

| Revue | Agent | CRITIQUE | HAUTE | MOYENNE | BASSE |
|---|---|---|---|---|---|
| TypeScript | typescript-reviewer | 0 | 1 | 4 | 3 |
| Sécurité et vie privée | security-reviewer | 0 | 1 | 2 | 1 |
| Red-team mesure (Scenario Hunter) | code-reviewer | 2 | 2 | 1 | 0 |

`pnpm audit --prod` : **aucune vulnérabilité connue**. Aucun secret en dur. Aucune fuite de clé dans les journaux ni dans les erreurs.

## 2. Constats corrigés (tous les CRITIQUES et HAUTS, plus les MOYENS utiles)

| # | Gravité | Constat | Correction | Test ajouté |
|---|---|---|---|---|
| RT-1 | CRITIQUE | SoRV : un moteur en panne disparaissait de la moyenne, ce qui **gonflait** le chiffre | Couverture par moteur ; vague **incomplète** si un moteur < 80 % ou si le budget a stoppé la vague → SoRV non publiable et « rendu visible » forcé à NON | `report-data.test.ts` (3 tests) |
| RT-2 | CRITIQUE | Re-scoring : les concurrents cités **sur la même ligne** (réponse en prose) n'étaient pas comptés | Le rang se calcule depuis la **première mention** du client, sans notion de ligne | `rescore.test.ts` (prose) |
| RT-3 | HAUTE | Un point final collé à l'URL (`…dev.`) donnait un faux négatif **et** masquait l'URL du client | `stripTrailingPunctuation` + point final retiré de l'hôte ; ponctuation préservée hors du masquage | `isClientUrl edge cases` (3 tests) |
| RT-4 | HAUTE | DiD calculée même quand les JD diffèrent entre vagues (changement de mix ≠ effet) | DiD et dérive **seulement sur des JD identiques**, sinon note explicite | `report-data.test.ts` (2 tests) |
| RT-5 | MOYENNE | Noms à particule (« Jean de Vries », « d'Arvor ») non masqués par le lexique | Particules et `d'` gérées | test « particle » |
| SEC-1 | HAUTE | Le rang dépendait de l'extracteur LLM, manipulable par injection | **Rang conservateur** = le plus défavorable entre l'extracteur et le re-scoring déterministe ; désaccord ⇒ `needsReview` | test d'injection « NOTE TO EXTRACTOR » |
| SEC-2 | MOYENNE | Domaines nus masqués seulement sur une liste de TLD | Toute TLD de 2 à 24 lettres, sauf extensions et noms techniques (Next.js, ASP.NET) | test « any TLD » |
| SEC-3 | MOYENNE | Erreurs inattendues affichées avec leur message (qui peut citer une réponse) | Liste blanche : classe d'erreur seulement ; détail uniquement si `PROOFSEEN_DEBUG=1` | — |
| SEC-4 | BASSE | ReDoS potentiel | **Confirmé par mesure** : regex e-mail quadratique (~1 300 ms pour 20 000 caractères). Bornée aux limites RFC 5321 → **~20-55 ms** | tests ReDoS (seuil 500 ms), `core` et `extract` |
| TS-1 | HAUTE | Remplacement des noms de tiers sans limite de mot (« Max » dans « Maxime ») | Limites Unicode `(?<![\p{L}\p{N}])` | test « whole word » |
| TS-2 | MOYENNE | Erreur d'extraction avalée | `extractionError` (classe seule) conservé dans chaque tirage | — |
| TS-3 | MOYENNE | Cast `raw` non commenté (`pause_turn`) | Justification commentée (contenu à renvoyer tel quel) | — |
| TS-4 | MOYENNE | Erreur JSONL sans détail | Chemin et message du premier problème zod | — |
| TS-5 | MOYENNE | Purge séquentielle | `Promise.all` | — |
| TS-6 | BASSE | `</answer>` seul échappé | Variantes de casse et d'espaces échappées | — |
| TS-7 | BASSE | Invariant `models[e]!` implicite | Commenté (garanti par le `refine` du manifeste) | — |
| QA-1 | (vérif.) | **Le build « vert » produisait un artefact non exécutable** (packages internes en TS externes) | `tsup` avec `noExternal: [/^@proofseen\//]` ; artefact exécuté avec Node seul | vérification manuelle collée ci-dessous |

## 3. Constats laissés ouverts (non bloquants, consignés)

| Constat | Pourquoi ce n'est pas corrigé en S1 | Quand |
|---|---|---|
| Parsing CSV par `split(",")` sans guillemets | Sans risque tant que les notes n'acceptent que des codes, sans virgule | Si le format évolue |
| Le masquage repose sur l'extracteur + un lexique : un nom **hors lexique et omis** par l'extracteur survit (dans le texte scellé, chiffré, purgé à 72 h) | Limite connue d'une approche sans NER entraîné | S2 : audit mensuel d'un échantillon déchiffré ; NER plus robuste à étudier |
| Appariement « probable » sans juge LLM | Reporté en S2 par décision du board (S1_PLAN) ; exclu de la north star | S2 |
| Réponses de l'Agent API Perplexity (annotations, `tool_calls_details`) non vérifiées par un appel réel | Aucun appel payant sans « GO API » | 1er tirage réel |

## 4. Vérification finale (QA Guardian), sorties réelles du 2026-09-18

```
== TYPECHECK ==  typecheck exit=0
== LINT ==       lint exit=0
Test Files  9 passed (9)
     Tests  105 passed (105)
All files          |   93.59 |    78.15 |   94.33 |   95.29 |
 packages/core/src |   97.14 |    95.23 |     100 |   96.61 |
 ...es/engines/src |   92.89 |    77.31 |    89.7 |    97.9 |
 ...es/extract/src |   98.84 |    95.19 |     100 |    99.1 |   (masquage inclus)
 ...ages/stats/src |   98.19 |    86.11 |     100 |     100 |
coverage exit=0   (seuils 80 % imposés sur stats/ et extract/)
== BUILD ==  dist\main.js 72.82 KB — Build success — build exit=0
== NODE dist == Wave J0: 780 draws on openai, anthropic, perplexity — worst case 64.48 $, hard cap 50 $
               Done: 780 draws (0 errors), 7.943 $            (DRY-RUN, coût simulé)
== REPORT ==   « DRY-RUN — DONNÉES SIMULÉES » ; 780 / 0 ; SoRV@5 = 0.0 %
               (0 % attendu : l'identité du gabarit n'a aucune URL vérifiée → US-F00 bloque tout appariement)
== GUARD ==    manifest is not frozen: set frozenAt before a real wave (EXPERIMENT_0 §2) — exit=1
```

Le test bout en bout vérifie qu'**aucun nom de tiers n'atteint le disque**, y compris dans les réponses scellées une fois déchiffrées.

## 6. Durcissement avant J0 (2026-09-20)

Constat laissé ouvert en S1 (« parsing CSV par `split(",")` ») **repris** : c'est un risque réel pour le 28/09, parce que l'échantillon
manuel est rempli à la main, très probablement dans un tableur.

| Problème réel | Correction |
|---|---|
| Excel français enregistre le CSV avec `;` | Séparateur détecté depuis l'en-tête (`,` ou `;`) |
| Excel ajoute un BOM UTF-8 | BOM retiré avant lecture |
| Une note contenant `;` (format autorisé) est mise entre guillemets | Vraie lecture CSV (RFC 4180), guillemets doublés gérés |
| Un booléen tapé devient `VRAI`/`FAUX` | `VRAI/FAUX`, `oui/non`, `1/0`, `true/false` acceptés, quelle que soit la casse |
| Ligne invalide = message vague | Message avec **numéro de ligne** et colonne fautive ; rien n'est deviné |

Nouvelle commande **`pnpm sim:check-manual --manual <csv>`** : valide le fichier **seul** (utilisable avant même la vague) et vérifie les
règles du protocole — `client_rank` rempli si et seulement si `client_present=true`, pas de doublon JD × app, une seule vague, 50 lignes
attendues — puis résume (total, présence, répartition par application). Sortie 1 en cas de problème.

Gabarit ajouté : `experiment0/templates/manual_sample.template.csv` (en-tête seul, à ouvrir dans Excel).
Tests : 4 nouveaux cas (fichier « Excel français » complet, oui/non et 1/0, guillemets non fermés, règles du protocole).

## 7. Pré-vol J0 : `pnpm sim:preflight` (2026-09-20)

Le jour de la mesure, aucun problème de configuration ne doit se découvrir **après** la première dépense. Nouvelle commande, sans
aucun appel réseau :

```bash
pnpm sim:preflight --manifest <manifest.json> --identity <identity.json>
```

Elle vérifie, puis conclut par **GO** ou **NO-GO** (sortie 1) : manifeste **gelé** (et pas daté dans le futur) · **clés présentes**
dans `.env` (présence uniquement — aucune valeur n'est lue, affichée ni journalisée ; un test le vérifie) · **clé de chiffrement**
décodable et longue de 32 octets · **preuve de possession** (au moins une URL vérifiée, sinon aucun appariement n'est comptable) ·
**corpus** (10 cibles + 3 témoins) · **budget** (pire cas contre plafond) · **dossier de vague** déjà présent (reprise). Elle imprime
aussi l'empreinte SHA-256 du manifeste, à recopier dans le journal.

**Ce que le pré-vol a trouvé tout de suite, sur les gabarits actuels — décision du founder requise avant le 28/09 :**

> 780 tirages, **pire cas 64,48 $**, plafond du manifeste **50 $**. La vague s'arrêterait au plafond **avant la fin** ; or une vague
> incomplète rend le SoRV **non publiable** (règle RT-1 de ce même sprint). Options : porter `costCapUsd` à ~70 $ (le budget
> investisseur prévoit ≈ 170 $ pour 3 mesures : il faudrait alors revoir ce total), ou réduire la vague (moins de tirages par cellule,
> ou 3 formulations au lieu de 4), ou accepter formellement une vague partielle **avant** la mesure, jamais après.
. Répercussion sur le budget investisseur
(`BUDGET_P0_INVESTISSEUR.md`) : **≈ 210 $** au lieu de 170 $, réparti selon le pire cas calculé depuis le code —
OpenAI 20,80 $ par mesure (crédit 70 $), **Anthropic 35,88 $ par mesure (crédit 110 $ : il est à la fois moteur mesuré et
extracteur des 780 réponses)**, Perplexity 7,80 $ par mesure (crédit 30 $). Total pire cas des 3 mesures : 193,40 $.

Tests : 8 cas (GO complet et aucun secret dans la sortie, manifeste non gelé ou daté dans le futur, secret manquant nommé sans être
révélé, clé de chiffrement de mauvaise taille, budget insuffisant, absence de preuve de possession, corpus mince, reprise de vague).
155/155 tests, lint et typecheck 0.

## 8. Répétition générale à blanc, à la vraie taille (2026-09-20)

Chaîne complète exécutée sur le **manifeste gelé de J0** (780 tirages, 13 JD × 4 formulations × 3 moteurs × 5 tirages), en `--dry-run`,
sans aucun appel réseau, dans un dossier temporaire.

| Étape | Résultat |
|---|---|
| `sim:run --dry-run` | 780 tirages, **0 erreur**, ~16 s, 1,5 Mo sur disque (réponses scellées comprises) |
| `sim:extract` | ~7 s, accord extracteur / re-scoring déterministe **780/780** |
| `sim:check-manual` | 50 lignes fictives au format « Excel français » (`;`, BOM, CRLF) : acceptées, 10 par application |
| `sim:report --manual` | Rapport complet : funnel E2-E5 par moteur avec IC de Wilson, SoRV@5 avec IC bootstrap, JD témoins, mix des sources, **accord API / apps calculé** (l'alerte « < 80 % » s'affiche bien), bandeau **DRY-RUN** en tête |

Ce que cela prouve : la chaîne tient la charge de J0 et le rapport se génère. Ce que cela ne prouve **pas** : aucun chiffre de ce rapport
n'a de sens (le simulateur invente les réponses), et le « coût simulé » affiché (9,24 $) n'est **pas** une prévision du coût réel —
la seule borne qui engage reste le pire cas de 64,48 $ du pré-vol.

Détail de méthode : pour que la répétition passe l'étape d'appariement, une **copie** de l'identité a été utilisée avec une URL marquée
vérifiée. **Jamais sur le fichier réel** : `verifiedAt` ne se renseigne qu'après la preuve de possession (`PROCEDURE_US-F00.md`),
et le pré-vol refuse une identité sans URL vérifiée.
