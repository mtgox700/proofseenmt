# EXPERIMENT 0 — Dogfood sur le profil d'Ayoub (Phase 5, 2026-09-18)

> ⚠ **CORRECTIONS du 2026-09-18 (Dossier de fondation)** — elles priment sur le texte ci-dessous :
> - **Mesure API = 3 moteurs** (OpenAI, Anthropic, Perplexity) : 13 JD × 4 × 3 × 5 = **780 appels par vague**. **Gemini et Copilot
>   uniquement par échantillon manuel** (Gemini grounding : l'analyse des résultats est interdite par ses conditions).
> - **Aucun moteur utilisé à J0 sans lecture de ses conditions** (`foundations/research/R5`, `foundations/CONFORMITE.md` §5).
>   Perplexity : CGU API non lues à ce jour.
> - **Masquage des tiers dans `sim-run` lui-même** (en mémoire, avant écriture) ; brut pseudonymisé, 72 h maximum. La contrainte
>   « `sim-extract` dans les 7 jours » de la ROADMAP devient « masquage à l'ingestion, extraction sous 72 h ».
> - Critère H0 : « au moins 2 moteurs sur 4 » s'évalue sur **3 moteurs API + Gemini manuel**.
> - Coût API recalculé : **~9-35 $ par vague, ~28-105 $ pour les 3 vagues** (780 appels par vague).
> - **Échantillon manuel** (§5.2) : on ne consigne que **oui/non + rang du client** ; **aucune capture non caviardée** n'est conservée (noms de tiers).
> - Identité (§1) : les URL mesurées doivent être **vérifiées** (preuve de possession, CAHIER_DES_CHARGES US-F00), y compris pour Ayoub.
> - §9 (livrable public) : ne pas citer Gemini comme moteur mesuré ; utiliser les gabarits SUCCÈS / AMBIGU / ÉCHEC de `foundations/MARQUE.md` §7.

> Protocole **pré-enregistré** : les critères de succès et de kill sont fixés AVANT la mesure, pour ne pas
> les ajuster après coup. **La mesure appartient au founder** : la War Room livre le protocole, les scripts
> à écrire et les gabarits. Elle ne mesure rien et n'invente aucun résultat.

## 0. Hypothèses testées

| id | Hypothèse | Garde-fou lié |
|---|---|---|
| H0 | Au moins 2 moteurs sur 4 acceptent de **nommer des individus** dans une réponse de sourcing | G2 |
| H1 | Des actions white-hat, et uniquement celles-là, font monter la **Retrieval Rate** d'Ayoub en ≤ 60 jours | G3 |
| H2 | …et font passer son **SoRV@5** de ~0 à une valeur mesurable | G3 |
| H3 | L'effet ne s'explique pas par une dérive des moteurs (JD témoins stables) | validité |

En parallèle (**piste demande, G1**) : 15 interviews de recruteurs tech sur 30 jours (script en §7).

## 1. Identité à mesurer (faits vérifiés, truth lock)

- **Nom** : Ayoub Hammoudi, avec les variantes « Ayoub HAMMOUDI » et « A. Hammoudi ».
- **Positionnement** : Senior Full Stack & AI/LLM Engineer, freelance, Paris.
  ⚠ La séniorité est challengeable (freelance depuis 06/2022, diplômé en 06/2025) : la formulation publique doit rester défendable.
- **URL possédées**
  - `ayoub-hammoudi.dev` : **à vérifier à J-7** (en ligne ? SSR ? indexé ?)
  - `github.com/Ayoubhm07`
  - `linkedin.com/in/ayoub-hammoudi-3251851b8`
  - profil Malt, s'il existe (à confirmer)
- **Preuves publiables**, chiffres vérifiés dans le code (mémoire `ayoub-flagship-projects`) :
  - **AFTERSHOCK** : 17 526 séismes, 7 939 versions, Kafka + Spark + 4 DAG Airflow.
  - **Taintrace** : Neo4j sur n sauts, 512,25 BTC tracés, 9 services.
  - **Phantera** : 222 tests, 56 routes API, harness d'évals LLM, red-team Garak.
  - **Spar-X** : Next.js 15, 9 specs Playwright, Lighthouse CI.
  - ⛔ **Interdit** : citer LangGraph pour Phantera (absent du code) ; citer « 0 downtime ».

## 2. Corpus

| Élément | Règle |
|---|---|
| **10 JD cibles** | Collectées **à la main** par le founder (copier-coller) sur Free-Work, WTTJ, Malt Missions, LinkedIn Jobs, Indeed. Critères : freelance ou régie, Paris ou remote France, Senior Full Stack TS/Next.js **ou** AI/LLM Engineer (RAG, évals, agents), publiées il y a moins de 60 jours. 7 en FR, 3 en EN. |
| **3 JD témoins** | Rôles adjacents que l'optimisation **ne vise pas** (ex. : Développeur Java/Spring, Admin système Linux, Développeur mobile Flutter). Elles servent à détecter la dérive des moteurs. |
| Nettoyage | Retirer noms, e-mails et téléphones des recruteurs. |
| Gel | Corpus, 4 formulations (MEASUREMENT_SPEC §5) et versions de modèles consignés dans `experiment0/manifest.json` avant J0. |

## 3. Calendrier

| Jour | Date (si départ le 2026-09-21) | Action |
|---|---|---|
| J-7 → J-1 | 21 → 27/09 | Préparation : vérifier le site perso, collecter les JD, écrire les scripts (§6), geler le manifeste |
| **J0** | **28/09** | **Mesure de base** (API + échantillon manuel + état de l'indexation) + **test H0** |
| J1 → J10 | 29/09 → 08/10 | Actions white-hat (§4), dans l'ordre de priorité |
| J+30 | 28/10 | Re-mesure n°1 |
| **J+60** | **27/11** | **Re-mesure n°2 et verdict** (l'indexation prend du temps) |

## 4. Actions white-hat (par impact décroissant, preuve à l'appui)

| # | Action | Pourquoi (RESEARCH_GROUND_TRUTH) | Effort |
|---|---|---|---|
| A1 | **Site perso en HTML statique (SSG)**, texte visible : titre, stack, ville, mode, **disponibilité datée**, fourchette de TJM (si Ayoub l'accepte), pages `/missions/<slug>` avec 4 case studies aux chiffres vérifiés, versions FR et EN | HTML visible et SSR = prouvé ; stats et citations = levier GEO | 2-3 j |
| A2 | robots.txt du site : autoriser Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot, Claude-User, PerplexityBot. Sitemap. | Bloquer OAI-SearchBot = exclusion de ChatGPT search | 15 min |
| A3 | **Indexation sur les 3 index** : Google Search Console, Bing Webmaster Tools + IndexNow, vérification `site:` sur Brave | Chaque LLM dépend d'un index différent | 1 h |
| A4 | **LinkedIn** : titre, « Infos » et expériences réécrits avec le vocabulaire des JD (vrai uniquement), profil public activé, puis **2 articles + 4 posts en 30 jours** sur les missions réelles, **publiés à la main** | LinkedIn = domaine n°1 cité ; les posts et articles montent | 1 j + 30 min/semaine |
| A5 | **GitHub** : README de profil (même ligne d'identité, liens) + 4 repos épinglés avec des README qui expliquent (AFTERSHOCK, Taintrace…) | GitHub = plateforme la plus lisible par les bots IA | 0,5 j |
| A6 | **Malt** complet, et **Codeur.com** en option (ouvert, balisage riche), avec le même vocabulaire | Sources ouvertes aux bots de recherche | 0,5 j |
| A7 | 1 article technique sur dev.to ou Medium (cross-post), avec lien vers le site | Mentions tierces plutôt que backlinks | 0,5 j |
| A8 | **Cohérence d'entité** : même nom, même titre, même ville, même photo partout ; liens croisés entre toutes les surfaces | Corroboration | 1 h |
| — | JSON-LD Person sur le site | Hygiène uniquement, **pas compté comme levier** (réfuté) | 10 min |
| ⛔ | Texte caché, instructions adressées aux LLM, faux avis, pages en masse, automatisation LinkedIn | Lignes rouges | — |

Chaque action est **datée** dans `experiment0/actions.log`, pour pouvoir attribuer les effets.

## 5. Mesure (identique à J0, J+30 et J+60)

1. **API** : 13 JD × 4 formulations × 4 moteurs × 5 tirages = **1 040 appels** par vague. Coût : **~12-47 $ par vague, 37-140 $ pour les 3 vagues** (MEASUREMENT_SPEC §10-ter).
2. **Échantillon manuel (calibration)** : 10 JD cibles × formulation P1 × 4 apps (ChatGPT, Claude, Perplexity, Gemini) × 1, en session **déconnectée** si possible, sinon en navigation privée ; + **Copilot** sur les mêmes 10 JD. Soit 50 saisies (~2 h). Capture d'écran et résultat oui/non dans `manual_sample.csv`.
3. **Indexation** : captures Search Console et Bing Webmaster (pages indexées, AI Performance), plus résultat de `site:ayoub-hammoudi.dev` sur Google, Bing et Brave.
4. **Test H0 (J0 uniquement)** : sur les 40 cellules JD × moteur, noter si le moteur **refuse de nommer des personnes**, ne renvoie que des plateformes, ou nomme des individus.

## 6. Critères pré-enregistrés

| Verdict | Condition à J+60 |
|---|---|
| ✅ **SUCCÈS** | SoRV@5 sur les 10 JD cibles **≥ 10 %** avec borne basse de l'IC bootstrap > valeur de base, **ET** dérive des JD témoins < 5 pts. **Ou**, succès partiel : RR ≥ 30 % sur au moins 2 moteurs, ce qui prouve le mécanisme même si le top-5 n'est pas encore atteint. |
| ⚠️ **AMBIGU** | Delta positif mais IC qui chevauche la base, ou dérive des témoins ≥ 5 pts → prolonger jusqu'à J+90 avec n = 10 tirages. |
| ❌ **KILL** | RR < 10 % **ET** TA@5 < 3 % sur **tous** les moteurs, alors que l'indexation E1 est confirmée. Le mécanisme ne marche pas pour un individu → pas de SaaS ; on garde l'outil interne (issue B). |
| ❌ **KILL précoce (J0)** | H0 fausse : au moins 3 moteurs sur 4 refusent de nommer des individus → canal 1 fermé aux personnes → pivot (PRODUCT_THESIS §6). |

⚠ Le seuil de 10 % est une **proposition du board**, pas un fait. Le founder peut l'ajuster **avant J0**, jamais après.

## 7. Piste demande : interviews de recruteurs (G1)

- **Cible** : 15 recruteurs, talent sourcers et managers d'ESN, via le réseau (FCT, IPSSI, LinkedIn).
- **Script de 20 min** (Head of Talent) :
  1. Décrivez votre dernière recherche de freelance tech, étape par étape.
  2. Avez-vous déjà demandé à ChatGPT, Claude, Perplexity ou Copilot de trouver ou de comparer des profils ? Montrez-moi le prompt, si possible.
  3. À quelle fréquence ? Pour quel type de poste ?
  4. Qu'est-ce qui vous fait contacter un profil ? Qu'est-ce qui vous fait fuir ?
  5. Utilisez-vous Hiring Assistant, Malt IA ou un agent dans votre navigateur ?
- **Sortie** : fréquence d'usage d'un LLM pour sourcer + **prompts réels** → alimentent la bibliothèque I13.
- **Seuil G1** : au moins 30 % des interviewés sourcent via un LLM au moins une fois par mois.

## 8. Scripts à écrire (spécifications, pas de code dans cette session)

| Script | Entrée | Sortie | Notes |
|---|---|---|---|
| `sim-run` | `manifest.json` (JD, formulations, moteurs, n) | `runs/<vague>/*.jsonl` : un tirage par ligne, réponse brute chiffrée, citations, résultats de recherche, version du modèle | Un adaptateur par moteur ; retry avec backoff ; budget de coût maximal par vague |
| `sim-extract` | `runs/<vague>` + `identity.json` | `extract/<vague>.jsonl` : match, match_type, rang, URL client, domaines cités | Masquage NER des tiers avant écriture ; juge LLM pour les matches « probables » |
| `sim-report` | `extract/*` + `manual_sample.csv` | `report/<vague>.md` : funnel E1-E5 par moteur, SoRV@5 avec IC, DiD contre les témoins, mix de sources, accord API/app | Bootstrap par grappe, 2 000 itérations |
| Gabarits | — | `identity.json`, `manifest.json`, `manual_sample.csv`, `actions.log` | Créés à J-7 |

## 9. Livrable public (si succès)

Une case study honnête, avec des chiffres réels et le protocole publié : « J'ai mesuré si ChatGPT, Claude, Perplexity
et Gemini me recommandent à un recruteur. Voici avant/après. » Publiée sur LinkedIn (source n°1 citée) et sur le site.
C'est aussi le premier actif de go-to-market.
