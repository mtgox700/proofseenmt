# MEASUREMENT SPEC — Recruiter Simulator (Phase 4, 2026-09-18)

> ⚠ **CORRECTIONS du 2026-09-18 (Dossier de fondation, sources : `foundations/research/R3`, `R5`)** — elles priment sur le texte ci-dessous :
> 1. **Gemini retiré de la mesure automatisée.** Les conditions de « Grounding with Google Search » interdisent d'*analyze* les résultats.
>    Gemini est mesuré **uniquement par échantillon manuel** et approché par Google Search Console (E1). Mesure automatisée V0 = **3 moteurs**
>    (OpenAI, Anthropic, Perplexity), chacun **sous réserve de la validation de ses conditions** (`foundations/CONFORMITE.md` §5).
> 2. **Stockage des réponses brutes (§11) remplacé** : masquage des noms de tiers **en mémoire avant toute écriture** ; brut conservé
>    **pseudonymisé** (jetons), chiffré, **72 h maximum** (et non 7 jours en clair chiffré).
> 3. Volumes recalculés à 3 moteurs : audit complet = 3 JD × 4 × 3 × 5 = **180** appels par client (hors panel) ; audit flash = **18** appels ;
>    vague de l'expérience 0 = 13 × 4 × 3 × 5 = **780** appels.
> 4. Canal complémentaire à instruire (V1.5) : **simulateur de requêtes X-ray** (le LLM écrit la requête booléenne), parce que c'est l'usage
>    recruteur le plus documenté (`foundations/research/R4` §D). Exécution directe via une API de recherche bloquée à ce jour (R5) ; piste : l'outil
>    de recherche d'OpenAI ou d'Anthropic.
> 5. **North star business précisée** : seuls les appariements **« certains »** comptent (≥ 2 appariements certains sur ≥ 2 JD de marché **et**
>    borne basse de l'IC bootstrap > 0). Les JD fournies par le client sont exclues de la north star et des case studies.
> 6. **Domaines conservés** : liste blanche de domaines de plateforme seulement ; tout domaine personnel de tiers est réduit à la catégorie « autre ».
> 7. **Durées de conservation (§11)** : alignées sur `foundations/CONFORMITE.md` §2 (données du client : durée du contrat, puis suppression ≤ 30 j).
> 8. **Identité** : seules les URL **vérifiées** (preuve de possession) servent à l'appariement.

> Auteurs : Retrieval Scientist (lead), Elias Voss, Maxwell Reid, Legal & Trust. Pseudo-spec, **aucun code**.
> Principe directeur : une réponse de LLM est un **tirage aléatoire**. On ne mesure jamais « le rang » ;
> on mesure une **probabilité d'apparition**, avec un intervalle de confiance.

## 1. Question mesurée

> *Quand un recruteur soumet une JD de ce cluster à ce moteur, quelle est la probabilité que le client
> apparaisse parmi les K premiers profils proposés ? Et quelles sources le moteur cite-t-il ?*

## 2. Le funnel de visibilité (5 étages)

La mesure ne s'arrête pas au résultat final. Elle suit le funnel, pour savoir **où** ça casse :

| Étage | Métrique | Source de mesure |
|---|---|---|
| E1 Indexé | Les pages du client sont présentes dans Google / Bing / Brave | Search Console, Bing Webmaster, requête `site:` manuelle sur Brave |
| E2 Récupéré | **Retrieval Rate (RR)** = part des tirages où une URL du client figure dans les résultats de recherche renvoyés par l'outil | Résultats de recherche exposés par l'API |
| E3 Nommé | **Mention Rate (MR)** = part des tirages où le client est nommé | Parsing de la réponse |
| E4 Top-K | **TA@K** = part des tirages où le client est dans les K premiers profils (K = 5 par défaut) | Parsing de la réponse |
| E5 Cité | **Citation Rate (CR)** = part des tirages où une URL du client est citée comme source | Citations de l'API |

**Pourquoi c'est important** : au départ, la plupart des freelances seront à TA@5 = 0 %. Une métrique
bloquée à zéro n'aide pas à piloter. **RR** est l'indicateur avancé qui bouge en premier.

## 3. KPI

- **KPI nord produit — SoRV@5 (Share of Recruiter Voice)** = moyenne de TA@5 sur les moteurs, pondération égale en V0, calculée sur le cluster de JD cible du client, avec un IC à 95 %.
- **KPI nord business** = nombre de profils **rendus visibles** : SoRV@5 passé de 0 à une valeur > 0, avec la borne basse de l'IC > 0.
- Indicateurs d'accompagnement : RR, MR, CR, rang moyen conditionnel (sachant que le client apparaît), **mix des sources citées** (part LinkedIn, GitHub, Malt, site perso…).

## 4. Corpus de JD

| Élément | Règle |
|---|---|
| Source V0 | **JD fournies par le client** (3-10 JD cibles), plus un **corpus de marché collecté à la main** (50 JD sur les clusters de lancement). **Aucun scraping** de job boards (CGU). |
| Nettoyage | Retrait des contacts (nom du recruteur, e-mail, téléphone) avant stockage. |
| Cluster | `rôle × stack principale × séniorité × localisation × mode (remote/hybride/sur site) × langue` |
| Clusters de lancement (HYPOTHÈSE) | Senior Full Stack TS/Next.js · AI/LLM Engineer · Data Engineer · DevOps/Cloud · Mobile (React Native/Flutter). Paris + remote France, FR et EN. |
| Stockage | Le texte de la JD est conservé (ce n'est pas une donnée personnelle une fois nettoyé), avec les attributs du cluster. |

## 5. Formulations de recruteur (K = 4 en V0)

Gelées et versionnées. Elles seront remplacées par des prompts **réels** collectés en interviews (I13).

| id | Formulation (résumé) | Pourquoi |
|---|---|---|
| P1 | JD collée + « Trouve-moi les 5 meilleurs profils freelances pour cette mission. Nom, lien, pourquoi. » | Le scénario du founder |
| P2 | Version courte sans JD : « Je cherche un freelance <rôle> <stack> à <ville>, dispo sous 2 semaines. Qui me recommandes-tu ? Avec liens. » | Le recruteur pressé |
| P3 | P1 en anglais | Recruteurs internationaux ; les moteurs se comportent différemment selon la langue |
| P4 | « Cherche sur LinkedIn, Malt et GitHub des profils correspondant à cette JD… » | Pousse le moteur vers les plateformes (canal 1 seulement, via l'index) |

## 6. Moteurs ciblés (V0)

| Moteur | Accès | Remarque |
|---|---|---|
| ChatGPT | OpenAI Responses API + outil `web_search` | Index hybride |
| Claude | Anthropic Messages API + outil `web_search` | Index Brave (U4 à vérifier) |
| Perplexity | Sonar API | Index propriétaire ; aveugle sur LinkedIn |
| Gemini | Gemini API + Grounding with Google Search | Index Google |
| Copilot | **Pas d'API de réponse.** Mesure officielle et gratuite via **Bing Webmaster « AI Performance »**, plus un échantillon manuel | Mesure partielle, assumée |

⚠ **API ≠ app grand public.** Les réponses d'API peuvent différer de ce que voit un recruteur dans l'app
(modèle, prompt système, personnalisation). → **Calibration** (§9).

## 7. Plan d'échantillonnage

| Paramètre | V0 | V1 |
|---|---|---|
| Tirages par cellule (JD × formulation × moteur) | n = 5 fixes | Adaptatif : 3 → 20, arrêt quand la demi-largeur de l'IC ≤ 10 pts |
| Température | celle par défaut du moteur (on mesure ce que voit le recruteur, pas un optimum) | idem |
| Audit complet (10 JD × 4 formulations × 4 moteurs × 5) | **800 appels** | ~400-600 avec l'échantillonnage adaptatif |
| Audit gratuit (1 JD × 2 formulations × 4 moteurs × 3) | **24 appels** | idem |
| Horodatage et version du modèle | enregistrés à chaque tirage | idem |
| Fenêtre de mesure | tous les tirages d'une vague sur ≤ 48 h, pour limiter la dérive des moteurs | idem |

**Panel partagé (I08)** : les tirages d'un cluster de marché sont **mutualisés**. Une seule vague sert tous
les clients du cluster, ce qui rend le coût marginal par client quasi nul. Les JD propres à un client restent privées.

## 8. Extraction et appariement

1. **Parser** la réponse → liste ordonnée d'entités-candidats (nom, URL, rang) et liste des URL citées (champ citations/sources de l'API).
2. **Identité du client** (fournie par lui, avec son consentement) : noms et variantes, URL possédées (site, slug LinkedIn, GitHub, Malt, Codeur…).
3. **Appariement**
   - **Certain** : une URL du client est présente.
   - **Probable** : nom exact + un attribut concordant (ville ou stack), confirmé par un juge LLM à seuil fixe, avec un échantillon relu à la main.
   - Chaque tirage enregistre son `match_type`.
4. **Tiers** : les noms des autres profils sont **masqués par NER avant persistance** (§11). On ne conserve que leurs **domaines**, pour la carte des sources.

## 9. Statistique

| Problème | Traitement |
|---|---|
| Proportion par cellule | **IC de Wilson** à 95 % (robuste près de 0 %) |
| Tirages corrélés au sein d'une JD | IC agrégé par **bootstrap par grappe** (rééchantillonnage des JD, 2 000 itérations) |
| Avant/après (expérience 0, clients) | Delta de SoRV avec IC bootstrap par grappe ; **différence-de-différences** contre des **JD témoins** que l'optimisation ne cible pas |
| Dérive des moteurs (changements de modèle) | JD témoins + version du modèle enregistrée ; toute vague où les témoins bougent de plus de 5 pts est signalée |
| Base à 0 % | On pilote sur RR et MR tant que TA@5 = 0 |
| Validité API vs app | **Calibration** : à chaque vague, 1 formulation × 10 JD saisies à la main dans chaque app (session déconnectée quand c'est possible), puis taux d'accord API/app sur « le client apparaît : oui/non » |
| Faux positifs d'appariement | Revue manuelle de 10 % des matches « probables » ; précision cible ≥ 95 % |

## 10. Coût par audit

Formule : `coût_audit = Σ_moteurs (appels_moteur × (prix_recherche × recherches_par_appel + tokens_in × prix_in + tokens_out × prix_out))`.
Hypothèse de tokens par appel : ~1 500 en entrée (prompt + JD) + ~4 000 de résultats injectés + ~800 en sortie, avec 1 à 3 recherches.

### 10-bis. Tarifs vérifiés le 2026-09-18 (pages officielles)

| Moteur | Modèle | Recherche | Coût par appel (1 → 3 recherches) | Source |
|---|---|---|---|---|
| OpenAI | gpt-5-nano → gpt-5-mini | 10 $ / 1 000 appels | 0,011 → 0,033 $ | developers.openai.com/api/docs/pricing |
| Anthropic | Haiku 4.5 → Sonnet 5 | 10 $ / 1 000 recherches | 0,020 → 0,049 $ | platform.claude.com/docs/en/about-claude/pricing |
| Perplexity | sonar → sonar-pro | 5 à 14 $ / 1 000 requêtes | 0,007 → 0,043 $ | docs.perplexity.ai/getting-started/pricing |
| Gemini | 3.1 Flash-Lite | 5 000 recherches gratuites/mois, puis 14 $ / 1 000 | ~0,003 $ dans le quota, 0,017 → 0,045 $ au-delà | ai.google.dev/gemini-api/docs/pricing |
| Copilot | — | Pas d'API grand public. La M365 Copilot Chat API exige une licence M365 Copilot. Bing Grounding coûte 14 $ / 1 000 transactions | ~0,017 → 0,045 $ (HYPOTHÈSE : tokens Azure non vérifiés) | microsoft.com/en-us/bing/apis/grounding-pricing |

**La recherche domine le coût, pas les tokens** → plafonner le nombre de recherches par appel (`max_uses` chez Anthropic).
⚠ Gemini 3.x Flash est en prix promotionnel jusqu'au 31/12/2026. Les modèles à raisonnement facturent aussi leurs tokens de raisonnement.

### 10-ter. Coûts dérivés (HYPOTHÈSE de mix : 0,012 $ bas / 0,026 $ médian / 0,045 $ haut par appel)

| Unité | Appels | Bas | Médian | Haut |
|---|---|---|---|---|
| Audit gratuit | 24 | 0,29 $ | 0,62 $ | 1,08 $ |
| Audit complet | 800 | 9,6 $ | 21 $ | 36 $ |
| Vague de l'expérience 0 | 1 040 | 12,5 $ | 27 $ | 47 $ |
| Expérience 0 complète (3 vagues) | 3 120 | 37 $ | 81 $ | 140 $ |
| Panel d'un cluster de marché (50 JD × 4 × 4 × 5) | 4 000 | 48 $ | 104 $ | 180 $ |
| JD privées d'un client, monitoring mensuel (3 JD × 2 × 4 × 3) | 72 | 0,9 $ | 1,9 $ | 3,2 $ |

**Économie unitaire (décision Maxwell)** : le panel partagé coûte ~50-180 $ par cluster et par vague, quel que soit
le nombre de clients. **La fréquence du panel suit la densité du cluster** : mensuelle sous 20 clients, hebdomadaire
au-delà de 100. À 100 clients par cluster en hebdomadaire, le coût est d'environ 2-7 $ par client et par mois,
plus ~1-3 $ pour ses JD privées. C'est compatible avec un prix de 29 €. À faible densité (M1-M6), le B2C est
**déficitaire sur le panel** → justifie l'audit payant unique et le B2B.

⚠ Choix du modèle = **arbitrage entre représentativité et coût**. Les modèles « nano/lite » coûtent moins cher,
mais ressemblent moins à ce que voit un recruteur dans l'app. V0 : modèles « mini/Haiku/sonar/Flash-Lite », puis
calibration (§9). Si l'accord API/app est inférieur à 80 %, on passe aux modèles supérieurs.

## 11. RGPD et stockage (décision Legal & Trust)

| Donnée | Stockage | Durée |
|---|---|---|
| Réponse brute du LLM | **Chiffrée**, pour débogage et audit de l'appariement | **7 jours**, puis suppression |
| Par tirage | moteur, version du modèle, id de formulation, id de cluster, horodatage, `client_match`, `match_type`, rang du client, URL citées **du client**, **domaines** cités (tiers inclus), hash de la réponse | durée du contrat + 12 mois |
| Noms de tiers | **Jamais persistés** (masquage NER avant écriture) | — |
| Identité du client | Fournie par lui, base légale : contrat | jusqu'à suppression du compte |
| JD | Nettoyées des contacts | durée du contrat |

Base légale du traitement accessoire de données de tiers (elles apparaissent dans les réponses) : intérêt légitime
+ minimisation (masquage immédiat, aucune réutilisation). DPA à signer avec chaque fournisseur de LLM. **À faire valider
par un juriste avant la première facturation.**

## 12. Ce que la mesure ne prétend PAS

- Elle ne mesure pas le canal 2 (agent dans la session connectée du recruteur) ni le canal 3 (bases propriétaires).
- Elle ne prédit pas les missions obtenues.
- Elle ne reproduit pas exactement l'app grand public : elle en donne une **estimation calibrée**.

## LLM Discoverability Rate (LDR) — ajout du 2026-09-20

> Métrique demandée par le founder (contraintes 4, 5 et 11, `foundations/ARCHITECTURE_ANONYME.md`). Implémentée dans
> `packages/stats/src/discoverability.ts` et `bots.ts`. **Cible 90 % = KPI, jamais une garantie.**

**Définition.** Pour un profil `p` et un ensemble de requêtes éligibles `Q`, le LDR est la part des tirages où le profil est
**cité** dans la réponse (pseudonyme nommé ou URL de sa page), mesurée sur `n` tirages répétés, **toujours publiée avec son
intervalle de Wilson à 95 %**. Décliné **par moteur** et **par requête**, parce que les causes d'échec diffèrent.

**Règles de publication, appliquées par le code :**
- `n < 10` tirages → le taux est calculé mais **marqué non publiable** : on affiche « trop peu de tirages », jamais un chiffre.
- Un profil jamais cité garde une **borne haute strictement positive** : « 0 % » ne signifie pas « impossible ».
- « Profil rendu visible » = cité au moins une fois **et** borne basse de l'intervalle > 0 (même définition que la north star).
- LDR global = tous les tirages confondus, donc **pondéré par le nombre de tirages** ; publié avec sa date, son `n` et la liste
  des moteurs.

**Deux nombres séparés, jamais confondus :**

| Mesure | Ce que c'est | Colonne |
|---|---|---|
| **Taux de récupération** | Le moteur est **venu chercher** la page (journaux serveur : `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Googlebot`, `Bingbot`, `BraveBot`) | **CONTRÔLÉ** — nous pouvons le prouver |
| **LDR** | La réponse **nous a cités** | **NON GARANTI** — décidé par le moteur |

`botHits()` lit les journaux d'accès au format courant, ignore les humains et les lignes illisibles, compte par URL et par
robot avec la **date de dernière visite**, et — c'est la ligne la plus utile du rapport — **liste les pages qu'aucun robot
d'IA n'est jamais venu chercher**.
