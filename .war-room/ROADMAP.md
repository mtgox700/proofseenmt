# ROADMAP — ReferencementCracker (nom de code)

> **Référence unique de la War Room** pour le séquencement : phases, sprints, gates, KPIs, risques.
> Date : **2026-09-18** · Version 1.0 · Auteur : planner (War Room) · Statut : **VALIDÉE par le founder le 2026-09-18** (avec les corrections du dossier de fondation).
> Sources de vérité (elles l'emportent sur ce document en cas d'écart ; on corrige alors la roadmap) :
> `TEAM_MEMORY.md`, `PRODUCT_THESIS.md`, `MEASUREMENT_SPEC.md`, `EXPERIMENT_0.md`, `ARCHITECTURE_V0.md`,
> `PLAN_ENTREPRISE.md`, `PROFILE_SURFACE.md`, `RESEARCH_GROUND_TRUTH.md`.
> Prompt de lancement de la Track B (fondations) : `LAUNCH_PROMPT_FONDATIONS.md`.

> 🎯 **PLAN DE CONQUÊTE du 2026-10-05 (décision du founder, TEAM_MEMORY)** — il prime sur le corps de ce document :
> l'objectif devient **conquérir Malt et Free-Work**. Le refus « marketplace avant M12 » est levé. Le périmètre des sprints
> S2 à S8 est remplacé par les sprints **C1 à C7** de `.war-room/PROMPTS_CONQUETE.md`, sur les mêmes créneaux de deux
> semaines. Les phases P3 à P5 ci-dessous restent la référence au-delà de C7.

> ⚠ **CORRECTIONS du 2026-09-18 (Dossier de fondation, `foundations/REVUE.md`)** — elles priment sur le corps du document :
> - **Mesure API = 3 moteurs** (OpenAI, Anthropic, Perplexity Sonar). **Gemini, Vertex AI et Bing grounding sont incompatibles** avec l'analyse
>   de leurs résultats (`foundations/research/R5`). Gemini et Copilot : échantillon manuel d'étalonnage interne seulement.
> - Vague de l'expérience 0 : **780 appels** (et non 1 040) ; **3 adaptateurs** (et non 4) ; coût ~9-35 $ par vague.
> - **Masquage des tiers dans `sim-run`, en mémoire, avant écriture** ; brut pseudonymisé **72 h maximum**. « `sim-extract` avant le 05/10 »
>   devient « extraction sous 72 h ». Tâche TTL de S11 : **72 h**.
> - **S1 ajoute** : preuve de possession des URL d'Ayoub (US-F00) · acceptation des conditions et DPA d'OpenAI, d'Anthropic et de Perplexity avant J0 ·
>   demandes écrites à Anthropic (§D.4 « resale ») et Perplexity (§2.5) · consentement écrit des recruteurs interviewés.
> - **Pré-vente (US-P01) fait partie de V0** : Payment Links + CGV validées par un juriste (S2-S3), conforme à la gate (3).
> - **S6** : les Payment Links Pro (29 €/mois, 290 €/an) sont vendus comme **« Pro fondateur »** (re-mesure manuelle, 20 abonnés maximum) jusqu'à S13.
> - Échantillon manuel : **oui/non + rang du client**, aucune capture non caviardée conservée.
> - **Modèle « passerelle » A + D (décision du founder, `foundations/MODELE_PASSERELLE.md`)** : la gate du 2026-11-27 ajoute un **test de
>   l'étage 2** : **3 entreprises** prêtes à passer par Proofseen pour une mission (lettre d'intention ou premier contrat) et **1 société de
>   portage** d'accord pour partager la commission. Sans code : vente + juriste (AI Act, non-contournement, intermédiation).
>   Seuils à confirmer par le founder avant le 2026-10-18.
>
> **Statut Track B (P0)** : dossier de fondation livré le 2026-09-18 (`foundations/` : STRATEGIE, CAHIER_DES_CHARGES, MARQUE, CONFORMITE,
> REVUE, research R1-R5) → 🟡 décisions du founder **prises** (Proofseen, grille validée, laboratoire éditorial) ; reste la **validation par un juriste** et un **conseil en PI**.

## 0. Règles d'usage

| Règle | Contenu |
|---|---|
| Mise à jour | L'Orchestrator met à jour les statuts à chaque revue de sprint (dimanche de fin de sprint) |
| Changement de date ou de périmètre | D'abord une entrée datée dans `TEAM_MEMORY.md` (qui, quoi, pourquoi), **ensuite** la roadmap. On ne réécrit jamais l'historique : un sprint abandonné passe en ❌ et on ajoute son remplaçant. |
| Chiffres | Toute valeur non sourcée porte la mention **HYPOTHÈSE**. Les chiffres de marché viennent de `RESEARCH_GROUND_TRUTH.md`, avec leur statut. |
| Pré-enregistrement | Les seuils d'une gate sont fixés **avant** la mesure et ne bougent plus ensuite (règle de l'expérience 0, étendue aux gates M6 et M12) |
| Git | **Aucun commit** avant le `git init` dédié (le dossier est encore sous le repo du Bureau) |

**Statuts** : ✅ terminé (chaque case de la Definition of Done cochée, preuve à l'appui) · 🟡 en cours ou partiel (dire ce qui manque) · ⬜ pas commencé ·
❌ abandonné ou échoué (renvoi à l'entrée TEAM_MEMORY).

**Lignes rouges (non négociables)** : pas de prompt injection ni de texte caché · pas de compétence, d'expérience ou de métrique inventée ·
pas d'automatisation LinkedIn ou Malt, pas de scraping de tiers · RGPD dès le design (noms de tiers jamais stockés) · pas de chiffre inventé.

**Capacité (HYPOTHÈSE et risque n°1)** : le founder dispose d'environ **15 h/semaine, soit 30 h par sprint**, jusqu'à la gate (il est étudiant et freelance).
Toute la phase P0 est dimensionnée sur ce plafond. La capacité après la gate est à **déclarer par le founder le 2026-11-27** : P1 et P2 en dépendent.

---

## 1. Vision et north star

Un recruteur colle une JD dans ChatGPT, Claude, Perplexity ou Gemini et demande « trouve-moi 5 freelances ». Aujourd'hui, personne ne peut dire à un freelance
s'il sort dans cette réponse, pourquoi, ni quoi corriger. Nous construisons **l'instrument de mesure** (Recruiter Simulator), puis **la correction honnête**
(une surface de profil lisible par les IA : hub statique, LinkedIn, GitHub, Malt, preuves tierces), puis **la re-mesure** qui prouve l'écart avant/après.
**Le produit, c'est la mesure. L'optimisation en est la conséquence.** Ordre d'entrée : freelances tech en France, puis sociétés de portage, puis ESN,
puis marché anglophone. L'index de profils vérifiés (Talent MCP) reste une option.

| North star | Définition | Source |
|---|---|---|
| **Produit : SoRV@5** | Moyenne de TA@5 sur les moteurs, sur le cluster de JD cible du client, avec IC à 95 % | MEASUREMENT_SPEC §3 |
| **Business : profils rendus visibles** | Nombre de profils dont le SoRV@5 passe de 0 à > 0, borne basse de l'IC > 0 | MEASUREMENT_SPEC §3 |
| Financier (suivi) | Revenu mensuel récurrent, avec les jalons M3/M6/M12/M24 (HYPOTHÈSES) | PLAN_ENTREPRISE §4 |

---

## 2. Vue d'ensemble des phases

| Phase | Période | Sprints | Objectif | Gate de sortie |
|---|---|---|---|---|
| **P0 Preuve** | 2026-09-21 → 2026-11-29 | S1-S5 | Prouver le mécanisme sur le profil d'Ayoub, vérifier que les LLM nomment des individus, encaisser 10 pré-paiements | **GATE du 2026-11-27** : 3 conditions (§7) |
| **P1 Service et premiers revenus** | 2026-11-30 → 2027-02-07 | S6-S10 | V0.5 : service manuel, landing SSG, Stripe Payment Links, case study, 3 pilotes portage signés (M4) | Pré-ventes livrées, revue M3, 3 pilotes signés |
| **P2 Plateforme V1 + pilotes** | 2027-02-08 → 2027-04-04 | S11-S14 | V1 SaaS multi-profils (panel partagé, monitoring), pilotes en production | **Revue M6 du 2027-03-29** : décision de levée seed |
| **P3 Scale France + B2B ESN** | 2027-04-05 → 2027-09-30 | trimestriel | Montée B2C, portage payant, entrée ESN, préparation EN | **Revue M12 du 2027-09-30** (option Talent MCP) |
| **P4 International** | 2027-10-01 → 2028-03-31 | trimestriel | UK/US, clusters EN, B2B multi-pays | Revue M18 du 2028-03-31 |
| **P5 Leadership / option Talent MCP** | 2028-04-01 → 2029-09-30 | trimestriel | 500 K€/mois à M24 (avec seed) ou M30-M36 (bootstrap) ; option index | Revue M24 du 2028-09-30, puis M36 |

Repère des mois : M0 = sept. 2026 · M3 = déc. 2026 · M4 = janv. 2027 · M6 = mars 2027 · M12 = sept. 2027 · M24 = sept. 2028.

---

## 3. P0 — Preuve (S1-S5, 2026-09-21 → 2026-11-29)

**Mode commando** (verdict du board) : Retrieval Scientist, Elias Voss et Maxwell Reid sont engagés. Budget API **< 150 $**. Deux tracks tournent en parallèle :

| Track | Contenu | Part de la capacité du founder |
|---|---|---|
| **A — Preuve** | Expérience 0, 15 interviews de recruteurs, pré-ventes (test d'argent) | ~26 h par sprint |
| **B — Fondations** | Cahier des charges, stratégie, marque, design system, charte white-hat, RGPD/DPA, pricing. **Lancée par `LAUNCH_PROMPT_FONDATIONS.md`** | ~4 h par sprint (décisions et relectures seulement) |

⚠ La Track B est **documentaire uniquement** : aucune ligne de code produit, aucun build de plateforme, aucune publication de marque avant la gate
(verdict « plateforme, branding et growth en attente »).

**Calendrier clé de P0**

> **Calendrier recalé sur la mesure réelle (2026-09-26).** La vague J0 a été mesurée le **2026-09-24**, quatre jours
> avant la date planifiée, et le test à deux bras a été publié le même jour. Les échéances J+30 et J+60 courent donc
> depuis le 24/09 : **J+30 = 2026-10-24**, **J+60 = 2026-11-23**. La **gate du 2026-11-27 ne bouge pas** : c'est une
> date d'affaires, pas une date de mesure. Conséquence favorable, non cherchée : le verdict tombe **quatre jours avant**
> la gate au lieu du même jour. Les dates planifiées initialement (28/09, 28/10, 27/11) sont périmées et remplacées.



| Date | Événement |
|---|---|
| 2026-09-21 | Début de S1 (J-7) : préparation |
| 2026-09-27 | **Gel du manifeste** et dernier jour pour ajuster le seuil de 10 % |
| **2026-09-24** | **J0 RÉEL** : mesure de base + test H0 (fait 4 jours avant le plan ; manifeste figé le 23/09) |
| ≤ 2026-10-04 | `sim-extract` exécuté sur J0 (réponses brutes détruites à 7 jours) → **verdict H0** |
| 2026-09-29 → 10-08 | Fenêtre prévue pour les actions A1-A8 (glissement probable jusqu'au ~19/10, cf. S2) |
| **2026-10-24** | **J+30** : re-mesure n°1 (manifeste `manifest-J30.json` déjà prêt) |
| ~2026-11-01 | Fin des 15 interviews |
| **2026-11-23** | **J+60** : re-mesure n°2 et verdict pré-enregistré |
| **2026-11-27** | Décompte des pré-paiements = **GATE** (date d'affaires, inchangée) |
| ≤ 2026-11-29 | Verdict formel consigné dans TEAM_MEMORY |

### S1 — 2026-09-21 → 10-04 · 🟡 · « Instrument + J0 »

> **Statut au 2026-09-18** : volet [WAR ROOM] **livré et vérifié** : monorepo, CLI `sim-run` / `sim-extract` / `sim-report` / `sim-purge`,
> 105 tests verts, couverture ≥ 80 % sur stats/extract, 3 revues (0 constat CRITIQUE ou HAUT ouvert), kits `experiment0/` et `presale/`
> (`sprints/S1_REVIEW.md`). **Reste le volet [FOUNDER]** (F1-F9 de `sprints/S1_PLAN.md`), dont le « GO API » et la mesure J0 (faite le 2026-09-24).
> Changements imposés par la réalité : Perplexity → **Agent API** (`/v1/agent`, l'ancienne API Sonar s'arrête le 2026-09-27) ; moteur Anthropic
> mesuré = **claude-sonnet-5** (retrait de Haiku 4.5 possible dès le 2026-10-15) ; vague = **780** appels.

**Objectif** : geler le protocole, rendre `sim-run` opérationnel et réaliser la mesure de base du 28/09.

**Livrables — Track A**
- `git init` dédié ; gabarits `identity.json`, `manifest.json`, `manual_sample.csv`, `actions.log`.
- Corpus gelé : 10 JD cibles (7 FR, 3 EN) + 3 JD témoins, nettoyées des contacts.
- `manifest.json` gelé le 27/09 : formulations P1-P4, versions des modèles, n = 5, plafond de coût par vague (proposition : 50 $).
- `sim-run` : 4 adaptateurs, `max_uses`, retry avec backoff, arrêt net au plafond, coût calculé à chaque tirage.
- **J0 (28/09)** : 1 040 appels API + 50 saisies manuelles (4 apps + Copilot) + captures d'indexation (GSC, Bing WMT, `site:` sur Brave).
- `sim-extract` exécuté sur J0 **avant le 05/10**, avec masquage NER des tiers → verdict H0 (40 cellules JD × moteur).
- Recruteurs à contacter listés + invitations aux interviews envoyées ; liste de prospects pour la pré-vente (FCT, IPSSI, communautés).

**Livrables — Track B** : plan du cahier des charges + glossaire · charte white-hat v0 · brief de marque et protocole de vérification des noms.

**Agents** : Retrieval Scientist (manifeste, H0) · Maxwell (revue de `sim-run`, coûts) · Elias (identité, vérification du site) · Security Sentinel (secrets,
clé AES-GCM, avant J0) · Head of Talent (ciblage des recruteurs) · Orchestrator, Victoria, Legal & Trust, Lena (Track B).

**Founder** : `git init` ; vérifier que `ayoub-hammoudi.dev` est en ligne, en SSR et indexé ; confirmer le profil Malt ; collecter les 13 JD à la main ;
ouvrir les comptes API avec plafonds de facturation ; exécuter les scripts ; **confirmer ou ajuster le seuil de 10 % avant le 28/09** ; faire la mesure J0 ;
envoyer les invitations. Charge : ~28-30 h (HYPOTHÈSE).

**Definition of Done**
- [ ] `manifest.json` daté du 27/09 au plus tard, sans modification ensuite
- [ ] `runs/J0/` contient 1 040 tirages (tout écart documenté) ; coût réel ≤ plafond
- [ ] `manual_sample.csv` : 50 lignes avec captures
- [ ] `extract/J0.jsonl` produit avant le 05/10 ; contrôle manuel : aucun nom de tiers en clair
- [ ] Verdict H0 consigné dans TEAM_MEMORY
- [ ] Au moins 3 interviews planifiées

**Dépendances** : clés API et facturation ; accès GSC et Bing WMT ; statut du site perso.
**Risques** : scripts pas prêts pour J0. Parade : périmètre minimal (`sim-run` pour J0, `sim-extract` dans les 7 jours, `sim-report` en S2). En dernier recours,
**décaler tout le calendrier d'une semaine** (décision du founder consignée avant le 28/09) plutôt que de mesurer à moitié.

### S2 — 2026-10-05 → 10-18 · 🟡 · « Hub + indexation »

> **Statut au 2026-09-18 (volet WAR ROOM avancé)** : générateur de hub + contenu d'Ayoub + textes de surface A4-A7 + juge LLM + projets
> juridiques **livrés et vérifiés** (`sprints/S2_REVIEW.md`, 130 tests). **Rien n'est publié** : option A par défaut, publication après la mesure
> API de départ. Reste au founder : 29 points à confirmer (`experiment0/surface/A_CONFIRMER.md`), déploiement du hub, GSC/Bing/IndexNow,
> publications manuelles, juriste.

**Objectif** : mettre en ligne et faire indexer le hub (A1-A3), produire le rapport de base, lancer les interviews.

**Livrables — Track A**
- `sim-report` v1 → `report/J0.md` (funnel E1-E5 par moteur, SoRV@5 avec IC, mix des sources, accord API/app).
- **A1** : hub en HTML statique (FR/EN), disponibilité datée, 4 pages `/missions/<slug>` aux chiffres vérifiés (truth lock : pas de LangGraph pour Phantera,
  pas de « 0 downtime », séniorité défendable).
- **A2** : robots.txt (Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot, Claude-User, PerplexityBot) + sitemap. **A3** : GSC, Bing WMT + IndexNow, `site:` sur Brave.
- **A5** : README de profil GitHub + 4 repos épinglés (glisse en S3 si la capacité manque). `actions.log` daté.
- 5 interviews réalisées, notes pseudonymisées, prompts réels recueillis.
- Offre de pré-vente sur une page (audit 49 €, clé en main 490 €) ; Payment Links créés mais **pas encore partagés**.

**Livrables — Track B** : analyse RGPD v1 (registre, bases légales, TTL, AIPD à évaluer, DPA avec les fournisseurs de LLM, qualification AI Act) · CGV de
prévente + politique de remboursement (proposition : remboursement intégral si la gate échoue ou si rien n'est livré au 31/12/2026) · grille de prix validée.

**Agents** : Elias (spec GEO du hub, relecture truth lock) · Maxwell (hébergement statique) · Retrieval Scientist (rapport J0) · Head of Talent · Victoria +
Freelance Power User (offre) · Legal & Trust (RGPD, CGV).

**Founder** : construire et déployer le hub ; GSC et Bing ; GitHub ; 5 interviews ; valider l'offre ; **trouver un juriste humain** pour valider CGV et RGPD
avant le premier encaissement. Charge : **~30-35 h, dépassement probable**.

**Definition of Done**
- [ ] Le HTML servi, sans exécution de JavaScript, contient le texte visible — **vérifié par `pnpm hub:verify`** (sortie complète collée dans `actions.log`)
- [ ] robots.txt autorise les 6 bots ; sitemap soumis dans GSC et Bing (captures)
- [ ] `report/J0.md` conforme à MEASUREMENT_SPEC
- [ ] 5 interviews, notes pseudonymisées
- [ ] Offre et brouillon de CGV relus par Legal & Trust

**Risques** : A1-A8 ≈ 40-48 h. La fenêtre « J1 → J10 » s'étire jusqu'au ~19/10 : moins d'exposition avant J+30, J+60 non affecté. Ordre imposé :
A1 → A2 → A3 → A8 → A4 → A5 → A6 → A7, textes rédigés par Elias et validés par le founder.

> **AJOUT du 2026-09-20 (décisions du founder, `foundations/PIVOT_ANONYME.md`)** — à exécuter en S2/S3, sans code de marketplace :
> **(1) Test à 3 bras du pivot anonyme** : publier le même jour, sur notre domaine, un profil **nominatif**, un profil **pseudonyme**
> (mêmes faits, aucun lien externe) et **une** page d'entrée « Freelances X à Paris — profils vérifiés » ; sitemap soumis à Bing/IndexNow,
> Brave et GSC ; lectures par vague réduite (150 tirages, ≈ 12 $) à **J+30 (2026-10-24)** et **J+60 (2026-11-23)**, seuils pré-enregistrés.
> **(2) Prototype de connecteur MCP** (lecture seule, profils consentants) soumis à l'annuaire Anthropic : apprentissage du canal
> « être une source dans l'assistant ». **(3) Portage suspendu** (risque de placement privé) : commission facturée à l'entreprise.

### S3 — 2026-10-19 → 11-01 · ⬜ · « Satellites + J+30 + pré-vente ouverte »

**Objectif** : compléter la surface de profil (A4-A8), réaliser la mesure J+30 et ouvrir la pré-vente.

**Livrables — Track A**
- **A4** : LinkedIn réécrit (vrai uniquement), profil public activé, 1er article + 2 posts **publiés à la main**.
- **A6** : Malt complet (Codeur.com en option) · **A7** : 1 article sur dev.to ou Medium · **A8** : cohérence d'entité et liens croisés.
- **J+30 (28/10)** : vague API + échantillon manuel + captures ; `sim-extract` avant le 04/11.
- Interviews : 11 à 12 au total.
- **Pré-vente ouverte** (après validation du juriste) : Payment Links envoyés en message direct, un par un, à la liste de prospects.

**Livrables — Track B** : rapport de disponibilité des noms (INPI, EUIPO, domaines) · fondations du design system (principes, tokens, AA, ton white-hat) ·
cahier des charges V0.5 (landing, rapport PDF, Payment Links, onboarding manuel, checklist anti-triche).

> **Avancé le 2026-09-19** : landing V0.5 construite en local (`apps/landing`, FR/EN, Lighthouse local desktop 100 / mobile 97-100,
> preuve `sprints/S3_DESIGN_REVIEW.md`). Non publiée : elle attend le nom définitif, le domaine et les CGV validées (inchangé).
> Impact sur les dates : aucun ; libère de la capacité en S6 (la landing n'y est plus qu'une mise en ligne).

**Agents** : Elias · Retrieval Scientist · Victoria (pipeline de pré-vente) · Legal & Trust · Lena + Frontend Elite (spec, sans code) · Orchestrator.
**Founder** : publications LinkedIn ; Malt ; article ; mesure J+30 ; 6 interviews ; premières conversations de vente.

**Definition of Done**
- [ ] A4-A8 datées dans `actions.log`
- [ ] `runs/J+30/` complet ; extraction avant le 04/11
- [ ] Au moins 11 interviews réalisées
- [ ] CGV validées par un juriste **avant** le 1er lien de paiement envoyé
- [ ] Au moins 3 pré-paiements encaissés (cible intermédiaire, HYPOTHÈSE)

**Risques** : juriste indisponible, donc pré-vente retardée, donc test d'argent compromis (**chemin critique**). Parade : prise de contact dès S2.

### S4 — 2026-11-02 → 11-15 · ⬜ · « Analyse J+30 + nom + interviews terminées »

**Objectif** : analyser J+30, terminer les interviews, choisir le nom et accélérer la pré-vente.

**Livrables — Track A**
- `report/J+30.md` : différence-de-différences contre les témoins, statut E1 sur les 3 index (correctif consigné si E1 n'est pas confirmé).
- **15 interviews sur 15** ; synthèse G1 ; bibliothèque I13 v1 (prompts réels anonymisés).
- A4 suite : 2e article et posts 3 et 4. Pré-vente : au moins 6 pré-paiements cumulés (HYPOTHÈSE).

**Livrables — Track B** : **nom définitif choisi par le founder** + réservation du domaine · spec des composants (landing, rapport PDF, maquettes basse fidélité
sous forme de document) · cahier des charges V1 v1 (multi-profils, Vivier B2B, exigences non fonctionnelles, stratégie de test) · calendrier éditorial LinkedIn pour P1.

**Agents** : Retrieval Scientist + QA Guardian (stats vérifiées sur fixtures) · Head of Talent · Victoria · Lena · Legal & Trust · Architect + Security Sentinel · Growth Engineer.

**Definition of Done**
- [ ] `report/J+30.md` publié en interne ; TEAM_MEMORY à jour
- [ ] Synthèse G1 chiffrée sur n = 15 (calibration, pas de kill)
- [ ] Nom consigné dans TEAM_MEMORY avec le rapport de disponibilité
- [ ] Cahier des charges V1 relu par Maxwell et Victoria (veto technique et produit)

**Risques** : aucun nom disponible. Parade : longlist élargie dès S3 ; « ReferencementCracker » ne sort jamais en public.

### S5 — 2026-11-16 → 11-29 · ⬜ · « J+60 + GATE »

**Objectif** : mesurer J+60, compter les pré-paiements, rendre le verdict.

**Livrables — Track A** : **J+60 (27/11)** + `report/J+60.md` avec le verdict pré-enregistré (SUCCÈS, AMBIGU ou KILL) · décompte des pré-paiements le
**2026-11-27 à 23:59** (paiements encaissés, pas des promesses) · dossier de gate d'une page (3 conditions + preuves + recommandation) · brouillon de case study
(succès) ou de post d'échec honnête (échec).

**Livrables — Track B** : backlog P1 prêt + ADR V0.5 · charte white-hat v1 publiable · pack légal (CGV, confidentialité, mentions légales) validé.

**Agents** : Retrieval Scientist + Maxwell (verdict technique) · Victoria (verdict argent) · Scenario Hunter (red-team : biais de confirmation, dérive des moteurs) · Orchestrator.
**Founder** : mesure J+60 ; relances de vente ; **décision de gate** ; **déclaration de sa capacité après la gate**.

**Definition of Done**
- [ ] Les 3 conditions évaluées avec leurs preuves
- [ ] Verdict et capacité consignés dans TEAM_MEMORY au plus tard le 29/11
- [ ] Budget API total de P0 ≤ 150 $ (relevé)

---

## 4. P1 — Service et premiers revenus (S6-S10, 2026-11-30 → 2027-02-07)

> **Prérequis** : gate passée. Si AMBIGU, P1 se limite à livrer les pré-ventes jusqu'au 27/12. Si échec, issue B (§7).
> Architecture V0.5 : même CLI + rapports PDF + landing SSG + Stripe Payment Links. **Tout le reste est manuel, et c'est voulu.**

| Sprint | Dates | Objectif | Livrables clés | DoD |
|---|---|---|---|---|
| **S6 « Bascule »** ⬜ | 11-30 → 12-13 | Livrer les premières pré-ventes, présence publique minimale sous le nom définitif | Engagement de toute l'équipe consigné · monorepo pnpm (`core`, `engines`, `extract`, `stats`, `apps/cli`) repris des scripts V0 · tests de `stats` (Wilson, bootstrap, DiD) · landing SSG (offre, charte, protocole, pages légales) · Payment Links (49 €, 490 €, 29 €/mois, 290 €/an) · gabarit de rapport PDF · checklist anti-triche · 1re moitié des audits pré-vendus livrée | Landing vérifiée sans JavaScript · paiement de test réussi · couverture ≥ 80 % sur `stats` et `extract` · 100 % des clients passés au scan anti-triche |
| **S7 « Case study + entonnoir »** ⬜ (fêtes) | 12-14 → 12-27 | Publier la preuve, ouvrir l'entonnoir gratuit | Case study publique (protocole + chiffres réels) · audit gratuit sur 1 JD (24 appels) + liste d'attente · 1er lot de clés en main (gabarit de hub) · LinkedIn 3 fois par semaine · **si AMBIGU : J+90 le 27/12** | Chiffres qui renvoient à des fichiers `report/` · entonnoir instrumenté · temps passé par clé en main mesuré |
| **S8 « Coûts + M3 + B2B »** ⬜ | 12-28 → 2027-01-10 | Recaler l'économie unitaire, préparer le portage | Coûts mis à jour (**fin de la promotion Gemini le 31/12/2026**) · **revue M3** comparée au jalon (~1 K€ récurrent + 3,4 K€ unique, HYPOTHÈSE) · vérificateur bots/SSR gratuit en ligne · 50 JD de marché pour le cluster 1 (collecte manuelle) · shortlist portage, deck « Vivier », contrat de pilote + DPA | Revue M3 consignée avec l'écart au jalon · coût par audit ≤ 36 $ |
| **S9 « Pilotes portage (M4) »** ⬜ | 01-11 → 01-24 | Signer 3 pilotes, faire tourner le 1er panel | **3 pilotes signés** · 1re vague du panel cluster 1 (4 000 appels, 48-180 $) · formulations v2 issues des prompts réels, **versionnées à côté de P1-P4** · cahier des charges V1 gelé + ADR | 3 contrats + DPA · `report/panel-C1-V1.md` · cahier des charges V1 signé par Maxwell et Victoria |
| **S10 « Onboarding + préparation V1 »** ⬜ | 01-25 → 02-07 | Servir les pilotes à la main, V1 prête à construire | Onboarding des consultants (consentement, scan anti-triche) · rapports par consultant + vue agrégée en PDF · « State of AI Sourcing » v0 (domaines seulement) · modèle de menaces V1 + stratégie de test · backlog S11-S14 · communautés | Chaque consultant a son rapport · backlog dimensionné sur la capacité déclarée |

**Risques de P1** : une clé en main prend 20-40 h (HYPOTHÈSE), donc plafond **< 10 par mois** tant que le gabarit de hub n'existe pas, puis prix ou périmètre revus
après 2 livraisons · moins de 3 pilotes : revue de la thèse B2B (54 % du revenu à M24) · capacité toujours à ~15 h/semaine : V1 glisse à M7-M8.

---

## 5. P2 — Plateforme V1 + pilotes portage (S11-S14, 2027-02-08 → 2027-04-04)

> Stack (ARCHITECTURE_V0) : Next.js SSG/ISR, Inngest, Neon + Prisma, Clerk, Stripe, Resend, Vercel. Validation zod à toutes les frontières.
> Objectif : **automatiser ce qui a été vendu à la main**, rien de plus.

| Sprint | Dates | Objectif | Livrables clés | DoD |
|---|---|---|---|---|
| **S11 « Fondations V1 »** ⬜ | 02-08 → 02-21 | Pipeline de mesure durable et multi-comptes | Schéma Neon/Prisma (Identity, JobDescription, Cluster, Draw, Extraction, Organisation) · Clerk avec organisations · `sim-run` sur Inngest (concurrence par fournisseur, budget par vague) · job de TTL à 7 jours · CI (types, lint, tests, couverture ≥ 80 %) · secrets vérifiés au démarrage | Vague complète de bout en bout en préproduction · test automatisé : aucune réponse brute au-delà de 7 jours |
| **S12 « Dashboard + facturation »** ⬜ | 02-22 → 03-07 | Le client voit son funnel et paie seul | Dashboard (funnel E1-E5, SoRV@5 avec IC, carte des sources, « qui sort à ta place » en domaines seulement) · onboarding + scan anti-triche automatisé · Stripe Billing · e-mails Resend · audit gratuit en libre-service · « State of AI Sourcing » publié | E2E « inscription → audit gratuit → paiement → rapport » vert · scan anti-triche testé sur fixtures piégées |
| **S13 « Panel + Vivier + migration »** ⬜ | 03-08 → 03-21 | Monitoring récurrent et vue B2B | Panel partagé par cluster (fréquence selon la densité) · monitoring mensuel + alertes · échantillonnage adaptatif + cache · vue Vivier · migration des clients V0.5 · revue de sécurité · tests d'injection sur l'extracteur | 3 pilotes sur V1 · précision de l'appariement ≥ 95 % · aucune constatation critique ou haute ouverte |
| **S14 « Lancement + revue M6 »** ⬜ | 03-22 → 04-04 | Lancer publiquement, décider sur chiffres réels | Lancement public V1 + Product Hunt · **revue M6 le 2027-03-29** : revenu comparé à ~8 K€/mois (HYPOTHÈSE), **décision seed**, décision open source, 1re recrue, go ou no-go ESN | Décisions de M6 consignées · **seuils de M6 pré-enregistrés avant le 2027-03-01** |

---

## 6. P3, P4, P5 — découpage trimestriel

> Tous les KPIs cibles sont des **HYPOTHÈSES** (PLAN_ENTREPRISE §4 et §6). On ne met pas de chiffre entre deux jalons : une interpolation serait un chiffre inventé.

### P3 — Scale France + B2B ESN (2027-04-05 → 2027-09-30, M7-M12)

| Trimestre | Objectifs | Livrables majeurs | KPIs cibles (HYPOTHÈSE) | Recrutements |
|---|---|---|---|---|
| T2 2027 | Pilotes portage convertis en payant ; entrée ESN ; clusters 2 et 3 | Offre ESN « Vivier+ » (1 490-2 990 €/mois) ; panels AI/LLM Eng et Data Eng ; préparation de la levée si seed décidée | Conversion gratuit → payant proche de 5 % ; churn B2C < 8 %/mois ; CAC < 3 mois | 1re recrue sales/partnerships B2B, ou cofondateur business |
| T3 2027 | Préparer l'anglophone ; revoir les idées parquées (I10, I24) | Corpus et clusters EN ; analyse juridique UK/US ; tarification USD/GBP ; **revue M12 le 2027-09-30** | **M12 : ~56 K€/mois** | Seed M9-M12 si décidée ; 4 personnes à M12 |

### P4 — International (2027-10-01 → 2028-03-31, M13-M18)

| Trimestre | Objectifs | Livrables | KPIs (HYPOTHÈSE) |
|---|---|---|---|
| T4 2027 | Lancement UK/US B2C | Produit EN, case studies EN, contenu d'autorité ; décision sur l'option Talent MCP | Premiers abonnés EN ; accord API/app ≥ 80 % sur les clusters EN |
| T1 2028 | B2B hors France | Vivier UK/UE ; évaluation de l'API plateformes (I31) ; **revue M18 le 2028-03-31** | Scénario médian du board : 30-60 K€/mois à M18-M24 |

### P5 — Leadership / option Talent MCP (2028-04-01 → 2029-09-30, M19-M36)

| Trimestre | Objectifs | KPIs (HYPOTHÈSE) |
|---|---|---|
| T2 2028 | Densifier les panels, industrialiser le B2B, contrats partenaires / API | — |
| T3 2028 | **Revue M24 le 2028-09-30** | **~500 K€/mois avec seed** : 4 000 Pro (1 500 FR + 2 500 EN), 180 comptes B2B × 1 500 €, 6 partenaires × 8 K€ ; 8-10 personnes |
| T4 2028 | Option C5 si déclenchée : index vérifié / Talent MCP | > 1 000 profils vérifiés (prérequis) |
| T1-T2 2029 | Moat : historique des panels, bibliothèque I13, label vérifié | — |
| T3 2029 | **Revue M36** | Chemin bootstrap : **500 K€/mois vers M30-M36** |

⚠ **Écart à connaître** : la trajectoire du plan d'entreprise (~56 K€/mois à M12) est plus agressive que le scénario médian du board
(30-60 K€/mois à M18-M24). Les deux sont des hypothèses ; la revue M6 dira laquelle suivre.

---

## 7. Gates et kill criteria

| Gate | Date | Test | Seuil | Si échec |
|---|---|---|---|---|
| Gel du protocole | 2026-09-27 | Manifeste et seuils gelés | Modifiables jusqu'à cette date, jamais après | Pas de J0 tant que ce n'est pas gelé |
| **G2 / H0 : les LLM nomment des individus** | J0 = 09-28, verdict ≤ 10-04 | 40 cellules JD × moteur | Au moins 2 moteurs sur 4 nomment des individus | ≥ 3 sur 4 refusent : **kill précoce** → issue B ou agence (I43) |
| Point J+30 | 2026-10-24 | Funnel E1-E5 | E1 confirmé | Correctif d'indexation consigné |
| G1 (calibration) | ~2026-11-01 | 15 interviews | Au moins 30 % sourcent via un LLM au moins une fois par mois | **Pas de kill** (décision du founder) → signal revu à M6 |
| **GATE (1) Mécanisme** | 2026-11-23 (verdict) → 2026-11-27 (gate) | J+60 | SoRV@5 ≥ 10 % (borne basse de l'IC > base, dérive des témoins < 5 pts) **ou** RR ≥ 30 % sur 2 moteurs | KILL (RR < 10 % et TA@5 < 3 % partout, E1 confirmé) → **issue B** |
| **GATE (2) Individus** | J0 | H0 | voir G2 | voir G2 |
| **GATE (3) Argent** | 2026-11-27 à 23:59 | Paiements encaissés | 10 freelances pré-paient (49 € ou 490 €) | **Issue B** ; pré-ventes remboursées selon les CGV |
| AMBIGU | J+90 = 2026-12-27 | Vague avec n = 10 (2 080 appels, ~25-94 $) | Mêmes critères | Nécessite une **extension du budget de 150 $** (founder) ; P1 réduit aux livraisons |
| Revue M3 | 2026-12-31 | Revenu, conversion | ~1 K€ récurrent + 3,4 K€ unique (HYPOTHÈSE) | Calibration, pas de kill |
| Pilotes (M4) | 2027-01-31 | Contrats | 3 signés | Revue de la thèse B2B |
| **Revue M6** | 2027-03-29 | Revenu, rétention, pilotes | ~8 K€/mois (HYPOTHÈSE), seuils fixés avant le 03-01 | Pas de seed → bootstrap (500 K€ vers M30-M36) |
| **Revue M12** | 2027-09-30 | Revenu ; option C5 | ~56 K€/mois ; C5 si > 1 000 profils vérifiés **et** canal 3 > canal 1 chez les recruteurs | C5 reste parquée |
| Continu | chaque vague | Qualité de la mesure | Accord API/app ≥ 80 % ; précision ≥ 95 % ; dérive des témoins < 5 pts | Modèles supérieurs ; rapports bloqués |
| Continu | chaque mois | Churn B2C | < 8 %/mois | Revue de la rétention |

**Issue B (outil interne)** : on garde la CLI pour nos propres profils (< 20 €/mois), on publie l'échec honnêtement, on ne construit aucun SaaS.

---

## 8. Tableau de bord des KPIs par phase

| Phase | Produit | Business | Qualité |
|---|---|---|---|
| P0 | RR, MR, TA@5, CR par moteur ; SoRV@5 d'Ayoub ; verdict H0 | Pré-paiements (objectif 10) ; interviews 15/15 ; part G1 | Coût par vague ≤ plafond ; total ≤ 150 $ ; accord API/app ; 0 nom de tiers persisté ; manifeste intact |
| P1 | Profils rendus visibles ; delta de SoRV par client | Revenu vs M3 ; conversion gratuit → payant (5 %, HYP.) ; pilotes signés | Coût par audit ≤ 36 $ ; temps par livraison ; 100 % des clients scannés |
| P2 | Clients monitorés ; alertes envoyées | MRR vs M6 (~8 K€) ; churn < 8 % ; CAC < 3 mois | Couverture ≥ 80 % ; E2E verts ; TTL de 7 jours prouvé ; aucune constatation critique |
| P3 | Clusters actifs ; densité par cluster | ~56 K€/mois à M12 ; comptes B2B | Marge brute B2C 65-85 %, B2B > 90 % (HYP.) |
| P4-P5 | Profils vérifiés (seuil C5 : 1 000) | M18, M24, M36 | Accord API/app sur les clusters EN ≥ 80 % |

---

## 9. Registre des risques (top 10)

| # | Risque | Proba | Impact | Parade | Owner |
|---|---|---|---|---|---|
| 1 | **Capacité du founder (~15 h/semaine)** | Haute | Haut | Track A en priorité ; Track B ≤ 4 h ; textes rédigés par les agents ; clés en main plafonnées ; capacité déclarée à la gate | Orchestrator |
| 2 | Les LLM refusent de nommer des individus (H0) | Inconnue | Fatal | Test à J0, verdict ≤ 04/10 ; pivot préparé | Retrieval Scientist |
| 3 | Indexation trop lente, le mécanisme ne bouge pas en 60 jours | Moyenne | Haut | A1-A3 en premier ; E1 suivi dès J+30 ; exception J+90 | Elias Voss |
| 4 | Test d'argent raté (réseau trop petit, juriste en retard) | Moyenne | Haut | Prospects dès S1 ; juriste en S2 ; pré-vente en S3 | Victoria |
| 5 | Demande recruteur non prouvée (G1 rétrogradé) | Inconnue | Haut | 15 interviews ; bibliothèque I13 ; signal revu à M6 | Head of Talent |
| 6 | Résultats API différents de l'app (< 80 %) | Moyenne | Moyen | Calibration à chaque vague ; modèles supérieurs | Retrieval Sci. + Maxwell |
| 7 | Dérive des moteurs, des API ou des prix (Gemini au 31/12/2026, Brave) | Haute | Moyen | Témoins ; versions enregistrées ; coûts en configuration ; plafond par vague | Maxwell |
| 8 | RGPD et juridique (tiers, DPA, prévente, AI Act) | Moyenne | Haut | Masquage NER ; TTL de 7 jours ; DPA ; juriste avant le 1er encaissement | Legal & Trust |
| 9 | Le canal 3 absorbe le canal 1 ; Peec/Otterly ajoutent « Personne » ; LinkedIn ou Malt exposent un score gratuit | Moyenne | Haut | Vitesse ; prompts réels ; Vivier B2B ; option C5 à M12 | Victoria + Scenario Hunter |
| 10 | Perception « black-hat » ou affirmations contestables | Faible | Haut | Nom sans « Cracker » ; charte publique ; scan anti-triche ; truth lock | Legal & Trust + Lena |

---

## 10. Rituels War Room

| Rituel | Quand | Durée | Contenu |
|---|---|---|---|
| Point asynchrone | Chaque lundi | 15 min | Le founder note ses heures, ses blocages et ses mesures ; l'Orchestrator ajuste |
| Revue + rétro de sprint | Dimanche de fin de sprint | 45 min | Statuts, KPIs, risques, DoD vérifiée sur preuves |
| Planning de sprint | Lundi de début de sprint | 30 min | Engagement dimensionné sur la capacité déclarée |
| Jour de mesure | J0, J+30, J+60 (J+90) | ~4 h | Checklist du protocole ; manifeste intouchable ; extraction dans les 7 jours |
| Revue de gate | 2026-11-27, M3, M6, M12 | 1 h | Seuils pré-enregistrés ; red-team par le Scenario Hunter |

**Format d'une entrée TEAM_MEMORY** (une par décision, mesure ou fin de sprint, jamais réécrite) :
`- **AAAA-MM-JJ — [Agent(s) ou FOUNDER]** Fait / décision. Preuve : <fichier>. Impact roadmap : <sprint ou aucun>. Prochaine action : <qui, quand>.`

| Situation | Agents à invoquer |
|---|---|
| Préparation ou analyse d'une vague de mesure | Retrieval Scientist, Maxwell, QA Guardian |
| Textes du profil (hub, LinkedIn, Malt) | Elias Voss (+ Legal & Trust pour le truth lock) |
| Prix, offre, vente, pilotes | Victoria, Freelance Power User, Head of Talent |
| Contrat, CGV, RGPD, DPA, marque | Legal & Trust |
| Marque, design system, rapport PDF | Lena Sørensen, Frontend Elite |
| Décision d'architecture | Architect, Maxwell |
| Code écrit ou modifié | QA Guardian, puis Security Sentinel avant tout commit |
| Déploiement, cron TTL, secrets | DevOps Operator, Security Sentinel |
| Entonnoir, contenu, lancement | Growth Engineer |
| Avant chaque gate ou décision irréversible | Scenario Hunter (red-team), Orchestrator (arbitrage) |

---

## 11. Dépendances critiques et chemin critique

**Chemin critique (Track A)**
1. `git init` et clés API → `sim-run` opérationnel (avant le 28/09).
2. J0 (28/09) → `sim-extract` **dans les 7 jours** (TTL des réponses brutes) → verdict H0 (≤ 04/10).
3. A1-A3 (hub en ligne et soumis aux 3 index) au plus tôt : c'est le délai d'indexation qui fixe l'effet mesurable.
4. J+30 (28/10) → J+60 (27/11) → gate → verdict (≤ 29/11).
5. Après la gate : nom + pack légal → landing + Payment Links (S6) → case study (S7) → pilotes (S9) → V1 (S11-S14) → revue M6 (2027-03-29).

**Chemin parallèle (test d'argent)** : offre (S2) → validation du juriste (S2-S3) → pré-vente ouverte (S3) → 10 paiements au 27/11.

| Dépendance | Nécessaire pour | Échéance |
|---|---|---|
| Statut de `ayoub-hammoudi.dev` (en ligne, SSR, indexé) | Périmètre de A1, identité | 2026-09-27 |
| Clés API + plafonds de facturation | J0 | 2026-09-27 |
| Seuil de 10 % confirmé | Pré-enregistrement | 2026-09-27 |
| Juriste (CGV, RGPD) | 1er encaissement | 2026-10-18 |
| Nom définitif + domaine | Landing | 2026-11-15 |
| DPA avec les fournisseurs de LLM | 1er client livré | 2026-12-13 |
| Capacité du founder après la gate | Dimensionnement de P1 et P2 | 2026-11-27 |

---

## 12. Complexité par phase

| Phase | Complexité | Pourquoi |
|---|---|---|
| P0 | **Medium** | Technique modeste ; difficulté dans la rigueur du protocole et la capacité du founder |
| P1 | **Medium** | Beaucoup de manuel ; saturation possible des livraisons ; vente B2B naissante |
| P2 | **High** | SaaS multi-comptes, pipeline durable, facturation, RGPD exécutable, en 8 semaines |
| P3 | **High** | Cycles de vente ESN, recrutements, éventuelle levée |
| P4 | **High** | Nouveau marché, juridique UK/US, calibration EN |
| P5 | **High** | Forte incertitude ; option biface face à Upwork, SeekOut et LinkedIn |

---

## 13. Décisions attendues du founder

| # | Décision | Échéance |
|---|---|---|
| D1 | Confirmer ou ajuster le seuil de 10 % (et le plafond de 50 $ par vague) | 2026-09-27 |
| D2 | Afficher ou non une fourchette de TJM sur le hub (A1) | 2026-10-04 |
| D3 | Structure de facturation pour la pré-vente (avec Legal & Trust) | 2026-10-18 |
| D4 | Politique de remboursement si la gate échoue | 2026-10-18 |
| D5 | Nom de marque définitif | 2026-11-15 |
| D6 | Capacité hebdomadaire après la gate | 2026-11-27 |
| D7 | Extension de budget si AMBIGU (J+90) | 2026-11-29 |

**VALIDÉE PAR LE FOUNDER — 2026-09-18**
