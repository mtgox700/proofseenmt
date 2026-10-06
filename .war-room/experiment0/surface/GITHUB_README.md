# GITHUB — README de profil et repos épinglés (action A5)

> Auteurs : Dr. Elias Voss et Head of Talent · Tâches W13-W14 · 2026-09-18.
> Cible : dépôt spécial `Ayoubhm07/Ayoubhm07` (son `README.md` s'affiche en tête de `https://github.com/Ayoubhm07`).
> GitHub est la plateforme la plus lisible par les robots d'IA (`RESEARCH_GROUND_TRUTH.md` §3) : du **texte**, pas des images
> de statistiques ni des badges en rafale.
> **Le founder crée le dépôt, colle le contenu, commit et pousse lui-même.** La War Room n'exécute aucune commande git.
> Ne rien pousser avant la mesure J0 (2026-09-28) ; dater l'action dans `actions.log`.

## Consignes

1. Créer le dépôt public `Ayoubhm07` (même nom que le compte) avec un `README.md` ; y coller le bloc ci-dessous.
2. Profil GitHub (Settings → Public profile) : **Name** `Ayoub Hammoudi` ; **Bio** = ligne d'identité courte de `COHERENCE.md` ;
   **Location** `Paris, France` ; **Website** `https://ayoub-hammoudi.dev` ; **Social** LinkedIn. Même photo que LinkedIn et Malt.
3. Épingler les 4 dépôts du §3 **seulement s'ils sont publics** et que leur README ne contient ni secret ni donnée personnelle
   (`A_CONFIRMER.md` G1-G3). Chaque README de dépôt épinglé renvoie vers sa page `/missions/<slug>` du site.
4. Supprimer le marqueur `[À CONFIRMER]` de la disponibilité avant de pousser.

---

## 1. Contenu du `README.md` de profil (à coller tel quel)

```markdown
# Ayoub Hammoudi

**Ingénieur Full Stack TypeScript / Next.js et AI/LLM Engineer (RAG, évaluations LLM, agents) — freelance depuis 2022 — Paris ou remote**
*Full Stack TypeScript / Next.js and AI/LLM Engineer (RAG, LLM evals, agents) — freelancing since 2022 — Paris or remote*

Je construis des applications TypeScript / Next.js et des systèmes à base de LLM, avec une règle : chaque chiffre annoncé
se vérifie dans le dépôt concerné. Côté données : streaming Kafka, Spark, Airflow, graphes Neo4j.

- Site et missions détaillées : https://ayoub-hammoudi.dev
- LinkedIn : https://www.linkedin.com/in/ayoub-hammoudi-3251851b8
- Disponibilité : [À CONFIRMER — date absolue]

## Projets choisis

| Projet | Ce qu'il fait | Ce qui se vérifie |
|---|---|---|
| **AFTERSHOCK** | Datalake Bronze/Silver/Gold sur HDFS alimenté par 3 sources USGS (Kafka + Spark Structured Streaming, catalogue FDSN, versions supersédées), 4 DAG Airflow chaînés par Datasets, modèle MLlib GBT | 17 526 séismes, 7 939 versions archivées pour 2 128 séismes, dont 34,5 % voient leur magnitude révisée ; rejeu après arrêt brutal d'Airflow sans duplication (`make replay`) |
| **Taintrace** | Criblage OFAC / OpenSanctions et propagation de contamination Bitcoin sur n sauts dans Neo4j ; Airflow, Kafka, MongoDB, 9 services Docker | chaîne réelle de 3 sauts : 512,25 BTC reçus par une adresse sur aucune liste, dont 11,07 % remontent à une entité sanctionnée |
| **Phantera** | SaaS B2B de prospection par agents LLM : Next.js 16, Prisma, Inngest, évaluations LLM à seuils, red-teaming NVIDIA Garak, grounding | 222 tests verts, 56 routes API, 0 erreur TypeScript et ESLint |
| **SoulReader** | Assistant RAG sur du code source : un dépôt Git interrogé en langage naturel (LangChain, FAISS), réponses avec chemin de fichier | ingestion d'un dépôt par URL ou import local |

## Stack

TypeScript · Next.js · React · Node.js · Prisma · PostgreSQL · Python · LangChain · FAISS · Inngest · Redis ·
Apache Kafka · Apache Spark · Apache Airflow · Delta Lake · Neo4j · MongoDB · Docker · Vitest · Playwright · Lighthouse CI

Formation : ingénieur en génie logiciel (ESPRIT, 2025) · Mastère Ingénierie logicielle, IA et Big Data (IPSSI, en cours).
```

Sources des chiffres : `SEISME/README.md` (AFTERSHOCK) ; `BlockchainTracker/README.md` §1, §2, §6 et `docker-compose.yml` (Taintrace) ;
`PhanteraTN-main/docs/ETAT_ET_ROADMAP.md` et `apps/web/app/api` (Phantera) ; projet LinkedIn « SoulReader » (`career-data/linkedin-raw.md`).

---

## 2. Bio GitHub (160 caractères maximum)

```
Full Stack TypeScript / Next.js & AI/LLM Engineer (RAG, LLM evals, agents). Data: Kafka, Spark, Airflow. Freelance since 2022, Paris / remote.
```

## 3. Quatre dépôts à épingler (une phrase factuelle chacun)

| Ordre | Dépôt local | Nom GitHub | Phrase de description (champ « About » du dépôt) | Source |
|---|---|---|---|---|
| 1 | `MyOwnBangers/SEISME` | [À CONFIRMER, proposition `aftershock`] | « Datalake Bronze/Silver/Gold sur HDFS (Kafka, Spark, Airflow, Delta) : 17 526 séismes USGS, 7 939 versions archivées, rejeu sans duplication prouvé par script. » | `SEISME/README.md` |
| 2 | `MyOwnBangers/BlockchainTracker` | [À CONFIRMER, proposition `taintrace`] | « Criblage OFAC / OpenSanctions et propagation de contamination Bitcoin sur n sauts dans Neo4j ; 9 services Docker, un seul `docker compose up`. » | `BlockchainTracker/README.md` §2 |
| 3 | `PhanteraTN-main` | [À CONFIRMER : dépôt public ou privé ?] | « SaaS B2B Next.js 16 d'agents LLM orchestrés par Inngest, avec évaluations à seuils et red-teaming NVIDIA Garak ; 222 tests verts. » | `docs/ETAT_ET_ROADMAP.md`, `.github/workflows/llm-security.yml` |
| 4 | SoulReader [À CONFIRMER : emplacement et nom du dépôt] | [À CONFIRMER] | « Assistant RAG sur du code source : interroger un dépôt Git en langage naturel (LangChain, FAISS), réponses avec chemin de fichier. » | projet LinkedIn « SoulReader » |

Remplacements possibles si un dépôt reste privé : **FCT / Spar-X** ne sont pas épinglables (le code Spar-X n'a pas de dépôt
propre, cf. mémoire `project_fct_rebuild`). Ne pas épingler un dépôt vide ou sans README.

Pour chaque dépôt épinglé, ajouter en tête de son README une ligne :
`Étude de cas complète : https://ayoub-hammoudi.dev/missions/<slug>` (slugs : `aftershock`, `taintrace`, `phantera`).
Topics GitHub suggérés (vrais uniquement) : `data-engineering` `kafka` `spark` `airflow` `delta-lake` (AFTERSHOCK) ;
`neo4j` `kafka` `airflow` `sanctions-screening` `bitcoin` (Taintrace) ; `nextjs` `typescript` `llm-evaluation` `red-teaming` `inngest` (Phantera) ;
`rag` `langchain` `faiss` (SoulReader).
