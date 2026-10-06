# PRODUCT THESIS — Phase 3, convergence (2026-09-18)

> ⚠ **CORRECTION du 2026-09-18 — décision du founder** : le modèle économique devient **« passerelle » A + D**
> (`foundations/MODELE_PASSERELLE.md`). La mesure et la correction (thèse ci-dessous) deviennent l'**étage 1** (acquisition).
> L'option C5 « devenir la source », parquée ici à M12+, est **avancée** sous forme de pages vérifiées sur proofseen.com, avec contact et
> commission via Proofseen. Test dès P0, sans code. Refus maintenu : pas de classement automatique pour les entreprises
> avant l'avis du juriste (AI Act).
>
> **CORRECTION du 2026-09-20 (`foundations/PIVOT_ANONYME.md`, décisions du founder)** : l'**anonymat** n'est plus refusé en bloc —
> il devient une **option de confidentialité** du freelance (nom partiel), **jamais un moteur de découverte** : ce qui rend citable,
> ce sont les mentions tierces et la surface nominative, qu'un profil anonyme n'a pas. En conséquence : le hub et la surface
> nominative sont **maintenus** ; une **page d'entrée unique** (« Freelances X à Paris — profils vérifiés ») est testée comme 3e bras,
> sans rouvrir l'annuaire programmatique ; un **prototype de connecteur MCP** (canal « être une source dans l'assistant ») est lancé
> en P0. « Référencé à 100 % » reste interdit.

## 0. Verdict du board sur l'idée du founder

**Maxwell** : « L'idée telle qu'écrite a **deux défauts**. Aucun n'est fatal, mais ils changent le produit. »

1. **Le mécanisme est faux.** Un LLM ne « va pas sur LinkedIn » : les fetchers à la demande y sont bloqués.
   Le profil remonte par un index de recherche (canal 1), par un agent qui navigue dans la session du
   recruteur (canal 2) ou par une base branchée au LLM (canal 3). Seul le canal 1 est mesurable
   et optimisable honnêtement par un tiers.
2. **La demande n'est pas prouvée.** Aucune donnée publique sur la part des recruteurs qui sourcent via un LLM.

**Victoria** : « "Enrichir les profils" seul, c'est un portfolio. Read.cv, Polywork et bento.me sont morts en
13 mois. Les leviers d'optimisation sont banals et publics, donc personne ne paiera pour eux. On paiera
pour savoir **si je sors, pourquoi, et si ça bouge**. **Le produit, c'est la mesure. L'optimisation en est la conséquence.** »

**Décision** : on ne tue pas l'idée, on la **retourne**. Et on ajoute un **garde-fou de demande** (U1) avant tout build SaaS.

## 1. Notation ICE (Impact, Confiance, Facilité ; score = moyenne)

| id | I | C | E | Score | Justification (1 ligne) | Verdict |
|---|---|---|---|---|---|---|
| I01 Page canonique SSR | 7 | 8 | 8 | 7.7 | HTML visible et SSR = levier prouvé | ✅ garde (brique fix) |
| I02 Kit d'indexation 3 index | 7 | 8 | 9 | 8.0 | Chaque LLM dépend d'un index différent : prouvé | ✅ garde |
| I03 Pages preuve par mission | 8 | 6 | 7 | 7.0 | Stats et citations = levier GEO ; aussi ce qui convainc le recruteur | ✅ garde |
| I04 Vérificateur bots/SSR | 4 | 9 | 10 | 7.7 | Faible impact seul, mais aimant à leads gratuit | ✅ feature gratuite |
| I05 Moteur de fraîcheur | 5 | 6 | 9 | 6.7 | Fraîcheur corrélée ; justifie l'abonnement | ✅ garde |
| I06 JSON-LD + llms.txt comme levier | 2 | 2 | 9 | 4.3 | Réfuté (diff-in-diff Ahrefs, 97 % des llms.txt jamais lus) | ❌ **TUÉ** comme argument de vente ; hygiène silencieuse seulement |
| I07 Recruiter Simulator | 10 | 7 | 6 | 7.7 | Le seul actif défendable, et personne ne le fait | ✅ **CŒUR** |
| I08 Panel partagé par cluster | 9 | 6 | 6 | 7.0 | Coût marginal par client ≈ 0 : c'est l'économie unitaire | ✅ garde |
| I09 Carte des sources citées | 8 | 7 | 7 | 7.3 | Dit **où** investir son temps : forte valeur perçue | ✅ garde |
| I10 A/B de formulation | 6 | 4 | 4 | 4.7 | Trop bruité aux volumes V0 | ⏸ parqué (M9+) |
| I11 Calibration API vs app | 7 | 7 | 6 | 6.7 | Sans elle, la mesure est contestable | ✅ obligatoire |
| I12 State of AI Sourcing | 7 | 6 | 6 | 6.3 | Contenu d'autorité, et nos propres « mentions » | ✅ M4+ |
| I13 Prompts de recruteurs réels | 8 | 8 | 6 | 7.3 | Valide ce qu'on mesure | ✅ garde |
| I14 Étude recruteurs | 9 | 8 | 7 | 8.0 | Lève l'inconnue n°1 (U1) | ✅ **immédiat** |
| I15 Fiche shortlist-ready | 7 | 6 | 8 | 7.0 | Ce qui fait passer de « cité » à « contacté » | ✅ fusionnée avec I16 |
| I16 Signaux de fuite | 5 | 5 | 8 | 6.0 | — | ↪ fusionnée dans I15 |
| I17 Outil gratuit recruteur | 6 | 3 | 4 | 4.3 | Biface trop tôt, dilue le focus | ❌ tuée |
| I18 Audit gratuit 1 JD | 8 | 7 | 7 | 7.3 | Entonnoir et preuve de valeur immédiate | ✅ garde |
| I19 Paiement au résultat | 7 | 2 | 3 | 4.0 | Attribution impossible à prouver (D) | ❌ tuée |
| I20 Offre clé en main | 6 | 8 | 8 | 7.3 | Cash et apprentissage tout de suite, non scalable | ✅ phase 1 seulement |
| I21 Alerte d'apparition | 6 | 6 | 6 | 6.0 | Rétention | ✅ V1 |
| I22 Extension navigateur | 5 | 4 | 4 | 4.3 | Zone grise CGU, maintenance lourde | ❌ tuée |
| I23 Bundle portage | 8 | 5 | 6 | 6.3 | Distribution B2B2C crédible | ✅ pilote M4 |
| I24 Label vérifié | 9 | 5 | 4 | 6.0 | Moat futur de l'index | ⏸ parqué (M9+) |
| I25 Masquage NER des tiers | 6 | 9 | 7 | 7.3 | RGPD : non négociable | ✅ obligatoire |
| I26 Charte white-hat | 6 | 9 | 9 | 8.0 | Marque et défense contre la perception black-hat | ✅ obligatoire |
| I27 API officielles seulement | 6 | 9 | 8 | 7.7 | Scraper l'UI de ChatGPT = hors CGU | ✅ obligatoire |
| I28 ESN « Vivier » | 9 | 5 | 5 | 6.3 | Douleur de l'intercontrat forte (HYPOTHÈSE), cycle de vente long | ✅ M6+ |
| I29 Portage : visibilité comme argument | 8 | 5 | 6 | 6.3 | 518 sociétés qui se battent pour attirer des consultants | ✅ **premier B2B** |
| I30 Écoles/bootcamps | 6 | 4 | 6 | 5.3 | Juniors peu sourcés par LLM (HYPOTHÈSE) | ⏸ parqué |
| I31 API pour plateformes | 7 | 3 | 4 | 4.7 | Les plateformes ont leur propre matching | ⏸ parqué (M12+) |
| I32 Freemium 0/29/79 | 6 | 6 | 8 | 6.7 | Aligné sur la disposition à payer CV/ATS | ✅ garde |
| I33 Anglophone M9 | 9 | 5 | 5 | 6.3 | Indispensable pour 500 K€ | ✅ M9-M12 |
| I34 Monorepo TS | 5 | 8 | 8 | 7.0 | Cohérent avec la stack du founder | ✅ infra |
| I35 Échantillonnage adaptatif | 7 | 7 | 6 | 6.7 | Divise le coût API | ✅ V1 |
| I36 Cache par cluster | 5 | 6 | 8 | 6.3 | — | ✅ V1 |
| I37 Tout à la main au début | 6 | 9 | 9 | 8.0 | Apprendre avant d'automatiser | ✅ V0 |
| I38 ★ Talent MCP | 10 | 3 | 3 | 5.3 | Biface ; Upwork et SeekOut déjà présents dans les LLM | ⏸ **option M12+** |
| I39 ★ Vendre la mesure seule | 8 | 5 | 6 | 6.3 | Pivot de repli solide | ↪ absorbée dans la thèse |
| I40 ★ App « Hire freelancers » | 9 | 2 | 2 | 4.3 | Upwork y est déjà, biface, capital élevé | ❌ tuée |
| I41 ★ Coopérative de mentions | 5 | 4 | 6 | 5.0 | Dérive facile vers un schéma de liens artificiels | ❌ tuée |
| I42 ★ MCP personnel | 4 | 3 | 7 | 4.7 | Aucun recruteur n'ajoute un MCP par personne | ❌ tuée |
| I43 ★ Agence de placement IA-native | 8 | 4 | 4 | 5.3 | Métier différent ; bon plan B pour l'issue B | ⏸ plan B |
| I44 ★ Simulator open source | 7 | 5 | 6 | 6.0 | Crédibilité, mais offre la mesure aux concurrents | ⏸ décision M6 |
| I45 Qui sort à ta place | 7 | 6 | 6 | 6.3 | Utile, à condition de ne montrer que les domaines | ✅ V1 (sans noms) |
| I46 Posts/articles LinkedIn tirés des missions | 8 | 6 | 7 | 7.0 | Les posts/articles LinkedIn montent dans les citations | ✅ garde (publication manuelle) |
| I47 ★ Annuaire programmatique | 7 | 3 | 6 | 5.3 | Contenu de masse = politique anti-spam de Google | ❌ **tuée** |
| I48 Bing AI Performance | 5 | 8 | 9 | 7.3 | Mesure Copilot officielle et gratuite | ✅ expérience 0 |

**Tuées (9)** : I06, I17, I19, I22, I40, I41, I42, I47, plus I16 fusionnée.
**Parquées (7)** : I10, I24, I30, I31, I38, I43, I44.

## 2. Top 5 (concepts regroupés)

| Concept | Idées | Rôle |
|---|---|---|
| **C1 Recruiter Simulator** | I07, I08, I09, I11, I13, I35 | La mesure : le produit |
| **C2 Profile Surface** | I01, I02, I03, I05, I15, I46 | La correction : la conséquence |
| **C3 Audit gratuit + clé en main** | I18, I20, I04 | Go-to-market et cash |
| **C4 Vivier B2B** | I29, I23, I28, I39 | Le chemin vers 500 K€ |
| **C5 Talent MCP / index vérifié** | I38, I24 | L'option « devenir la source » |

## 3. Confrontations deux à deux

| Duel | Gagnant | Pourquoi |
|---|---|---|
| C1 vs C2 | **C1** | C2 sans C1 = un portfolio (catégorie morte). C1 sans C2 = déjà vendable aux ESN (I39). |
| C1 vs C5 | **C1** | C5 est biface et affronte Upwork, SeekOut et LinkedIn. C1 se construit en solo, et chaque client mesuré alimente la future offre de C5. |
| C3 vs C4 | **C3 d'abord, C4 à M4** | C3 génère du cash et des preuves en 30 jours ; C4 a besoin de ces preuves pour vendre. |
| C1+C2 vs C4 | **Fusion** | Même moteur, deux emballages : « mon profil » (B2C) et « mon vivier » (B2B). |

## 4. Les 3 débats contradictoires

### Tension 1 — SaaS d'optimisation VS devenir la source (index / Talent MCP)

- **Scenario Hunter (pour la source)** : « Le canal 3 mange le canal 1. Upwork est déjà dans ChatGPT. Si on n'est pas une base, on optimise pour un canal qui rétrécit. »
- **Maxwell (contre)** : « Une base sans offre ni demande ne vaut rien. Upwork a 800 k profils et une marque ; nous, zéro. Construire C5 maintenant, c'est une marketplace solo : suicide. »
- **Victoria** : « Le canal 1 reste le seul qu'un recruteur utilise **sans abonnement**. Et chaque profil vérifié et mesuré est un actif pour C5 plus tard. »
- **Tranché** : **SaaS de mesure et de correction maintenant.** C5 est une **option** qu'on déclenche à M12 si (a) plus de 1 000 profils vérifiés et
  (b) une mesure qui montre que le canal 3 dépasse le canal 1 chez les recruteurs interrogés.

### Tension 2 — B2C freelances VS B2B ESN/portage d'abord

- **Victoria (B2B)** : « Les maths sont sans appel : 10 200 abonnés B2C = 6 à 8,5 % des freelances IT français. Irréaliste. 333 comptes B2B, c'est concevable. »
- **Freelance Power User (B2C)** : « Je paierai 29 € si tu me montres que je sors, mais je résilierai dès que j'ai une mission, comme avec Jobscan. Il te faut une raison mensuelle : fraîcheur, alertes, dérive des moteurs. »
- **Head of Talent** : « Une ESN met 3 à 6 mois à signer (HYPOTHÈSE). Une société de portage signe plus vite : son business, c'est attirer des consultants. »
- **Elias** : « Le founder est lui-même le client B2C. C'est la boucle d'apprentissage la plus rapide qui existe. »
- **Tranché** : **entrée B2C (le founder et 10 freelances), conçue multi-profils dès le départ, premier B2B = portage à M4.**
  Les ESN viennent à M6+, avec des case studies en main.

### Tension 3 — LLM ouverts VS moteurs de matching internes des plateformes

- **Elias** : « LinkedIn est le domaine n°1 cité. Optimiser le contenu LinkedIn sert **les deux** canaux à la fois. »
- **Legal & Trust** : « Mesurer le classement interne de LinkedIn ou de Malt suppose d'automatiser des recherches dans la plateforme = CGU violées. Ligne rouge. »
- **Retrieval Scientist** : « Le canal 2 (agent dans la session du recruteur) passe par la recherche interne de LinkedIn. On ne peut pas le mesurer, mais on peut **conseiller** : le même contenu y aide. »
- **Tranché** : **on mesure le canal 1 seulement** (API officielles). Pour les plateformes, on **conseille** : checklist
  et réécritures que le freelance applique lui-même. On ne mesure ni n'automatise rien à l'intérieur des plateformes.

## 5. LA THÈSE

> **Le seul outil qui montre à un freelance tech — puis au vivier d'une société de portage ou d'une ESN —
> s'il sort quand un recruteur demande à ChatGPT, Claude, Perplexity ou Gemini de lui trouver quelqu'un,
> quelles sources le font sortir, et quoi corriger honnêtement pour y apparaître.**

| Élément | Contenu |
|---|---|
| **Client cible** | V0 : freelance tech confirmé (TJM 450-600 €), en France. M4 : sociétés de portage. M6+ : ESN. M9+ : anglophones. |
| **Douleur** | « Je ne sais pas si les recruteurs me trouvent quand ils utilisent l'IA, et les plateformes ne me disent rien. » (portage/ESN : « nos consultants sont invisibles, l'intercontrat coûte cher » — HYPOTHÈSE à valider) |
| **Promesse mesurable** | Un score de visibilité (**SoRV@5**) mesuré sur vos JD cibles, dans 4 moteurs, avec intervalle de confiance ; un plan de correction ; une re-mesure qui prouve le delta. **Jamais de « n°1 garanti ».** |
| **Moat** | (1) Le panel de mesure partagé par cluster de JD, avec l'historique qui s'accumule. (2) La bibliothèque de prompts de recruteurs réels. (3) La confiance : white-hat, vérifié, conforme RGPD. (4) Plus tard, l'option C5. |
| **Ce qu'on refuse de construire** | Texte caché ou prompt injection · faux avis ou fausses mentions · automatisation sur LinkedIn/Malt (post, scraping, mesure interne) · scraping de l'UI des apps LLM · annuaire programmatique · « n°1 garanti » · paiement au résultat · marketplace avant M12 · JSON-LD/llms.txt vendus comme leviers. |

## 6. Garde-fous de décision (kill gates)

| Garde-fou | Test | Seuil proposé | Si échec |
|---|---|---|---|
| **G1 Demande** (U1) | 15-20 interviews de recruteurs tech | ≥ 30 % disent sourcer via un LLM au moins une fois par mois | Pivot vers la **visibilité multi-plateformes** (Malt/LinkedIn/Google), sans promesse LLM |
| **G2 Garde-fous des LLM** (U2) | Test J0 de l'expérience 0 | Au moins 2 moteurs sur 4 nomment des individus | Le canal 1 est fermé aux personnes : pivot vers l'issue B ou vers I43 (agence) |
| **G3 Mécanisme** | Expérience 0, J+60 | cf. `EXPERIMENT_0.md` | Arrêt du SaaS ; garder l'outil interne (issue B) |

## 7. Nom

« ReferencementCracker » reste un **nom de code interne**. **Legal & Trust veto** « Cracker » pour la marque :
le mot évoque le black-hat, c'est-à-dire l'exact opposé du positionnement. Pistes (à vérifier : marques, domaines) :
**Shortlisted**, **Citable**, **Sourced**, **Retenu**. C'est une décision du founder.
