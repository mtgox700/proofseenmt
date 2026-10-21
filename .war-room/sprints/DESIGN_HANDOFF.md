# Refonte « Legends League » : passation

> Mandat : `.war-room/PROMPT_LEGENDS_REDESIGN.md` (founder, 2026-10-20). Méthode : skill `katana-forge`, `PLAN.md`.
> Pas de GO DEPLOY : chaque lot est fusionné sur `main`, la production ne bouge pas.

## État au 2026-10-21

| Étape | État | Où |
|---|---|---|
| Vague 0, audit (Kage) et arbitrages | faits | `.war-room/design/AUDIT.md`, captures avant `.war-room/design/before/` |
| Marque (Sumi), verdict | faits | `.war-room/brand/BRAND_BOOK.md`, `PLANCHE.png`, `packages/brand/`, `apps/web/public/brand/` |
| Concept et storyboard (Sensei) | faits | `.war-room/design/CONCEPT.md`, `STORYBOARD.md` (M1 le relevé, M2 l'essai et la frappe, M3 le passage au guichet) |
| Lot a, socle de marque | fusionné, PR #72 | captures `.war-room/design/after-a/` |
| Lot d, fiche profil et trace de preuve | fusionné, PR #73 | `after-d/` |
| Lot g, vide, erreur, 404, hors ligne | fusionné, PR #74 | `after-g/` |
| Lot b, vitrine | fusionné, PR #75 | `after-b/`, Lighthouse mobile 0,97 à 0,98 |
| Lots e+f, missions, entreprises, baromètres, blog | fusionné, PR #76 | `after-ef/` |
| Lot c, annuaire et carte unique, M3 | fusionné, PR #77 | `after-c/` |
| Vague 7, Mamori | fait, tous budgets PASS sauf BP sur l'aperçu (127.0.0.1) | `.war-room/design/MAMORI_REPORT.md` |
| Vague 7, Kensa | FAIL : 3 bloquants, 7 majeurs | `.war-room/design/KENSA_REVIEW.md` |
| Correctifs vague 7 | faits, seconde passe de Kensa puis 3 phrases de vérité corrigées | branche `sprint/design-legends-polish` (avec `-polish-a` et `-polish-b` fusionnées) |
| Verdict du Shogun | porte passée pour la surface publique, restes listés | `.war-room/design/VERDICT.md` |
| BEFORE_AFTER | fait, captures et chiffres de l'arbre final | `.war-room/design/BEFORE_AFTER.md`, captures `after/` |

## Déjà corrigé sur la branche polish

En-tête mobile (trois colonnes, fondu), bords gauches des pages larges et des fiches sur `--ps-max`, captures de
l'ancienne interface retirées de la vitrine, JSON-LD de l'accueil et de l'index des missions, `x-default` partout,
`apps/web/NOTICE.md`. Le reste des défauts est dans `KENSA_REVIEW.md`.

## Pièges connus

- Le panneau navigateur intégré n'affiche rien quand il est masqué ; captures avec Playwright (`mcp__playwright__*`,
  chemins relatifs au dépôt, `.playwright-mcp/` exclu de git).
- `marketplace-verify` et les tests du hub exigent des pages identiques pour les robots, sans script hors JSON-LD,
  sans `display:none` ni `opacity:0`.
- Gate complet sur le VPS : arbre copié dans `/root/pscheck`, script `/root/gate.sh` dans `node:22-bookworm-slim`,
  journal `/root/pscheck.log` (marqueurs `GATE-END`, `PREVIEW-END`). Aperçu privé : `deploy/vps/preview.sh`, port
  127.0.0.1:3200, tunnel `ssh -N -L 3200:127.0.0.1:3200 root@82.165.57.191`.
- Lighthouse : `lighthouse@12.8.2` dans `node:22-bookworm-slim` avec chromium Debian, `--network host`, rapports dans
  `/root/lh/`.
- Commits au nom d'Ayoub, jamais de mention de Claude, aucun tiret cadratin dans les textes.

## Suite immédiate

1. Fusionner la PR de `sprint/design-legends-polish` (gate vert : 271 fichiers, 2 613 tests).
2. Attendre les décisions du founder listées dans `VERDICT.md` (page Commander, page nominative) et son GO DEPLOY.
3. Après GO DEPLOY : déployer `main`, remesurer Lighthouse en production, vérifier sitemaps, llms.txt et JSON-LD en prod.
