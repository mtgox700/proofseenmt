# C13 — lot D : côté public sans démo, vrai menu, llms.txt, pages métiers factuelles

Branche `sprint/c13-public` (non poussée).

## Construit

- **Plus aucune démo devant un visiteur.** `/[lang]/freelance*` et `/[lang]/entreprise*` sont supprimés et répondent en
  **308** (middleware, `apps/web/src/lib/legacy-pages.ts`) : `/fr/freelance…` → `/fr/app`, `/fr/entreprise…` →
  `/fr/freelances` (idem `/en`). La query est conservée. `/fr/freelances` n'est pas capturé par la règle `freelance`.
- **Menu public** (`SiteHeader`, et le même dans les pages HTML brutes de `packages/hub` via `market-shell.ts`) :
  Missions, Freelances, Métiers, Se connecter, Créer un compte (`/creer-un-compte`), langue.
- **Annuaire `/[lang]/freelances`** : route handler + `renderProfileDirectory` (hub). Profils publiés depuis la base
  (`publicProfiles(db).directory`), filtres compétence / ville en GET (`competence`, `ville`, `page`), 20 par page.
  Ordre affiché : du plus récemment mis à jour au plus ancien. Cartes : titre, ville, mode, compétences, faits vérifiés
  (répertoire, identité, vigilance, missions vérifiées, entreprises payeuses). Page nue indexable ; page filtrée en
  `noindex, follow` (même règle que `/missions`).
- **Index `/[lang]/metiers`** : `renderSkillIndex`, depuis `skillPages(db).listForSitemap()` (qui renvoie maintenant
  libellé et nombres), ordre alphabétique.
- **Pages métiers factuelles** : paragraphe « En bref » (profils publiés, missions ouvertes, villes, fourchette de TJM
  **seulement si n ≥ 5**, avec n), FAQ visible + `FAQPage` en JSON-LD (dans un `@graph` avec la `CollectionPage`),
  date de génération (jour seul, pour que le rendu reste identique d'une requête à l'autre).
- **`/llms.txt`** (format llmstxt.org), texte brut : pages publiques, pages métiers existantes, sitemaps, robots.
- Sitemap des pages fixes : + `/fr|en/freelances`, `/fr|en/metiers`. `marketplace-verify` (CLI) vérifie aussi
  l'annuaire et l'index des métiers.

## Décisions

- L'accueil garde l'image J0 (`j0-answers.json`, mesure réelle du fondateur, approuvée) ; il perd la carte de profil
  de `profiles.json`, le point d'arrêt du fondateur (espace démo) et le lien « voir la démo ». La vitrine garde deux
  captures (vue d'ensemble, plan de correction) sans afficher d'adresse ; la capture « fiche entreprise » est retirée.
- `/api/profiles.json` (liste figée de l'ancien site statique) n'est **pas** cité dans `llms.txt` : il ne reflète pas
  la base.
- robots.txt inchangé : `Allow: /` couvre `/llms.txt`, les nouvelles pages et leurs sitemaps sont déjà déclarés.
- Supprimés car plus utilisés : `data/demo.ts`, `lib/directory.ts` (+ test), `data/profiles.json`,
  `data/freelance/FR-7H2XK.json`, composants `workspace/*` de la démo, `Interval`, `RequestProfile`, captures
  `profile-*`, sections i18n `ws/overview/report/proofs/evolution/profile`. `pnpm --filter @proofseen/web snapshot`
  n'écrit plus que `j0-answers.json`.

## Reste à faire

- `AppShell.tsx` (autre lot) lie encore `/${lang}/entreprise` pour l'opérateur et l'entreprise : la redirection 308
  l'envoie sur l'annuaire, mais le lien devrait pointer directement sur `/${lang}/freelances`.
- Pas de `next build` local : à builder sur le serveur, puis lancer `marketplace-verify` contre la prod.
