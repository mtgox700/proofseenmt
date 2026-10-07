# C9 — Recherche sans score · reprise

> Écrit le 2026-10-07, branche `sprint/c9-recherche-sans-score`. Lancé sur le « go C9 » du founder.

## Fait

| Brique | Fichiers |
|---|---|
| Traduction d'une phrase en filtres candidats (Claude Haiku 4.5, sans outil, coût réel calculé) | `packages/engines/src/brief.ts` |
| Revalidation : filtres bornés seulement, tout tri, score ou liste de personnes jeté | `packages/db/src/brief-filters.ts`, test AI Act |
| Route `POST /api/search/brief` : connectés seulement, 20/h par personne, plafond journalier `PROOFSEEN_BRIEF_DAILY_CAP` | `apps/web/src/app/api/search/brief/route.ts` |
| Délai de réponse d'une entreprise (médiane, 6 mois, ≥ 3 décisions) sur la page d'une mission | `packages/db/src/missions.ts`, `packages/hub/src/job-page.ts` |
| Délai médian jusqu'au premier échange d'une entreprise dans `funnel` | `packages/db/src/funnel.ts`, `apps/cli/src/funnel.ts` |

Mesures : 0,00053 $ par brief, ~1 s ; exécuté sur le site compilé avec la base Railway et la session du founder.

## Reste à faire

1. Écrans (session design) : champ « décrivez votre besoin », filtres affichés et modifiables avant la recherche, même chose
   pour créer une alerte côté freelance ; repli sur le formulaire quand la route répond « non-configuré ».
2. Au déploiement : `ANTHROPIC_API_KEY` et, si besoin, `PROOFSEEN_BRIEF_DAILY_CAP` dans l'environnement du site.
3. Mesurer « arrivée → premier contact » avant et après la mise en ligne des écrans (`funnel`).
