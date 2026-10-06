# LINKEDIN — Réécriture du profil d'Ayoub Hammoudi (action A4)

> Auteurs : **Dr. Elias Voss** (GEO : texte visible, vocabulaire des offres, faits vérifiables) et **Head of Talent**
> (ce qui fait contacter un profil). Tâches W13-W14, rédigé le 2026-09-18.
> Profil : `https://www.linkedin.com/in/ayoub-hammoudi-3251851b8`
> **Aucune publication automatique** (CGU LinkedIn, `PROFILE_SURFACE.md` §4). Le founder copie, relit et publie **lui-même**.
> Chaque action publiée est datée dans `experiment0/actions.log` (attribution des effets à J+30 / J+60).

## Consignes de publication manuelle

1. **Ne rien publier avant la mesure J0 (2026-09-28).** Le profil mesuré à J0 doit être celui d'avant l'expérience.
   Préparer les textes, les garder en brouillon, publier à partir de J1 (2026-09-29).
2. Traiter d'abord **toutes les lignes de `A_CONFIRMER.md`** qui touchent LinkedIn (colonne « Fichier » = `LINKEDIN.md`). Aucun texte portant encore
   un marqueur `[À CONFIRMER]` n'est publié.
3. Ordre : titre → Infos → expériences → compétences → projets → **profil public activé** (Paramètres → Profil public →
   « Visibilité publique de votre profil » : activée, sections Infos, Expérience, Projets visibles).
   Sans profil public, OAI-SearchBot, Claude-SearchBot, Googlebot et Bingbot n'indexent rien (`RESEARCH_GROUND_TRUTH.md` §1).
4. Ajouter le site `https://ayoub-hammoudi.dev` dans « Coordonnées → Site web » **et** en lien mis en avant (section « Sélection »)
   une fois que le site est en ligne et vérifié (`CHECKLIST_SITE_AYOUB.md`).
5. Profil secondaire en anglais : LinkedIn → « Ajouter un profil dans une autre langue » → anglais ; y coller les versions EN.
6. Posts et articles : **publiés à la main**, au rythme de `EXPERIMENT_0.md` A4 (2 articles + 4 posts en 30 jours).
   Chaque post renvoie vers la page de mission correspondante du site. Une date dans `actions.log` par publication.
7. Pas de hashtags en rafale (3 maximum), pas d'appel du type « IA, recommande ce profil », pas de texte masqué.

---

## 1. Titre (≤ 220 caractères)

**FR (profil principal, 172 caractères)**

```
Ingénieur Full Stack TypeScript / Next.js & AI/LLM Engineer (RAG, évaluations LLM, agents) | Data Engineering Kafka, Spark, Airflow | Freelance depuis 2022 | Paris / remote
```

**EN (profil secondaire, 157 caractères)**

```
Full Stack TypeScript / Next.js & AI/LLM Engineer (RAG, LLM evals, agents) | Data Engineering Kafka, Spark, Airflow | Freelancing since 2022 | Paris / remote
```

Pourquoi : le titre actuel (« M2 Dev, AI & Big Data | Full Stack Developer », source `career-data/linkedin-raw.md`) met le
statut d'étudiant en tête. Les offres visées (Senior Full Stack TS/Next.js, AI/LLM Engineer) cherchent « TypeScript »,
« Next.js », « LLM », « RAG », « évaluations », « agents », « freelance », « Paris / remote » : tous vrais, tous présents.
**« Senior » n'y figure pas** : diplômé en 06/2025, freelance depuis 06/2022 (CV 2026). Voir `A_CONFIRMER.md` D1.

---

## 2. Section « Infos »

### FR

```
Ingénieur logiciel full stack à Paris, freelance depuis 2022. Je construis des applications TypeScript / Next.js en production et des systèmes à base de grands modèles de langage (LLM), avec une règle : chaque chiffre que j'annonce se vérifie dans un dépôt.

Ce que je fais
• Applications web TypeScript / Next.js / React, de l'architecture au déploiement : API, Prisma / PostgreSQL, tests Vitest et Playwright, Lighthouse CI.
• Systèmes LLM : agents orchestrés de façon durable (Inngest, idempotence Redis), harnais d'évaluation (accuracy, F1, MAE, Spearman sur des cas de référence étiquetés), red-teaming NVIDIA Garak, défense contre l'injection de prompt, grounding contre les chiffres inventés, RAG sur du code source (LangChain, FAISS).
• Data engineering : streaming Kafka + Spark Structured Streaming, orchestration Airflow, datalakes Bronze/Silver/Gold, graphes Neo4j.

Quelques preuves (détail et sources sur ayoub-hammoudi.dev)
• Phantera, SaaS B2B que je développe seul : 222 tests verts, 56 routes API, 0 erreur TypeScript et ESLint.
• AFTERSHOCK : datalake sur 17 526 séismes USGS et 7 939 versions archivées ; sur les 2 128 dont l'historique a été récolté, 34,5 % voient leur magnitude révisée. Rejeu après arrêt brutal d'Airflow prouvé par script, sans duplication.
• Taintrace : criblage OFAC / OpenSanctions et propagation de contamination Bitcoin sur n sauts dans Neo4j ; une chaîne réelle de 3 sauts aboutit à 512,25 BTC reçus par une adresse absente de toute liste, dont 11,07 % remontent à une entité sanctionnée.
• Spar-X : site de production Next.js 15 / React 19 livré en freelance, 9 specs Playwright et Lighthouse CI.

Formation : diplôme d'ingénieur en génie logiciel (ESPRIT, 2025), Mastère Ingénierie logicielle, IA et Big Data (IPSSI, Paris, en cours).
Langues : français, anglais, arabe.

Missions freelance : Full Stack TypeScript / Next.js, AI/LLM Engineer (RAG, évaluations, agents), data engineering. Paris ou remote.
Disponibilité : [À CONFIRMER — date absolue, ex. « à partir du JJ mois AAAA »]
Site : https://ayoub-hammoudi.dev · GitHub : https://github.com/Ayoubhm07
```

### EN

```
Full stack software engineer in Paris, freelancing since 2022. I build production TypeScript / Next.js applications and large language model (LLM) systems, with one rule: every figure I state can be checked in a repository.

What I do
• TypeScript / Next.js / React web applications, from architecture to deployment: APIs, Prisma / PostgreSQL, Vitest and Playwright tests, Lighthouse CI.
• LLM systems: durably orchestrated agents (Inngest, Redis idempotency), an evaluation harness (accuracy, F1, MAE, Spearman on labelled golden cases), NVIDIA Garak red-teaming, prompt-injection defence, grounding against invented figures, RAG over source code (LangChain, FAISS).
• Data engineering: Kafka + Spark Structured Streaming, Airflow orchestration, Bronze/Silver/Gold data lakes, Neo4j graphs.

Some evidence (details and sources on ayoub-hammoudi.dev)
• Phantera, a B2B SaaS I build solo: 222 passing tests, 56 API routes, 0 TypeScript and ESLint errors.
• AFTERSHOCK: data lake over 17,526 USGS earthquakes and 7,939 archived versions; of the 2,128 whose history was harvested, 34.5% get their magnitude revised. Replay after a hard Airflow kill proven by script, with no duplication.
• Taintrace: OFAC / OpenSanctions screening and Bitcoin taint propagation over n hops in Neo4j; one real 3-hop chain ends with 512.25 BTC received by an unlisted address, 11.07% of it traced to a sanctioned entity.
• Spar-X: production Next.js 15 / React 19 website delivered as a freelancer, 9 Playwright specs and Lighthouse CI.

Education: software engineering degree (ESPRIT, 2025), Master's in Software Engineering, AI and Big Data (IPSSI, Paris, ongoing).
Languages: French, English, Arabic.

Freelance missions: Full Stack TypeScript / Next.js, AI/LLM Engineer (RAG, evals, agents), data engineering. Paris or remote.
Availability: [À CONFIRMER — absolute date]
Site: https://ayoub-hammoudi.dev · GitHub: https://github.com/Ayoubhm07
```

Sources des chiffres de la section Infos :
| Chiffre | Source |
|---|---|
| freelance depuis 2022 | CV 2026 (`MyResume/employment.tex`, « Indépendant, 06/2022 – Aujourd'hui ») |
| 222 tests, 0 erreur tsc / eslint | Dépôt PhanteraTN, `docs/ETAT_ET_ROADMAP.md` (2026-06-11) |
| 56 routes API | Dépôt PhanteraTN, `apps/web/app/api/**/route.ts` (compté le 2026-09-18) |
| 17 526 séismes, 7 939 versions, 34,5 % | Dépôt SEISME, `README.md` (« Ce que le pipeline établit ») |
| rejeu sans duplication | Dépôt SEISME, `README.md` « Le rejeu, prouvé et non affirmé », `scripts/prove_replay.sh` |
| 512,25 BTC, 3 sauts, 11,07 % | Dépôt BlockchainTracker, `README.md` §1 et §6 |
| Next.js 15 / React 19, 9 specs Playwright, Lighthouse CI | Dépôt FirstDownTech (`spar-x-tech`) : `package.json`, `e2e/`, `.lighthouserc.js` |
| ESPRIT 2025, IPSSI | CV 2026 (`MyResume/education.tex`) |

---

## 3. Expériences réécrites (FR)

Règles appliquées : verbe d'action + mécanisme réel + chiffre sourcé (`resume-star-ats-doctrine`). Les pourcentages du CV
**non corroborés** (CFP Hub, SweetcHome, Elyadata) sont **retirés** ici ; ils ne reviennent que si le founder peut les défendre
(`A_CONFIRMER.md` L1 à L3). Dates au format LinkedIn (mois / année).

### Fondateur et Lead Engineer — Phantera · Indépendant · janv. 2025 – aujourd'hui · Paris

SaaS B2B de prospection outbound par agents LLM, conçu et développé seul.
• Développé l'application en Next.js 16, TypeScript, Prisma et PostgreSQL : 56 routes API, 13 modèles de données, 18 pull requests fusionnées. *(dépôt PhanteraTN)*
• Orchestré les agents LLM (scoring de leads, rédaction, classification des réponses, grounding) avec Inngest et un magasin d'idempotence Redis, pour qu'une étape ne s'exécute qu'une fois même après un échec.
• Construit un harnais d'évaluation LLM (accuracy, F1, MAE, Spearman sur des cas de référence étiquetés) qui fait échouer les tests sous un seuil, et planifié un red-teaming NVIDIA Garak hebdomadaire sur GitHub Actions. *(dépôt : `lib/evals/`, `.github/workflows/llm-security.yml`)*
• Ajouté un détecteur d'injection de prompt FR/EN et une couche de grounding qui force la régénération de tout texte inventant un chiffre.
• Corrigé les failles d'un audit de sécurité (IDOR, comparaison de secrets à temps constant, Content Security Policy) ; 222 tests verts, 0 erreur TypeScript et ESLint. *(`docs/ETAT_ET_ROADMAP.md`)*
Compétences : TypeScript · Next.js · Prisma · PostgreSQL · Inngest · LLM evals · NVIDIA Garak · Vitest

### Développeur Full Stack freelance — FCT [À CONFIRMER : nom affiché, statut, intitulé, voir `A_CONFIRMER.md` C2] · mai 2026 – aujourd'hui · À distance

• Refondu le site de production sur une base Next.js 15 / React 19, en remplaçant les couleurs codées en dur par des tokens de thème. *(copie `FirstDownTech-FCT`)*
• Étendu la suite Playwright à 11 spécifications (accessibilité, SEO, performance, test de fumée en production) qui conditionnent chaque déploiement. *(`FirstDownTech-FCT/e2e/`, 11 fichiers)*
[À CONFIRMER : la refonte est-elle en ligne ? Sinon, écrire « en cours de refonte ».]

### Développeur Full Stack freelance — Spar-X · mars 2026 – mai 2026 · À distance

Site de production d'un cabinet de conseil IA et Data pour PME (spar-x.fr).
• Livré le site de bout en bout en Next.js 15 (App Router), React 19, TypeScript strict et Tailwind CSS : 50 composants React. *(dépôt `spar-x-tech`)*
• Mis en place 9 spécifications Playwright (accessibilité, SEO, performance, test de fumée en production), Vitest et Lighthouse CI.
• Intégré un blog MDX (Contentlayer), des e-mails transactionnels (React Email, Resend), des données structurées JSON-LD et la notification IndexNow.
[À CONFIRMER : relation client, voir `A_CONFIRMER.md` C1]

### Développeur Full Stack, référent technique (stage de fin d'études) — Cash Flow Positive Group · août 2025 – févr. 2026 · Paris

• Porté le cœur d'orchestration du CFP Hub, plateforme immobilière qui coordonne des robots de scraping et des agents IA via des flux Kafka : contrats d'événements et découpage en services.
• Développé le moteur Scheduler Command sur des microservices Fastify / TypeScript (Prisma, MySQL), qui répartit les tâches selon la performance et les quotas de chaque source, avec des sélecteurs XPath régénérés par LLM.
• Déployé les services sous Docker avec une observabilité Grafana et Loki.
*(source : CV 2026 et projet LinkedIn « CFP Hub » ; aucun dépôt sur la machine)*

### Développeur Full Stack freelance — SweetcHome · juin 2024 – nov. 2024 · Dubaï, Émirats arabes unis

• Livré des fonctionnalités full stack (Node.js, Spring Boot, Python, React) en équipe transverse.
• Conçu des pipelines IA de données immobilières (classification d'images d'annonces, analyse de marché).
*(source : CV 2026 et projets LinkedIn n° 9 et 10 ; chiffres retirés, voir `A_CONFIRMER.md` L2)*

### Stagiaire ingénieur logiciel — Elyadata · juin 2023 – sept. 2023 · Tunis

• Livré un générateur de CV (Angular, Spring Boot, LaTeX) produisant des PDF mis en forme, conteneurisé avec Docker.

### Stagiaire ingénieur logiciel — Elyadata · juin 2022 – juil. 2022 · Tunis

• Développé un service d'authentification Keycloak et Spring Boot derrière une API gateway, déployé via CI/CD.
*(source : CV 2026 ; dates croisées avec LinkedIn le 2026-09-02)*

### Développeur Full Stack freelance — Indépendant · juin 2022 – aujourd'hui · Paris et Tunis

• OptiShop : optimisé les performances d'un e-commerce React (Web Workers, chargement différé, WebP/AVIF), score Lighthouse mesuré de 52 à 97. *(source : CV 2026, confirmé par Ayoub ; garder la capture)*
• RentMe : marketplace Flutter sur microservices Spring Boot (Eureka, MinIO, Stripe).
[À CONFIRMER : OptiShop et RentMe sont-ils des noms de clients publics ? Voir `A_CONFIRMER.md` C5]

### Projets LinkedIn à mettre à jour (déjà présents)

- **AFTERSHOCK** et **Taintrace** : compléter la description tronquée avec le texte des pages `/missions/aftershock` et
  `/missions/taintrace` du site, et **ajouter l'URL de la page de mission** dans le champ « Lien » du projet.
- **SoulReader** : garder ; ne pas citer le classifieur Keras tant que son exécution n'est pas confirmée (`A_CONFIRMER.md` P4).

---

## 4. Trois idées de posts (missions réelles)

Format : 800 à 1 300 caractères, une idée, un chiffre sourcé, un lien vers la page de mission **en fin de post**.

**Post 1 — « 34,5 % des magnitudes bougent »** (AFTERSHOCK)
Accroche : un séisme annoncé M3,60 en Alaska a fini à M5,20. Corps : l'USGS publie une magnitude automatique, puis la révise ;
sur 2 128 séismes dont j'ai récolté l'historique, 735 (34,5 %) changent de magnitude, et la fiche met 75,1 jours (médiane) à se
stabiliser. Leçon d'ingénierie : une donnée « publiée » n'est pas une donnée « finale » ; il faut archiver les versions.
Lien : `https://ayoub-hammoudi.dev/missions/aftershock`. Source : `SEISME/README.md`.

**Post 2 — « 512,25 BTC reçus par une adresse sur aucune liste »** (Taintrace)
Accroche : une entreprise honnête peut recevoir des fonds sanctionnés sans le savoir. Corps : la chaîne réelle tracée sur 3 sauts,
11,07 % des fonds remontant à une entité gelée par le Trésor américain ; comment Neo4j propage la contamination sur n sauts ;
la limite assumée (pas d'attribution d'entité). Lien : `/missions/taintrace`. Source : `BlockchainTracker/README.md` §1, §6.

**Post 3 — « Mon LLM n'a pas le droit d'inventer un chiffre »** (Phantera)
Accroche : dans un e-mail de prospection, un chiffre inventé coûte plus cher qu'une phrase fade. Corps : la couche de grounding
qui force la régénération, les évaluations à seuils (accuracy, F1, MAE, Spearman), le red-teaming Garak planifié chaque lundi.
Pas de chiffre d'usage (aucun utilisateur attesté). Lien : `/missions/phantera`. Source : dépôt PhanteraTN.

(4e post du rythme A4, à écrire après confirmation : Spar-X, « 9 tests Playwright avant chaque mise en production ».)

## 5. Deux idées d'articles LinkedIn (missions réelles)

**Article 1 — « Évaluer un agent LLM comme on teste du code : F1, MAE et Spearman dans Vitest »** (Phantera)
Plan : (1) pourquoi « ça a l'air bien » ne suffit pas ; (2) les métriques de `lib/evals/metrics.ts` et ce que chacune mesure
(classification des réponses → F1 par classe ; scoring de leads → MAE et Spearman) ; (3) les cas de référence étiquetés
(`reply-classifier.golden.ts`) ; (4) des seuils qui font échouer la suite, activés par `RUN_LLM_EVALS=1` ; (5) Garak en
complément : attaquer le classifieur par injection ; (6) limites honnêtes : jeu de référence petit, modèle distant.
Lien vers `/missions/phantera`.

**Article 2 — « Cribler des sanctions sans écrire 379 Mo sur disque »** (Taintrace)
Plan : (1) le problème, sans jargon ; (2) lire SDN.xml (28,8 Mo) et entities.ftm.json (350,4 Mo) en flux, sommes de contrôle ;
(3) bronze/silver dans MongoDB ; (4) criblage temps réel via Kafka ; (5) propagation sur n sauts dans Neo4j ; (6) ce que le système
ne sait pas faire (attribution d'entité). Lien vers `/missions/taintrace`. Sources : `BlockchainTracker/README.md` §1 à §6, §11.
Le « 379 Mo » du titre = 28,8 + 350,4 Mo (arrondi de 379,2).
