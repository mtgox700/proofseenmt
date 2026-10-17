# C21 — lot A : parité côté public

Branche `sprint/c21-public` (non poussée, pas de PR). Migration `20261017090000_search_unaccent`.

## Construit

**Recherche de missions insensible aux accents** (« developpeur » trouve « Développeur »)
- Colonne `JobPost.searchText` : intitulé, description et compétences **pliés par l'application**
  (`packages/db/src/search-text.ts` : NFD, marques retirées, minuscules, ligatures œ/æ/ß/ø/đ/ł/ı défaites), écrite par
  le dépôt à la création et à la modification d'une mission.
- La migration ajoute la colonne, crée la fonction SQL immuable `proofseen_fold` (même pliage sur les lettres latines,
  `translate` + `replace` + `lower`, sans l'extension `unaccent` absente de PGlite), remplit les missions existantes,
  supprime `JobPost_open_fulltext_idx` et crée `JobPost_open_search_idx` (GIN, `french` || `english`, missions ouvertes)
  sur le texte plié. Les racines françaises et anglaises restent (« migration » trouve « migrations »).
- Le texte cherché est plié de la même façon. Toujours un **filtre** : aucun `ts_rank`, l'ordre choisi est gardé.
- Test : la fonction SQL et `foldText` donnent le même texte sur un jeu d'exemples (accents, majuscules, ligatures,
  polonais, turc, nordique), le remplissage de la migration sur une base à l'état d'avant.

**Pages par poste `/[lang]/postes/[cle]` et index `/[lang]/postes`**
- Taxonomie écrite à la main de 26 postes tech (`packages/db/src/job-titles.ts`) : libellés FR/EN, expressions
  reconnues sur l'intitulé des missions et le titre des profils, en mots entiers, sur le texte plié. Une mission peut
  entrer dans plusieurs postes. Filtre, jamais classement.
- Mêmes règles que les pages par compétence : page seulement à partir de 2 éléments réels (sinon 404), paragraphe
  factuel daté, fourchette de TJM des profils seulement à n ≥ 5, fourchette des missions seulement à n ≥ 5 **et** au
  moins 3 entreprises distinctes, au plus 3 missions par entreprise (règle `cappedByPublisher` des baromètres), FAQ
  JSON-LD tirée des faits, `CollectionPage` + `ItemList`. Masqués et suspendus exclus (`LISTED_MISSION`,
  `LISTED_PROFILE`). Lecture d'au plus 5 000 missions ouvertes et 5 000 profils publiés, les plus récents.
- `sitemap-job-titles.xml` (déclaré dans l'index des sitemaps et dans `robots.txt`), index dans `sitemap-pages.xml`,
  section « Job title pages » dans `llms.txt`, « Postes » dans les deux menus publics à côté de « Métiers ».

**Simulateur de revenu net `/[lang]/simulateur`**
- Formulaire GET sans JavaScript : TJM, jours facturés, statut, frais annuels. La page nue (indexée) montre un exemple
  calculé (TJM 450 €, 180 jours, micro BNC, 2 000 € de frais) ; avec des paramètres, la simulation demandée, `noindex,
  follow`, canonique vers la page nue. Un champ illisible est signalé, rien n'est calculé ni deviné.
- Statuts simulés : micro-entreprise BNC (profession libérale non réglementée, hors Cipav), micro-entreprise BIC
  (prestations de services commerciales), SASU à l'IS en « tout dividendes ». **EURL à l'IS laissée de côté**, avec la
  raison écrite sur la page.
- Tous les taux dans un seul module daté (`packages/hub/src/simulator-rates.ts`), chacun avec sa source et sa date de
  lecture ; la page affiche « Taux en vigueur au 17 octobre 2026, sources : » avec le tableau des taux et les liens.
- JSON-LD `WebApplication` + `FAQPage` (taux et exemple calculé). « Simulateur » dans les deux menus publics, dans
  `sitemap-pages.xml` et `llms.txt`.

**marketplace-verify** : tests sur le simulateur (FR et EN), une page par poste et l'index des postes ; la commande
CLI vérifie aussi les pages par poste, leur index et le simulateur en production.

## Sources lues le 17 octobre 2026

| Fiche | « Vérifié le » | Utilisée pour |
|---|---|---|
| [F37353](https://entreprendre.service-public.gouv.fr/vosdroits/F37353) Régime micro-social | 21/02/2026 | 25,6 % libéral non réglementé hors Cipav, 21,2 % prestations de services BIC, sur le CA encaissé ; formation professionnelle en plus |
| [F23459](https://entreprendre.service-public.gouv.fr/vosdroits/F23459) Formation professionnelle des EI | 01/01/2026 | 0,2 % activité libérale, 0,1 % activité commerciale, du CA annuel |
| [F23267](https://entreprendre.service-public.gouv.fr/vosdroits/F23267) Régime fiscal de la micro-entreprise | 13/05/2026 | abattements 34 % / 50 %, minimum 305 € ; versement libératoire 2,2 % / 1,7 % ; RFR N-2 < 29 579 € (personne seule) ; plafond 83 600 € HT |
| [F1419](https://www.service-public.gouv.fr/particuliers/vosdroits/F1419) Barème de l'impôt sur le revenu | 15/04/2026 | barème des revenus 2025 : 11 600 / 29 579 / 84 577 / 181 917 €, 11 / 30 / 41 / 45 %, par part |
| [F23575](https://entreprendre.service-public.gouv.fr/vosdroits/F23575) Impôt sur les sociétés | 17/02/2026 | 25 %, 15 % jusqu'à 42 500 €, conditions (CA ≤ 10 M€, capital libéré, 75 % personnes physiques) |
| [F36215](https://entreprendre.service-public.gouv.fr/vosdroits/F36215) Fiscalité de la SASU | 21/02/2026 | dividendes au PFU 31,4 % = 12,8 % IR + 18,6 % prélèvements sociaux |
| [F36239](https://entreprendre.service-public.gouv.fr/vosdroits/F36239) Cotisations sociales d'une EURL | 21/02/2026 | gérant associé au régime des indépendants, cotisations sur les revenus professionnels (aucun taux donné) |
| [F36212](https://entreprendre.service-public.gouv.fr/vosdroits/F36212) Fiscalité de l'EURL | 21/02/2026 | IR par défaut, option IS ; aucun taux de cotisation sur les dividendes |
| F36240 Cotisations d'une SASU, F37396 EI | 21/02/2026 | lues, non utilisées pour un taux (aucun taux chiffré du président ; « environ 45 % » de l'EI trop vague pour un calcul) |

Non lus (bloqués, non contournés) : urssaf.fr (connexion coupée), economie.gouv.fr (403). Rien n'en est tiré.

## Hypothèses du simulateur (écrites sur la page)

- Montants HT ; tout le CA est facturé et encaissé dans l'année. Ni CFE, ni comptabilité, ni assurances, sauf si
  l'utilisateur les met dans ses frais.
- Micro : cotisations et formation sur le CA, impôt sur le CA après abattement ; les frais réels ne réduisent ni l'un
  ni l'autre, ils sont seulement retirés du reste. Plafond 83 600 € signalé quand il est dépassé. Deux options
  d'impôt montrées : barème (personne seule, 1 part, sans autre revenu, **avant décote**, réductions et crédits) ou
  versement libératoire (sous condition de RFR).
- Barème : celui des revenus 2025, le plus récent publié (celui des revenus 2026 n'existe pas encore).
- SASU : **aucune rémunération du président**, tout le bénéfice après IS distribué en dividendes, hors réserve légale,
  conditions du taux réduit d'IS supposées remplies, dividendes au PFU sans option pour le barème. Les cotisations
  d'assimilé salarié et les droits qu'elles ouvrent ne sont pas simulés.
- EURL à l'IS : non simulée, faute d'un taux de cotisation lisible sur une page officielle accessible.

## À relire

- Les taux à chaque loi de finances ou de financement de la sécurité sociale : changer la valeur, `readOn` et
  `RATES_AS_OF`, puis refaire à la main les exemples de `packages/hub/test/simulator.test.ts`.
- La décote et l'EURL à l'IS si urssaf.fr ou une fiche service-public donnent un jour des taux exploitables.
- Appliquer la migration en production (`prisma migrate deploy`) avant de déployer le code de recherche.
