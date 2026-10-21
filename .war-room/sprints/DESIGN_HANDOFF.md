# Refonte « Legends League » : passation

> Mandat : `.war-room/PROMPT_LEGENDS_REDESIGN.md` (founder, 2026-10-20). Méthode : skill `katana-forge`, `PLAN.md`.
> Pas de GO DEPLOY : chaque lot est fusionné sur `main`, la production ne bouge pas.

## État au 2026-10-21

| Étape | État | Où |
|---|---|---|
| Vague 0, audit (Kage) | fait | `.war-room/design/AUDIT.md`, captures avant `.war-room/design/before/` (12 PNG, prod, 1440 et 375) |
| Arbitrages du Shogun | faits | fin de `AUDIT.md` (8 décisions) |
| Vague 0 bis, marque (Sumi) | en cours | branche `sprint/design-legends-a`, livrables attendus `.war-room/brand/BRAND_BOOK.md`, `PLANCHE.png`, SVG `apps/web/public/brand/` |
| Verdict du Shogun sur la marque | à faire | |
| Lots a à g | à faire | une PR chacun, branche `sprint/design-legends-<lot>` |
| Vague 7, Kensa puis Shogun | à faire | |
| BEFORE_AFTER, Lighthouse mesuré | à faire | `.war-room/design/BEFORE_AFTER.md` |

## Décisions clés (détail dans AUDIT.md)

- La vitrine est `apps/web/src/app/[lang]/page.tsx` ; `apps/landing` (Astro) n'est pas déployée et ne reçoit que les fichiers de marque.
- L'accueil devient indexable (aujourd'hui `noindex` par `apps/web/src/app/[lang]/layout.tsx:38`).
- Sombre par défaut, clair défini (`prefers-color-scheme`), contrastes AA mesurés.
- Aucun prix public (les offres 49 € / 490 € disparaissent).
- Une seule marque pour React et le hub HTML (mêmes tokens), le hub garde une pile système pour le corps.
- Rien n'est caché en attendant une animation (pas d'opacité nulle initiale).
- Le graphique des 780 réponses perd ses 214 Ko.
- Pack 21st.dev du founder : vide sur le compte relié ; catalogue via `search`/`get_inspiration`, licence lue avec `get_component`, crédit dans `apps/web/NOTICE.md`.

## Pièges connus

- Le panneau navigateur intégré n'affiche rien quand il est masqué ; les captures se font avec Playwright (`mcp__playwright__*`, fichiers relatifs au dépôt, `.playwright-mcp/` exclu de git).
- Une quinzaine de tests vérifient du markup ou du texte (liste dans AUDIT.md §4) : les mettre à jour avec le changement, jamais les affaiblir.
- `marketplace-verify` et les tests du hub exigent des pages HTML identiques pour les robots, sans script hors JSON-LD, sans `display:none` ni `opacity:0`.
- Gate complet sur le VPS (conteneur jetable `/root/pscheck`), pas en local (trop lent).
- Commits au nom d'Ayoub, jamais de mention de Claude, aucun tiret cadratin dans les textes.

## Suite immédiate

1. Lire le rapport de Sumi, regarder `PLANCHE.png` et le logo à 16 px, rendre le verdict.
2. Lot a avec Tetsu : brancher tokens, polices, logo, layout global (React + hub), favicon et icônes PWA, `theme-color` par thème, carte de partage `og:image`.
