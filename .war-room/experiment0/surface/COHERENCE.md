# COHÉRENCE D'ENTITÉ — Ligne d'identité unique et checklist (action A8)

> Auteurs : Dr. Elias Voss et Head of Talent · Tâches W13-W14 · 2026-09-18.
> Principe : un LLM fait confiance à ce que **plusieurs sources** disent de la même façon (corroboration, `PROFILE_SURFACE.md` §1-§2).
> Même nom, même titre, même ville, même photo, liens croisés. **Une seule formulation**, recopiée à l'identique.

## 1. La ligne d'identité unique

**Version longue FR** (site, LinkedIn « Infos » première phrase, Malt, README GitHub, signature d'article) :

```
Ayoub Hammoudi — Ingénieur Full Stack TypeScript / Next.js et AI/LLM Engineer (RAG, évaluations LLM, agents) — freelance depuis 2022 — Paris ou remote
```

**Version longue EN** :

```
Ayoub Hammoudi — Full Stack TypeScript / Next.js and AI/LLM Engineer (RAG, LLM evals, agents) — freelancing since 2022 — Paris or remote
```

**Version courte** (bio GitHub, bio dev.to, champs limités) :

```
Full Stack TypeScript / Next.js & AI/LLM Engineer (RAG, LLM evals, agents). Data: Kafka, Spark, Airflow. Freelance since 2022, Paris / remote.
```

Pourquoi cette ligne :
- **Vocabulaire des offres visées**, vrai uniquement : « Full Stack », « TypeScript », « Next.js » (Phantera, Spar-X, FCT) ;
  « AI/LLM Engineer », « évaluations LLM », « agents » (Phantera `lib/evals`, `lib/agents`) ; « RAG » (SoulReader).
- **Séniorité défendable** : « freelance depuis 2022 » (CV 2026 : Indépendant 06/2022 – aujourd'hui) au lieu de « Senior » ou
  « 4+ ans » (D1 dans `A_CONFIRMER.md`).
- **Ville et mode** : Paris ou remote (D3).
- Exclus : LangGraph (absent du code), « 0 downtime », superlatifs, « expert ».

Si D1 est tranché en faveur de « Senior », remplacer **partout le même jour** « Ingénieur Full Stack » par « Senior Full Stack Engineer »
et dater le changement dans `actions.log`.

## 2. Référentiel d'entité (valeurs à recopier telles quelles)

| Attribut | Valeur unique | Remarque |
|---|---|---|
| Nom | **Ayoub Hammoudi** | LinkedIn affiche « Ayoub HAMMOUDI » : passer en casse normale. Variantes mesurées : « Ayoub HAMMOUDI », « A. Hammoudi » (EXPERIMENT_0 §1). |
| Titre | ligne d'identité §1 | `person.headline` du hub + `person.workMode` |
| Ville | **Paris** (France) | LinkedIn affiche « France » : préciser Paris (S4) |
| Mode | Freelance — Paris ou télétravail (France) | D3 |
| Disponibilité | même valeur **et même date** partout | D4 ; mise à jour mensuelle minimum |
| Photo | une seule photo | S2 |
| Site | `https://ayoub-hammoudi.dev` | S1 |
| GitHub | `https://github.com/Ayoubhm07` | |
| LinkedIn | `https://www.linkedin.com/in/ayoub-hammoudi-3251851b8` | |
| Malt | [À CONFIRMER, S3] | à ajouter aux `links` du hub |
| Formation | Ingénieur en génie logiciel (ESPRIT, 2025) · Mastère Ingénierie logicielle, IA et Big Data (IPSSI, en cours) | CV 2026 |
| Langues | français, anglais, arabe | LinkedIn |

## 3. Liens croisés attendus

| Depuis | Vers | Où le mettre |
|---|---|---|
| Site (hub) | GitHub, LinkedIn, Malt | `person.links` du profil JSON |
| Site, page de mission | dépôt GitHub de la mission (si public, G1) | `missions[].links` |
| LinkedIn | site | Coordonnées → Site web ; section « Sélection » ; lien de chaque projet vers `/missions/<slug>` |
| GitHub (profil) | site, LinkedIn | champ Website, README de profil |
| GitHub (dépôt épinglé) | `/missions/<slug>` | première ligne du README du dépôt |
| Malt | site, GitHub, LinkedIn | champ liens / portfolio |
| Article dev.to / Medium | `/missions/aftershock` | introduction et conclusion |
| Posts LinkedIn | `/missions/<slug>` | fin de chaque post |

## 4. Checklist de cohérence (à cocher par le founder après publication)

À faire **après J0** (2026-09-28), chaque case correspond à une action datée dans `actions.log`.

### Identité
- [ ] Le nom est écrit « Ayoub Hammoudi » sur le site, LinkedIn, GitHub, Malt, dev.to.
- [ ] La ligne d'identité §1 est recopiée **mot pour mot** (FR ou EN selon la surface) : site, 1re phrase d'« Infos » LinkedIn, README GitHub, Malt, bio dev.to ; le titre LinkedIn en est la version étendue (`LINKEDIN.md` §1), mêmes termes dans le même ordre.
- [ ] La ville est « Paris » partout (LinkedIn inclus).
- [ ] La même photo est utilisée partout.
- [ ] La disponibilité affiche la même valeur et la même date sur le site, LinkedIn et Malt.

### Faits
- [ ] Chaque chiffre publié figure dans les `facts` du hub avec sa source, ou dans le tableau des sources de `LINKEDIN.md` §2.
- [ ] Les chiffres sont **identiques** d'une surface à l'autre (ex. 222 tests, 56 routes API, 17 526 séismes, 7 939 versions, 512,25 BTC, 11,07 %, 9 specs Playwright).
- [ ] Les périodes des missions sont identiques sur le site, LinkedIn et Malt (AFTERSHOCK 07-08/2026, Taintrace 06-07/2026, Phantera depuis 01/2025, Spar-X 03-05/2026).
- [ ] Aucune mention de LangGraph, de « 0 downtime », de « 4+ ans », de superlatifs.
- [ ] Phantera n'est jamais décrit avec un chiffre d'usage (utilisateurs, chiffre d'affaires) non attesté.
- [ ] Les évaluations LLM de Phantera ne sont pas décrites comme « bloquant la CI » tant que P5 n'est pas tranché.
- [ ] AFTERSHOCK et Taintrace sont présentés comme projets de Mastère, jamais comme missions client.
- [ ] Aucun nom de client non confirmé (C1-C5) n'est publié.
- [ ] Le CV (`MyResume/*.tex`) est aligné sur ces textes (P5, AFTERSHOCK et Taintrace absents du CV).

### Liens et technique
- [ ] Tous les liens croisés du §3 sont en place et répondent en 200.
- [ ] Le profil LinkedIn est **public** (visibilité publique activée).
- [ ] Les dépôts épinglés sont publics, audités (G2, G3) et renvoient vers leur page de mission.
- [ ] Aucun texte caché, aucune instruction adressée aux IA, sur aucune surface (y compris commentaires HTML et `alt`).
- [ ] Aucune marque `[À CONFIRMER]` ne subsiste dans un texte publié.

### Fraîcheur (tenue dans le temps)
- [ ] Disponibilité et `availability.updatedAt` mis à jour au moins une fois par mois.
- [ ] Au moins un post LinkedIn par mois, lié à une mission réelle.
- [ ] Toute nouvelle mission est ajoutée **d'abord** au hub (avec ses `facts` sourcés), puis reprise sur les satellites.
