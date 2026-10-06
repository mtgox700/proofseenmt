# R2 — Concurrence & positionnement

**Pour :** Victoria Chen (CRO/CPO), War Room
**Date de consultation (toutes sources) :** 2026-09-18
**Méthode :** WebFetch des pages d'accueil / prix / inscription ; quand une page est bloquée (403, rendu JS, domaine refusé), recours à une source secondaire marquée **SECONDAIRE**. Les citations font moins de 15 mots, tout le reste est paraphrasé.

**Rappel produit :** mesurer si un freelance tech apparaît quand un recruteur demande à un LLM (ChatGPT, Claude, Perplexity, Gemini) des profils pour une offre, expliquer pourquoi, aider à corriger honnêtement, puis re-mesurer. Offre B2C (audit gratuit, audit à 49 €, Pro à 29 €/mois), puis B2B pour le portage et les ESN (490 à 2 990 €/mois).

---

## 0. Accessibilité des sources

| Site | Page | Statut au 2026-09-18 |
|---|---|---|
| peec.ai | Accueil | OK |
| peec.ai/pricing | Prix | Lisible, mais **aucun montant affiché** (rendu JS probable). Montants tirés du SECONDAIRE |
| otterly.ai | Accueil | OK (1er essai refusé : « domain safety », 2e essai OK) |
| otterly.ai/pricing | Prix | 1er essai refusé, 2e essai OK |
| tryprofound.com (accueil, www et sans www) | Accueil | **Refusé** (« Unable to verify if domain is safe »). Complété par du SECONDAIRE |
| tryprofound.com/pricing | Prix | OK (mais seuls les paliers Trial et Enterprise sont affichés, voir plus bas) |
| jobscan.co | Accueil | OK |
| jobscan.co/pricing | Prix | 301 vers app.jobscan.co/plan, page vide (JS). Données tirées du SECONDAIRE |
| tealhq.com, /pricing, help.tealhq.com | Tout | **403**. Données tirées du SECONDAIRE uniquement |
| malt.fr, malt.fr/freelancer, help.malt.com | Tout | **403**. Données tirées du SECONDAIRE uniquement |
| aivisibility.pro | Accueil | OK ; /pricing en **404** |
| visby.ai, /pricing | Accueil + prix | OK |

---

## 1. Fiches concurrents

### 1.1 Peec AI — GEO / suivi de visibilité IA (B2B marketing)

- **Promesse :** outil d'analytics de la recherche IA pour les équipes marketing. Il mesure la visibilité, la position et le sentiment d'une marque dans les LLM et la compare aux concurrents. Citation : « AI search analytics for marketing teams ». Source : https://peec.ai (consulté le 2026-09-18).
- **Cible :** équipes marketing, SEO et contenu, marques et agences. Les descriptions des paliers visent les « SEO and content managers », les « SEO teams » et les « marketing teams ». Source : https://peec.ai/pricing (2026-09-18).
- **Prix :** la page officielle affiche quatre paliers (Starter, Pro, Advanced, Enterprise « Custom »), en mensuel ou annuel, **sans aucun montant visible** dans le contenu récupéré. Source : https://peec.ai/pricing (2026-09-18).
  - SECONDAIRE : Starter à 85 €/mois (50 prompts), Pro à 205 €/mois (150 prompts), Advanced à 425 €/mois (350 prompts). En annuel : 70, 180 et 360 €/mois. En USD : 95, 245 et 495 $. Trois modèles d'IA au choix parmi six, nombre de sièges illimité. Offres agence à crédits à partir de 245 $/mois. Sources : https://www.aeolabs.ai/blog/peec-ai-review , https://geotoolbox.ai/blog/what-is-peec-ai (résultats de recherche du 2026-09-18).
- **Inscription :** CTA principal « Start Free Trial », plus « Talk to Sales ». Source : https://peec.ai (2026-09-18). La durée de l'essai et la question de la carte bancaire **ne figurent pas** sur la page. SECONDAIRE : essai de 7 jours sans carte bancaire. Sources : https://generatemore.ai/blog/peec-ai-review , https://www.frase.io/blog/peec-ai-alternatives (2026-09-18).
- **Preuves :** « 3000+ brands and agencies », note G2 de 4,9/5, témoignage de Lily Ray (VP SEO Strategy chez Amsive), mention d'une recommandation fréquente sur Reddit. Source : https://peec.ai (2026-09-18).
- **Ce qu'ils taisent :** aucune mise en garde sur la variabilité des réponses des LLM (non-déterminisme, écarts d'un run à l'autre). Les recommandations restent génériques (LinkedIn, subreddits, relations presse digitales). L'outil est centré sur la marque ou l'entreprise, **pas sur une personne**, et ne couvre aucun scénario de sourcing de talents. Les prix ne sont pas lisibles sans JS. Source : https://peec.ai (2026-09-18).
- **Ton :** professionnel, data-driven, accessible.

### 1.2 Otterly.ai — GEO / suivi de visibilité IA (du solo à l'Enterprise)

- **Promesse :** savoir où une marque apparaît dans la recherche IA, obtenir des mentions et des citations dans ChatGPT, Perplexity, AI Overviews, AI Mode, Gemini et Copilot. Citation : « We otter know where your brand shows up on AI Search ». Source : https://otterly.ai (2026-09-18).
- **Cible :** équipes marketing, agences, SEO, grandes marques, mais aussi **solopreneurs et fondateurs de petites entreprises**. Source : https://otterly.ai (2026-09-18).
- **Prix :**
  - Lite : 29 $/mois (15 prompts, 4 moteurs, 1 000 audits d'URL GEO par mois).
  - Standard : 189 $/mois (100 prompts, API, MCP).
  - Premium : 489 $/mois (400 prompts).
  - Enterprise : sur mesure, à partir de 1 000 $/mois.
  - Claude, AI Mode et Gemini sont vendus en add-on. L'annuel donne −15 %.
  - Source : https://otterly.ai/pricing (2026-09-18).
- **Inscription :** « Start Free Trial » et « Book a Demo ». La FAQ indique qu'**aucune carte bancaire n'est demandée**. Incohérence sur la page : un essai de **7 jours** dans la FAQ, un bouton qui annonce **14 jours**. Outils gratuits proposés : AI keyword research, GEO Content Check, AI Crawler Simulation. Source : https://otterly.ai (2026-09-18).
- **Preuves :** plus de 40 000 professionnels du marketing, logos (Roche, BenQ, Opera, Auto1…), note G2 de 4,8/5, Gartner Cool Vendor 2025, G2 High Performer, OMR Leader, études de cas (Bacula, Instant, Stella Rising), plus de 20 témoignages nominatifs. Source : https://otterly.ai (2026-09-18).
- **Ce qu'ils taisent :** l'offre d'entrée à 29 $ ne couvre que 4 moteurs, et Claude et Gemini sont payants en plus. Rien sur la variabilité des LLM. Aucun cas « personne » ou « candidat ». Les chiffres promotionnels (par exemple les mentions Adidas) sont présentés comme des démonstrations, sans méthode décrite. Source : https://otterly.ai , https://otterly.ai/pricing (2026-09-18).
- **Ton :** ludique (jeux de mots sur « otter »), rassurant, orienté simplicité.

### 1.3 Profound — GEO Enterprise

- **Promesse (SECONDAIRE, accueil inaccessible) :** identifier les prompts qu'utilisent les acheteurs d'une marque et augmenter la fréquence de ses mentions dans les chatbots. Source : https://siliconangle.com/2026/09/15/profound-raises-180m-to-boost-brands-visibility-in-ai-services/ (2026-09-18).
- **Cible :** grands comptes. Clients cités : Target, Walmart, Figma, MongoDB, Charlotte Tilbury, U.S. Bank ; « 16% of Fortune 500 » selon le SECONDAIRE. Même source (2026-09-18).
- **Prix (page officielle) :**
  - Trial : gratuit, 10 prompts uniques exécutés **une seule fois**, ChatGPT uniquement, 5 recherches de volume de prompts, crédits « AI Marketer » limités.
  - Enterprise : sur mesure, jusqu'à 9 moteurs (ChatGPT, Perplexity, AI Mode, Gemini, Copilot, DeepSeek, Claude, AI Overviews, Exa), SSO/SAML, SOC 2, API.
  - Offre agence évoquée à 400 crédits par mois et par client.
  - Source : https://www.tryprofound.com/pricing (2026-09-18).
  - SECONDAIRE (contradictoire avec la page actuelle) : Starter à 99 $/mois (ChatGPT seul) et Growth à 399 $/mois (3 moteurs), **facturés à l'année uniquement**. Source : https://www.get-ryze.ai/blog/profound-pricing-2026 , https://www.g2.com/products/profound/pricing (2026-09-18). **Ces paliers n'apparaissent pas sur la page prix consultée ce jour.**
- **Inscription :** l'essai gratuit est en libre-service (« Get Started ») ; l'Enterprise passe par une **démo commerciale obligatoire** (« Get a Demo »). Source : https://www.tryprofound.com/pricing (2026-09-18).
- **Preuves :** levée de fonds de Series D de 180 M$ (valorisation de 1,8 Md$ selon le SECONDAIRE), témoignage de Statsig (« the deepest and most complete tool in the market »), logos Fortune 500. Sources : https://www.tryprofound.com/pricing , https://siliconangle.com/2026/09/15/profound-raises-180m-to-boost-brands-visibility-in-ai-services/ (2026-09-18).
- **Ce qu'ils taisent :** aucun prix public pour le plan payant. L'essai n'est qu'une photo ponctuelle (un seul run), sans re-mesure. Aucun angle « individu » ou « recrutement ». La réputation reste inaccessible au marché des TPE et des indépendants.
- **Ton :** enterprise, autoritaire, « category leader ».

### 1.4 Jobscan — optimisation de CV pour les ATS (B2C chercheurs d'emploi)

- **Promesse :** optimiser son CV pour l'ATS précis de chaque offre, en détectant l'ATS et ses règles de parsing et de pondération. Citation : « Optimize your resume for the exact ATS ». Source : https://www.jobscan.co (2026-09-18).
- **Cible :** chercheurs d'emploi salariés inquiets du filtrage par les ATS. Source : idem.
- **Prix :** la page officielle redirige vers app.jobscan.co/plan, qui est vide (JS). SECONDAIRE, avec des chiffres **discordants selon les sources** :
  - Offre gratuite : 5 scans par mois, sans expiration.
  - Premium mensuel : 49,95 $/mois.
  - Premium trimestriel : 89,95 $ par trimestre (environ 29,98 $/mois).
  - Une autre source cite un annuel à environ 24,95 $/mois et un « Premium+ » à 89,95 $/mois.
  - Sources : https://pitchmeai.com/blog/jobscan-pricing-plans , https://makerstack.co/reviews/jobscan-review/ (2026-09-18).
- **Inscription :** CTA « Scan Your Resume For Free », puis création de compte. Source : https://www.jobscan.co (2026-09-18). SECONDAIRE : essai Premium sans carte bancaire ; remboursement seulement dans les 2 jours calendaires, si aucune fonctionnalité Premium n'a servi, avec 3,5 % de frais. Source : https://pitchmeai.com/blog/jobscan-pricing-plans (2026-09-18).
- **Preuves :** logos des entreprises où des utilisateurs ont été embauchés (Apple, Meta, Google, Amazon, Airbnb, Nvidia), la promesse de « 3x more interview callbacks », la statistique « 99% of Fortune 500 » (utilisation des ATS), un badge WCAG 2.1 AA. Source : https://www.jobscan.co (2026-09-18).
- **Ce qu'ils taisent :** **aucune méthodologie ni source** pour le « 3x » sur la page. Tout repose sur l'ATS, c'est-à-dire un canal où le candidat postule lui-même. Rien sur le sourcing proactif par un recruteur, ni sur les LLM comme moteurs de recommandation. Rien pour les freelances.
- **Ton :** confiant, technique, orienté performance.

### 1.5 Teal — copilote de recherche d'emploi (B2C)

- **Promesse (SECONDAIRE, 403 sur tout le site) :** CV IA, suivi de candidatures, matching par mots-clés. Le titre de la page d'accueil, tel qu'indexé : « Land Interviews 6x Faster ». Sources : résultat de recherche sur https://www.tealhq.com/ et https://www.unite.ai/tealhq-review/ (2026-09-18).
- **Cible :** chercheurs d'emploi salariés. SECONDAIRE : plus de 4 millions d'utilisateurs revendiqués. Source : idem.
- **Prix (SECONDAIRE, discordant) :**
  - Première version : 13 $/semaine, 29 $/mois, 79 $ par trimestre. Source : https://applyarc.com/compare/teal-pricing (résumé de recherche du 2026-09-18). Attention : la page elle-même, une fois récupérée, dit ne pas avoir pu vérifier le prix courant.
  - Deuxième version : environ 9 $/semaine, 29 $/mois, 79 $ par trimestre, environ 15 $/mois en annuel.
  - Offre gratuite : suivi de candidatures illimité, extension Chrome, CV de base, 10 crédits IA.
  - Source : https://blog.loopcv.pro/teal-hq-review/ (article du 2026-07-04, consulté le 2026-09-18).
- **Inscription :** modèle freemium, puis Teal+. Carte bancaire et garantie : **non vérifiables** (403).
- **Preuves :** « 6X » plus d'entretiens, plus de 4 M d'utilisateurs (SECONDAIRE, méthode non vérifiable).
- **Ce qu'ils taisent :** la personne postule toujours elle-même (SECONDAIRE, loopcv). Aucun angle « être trouvé ». Le paiement à la semaine gonfle le coût réel, point critiqué par applyarc (SECONDAIRE).
- **Ton :** coach bienveillant, orienté productivité (à confirmer, SECONDAIRE).

### 1.6 Malt (côté freelance) — marketplace

- **Accès :** malt.fr, malt.fr/freelancer et help.malt.com renvoient tous un **403**. Tout ce qui suit est SECONDAIRE.
- **Promesse :** trouver des missions via la plus grande marketplace freelance d'Europe. Chiffres discordants selon les sources : de 594 000 à 1 M de freelances, de 70 000 à 90 000 clients, 7 pays. Source : https://lefreelance.fr/articles/plateforme-freelance/ et autres résultats de recherche (2026-09-18).
- **Cible :** freelances ayant un statut légal (micro-entreprise, EI, société, portage). Source : https://lefreelance.fr/articles/malt-avis-2026/ (article du 2026-08-06, consulté le 2026-09-18).
- **Frais freelance :** 10 % HT sur une mission, soit 12 % TTC pour un micro-entrepreneur non assujetti à la TVA. 5 % HT après 6 mois avec le même client. 2 % HT si le freelance amène son propre client. Inscription gratuite, sans abonnement obligatoire. Source : https://lefreelance.fr/articles/malt-avis-2026/ (2026-09-18). La page officielle https://help.malt.com/hc/fr/articles/29567589850002-Les-offres-et-frais-de-service-Malt est en 403.
- **Visibilité et « boost » :** selon le SECONDAIRE, il n'existe **pas d'option payante pour être mis en avant**. La visibilité dépend des avis, de la réactivité, des recommandations et de la mise à jour des missions récentes (le signal a été renforcé par une mise à jour de l'algorithme en avril 2026). Le badge Super Malter demande une note moyenne d'au moins 4,5. Malt publie lui-même des guides « SEO » pour optimiser son profil. Sources : https://lefreelance.fr/articles/malt-avis-2026/ , https://www.malt.fr/resources/article/booster-son-profil-malt-grace-aux-techniques-seo (titre indexé, page en 403) (2026-09-18).
- **Malt Strategy :** communauté fermée d'environ 20 000 consultants en management et managers de transition vérifiés (issue du rachat de Comatch en 2022). Les profils **ne sont pas visibles dans le moteur de recherche Malt** ; l'équipe contacte les membres par email. Il faut au moins 2 ans en cabinet de premier plan (MBB) ou 5 ans dans une entreprise reconnue. Source : https://help.malt.com/hc/en-150/articles/29533477499538-What-is-Malt-Strategy (résumé de recherche, 2026-09-18). **Ce n'est pas un produit de visibilité payant pour les freelances tech.**
- **Ce qu'ils taisent :** l'algorithme de classement est opaque, et le démarrage à froid est pénalisant sans avis. La visibilité est confinée à Malt : **rien sur la présence du freelance dans les LLM**, alors que les recruteurs peuvent sourcer hors plateforme.
- **Ton :** communautaire, rassurant, « leader européen ».

### 1.7 Bonus : aivisibility.pro — vérificateur gratuit

- **Promesse :** voir si ChatGPT, Gemini, Claude et Perplexity recommandent une marque, et où ils l'oublient. Citation : « where they leave you out ». Source : https://aivisibility.pro (2026-09-18).
- **Cible :** marques de tous secteurs (SaaS, e-commerce, commerce local, cabinets, **consultants**…).
- **Prix :** « free to run », sans carte ; /pricing renvoie une 404. Inscription seulement pour conserver l'historique.
- **Preuves :** aucune preuve sociale chiffrée ; la page met en avant la méthode (prompts réels, score, concurrents, sources citées, rapport partageable).
- **Ce qu'ils taisent :** modèle économique invisible, aucune explication causale approfondie, aucune boucle de correction ni de re-mesure structurée.
- **Ton :** direct, urgent (« Being invisible costs you quietly »), pratique.

### 1.8 Bonus : Visby

- **Promesse :** se présenter comme la première plateforme de visibilité IA complète. Citation : « The first complete AI visibility platform ». Source : https://visby.ai (2026-09-18).
- **Prix :**
  - Starter : 79 $/mois (15 prompts, 1 siège, 5 articles générés).
  - Growth : 199 $/mois (90 prompts).
  - Enterprise : sur devis, avec un audit GEO par un expert.
  - Moteurs couverts : ChatGPT, Claude, Gemini, Google AIO. Facturation mensuelle, « Cancel anytime ».
  - Source : https://visby.ai/pricing (2026-09-18).
- **Inscription :** essai gratuit (« Start Free Trial »), « Free Audit », « Book Demo ».
- **Preuves :** plus de 2 500 équipes, plus de 100 avis G2, plus de 60 avis Trustpilot. Source : https://visby.ai (2026-09-18).
- **Ce qu'ils taisent :** l'**optimisation passe par la génération d'articles**, un levier contestable sur le plan de l'honnêteté du signal. Aucun angle « personne ».
- **Ton :** assuré, pédagogique, action (« Stop guessing »).

---

## 2. Tableau comparatif

| | Cible | Entrée payante | Essai / gratuit | Carte bancaire à l'essai | Démo commerciale | Unité mesurée |
|---|---|---|---|---|---|---|
| Peec AI | Marketing, SEO | 85 €/mois (SEC.) | 7 j (SEC.) | Non (SEC.) | Optionnelle (Enterprise) | Marque |
| Otterly | Marketing → solo | 29 $/mois | 7 ou 14 j (incohérent) | Non | Optionnelle | Marque, URL |
| Profound | Enterprise | 99 $/mois annuel (SEC., non affiché) | 1 run, 10 prompts | n.c. | Obligatoire (Enterprise) | Marque |
| Visby | PME, marketing | 79 $/mois | Essai + audit gratuit | n.c. | Optionnelle | Marque |
| aivisibility.pro | Toutes marques | — | Gratuit | Non | Non | Marque |
| Jobscan | Candidats salariés | 49,95 $/mois (SEC.) | 5 scans/mois | Non (SEC.) | Non | CV vs ATS |
| Teal | Candidats salariés | ~29 $/mois (SEC.) | Freemium | n.c. | Non | CV, candidatures |
| Malt | Freelances | Commission de 5-10 % HT | Inscription gratuite | — | Non | Profil sur Malt |

---

## 3. Codes de la catégorie (ce que tout le monde promet)

1. **« Voir où vous apparaissez »** : mesurer mentions, citations, position et sentiment dans ChatGPT, Perplexity et Gemini (Peec, Otterly, Profound, Visby, aivisibility.pro).
2. **Le benchmark concurrentiel** est un argument central : « où vos concurrents sont cités à votre place ».
3. **Des recommandations actionnables**, restées génériques (RP digitale, Reddit, LinkedIn, contenu, articles générés).
4. **Un essai gratuit sans carte** comme porte d'entrée standard, avec l'Enterprise sur démo.
5. **Une preuve sociale massive et chiffrée** : nombre d'utilisateurs (3 000+, 40 000+, 2 500+, 4 M+), notes G2, logos Fortune 500, levées de fonds.
6. **Côté carrière (Jobscan, Teal)**, des multiplicateurs de résultat **sans méthode affichée** (« 3x », « 6X ») et un ATS présenté comme l'ennemi à battre.
7. **Aucun acteur ne parle de la variabilité des LLM** (non-déterminisme, écart entre runs, intervalle de confiance).

## 4. Espaces libres pour nous

1. **L'unité « personne » plutôt que « marque ».** Aucun outil GEO ne mesure un individu. Aucun outil carrière ne mesure les LLM. Le croisement des deux, « freelance × requête de sourcing recruteur », est vide dans tout ce qui a été consulté.
2. **Le scénario « être trouvé » plutôt que « postuler ».** Jobscan et Teal optimisent la candidature entrante ; nous mesurons le **sourcing sortant par LLM**, un canal qu'aucun d'eux ne couvre.
3. **La mesure honnête et reproductible.** Personne n'affiche de méthode, d'échantillonnage multi-runs ni de marge d'incertitude. C'est un différenciateur de confiance, rare dans une catégorie saturée de promesses.
4. **La correction honnête.** Visby génère des articles et Jobscan pousse les mots-clés. L'espace « corriger la vérité de son empreinte publique (GitHub, profils, portfolio, cohérence) sans fabriquer de signal » est libre.
5. **Le prix pour un individu.** L'entrée GEO démarre à 29-99 $/mois, pour une marque et avec peu de prompts ; l'entrée carrière est à 29-50 $/mois, pour l'ATS. Une offre à 0 €, 49 € et 29 €/mois dédiée au freelance tech français n'a pas d'équivalent direct.
6. **La visibilité hors plateforme pour les freelances.** Malt ne vend pas de boost et ne mesure que son propre moteur. Le freelance n'a aucun moyen de savoir s'il existe pour un recruteur qui interroge un LLM.
7. **Le B2B portage et ESN.** Les outils GEO vendent aux équipes marketing, pas aux structures qui « vendent » des consultants. Mesurer la visibilité IA d'un vivier de consultants est un usage non adressé.

## 5. Cinq recommandations de positionnement et de messaging

1. **Nommer la catégorie de la personne, pas de la marque.** Par exemple : « Mesurez si les IA vous proposent quand un recruteur cherche votre profil. » Éviter le jargon GEO et AEO face au B2C, le réserver à la page B2B.
2. **Faire de l'honnêteté méthodologique l'arme de preuve.** Afficher sur chaque rapport le nombre de runs, les modèles et les dates, le taux d'apparition sous forme de fourchette, et une mention explicite du type : « les réponses des LLM varient ; nous mesurons une tendance, pas une garantie ». C'est l'exact inverse des « 3x » et « 6X » sans source de la catégorie.
3. **Promettre la compréhension et la correction, pas le classement.** Structurer le message en trois temps : « Où vous en êtes, pourquoi, quoi corriger ». Bannir « n°1 », « garanti » et « boost ». Formuler les corrections comme des actions vérifiables sur son empreinte réelle (profil, dépôts, cohérence des intitulés), jamais comme du contenu fabriqué.
4. **Se positionner comme complémentaire de Malt et du CV/ATS, pas comme un substitut.** Par exemple : « Votre profil Malt et votre CV couvrent les canaux où vous postulez ; nous couvrons celui où l'on vous cherche. » Cela désamorce l'objection « j'ai déjà Malt » et crée une porte d'entrée vers le B2B portage et ESN, pour un vivier de consultants.
5. **Adopter les codes d'entrée de la catégorie, sans la surenchère.** Audit gratuit instantané sans carte (le standard de fait chez Otterly, Peec et aivisibility.pro). Audit à 49 € présenté comme un diagnostic ponctuel et complet, plutôt que comme un palier caché. Pro à 29 €/mois vendu sur la **re-mesure** (« vérifiez que vos corrections ont un effet »), une boucle que l'essai à run unique de Profound ne propose pas. Preuve sociale : des cas réels anonymisés avant/après, avec leur méthode, plutôt que des compteurs d'utilisateurs.

---

## 6. Limites de ce rapport

- Teal et Malt : **aucune page officielle lisible** (403). Leurs fiches reposent entièrement sur des sources secondaires, dont certaines se contredisent (prix de Teal, nombre de freelances Malt).
- Prix de Peec, Jobscan et Profound (paliers Starter et Growth) : **non visibles sur la page officielle** au 2026-09-18. Les chiffres viennent de sources secondaires et restent à re-vérifier dans un navigateur avant tout usage en pitch.
- Recherche « outil qui vérifie si ChatGPT recommande un freelance ou un candidat » : **aucun concurrent direct identifié** dans les résultats (WebSearch du 2026-09-18). L'absence de résultat ne prouve pas l'absence d'acteurs ; une veille complémentaire (Product Hunt, LinkedIn, marché FR) est recommandée.
