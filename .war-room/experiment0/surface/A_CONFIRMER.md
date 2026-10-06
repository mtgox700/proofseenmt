# À CONFIRMER — Décisions et vérifications du founder avant toute publication

> Auteurs : Dr. Elias Voss et Head of Talent · Tâches W13-W14 · 2026-09-18.
> Règle : **aucun texte portant un marqueur `[À CONFIRMER]` n'est publié**, et aucun champ du hub marqué ci-dessous n'est mis
> en ligne tant que la ligne n'est pas tranchée. Répondre dans la colonne « Réponse du founder », puis la War Room répercute.
> Chemins relatifs à `.war-room/experiment0/`.

## D — Décisions de positionnement

| id | Question | Pourquoi | Où c'est utilisé | Réponse du founder |
|---|---|---|---|---|
| D1 | Utiliser le mot **« Senior »** dans le titre (LinkedIn, Malt, site) ? Défaut retenu : **non**, remplacé par « freelance depuis 2022 ». | Freelance depuis 06/2022, diplômé 06/2025 (CV 2026) : un recruteur le challengera. Si oui, préparer la justification (missions en autonomie, Phantera en solo). | `hub/ayoub.profile.json` → `person.headline` ; `surface/LINKEDIN.md` §1 ; `surface/MALT.md` §1 ; `surface/COHERENCE.md` §1 | |
| D2 | **TJM** : afficher une fourchette sur le site ? Défaut : `rate: null`. | Décision D2 du founder, en attente. Malt en exige probablement un (à vérifier dans l'interface). | `hub/ayoub.profile.json` → `rate` ; `surface/MALT.md` consigne 3 | |
| D3 | **Mode de travail** : « Paris ou télétravail (France) » est-il exact ? Hybride accepté ? Déplacements ? Remote hors France ? | Les JD filtrent sur ce critère. | `hub/ayoub.profile.json` → `person.workMode` ; `surface/LINKEDIN.md` §2 ; `surface/MALT.md` consigne 2 | |
| D4 | **Disponibilité** : date absolue (« à partir du JJ mois AAAA ») ou « disponible maintenant » ? Défaut provisoire : `available`, sans date. | Une disponibilité **datée** est un signal de fraîcheur (`CHECKLIST_SITE_AYOUB.md` §5). | `hub/ayoub.profile.json` → `availability` ; `surface/LINKEDIN.md` §2 (FR et EN) ; `surface/GITHUB_README.md` §1 | |
| D5 | **E-mail de contact** public sur le site ? Défaut : `contactEmail: null`. Adresse du CV : `ayoub.hammoudi05@gmail.com`. | Sans contact, un recruteur qui arrive par un LLM n'a que LinkedIn. Risque : spam. | `hub/ayoub.profile.json` → `person.contactEmail` | |
| D6 | **Compatibilité du statut freelance** avec le Mastère IPSSI (02/2026 – 03/2027 au CV) et avec FCT : alternance ? rythme ? jours disponibles par semaine ? | Un recruteur freelance demande immédiatement la disponibilité réelle en jours par semaine. | `hub/ayoub.profile.json` → `person.summary`, `availability` ; `surface/LINKEDIN.md` §2 | |
| D7 | Langue principale du profil LinkedIn : **français** (défaut, 7 JD sur 10 en FR) avec profil secondaire anglais ? | Corpus EXPERIMENT_0 §2 : 7 JD FR, 3 EN. | `surface/LINKEDIN.md` consignes 5 | |

## C — Clients, employeurs et noms publiables

| id | Question | Pourquoi | Où c'est utilisé | Réponse du founder |
|---|---|---|---|---|
| C1 | **Spar-X** : client réel d'une mission freelance, ou entité liée au founder ? Accord pour citer le nom et le lien `spar-x.fr` ? Dates 03/2026 – 05/2026 exactes ? | La mémoire le classe parmi les « sites owned ». Si Spar-X est lié au founder, le présenter comme « mission client » serait trompeur : il faudrait écrire « projet pour une structure dont je suis [rôle] ». | `hub/ayoub.profile.json` → mission `spar-x` (`client`, `role`, `links`) ; `surface/LINKEDIN.md` §3 ; `surface/MALT.md` §4 | |
| C2 | **FCT** : nom à afficher (FCT ? FirstDown Tech ? autre raison sociale ?), statut (freelance, salarié), intitulé, dates (CV : 05/2026 – aujourd'hui). La refonte du site est-elle **en ligne** ? | LinkedIn affiche FCT comme employeur courant ; le CV écrit « FirstDown Tech (FCT) ». Le site FCT porte 5 claims juridiquement bloquants (mémoire `project_fct_rebuild`) : ne rien lier tant qu'ils ne sont pas levés. | `surface/LINKEDIN.md` §3 (entrée FCT) ; non repris dans le hub | |
| C3 | **Cash Flow Positive Group** : nom publiable sur LinkedIn (stage de fin d'études) ? | Règle : pas de nom confidentiel. Sinon : « Proptech, Paris ». | `surface/LINKEDIN.md` §3 | |
| C4 | **SweetcHome** (Dubaï) : nom publiable ? | Idem ; sinon « plateforme immobilière, Dubaï ». | `surface/LINKEDIN.md` §3 | |
| C5 | **OptiShop** et **RentMe** : noms de clients réels publics, noms de produits, ou projets personnels ? | Détermine la formulation (« client » vs « projet »). | `surface/LINKEDIN.md` §3 (entrée Indépendant) | |

## P — Projets : périmètre et preuves

| id | Question | Pourquoi | Où c'est utilisé | Réponse du founder |
|---|---|---|---|---|
| P1 | **AFTERSHOCK** : projet individuel ou en équipe ? Si équipe, quelle part (ingestion, orchestration, modèle) ? Est-ce bien un projet du Mastère IPSSI ? | Le README dit « nous » et mentionne un jury et un énoncé. Le hub écrit « Projet de Mastère soutenu devant jury » et le rôle « Data Engineer » sans dire « seul ». | `hub/ayoub.profile.json` → mission `aftershock` (`client`, `role`) ; `surface/ARTICLE_DEVTO.md` | |
| P2 | **Taintrace** : mêmes questions (individuel ou équipe, part personnelle, cadre IPSSI). | Le README mentionne « le jury ». | `hub/ayoub.profile.json` → mission `taintrace` (`client`, `role`) ; `surface/LINKEDIN.md` §4-§5 | |
| P3 | **Phantera** : produit en ligne (URL publique) ? Utilisateurs réels ? Période 01/2025 – aujourd'hui exacte ? | Aucun utilisateur attesté (objectif 10 beta users) : le hub ne cite **aucun** chiffre d'usage. Un lien public renforcerait la page. | `hub/ayoub.profile.json` → mission `phantera` (`links: []`, `period`) | |
| P4 | **SoulReader** : le classifieur Keras a-t-il réellement tourné (TensorFlow non installé d'après la mémoire) ? Où est le dépôt ? | Ne citer que ce qui tourne. Le hub ne cite que RAG / LangChain / FAISS. | `surface/LINKEDIN.md` §3 ; `surface/GITHUB_README.md` §3 (épingle 4) | |
| P5 | **Écart CV / code sur Phantera** : le CV dit « harnais d'évaluation LLM **bloquant la CI** ». Le dépôt ne contient qu'un workflow (`.github/workflows/llm-security.yml`, Garak, planifié le lundi, ignoré si le secret `OLLAMA_API_KEY` manque) ; les évals ne tournent qu'avec `RUN_LLM_EVALS=1`. Existe-t-il une CI ailleurs qui les lance ? | Truth lock : les textes produits ici disent « évaluations à seuils » et « Garak planifié chaque semaine », pas « bloquant la CI ». **Corriger aussi le CV** (`MyResume/employment.tex`, `summary.tex`) si aucune CI ne les exécute. | `hub/ayoub.profile.json` → mission `phantera` ; `surface/LINKEDIN.md` ; `MyResume/*.tex` | |
| P6 | Le **red-teaming Garak** a-t-il réellement tourné au moins une fois (rapport `garak-report` disponible) ? | « Planifié » est vrai ; « exécuté » demande une preuve. | `hub/ayoub.profile.json` → mission `phantera` ; `surface/LINKEDIN.md` §4 post 3, §5 article 1 | |

## L — Chiffres du CV retirés faute de preuve (LinkedIn)

| id | Chiffre retiré | Source actuelle | Pour le réintroduire | Où | Réponse du founder |
|---|---|---|---|---|---|
| L1 | CFP Hub : débit **+50 %**, temps de détection d'incident **−40 %** | CV 2026 seul (`UNVERIFIED` dans `career-kb.md`) | Comment a-t-il été mesuré ? Sur quelle période ? Défendable en entretien ? | `surface/LINKEDIN.md` §3 (entrée Cash Flow Positive Group) | |
| L2 | SweetcHome : vélocité **+35 %**, précision des données **+20 %** sur 500+ annonces/mois, valorisations **+25 %** | CV 2026 + projets LinkedIn 9-10 | Même question ; au minimum garder l'échelle « 500+ annonces par mois » si elle est sûre | `surface/LINKEDIN.md` §3 (entrée SweetcHome) | |
| L3 | Elyadata : **55+ utilisateurs**, temps de création **−70 %** ; **50+ utilisateurs** (authentification) | CV 2026 seul | Confirmer les ordres de grandeur | `surface/LINKEDIN.md` §3 (entrées Elyadata) | |
| L4 | OptiShop : Lighthouse **52 → 97** (conservé, « confirmé par Ayoub » dans le CV) | CV 2026 ; incohérence interne relevée (commentaire LaTeX « 72→95 ») | Garder une capture datée du rapport Lighthouse | `surface/LINKEDIN.md` §3 (entrée Indépendant) | |

## G — GitHub

| id | Question | Pourquoi | Où c'est utilisé | Réponse du founder |
|---|---|---|---|---|
| G1 | Noms et visibilité des dépôts AFTERSHOCK (`SEISME`) et Taintrace (`BlockchainTracker`) sur GitHub ? Sont-ils publics ? | Épingler et lier exige un dépôt public. Aucun lien de dépôt n'est mis dans le hub tant que ce n'est pas confirmé (`links: []`). | `surface/GITHUB_README.md` §3 ; `hub/ayoub.profile.json` → `missions[].links` ; `surface/ARTICLE_DEVTO.md` §6 | |
| G2 | **Ne pas épingler `PhanteraTN` en l'état** : le dossier `C:\Users\HP\Desktop` pointe vers le remote `github.com/Ayoubhm07/PhanteraTN.git` (mémoire `project_fct_rebuild`). Le dépôt distant est-il public ? Que contient-il ? | Risque de publier des fichiers sans rapport, voire sensibles. Si Phantera doit être épinglé : dépôt dédié et audité. | `surface/GITHUB_README.md` §3 (épingle 3) | |
| G3 | Audit des README et `docker-compose.yml` des dépôts épinglés : aucun secret, mot de passe par défaut exposé comme réel, ni donnée personnelle ? | Un dépôt épinglé est la page la plus lue par les robots. | `surface/GITHUB_README.md` consigne 3 | |

## S — Site et identité

| id | Question | Pourquoi | Où c'est utilisé | Réponse du founder |
|---|---|---|---|---|
| S1 | Le domaine `ayoub-hammoudi.dev` est-il acheté et en ligne ? (constat J-7, `CHECKLIST_SITE_AYOUB.md`) | `baseUrl` du hub et tous les liens des satellites en dépendent. | `hub/ayoub.profile.json` → `baseUrl` ; tous les fichiers `surface/` | |
| S2 | Photo unique à utiliser partout (laquelle ?) | Cohérence d'entité (A8). | `surface/COHERENCE.md` §2 | |
| S3 | Profil **Malt** existant ? URL ? Profil **Codeur.com** souhaité ? | À ajouter aux `links` du hub une fois l'URL connue. | `hub/ayoub.profile.json` → `person.links` ; `surface/MALT.md` | |
| S4 | Localisation LinkedIn : passer de « France » à « Paris, Île-de-France » ? | Cohérence avec le site (`city: "Paris"`). | `surface/COHERENCE.md` §2 | |

**Total : 29 points à confirmer** (D1-D7, C1-C5, P1-P6, L1-L4, G1-G3, S1-S4).
