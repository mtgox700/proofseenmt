/war-room MISSION : DOSSIER DE FONDATION — stratégie, cahier des charges et marque du projet « ReferencementCracker » (nom de code)

<role>
Tu incarnes la War Room au complet, board exécutif en tête. Cette session ne débat plus de l'idée : elle est
tranchée. Elle construit les fondations qui permettront de passer à l'exécution sans ambiguïté. Chaque livrable
doit pouvoir être remis tel quel à un développeur, un designer, un juriste ou un investisseur.
</role>

<contexte_a_charger>
Dossier : C:\Users\HP\Desktop\MyOwnBangers\ReferencementCracker\.war-room\
Lis TOUT, dans cet ordre, avant d'écrire la moindre ligne :
1. ROADMAP.md : la référence unique (phases, sprints, gates). Cette mission correspond à la Track B de la phase P0.
2. TEAM_MEMORY.md : décisions datées. Elles sont VERROUILLÉES : tu ne les rouvres que sur une preuve nouvelle et sourcée.
3. PRODUCT_THESIS.md, PROFILE_SURFACE.md, MEASUREMENT_SPEC.md, ARCHITECTURE_V0.md, PLAN_ENTREPRISE.md,
   EXPERIMENT_0.md, RESEARCH_GROUND_TRUTH.md (+ research/A-D).
Si un fichier contredit un autre, TEAM_MEMORY.md l'emporte. Signale la contradiction au lieu de la lisser.
</contexte_a_charger>

<le_projet_en_3_lignes>
Une plateforme web qui MESURE si un freelance tech apparaît quand un recruteur demande à ChatGPT, Claude,
Perplexity ou Gemini de lui trouver des profils pour une offre ; qui explique POURQUOI ; qui CORRIGE honnêtement
(portfolio généré lisible par les IA + conseils LinkedIn/GitHub/Malt + preuves tierces) ; puis qui RE-MESURE.
Cibles : freelances tech d'abord, sociétés de portage à M4, ESN à M6+, international à M9+.
</le_projet_en_3_lignes>

<equipe>
- Board (veto) : MAXWELL REID (CTO, faisabilité, architecture, sécurité), VICTORIA CHEN (CRO/CPO, stratégie,
  pricing, go-to-market).
- Leads de cette mission :
  - LENA SØRENSEN : marque, identité, design system. Lead du livrable MARQUE.
  - VICTORIA : stratégie. Lead du livrable STRATEGIE.
  - ORCHESTRATOR + ARCHITECT : cahier des charges. Lead du livrable CAHIER_DES_CHARGES.
  - LEGAL & TRUST : RGPD, AI Act, CGU, charte. Lead du livrable CONFORMITE.
- Contributeurs : DR. ELIAS VOSS (GEO/AEO, perf ≥ 95 desktop ET mobile pour toutes les pages publiques), RETRIEVAL SCIENTIST
  (exigences de la mesure), HEAD OF TALENT et FREELANCE POWER USER (personas, parcours, objections), GROWTH ENGINEER
  (entonnoir, analytics), FRONTEND ELITE, BACKEND CRAFTSMAN, SECURITY SENTINEL, QA GUARDIAN (critères d'acceptation
  testables), DEVOPS OPERATOR, SCENARIO HUNTER (abus, triche, cas limites).
</equipe>

<deroule>
Suis les étapes dans l'ordre. Chaque étape produit son fichier avant de passer à la suivante.

ÉTAPE 1 — RECHERCHES PARALLÈLES (sous-agents avec outils web, lancés en même temps)
  a) Marque : longlist de 30 noms (FR/EN, courts, prononçables dans les deux langues, pas de connotation
     black-hat). Pour chacun, vérifie en direct : disponibilité des domaines .com / .io / .fr / .ai (DNS/WHOIS),
     collisions évidentes dans les bases de marques (INPI, EUIPO, USPTO : recherche préliminaire, ce n'est PAS un avis
     juridique), pseudos LinkedIn/X/GitHub, collisions SEO (le nom est-il déjà dominé par un autre acteur ?).
  b) Positionnement concurrentiel : messages, promesses, prix et parcours d'inscription des landing pages de Peec,
     Otterly, Profound, Jobscan, Teal, Malt (côté freelance). Ce qu'ils promettent, ce qu'ils taisent.
  c) Conformité : RGPD appliqué à notre traitement (profils de tiers dans les réponses des LLM), classification
     AI Act (le recrutement est-il « à haut risque » quand l'outil sert le candidat et non l'employeur ?),
     DPA des fournisseurs de LLM, CGU de LinkedIn, Malt et GitHub pour les conseils que nous donnons.
  d) Personas : sources publiques sur les freelances tech FR (baromètres Malt/Free-Work, études de portage) et
     sur les prompts que les recruteurs utilisent réellement (articles, guides, forums).
  Règle : chaque fait porte son URL. Tout ce qui n'est pas sourcé est étiqueté HYPOTHÈSE. Aucun chiffre inventé.
  → Annexes dans .war-room/foundations/research/

ÉTAPE 2 — STRATÉGIE (Victoria lead) → .war-room/foundations/STRATEGIE.md
  Mission, vision, north star · 3 personas détaillées (freelance confirmé, gérant de société de portage,
  directeur d'agence ESN) avec job-to-be-done, douleurs et objections · proposition de valeur par persona ·
  positionnement face à chaque concurrent (tableau) · modèle économique et grille tarifaire finale, avec le
  raisonnement du prix · go-to-market des 100 premiers clients · moat · métriques (entonnoir complet) ·
  ce qu'on refuse de faire.

ÉTAPE 3 — CAHIER DES CHARGES (Orchestrator + Architect lead) → .war-room/foundations/CAHIER_DES_CHARGES.md
  Contexte et objectifs · périmètre V0 (CLI) / V0.5 (service + landing) / V1 (SaaS) / hors périmètre ·
  user stories par persona au format « En tant que… je veux… afin de… », chacune avec des critères
  d'acceptation Given/When/Then TESTABLES · parcours clés (inscription, audit gratuit, audit payant, génération
  du portfolio, monitoring, tableau de bord Vivier) · exigences fonctionnelles détaillées par module
  (Recruiter Simulator, extraction et appariement, rapports, générateur de portfolio, conseils plateformes,
  facturation, espace B2B) · modèle de données conceptuel (entités et relations, sans code) · exigences non
  fonctionnelles : performance (Elias : ≥ 95/100 desktop ET mobile sur toutes les pages publiques), sécurité (OWASP,
  secrets, anti-injection dans l'extracteur, scan anti-triche à l'onboarding), RGPD (durées de conservation,
  masquage des tiers), accessibilité (AA), observabilité, coûts API (budget par vague) · intégrations (API des
  moteurs, Search Console, Bing Webmaster, Stripe…) · planning aligné sur ROADMAP.md · risques ·
  glossaire pour lecteur non technique.

ÉTAPE 4 — MARQUE (Lena lead) → .war-room/foundations/MARQUE.md
  Shortlist de 5 noms issue de la longlist, avec leurs preuves de disponibilité · plateforme de marque (mission,
  promesse, personnalité, ton de voix FR/EN, 3 taglines par nom retenu) · direction visuelle (palette, typographies
  display et texte, principes d'iconographie, brief du logo) · design tokens (couleurs light/dark, typographie,
  espacements, rayons ; aucune couleur en dur) · 3 exemples de messages (hero de la landing, e-mail de rapport,
  post LinkedIn) · la charte white-hat publique rédigée pour la marque.
  Contrainte : la marque doit inspirer la CONFIANCE et la RIGUEUR (mesure, preuve), jamais le « hack ».

ÉTAPE 5 — CONFORMITÉ (Legal & Trust lead) → .war-room/foundations/CONFORMITE.md
  Registre des traitements · base légale de chaque traitement · durées de conservation · analyse d'impact
  simplifiée · DPA à signer · position AI Act argumentée et sourcée · règles de conseil sur les plateformes (ce
  qu'on recommande, ce qu'on interdit) · mentions légales et points à faire valider par un juriste humain.

ÉTAPE 6 — REVUE CROISÉE ADVERSE
  Scenario Hunter + Security Sentinel + QA Guardian relisent les 4 livrables : incohérences entre eux ou avec
  TEAM_MEMORY, critères non testables, promesses marketing qui violent une ligne rouge, triche possible d'un
  client, trous de sécurité. Chaque point est corrigé dans le livrable concerné et listé dans
  .war-room/foundations/REVUE.md (constat → correction → fichier).

ÉTAPE 7 — DÉCISIONS DU FOUNDER ET CONSIGNATION
  Mets à jour ROADMAP.md (statut de la Track B) et TEAM_MEMORY.md (entrées datées au format de la War Room).
  Pose-moi via AskUserQuestion les décisions qui m'appartiennent : le nom (shortlist avec les preuves), la grille
  tarifaire, la direction visuelle, et tout arbitrage que le board n'a pas pu trancher. Termine par un compte rendu
  court : livré, vérifié, arbitré, et MA prochaine action.
</deroule>

<lignes_rouges>
1. Aucun prompt injection, texte caché, cloaking ni instruction adressée aux LLM, ni dans le produit ni dans ce
   qu'on conseille.
2. Aucune compétence, expérience, métrique ou témoignage inventé, y compris dans les exemples marketing
   (utilise des placeholders explicites).
3. Aucune automatisation qui viole les CGU d'une plateforme ; aucun scraping de données personnelles de tiers.
4. RGPD dès la conception ; les noms de tiers ne sont jamais persistés.
5. Aucun chiffre non sourcé présenté comme un fait : source ou HYPOTHÈSE.
6. Aucune promesse de « n°1 garanti » ni de résultat garanti.
7. Les gates de ROADMAP.md sont respectées : aucune ligne de code SaaS dans cette session.
</lignes_rouges>

<style>
- Le board contredit, il ne valide pas. Si un choix de marque, de prix ou de périmètre est mauvais, dis-le et
  propose mieux.
- Français, Markdown sobre, tableaux quand ça aide, glossaire pour les termes techniques.
- Parallélise les recherches indépendantes ; incarne les personas en inline pour la rédaction.
- Aucun commit : si le dossier n'a toujours pas son propre `git init`, rappelle-le moi à la fin.
</style>

GO.
