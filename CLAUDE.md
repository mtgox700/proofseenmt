# Proofseen — consignes de la War Room

**Objectif du founder : conquérir Malt et Free-Work avec ce projet, construit par la War Room.**

## Démarrage et enchaînement automatique des sprints

Le plan d'exécution est `.war-room/PROMPTS_CONQUETE.md`. Il contient un prompt par sprint (C1 à C7), un bloc commun et un
protocole d'enchaînement.

- **À chaque clôture de sprint**, et **au début de toute session** où le founder dit « go », « continue », « war room » ou
  équivalent : ouvrir `.war-room/PROMPTS_CONQUETE.md`, prendre la première ligne du tableau de bord qui n'est pas ✅, et
  exécuter le prompt de ce sprint en appliquant son bloc commun.
- Un sprint ✅ déclenche immédiatement le suivant, sans attendre de feu vert. On ne s'arrête que pour une décision qui
  appartient au founder (GO API, GO PAIEMENT LIVE, GO DEPLOY, marque, prix), et on continue en parallèle ce qui n'en
  dépend pas.
- Avant que le contexte ne sature : écrire `.war-room/sprints/Cx_HANDOFF.md` pour que la session suivante reprenne sans
  rien redécouvrir.

## Règles qui ne se discutent pas

- **Git (décision du founder, 2026-10-06)** : la War Room committe, ouvre la PR et la merge **à la fin de chaque sprint**
  sur `github.com/Ayoubhm07/Proofseen`, avec `gh`. Commits, PR et merges **au nom du founder** (`Ayoub
  <ayoub.hammoudi05@gmail.com>`), **jamais de mention de Claude** : ni `Co-Authored-By`, ni signature « Generated with ».
  Historique propre : une branche par sprint (`sprint/cX-…`), commits conventionnels groupés par sujet, gate vert avant
  push. Jamais de `--force` sur `main`, jamais de données clients (`clients/`) ni de secret (`.env`).
- Le dépôt Proofseen est **son propre dépôt** (`ReferencementCracker/.git`) : ne jamais committer depuis le dépôt parent
  du Bureau, qui pousse vers PhanteraTN.
- Aucun appel payant aux API de LLM sans « GO API » ; aucun paiement réel sans « GO PAIEMENT LIVE ».
- Aucun scraping ni aucune automatisation sur LinkedIn ou Malt. Veille concurrentielle : pages publiques, à la main,
  jamais en contournant Cloudflare.
- Aucun chiffre, avis, mission ou compétence inventé. Aucune promesse de résultat.
- Aucun classement automatique de personnes (AI Act) : filtres et faits vérifiés.
- Le juridique est traité par le founder à la fin : ce n'est jamais un point de blocage.
- Sources de vérité, dans cet ordre : `.war-room/TEAM_MEMORY.md`, puis `.war-room/PROMPTS_CONQUETE.md`, puis `.war-room/ROADMAP.md`.
