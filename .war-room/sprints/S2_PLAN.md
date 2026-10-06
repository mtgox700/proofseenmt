# SPRINT 2 (volet WAR ROOM, avancé) — « Hub + surface + juridique » (préparé le 2026-09-18)

> Référence : `ROADMAP.md` S2-S3 (Track A : A1-A7 ; Track B : RGPD v1, CGV, cahier V0.5) + ouverts de `S1_REVIEW.md`.
> Règles : **aucune commande git** · aucun code SaaS avant le 2026-11-27 · aucun appel API payant ·
> **option A par défaut** (non tranchée par le founder) : tout est préparé, **rien n'est publié** sur tes profils avant la mesure API de départ.

## Tâches [WAR ROOM]

| id | Tâche | Owner | Definition of Done |
|---|---|---|---|
| W12 | `packages/hub` : générateur de site statique (profil JSON validé par zod → HTML FR/EN sans JavaScript, pages missions, robots.txt ouvert aux 6 bots, sitemap, hreflang, canonical, disponibilité datée, JSON-LD en hygiène) + commande `hub` dans la CLI | Elias + Frontend Elite | Tests : échappement XSS, texte présent sans JS, aucun texte caché, robots et sitemap conformes ; build vert |
| W13 | Contenu du hub d'Ayoub (`experiment0/hub/ayoub.profile.json`), truth lock : uniquement des faits vérifiés, sinon `[À CONFIRMER]` | Elias + Head of Talent | Valide contre le schéma ; liste « à confirmer » pour le founder |
| W14 | Textes de surface A4-A7 : LinkedIn (titre, infos, expériences), README GitHub, profil Malt, plan d'article dev.to, FR/EN | Elias + Head of Talent | Fichiers dans `experiment0/surface/` ; aucune affirmation non vérifiée |
| W15 | Juge LLM des appariements « probables » (REQ-M2-02) : sans outils, sortie JSON stricte, injectable, désactivé par défaut en V0 | Retrieval Scientist + Security | Tests sur fixtures (oui/non/invalide/injection) ; aucun appel réseau en test |
| W16 | Projets juridiques : CGV de pré-vente, politique de confidentialité, notice « personnes citées par les IA », mentions légales, clause de véracité | Legal & Trust | `presale/legal/` ; chaque document marqué « PROJET — à valider par un juriste » |
| W17 | Revue (typescript-reviewer, security-reviewer) + vérification complète | QA + Security | 0 constat CRITIQUE ou HAUT ouvert ; sorties collées |

## Tâches [FOUNDER] (rappel, hors de ce sprint War Room)

- F1-F9 de `S1_PLAN.md` (comptes API quand le budget arrive, US-F00, 13 JD, gel, J0).
- Valider les textes W13 et W14, puis **les publier seulement après la mesure API de départ**.
- Choisir l'option A ou B (`TEAM_MEMORY`).
