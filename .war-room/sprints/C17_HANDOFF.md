# C17 — tableaux de bord freelance et entreprise, réglages du compte

Branche `sprint/c17-dashboards` (non poussée, pas de PR). Migration `20261016100000_dashboards`.

## Livré

**Comptage de l'audience, sans pistage** (`packages/db/src/audience-stats.ts`, `apps/web/src/data/audience.ts`,
`apps/web/src/lib/audience.ts`)
- Modèles `ProfileStatDay` (vues, apparitions recherche entreprise, apparitions annuaire, ajouts à une liste, par profil
  et par jour de Paris), `ProfileStatKeyword` (filtres compétence/ville normalisés par `skillKey`, par profil et par
  jour, 20 au plus), `ProfileStatSeen` (empreintes du jour), `OrganisationStatDay` (recherches de l'équipe, total).
- Empreinte = HMAC(clé du jour dérivée de `PROOFSEEN_ACCESS_SECRET` + date, adresse + navigateur), tronquée à 22
  caractères base64url. La base refuse toute autre forme (CHECK) : une adresse IP ne peut pas y entrer. Les empreintes
  partent le lendemain (purge quotidienne + 1 % des requêtes). Sans secret ≥ 32 caractères : aucun comptage (journalisé).
- Ne comptent pas : robots IA et moteurs (liste `AI_SEARCH_BOTS` de marketplace-verify + noms connus), automatisation
  générique (curl, headless, Lighthouse…), navigateur vide, préchargement (`Sec-Purpose`), le propriétaire connecté
  (comparaison sur l'identifiant Clerk dans la même requête SQL), un profil privé.
- Une seule instruction SQL par comptage, idempotente par visiteur et par jour. Appelée dans `after()` : la page est
  envoyée avant, son HTML ne change pas (pages profil et annuaire restent identiques pour les robots).
- Points de comptage : `/[lang]/profils/[slug]` (vue), `/[lang]/freelances` (apparitions annuaire),
  `/[lang]/app/recherche` (apparitions + filtres + recherche d'équipe, page 1 seulement pour la recherche d'équipe),
  `freelanceLists.addItem` (ajout à une liste, dans la transaction).
- Conservation 13 mois (`RETENTION.audienceStatsMonths`, `purgeAudience` appelée par `retention.purge`), qui ramène
  aussi les filtres des deux derniers jours aux 20 plus fréquents.
- RGPD : l'export du freelance inclut `statDays` et `statKeywords` (et `user.lang`) ; effacement par cascade.

**Tableau de bord freelance** (`/[lang]/app`, `components/insights/FreelanceHomeBoard.tsx`)
- En tête selon l'étape (`lib/freelance-stage.ts`) : arrivée (4 étapes faites/à faire), candidature (candidatures en
  attente), mission (contrats en cours / à signer).
- Profil, invitations et missions enregistrées (gardés), candidatures et contrats par étape (tableaux, zéros compris).
- Audience 90 jours : 4 graphiques SVG rendus côté serveur (`lib/chart.ts`, sans bibliothèque ni script), chacun avec
  `role="img"` + description, et un tableau jour par jour replié. Filtres qui ont fait apparaître le profil (top 20).
  Phrase explicite : pas de position moyenne, Proofseen ne classe pas.
- Visibilité IA (bloc existant) + tableau des citations des 3 dernières mesures.
- Revenus : versé / bloqué (existant) + versé et bloqué mois par mois sur 12 mois (zéros affichés), factures, avis.

**Tableau de bord entreprise** (`components/insights/CompanyHomeBoard.tsx`, `packages/db/src/company-insights.ts`)
- Missions et candidatures par étape, délai médian de réponse sur 90 jours (candidature → décision, avec n),
  candidatures à traiter, contrats, factures, missions publiées par mois (12 mois, graphique + tableau).
- Dépenses par mois (versé / bloqué, au mois du paiement) et par centre de coûts, 12 mois. Plusieurs devises : pas de
  total.
- Activité de l'équipe sur 90 jours : recherches, listes créées, freelances ajoutés. Total d'équipe, jamais par membre.
- `DashboardTiles.tsx` supprimé (plus utilisé).

**Réglages** `/[lang]/app/reglages` (lien dans le menu freelance et entreprise)
- Langue des e-mails (`User.lang`, déjà lue par les notifications) : `users.lang` / `users.setLang`.
- Lien vers `/app/alertes` ; `<UserProfile routing="hash" />` de Clerk pour e-mail / mot de passe / sessions.
- « Exporter mes données » : lien de téléchargement de `GET /api/me` (sans JavaScript).
- « Supprimer mon compte » : mot à taper (SUPPRIMER / DELETE), appel `DELETE /api/me`, refus expliqués en FR/EN
  (contrat en cours ou argent bloqué, trop de tentatives, session expirée, échec).
- Changement d'entreprise si la personne en a plusieurs : cookie `ps_org` (httpOnly), relu par `currentOrganisation`
  qui ne l'honore que si la personne est encore membre (`lib/settings.ts#pickOrganisation`).
- Actions serveur limitées en débit (`settings`, 20 / 10 min / personne).

## Limites connues

- **Chiffres planchers** : les pages profil (s-maxage=300) et annuaire (s-maxage=120) servies depuis le cache du réseau
  n'atteignent pas le serveur et ne sont pas comptées. L'écran le dit. Pour compter chaque vue, il faudrait renoncer au
  cache partagé de ces pages : décision du founder (performance contre précision).
- Délai de réponse : `updatedAt` de la candidature, comme le délai public de C16 ; une candidature retenue puis choisie
  prend la date du dernier changement.
- Pas de vérification dans un navigateur ni de `next build`, pas de Lighthouse (ni base ni Clerk dans le worktree) :
  à jouer en recette avec un compte de test (définition de fini : recalcul à la main, export et effacement depuis
  l'écran).
- Le menu ne montre pas « Réglages » à l'opérateur (aucun besoin identifié).
