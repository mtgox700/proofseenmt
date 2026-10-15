# C18 — lot 1 : moteur de blog et baromètres citables

Branche `sprint/c18-blog` (non poussée). Migration `20261015140000_articles` (générée par `prisma migrate diff`, CHECK ajoutés à la main à la suite).

## Construit

- **Articles en base** : modèle `Article` (slug unique par langue, fr|en, catégorie guide|actualite|etude, public freelance|entreprise|tous, signature, brouillon|publié, date de première publication conservée, sources `{title,url}` en JSON). CHECK en base : langue, forme du slug, longueurs, sources = liste, publié ⇒ daté.
- **Règles d'écriture** (`packages/db/src/article-input.ts`) : HTML brut refusé ; sources en https uniquement ; **aucun chiffre sans source** (un chiffre dans le titre, le chapeau ou le texte exige au moins une source). Revérifié à la publication.
- **Markdown sûr** (`packages/hub/src/markdown.ts`) : micromark 4.0.2 (MIT, sûr par défaut : HTML échappé, `javascript:`/`data:` vidés). Titres avec identifiants, h1 ramené à h2, liens externes `rel="noopener"`, images remplacées par leur texte (aucune requête vers un tiers). Tests XSS.
- **Bureau de rédaction** `/[lang]/app/articles` (opérateur seulement, OPERATOR_EMAILS) : liste, nouvel article, modification, aperçu du texte enregistré, publier / retirer. Formulaire sans JavaScript requis ; un enregistrement refusé renvoie ce qui a été tapé. Actions limitées en débit.
- **Public** : `/[lang]/blog` (catégorie, public, pagination ; seule la liste nue est indexée), `/[lang]/blog/[slug]` (BlogPosting : dates, auteur, éditeur, `citation` = sources ; section Sources ; articles liés), `/[lang]/blog/rss.xml`, `sitemap-blog.xml` (dans l'index et dans robots.txt), section « Articles » dans `/llms.txt`, « Blog » dans les deux menus publics.
- **Baromètres** (données réelles uniquement) :
  - `/[lang]/barometre/tjm` : TJM des profils publiés et des missions ouvertes ou publiées depuis 90 jours, séparés ; par compétence et par ville ; médiane, P25–P75, n ; **aucun groupe sous `MIN_BAROMETER_SAMPLE` = 10** ; date de calcul, méthode (quartiles type 7 / PERCENTILE.INC). Sous le seuil : « Pas encore assez de données : il faut au moins 10 profils ou missions par groupe. »
  - `/[lang]/barometre/competences` : compétences des missions publiées sur 90 jours, n ≥ 5.
  - Jeux de données `/barometre/tjm.csv|.json`, `/barometre/competences.csv|.json` (CC BY 4.0, protection contre l'injection de formules dans le CSV), JSON-LD `Dataset` (distribution, temporalCoverage, variableMeasured, licence, créateur).
  - Calcul mis en cache une heure par instance, `s-maxage=3600`.
- **marketplace-verify** : test qui passe l'index, un article et les deux baromètres dans la vérification complète (vert).

## Publier les brouillons

Les trois guides sont dans `packages/db/prisma/seeds/articles-drafts.ts`, **en brouillon**, jamais publiés par la War Room :

1. `pnpm --filter @proofseen/db exec prisma migrate deploy` (applique `20261015140000_articles`).
2. `pnpm --filter @proofseen/db exec tsx --env-file=../../.env scripts/seed-article-drafts.ts` (rejouable).
3. Se connecter avec une adresse de OPERATOR_EMAILS → `/fr/app/articles` → relire chaque guide (et les fiches sources, les seuils changent) → « Publier ».

## Sources lues (2026-10-15, toutes sur entreprendre.service-public.gouv.fr — l'adresse .fr y redirige)

| Fiche | « Vérifié le » | Utilisée pour |
|---|---|---|
| F37398 Micro-entrepreneur : ce qu'il faut savoir | 21/02/2026 | plafonds 83 600 € / 203 100 €, taux de cotisations |
| F37353 Régime micro-social | 21/02/2026 | 21,2 % / 25,6 % / 23,2 % en 2026, sur le CA encaissé |
| F23267 Régime fiscal de la micro-entreprise | 13/05/2026 | abattements 50 % / 34 %, versement libératoire 1,7 % / 2,2 % |
| F23961 Comment devenir micro-entrepreneur ? | 15/09/2025 | nature du régime, patrimoine |
| F37396 Entrepreneur individuel (EI) | 21/02/2026 | tableau EI/EURL/SASU, cotisations ≈ 45 % |
| F32333 Constituer et déposer le capital social | 20/10/2025 | capital libre, 20 % (SARL/EURL) / 50 % (SAS) |
| F36240 Cotisations sociales d'une SASU | 21/02/2026 | président assimilé salarié, pas d'assurance chômage |
| F36239 Cotisations sociales d'une EURL | 21/02/2026 | gérant associé TNS / non associé assimilé salarié |
| F21746 Franchise en base de TVA | 01/01/2026 | 37 500 € / 41 250 €, mention art. 293 B |
| F31808 Mentions obligatoires sur une facture | 11/08/2026 | mentions, 150 €, 40 €, facturation électronique 2026/2027 |
| F23211 Délais de paiement et pénalités | 07/08/2026 | 30 jours, 45 jours fin de mois / 60 jours, 3 × taux légal |

Non lus (bloqués, non contournés) : urssaf.fr (connexion coupée), economie.gouv.fr (403). Rien n'en est tiré. Les taux de pénalités chiffrés de F23211 (8,25 %, taux BCE) n'ont pas été repris : seule la règle « au moins 3 fois le taux légal » l'est.

## Reste à faire (hors lot)

- Relecture et publication par le founder ; 6 articles publiés pour la définition de fini (3 fournis).
- Versions anglaises des guides.
- Simulateur de revenu net (périmètre C18, non traité dans ce lot).
- Ajouter le blog et les baromètres à la liste de pages vérifiées par `marketplace-verify` en production (CLI) une fois des articles publiés.
