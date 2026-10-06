/war-room MISSION : SESSION DE BRAINSTORMING FONDATRICE — projet « ReferencementCracker » (nom de code)

<contexte>
Je suis Ayoub, founder solo (full stack / AI engineer, freelance, Paris). Dossier du projet :
C:\Users\HP\Desktop\MyOwnBangers\ReferencementCracker (vide, aucun code). Aujourd'hui on ne code pas :
on pense, on cherche, on se contredit, on tranche.

Lis d'abord, dans cet ordre :
1. .war-room/PLAN_V0_DRAFT.md — mon brouillon de thèse. C'est une HYPOTHÈSE à attaquer, pas une base acquise.
2. .war-room/TEAM_MEMORY.md s'il existe (sinon crée-le, cf. étape 0 de la War Room).
</contexte>

<idee_du_founder>
THÈME : référencement des profils sur les moteurs de recherche ET dans les LLM.
SITUATION : un recruteur (ex. Google) colle sa job description dans Claude Cowork / ChatGPT /
Perplexity / Gemini et lui demande d'aller sur le web (LinkedIn, free-work, Malt…) pour lui ramener
les profils qui collent le mieux.
TÂCHE : construire une solution NON pas pour le recruteur mais pour le freelance / le dev — enrichir,
structurer et diffuser son profil pour qu'il ressorte EN TÊTE de la réponse du LLM.
RÉSULTAT : mon profil apparaît dans l'output des LLM pour les JD qui me correspondent.
AMBITION : une entreprise qui vise un jour 500 K€/mois si on la vend ; sinon, un outil interne pour
référencer nos propres profils. Les deux issues doivent rester possibles.
</idee_du_founder>

<objectif_de_la_session>
Sortir de cette session avec : une compréhension VÉRIFIÉE de comment les LLM trouvent et classent des
profils aujourd'hui, une banque d'idées large puis filtrée, UNE thèse produit tranchée, le plan de
l'expérience de dogfood sur mon propre profil, et le chemin chiffré (hypothèses explicites) vers
500 K€/mois. Si l'idée ne tient pas, le board doit le dire et proposer le pivot le plus proche.
</objectif_de_la_session>

<equipe_de_mission>
Board et agents de la War Room habituels. Pour cette mission, ajoute ces invités, chacun avec un point
de vue qu'il doit défendre :
- DR. ELIAS VOSS — lead GEO/AEO : retrieval des LLM, indexation, données structurées, llms.txt.
- RETRIEVAL SCIENTIST (invité) — ex-équipe search/RAG : comment un LLM avec outil web choisit,
  classe et cite ; comment mesurer ça proprement face au non-déterminisme.
- HEAD OF TALENT (invité, point de vue recruteur) — comment un recruteur formule vraiment ses prompts,
  ce qui le fait contacter un profil, ce qui le fait fuir.
- FREELANCE POWER USER (invité, point de vue client) — ce pour quoi il paierait, ce qu'il n'achètera
  jamais, TJM, charge mentale.
- LEGAL & TRUST (invité) — RGPD, CGU des plateformes, loyauté envers le recruteur, AI Act.
- VICTORIA CHEN — marché, pricing, go-to-market, chemin vers 500 K€/mois.
- MAXWELL REID — faisabilité, architecture V0, coût par mesure, dépendances fragiles.
- SCENARIO HUNTER — abus, black-hat, saturation, et « et si OpenAI/LinkedIn le fait demain ? ».
</equipe_de_mission>

<deroule>
Suis ces phases dans l'ordre. Ne passe pas à la suivante sans avoir écrit le livrable de la phase.

PHASE 1 — VÉRITÉ TERRAIN (recherche réelle, en parallèle)
Lance des sous-agents de recherche en parallèle (outils web) sur des questions indépendantes :
  a) Comment ChatGPT (search), Claude (web search / Cowork), Perplexity, Gemini et Copilot récupèrent
     des pages : quel index de recherche, quels crawlers, quels user-agents, ce qu'ils respectent.
  b) Ce que LinkedIn, Malt, free-work, Welcome to the Jungle, GitHub, Crème de la Crème exposent
     réellement aux crawlers IA (robots.txt, login wall, données structurées). Vérifie les robots.txt
     en direct.
  c) Paysage concurrent : outils GEO/AI-visibility pour marques, outils d'optimisation de CV/ATS,
     outils de personal branding, fonctions IA natives des plateformes de recrutement. Pour chacun :
     prix, cible, ce qu'ils ne font pas.
  d) Taille du marché des freelances tech (France puis Europe/US) et dépense actuelle en visibilité
     (abonnements premium, plateformes, portage).
Chaque affirmation factuelle porte sa source (URL). Tout ce qui n'est pas sourcé est étiqueté
HYPOTHÈSE. Aucun chiffre inventé.
→ Livrable : .war-room/RESEARCH_GROUND_TRUTH.md

PHASE 2 — DIVERGENCE (quantité avant qualité)
Chaque membre de l'équipe propose au moins 5 idées depuis son angle. Minimum 40 idées au total,
couvrant : produit, mesure, distribution, modèle économique, B2C/B2B/B2B2C/marketplace, et au moins
5 idées « contre-intuitives » ou « 10x ». Aucune critique pendant cette phase.
→ Livrable : .war-room/IDEA_BANK.md (tableau : id, idée, auteur, segment)

PHASE 3 — CONVERGENCE (le board tue)
Note chaque idée en ICE (Impact, Confiance, Facilité, 1–10) avec une ligne de justification. Le board
tue explicitement les idées faibles et dit pourquoi. Garde un top 5, puis confronte-les deux à deux
jusqu'à UNE thèse. Organise un vrai débat contradictoire sur au moins ces 3 tensions :
  - SaaS d'optimisation pour freelances VS devenir la source (index / Talent MCP / marketplace).
  - B2C freelances VS B2B ESN/cabinets/portage d'abord.
  - Optimiser pour les LLM ouverts VS pour les moteurs de matching internes des plateformes.
→ Livrable : .war-room/PRODUCT_THESIS.md (thèse en une phrase, client cible, douleur, promesse
mesurable, moat, ce qu'on refuse de construire)

PHASE 4 — LA MESURE (le cœur)
Spécifie le « Recruiter Simulator » : corpus de JD, formulations de prompts recruteur, LLMs ciblés,
nombre de tirages par combinaison, métriques (probabilité d'apparition, rang moyen, citation, source
citée), traitement statistique de la variance, coût estimé par audit. Définis le KPI nord.
→ Livrable : .war-room/MEASUREMENT_SPEC.md

PHASE 5 — EXPÉRIENCE 0 : DOGFOOD SUR MON PROFIL
Protocole complet : 10 JD réelles qui me correspondent (Senior Full Stack / AI-LLM Engineer, Paris,
freelance), mesure de base AVANT, actions d'optimisation white-hat, re-mesure à J+30, critère de
succès chiffré et critère de kill. Ne mesure rien toi-même dans cette session : la mesure réelle
m'appartient ; tu livres le protocole et les scripts à écrire.
→ Livrable : .war-room/EXPERIMENT_0.md

PHASE 6 — ARCHITECTURE V0 ET PLAN D'ENTREPRISE
Maxwell : architecture V0 minimale (stack, composants, coûts, ce qui est fait à la main au début).
Victoria : segments, pricing, go-to-market des 100 premiers clients payants, puis chemin vers
500 K€/mois en jalons (M3, M6, M12, M24) avec les hypothèses de chaque ligne visibles.
→ Livrables : .war-room/ARCHITECTURE_V0.md et .war-room/PLAN_ENTREPRISE.md

PHASE 7 — DÉCISIONS DU FOUNDER
Consigne tout dans TEAM_MEMORY.md (entrées datées au format de la War Room). Puis pose-moi via
AskUserQuestion les 3 à 4 décisions qui m'appartiennent vraiment (ex. segment de départ, nom,
dogfood d'abord ou landing d'abord). Termine par un compte rendu court : ce qui a été décidé, ce qui
a été tué, et MA prochaine action concrète.
</deroule>

<lignes_rouges>
Non négociables, et le Scenario Hunter doit les faire respecter :
1. Aucun prompt injection, texte caché, cloaking ou instruction adressée aux LLM dans les profils.
   On gagne parce que le profil est le plus pertinent et le plus prouvé, pas parce qu'on manipule
   le modèle. Tromper le recruteur, c'est tuer la marque.
2. Aucune compétence, expérience ou métrique inventée. Le produit refuse de générer du faux.
3. Aucune automatisation qui viole les CGU d'une plateforme (LinkedIn en tête). Aucun scraping de
   données personnelles de tiers.
4. RGPD dès le design : le Simulator va voir passer des profils de tiers ; décide ce qu'on stocke.
5. Aucun chiffre de marché ou de résultat inventé : source ou étiquette HYPOTHÈSE.
</lignes_rouges>

<style_de_travail>
- Le board contredit, il ne valide pas. Si mon idée a un défaut fatal, dis-le en phase 3, argumente,
  et propose le pivot le plus proche au lieu d'enjoliver.
- Parallélise les recherches indépendantes. N'invente pas de sous-agents inutiles.
- Tout en français, fichiers Markdown sobres et scannables (tableaux quand ça aide, pas de pavés).
- Aucune ligne de code produit dans cette session. Des pseudo-specs, oui.
- Ne fais aucun commit : le dossier est dans un repo git parent (le Bureau). Propose-moi un `git init`
  dédié à la fin.
</style_de_travail>

GO.
