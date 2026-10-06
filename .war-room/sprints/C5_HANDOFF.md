# C5 — Profils cités par les IA, à l'échelle · reprise

> Écrit le 2026-10-06. Fusionné sur `main` par la PR du sprint `sprint/c5-profils-cites`.

## Fait

| Brique | Fichiers |
|---|---|
| Page publique de chaque profil publié, depuis la base, sans JavaScript, `ProfilePage` sans aucune note agrégée | `packages/db/src/public-profiles.ts`, `packages/hub/src/profile-page.ts`, `apps/web/src/app/[lang]/profils/[slug]/route.ts` |
| Profil pseudonyme : ni nom ni adresse web, seulement le nombre de preuves | `packages/hub/src/profile-page.ts` |
| Pages métiers : n'existent qu'avec au moins deux éléments réels (missions ouvertes + profils publiés), 404 sinon | `packages/db/src/skill-pages.ts`, `packages/hub/src/skill-page.ts`, `apps/web/src/app/[lang]/metiers/[key]/route.ts` |
| Sitemaps profils, missions, métiers ; `robots.txt` (6 robots d'IA autorisés, espaces privés exclus) | `apps/web/src/app/sitemap-*.xml/`, `apps/web/src/app/robots.txt/route.ts` |
| IndexNow à chaque publication, modification ou retrait de profil | `apps/web/src/data/indexnow.ts` |
| `marketplace-verify` : chaque page publique demandée comme un navigateur et comme chaque robot, attendus tirés de la base | `packages/hub/src/marketplace-verify.ts`, `apps/cli/src/marketplace-verify.ts` |
| Icône intégrée aux rendus publics (le 404 `favicon.ico` coûtait 4 points de bonnes pratiques) | `packages/hub/src/pages.ts` |

Mesures sur le site compilé (base locale) : `marketplace-verify` 9/9 ; Lighthouse profil, mission, métier et index des
missions à 100 en performance, accessibilité, bonnes pratiques et SEO (l'index était à 97 en accessibilité : titres de
cartes en `h3` sans `h2`, corrigé).

## Reste à faire pour clore C5

1. **Mesure de conquête** (part des citations IA vers proofseen.com face à Malt et LinkedIn) : **GO API requis**. À
   lancer avec la remesure J+45 de Zak pour un seul coût.
2. Avec `DATABASE_URL` et le site déployé (GO DEPLOY) : `pnpm tsx apps/cli/src/main.ts marketplace-verify --base-url https://proofseen.com`.
3. Suivi d'indexation Bing, Brave et Google : comptes Search Console et Bing Webmaster au nom du founder, puis
   `INDEXNOW_KEY` et `PROOFSEEN_PUBLIC_URL` dans l'environnement de production.

## Suite

C6 — Confiance, conformité, robustesse.
