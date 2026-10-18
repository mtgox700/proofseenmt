# C22 — lot B : recherche avancée, annuaires riches

Branche `sprint/c22-search` (non poussée, pas de PR). Migration `20261018100000_advanced_search`. Aucun appel payant,
aucun score sur une personne : des filtres sur des faits, des effectifs de profils, un ordre choisi et expliqué.

## Livré

**Recherche des entreprises** (`/[lang]/app/recherche`)
- Deux colonnes : panneau de filtres à gauche (replié au-dessus des résultats sur téléphone, toujours ouvert sur grand
  écran, en CSS seul), grille de cartes à droite. Formulaire GET : chaque recherche a son adresse. Amélioration
  progressive seulement : `next/form` garde la page en place, et cocher une case ou choisir une option applique le
  filtre (`AutoSubmit`) ; sans script, le bouton fait tout.
- Filtres : mots-clés (titre, résumé, compétences, intitulés d'expérience, sans accents, plein texte FR + EN),
  compétences (cochées, suggestions tirées des résultats avec leur effectif, champ « ajouter » avec liste de
  suggestions), poste (taxonomie C21), ville (+ villes des résultats en un clic), mode, TJM min/max, disponible
  maintenant / hors indisponibles / au plus tard le (fraîcheur de 30 jours écrite), langues avec niveau minimal (C21),
  faits vérifiés (adresse prouvée, mission vérifiée, SIRET actif, URSSAF), avec photo, avec réalisations.
  **Séniorité** : pas de filtre, et l'écran le dit (la règle C14 tient : rien n'est déduit des expériences).
- Effectifs à côté des options : identifiants retenus (5 000 au plus, les plus récemment mis à jour) puis `GROUP BY`
  bornés ; ville, mode et poste sont comptés sans leur propre filtre. Au-delà de 5 000, l'écran dit « au moins ».
- Filtres actifs en puces, chacune un lien qui la retire ; « Effacer tout » garde l'ordre choisi.
- Ordre choisi et expliqué sous les résultats : récents, TJM croissant/décroissant, disponibilité, **nombre de faits
  vérifiés** (missions vérifiées + adresses prouvées + SIRET actif + URSSAF en cours, chacun pour un, affiché sur chaque
  carte avec la liste des faits). Test AI Act mis à jour en conscience.
- Cartes : photo (profil nominatif seulement, `width`/`height`, `loading=lazy`), sinon monogramme tiré de la référence
  (teinte aussi, rien de la personne), nom ou référence, ville, mode, TJM, disponibilité avec sa date de confirmation,
  6 compétences + « +N », faits vérifiés, langues, « Voir le profil », « Contacter », « Ajouter à une liste ».
- **Recherches enregistrées** (modèle `SavedSearch`, `SavedSearchSeen`) : partagées entre membres de l'entreprise,
  30 par entreprise, 10 alertes par personne (sous verrou). Alerte quotidienne pour le seul créateur (notification
  `profile_match`, e-mail par la file existante, adresses des profils seulement) : jamais deux fois le même profil, le
  stock existant marqué vu à l'activation. Créateur parti, suspendu, entreprise suspendue ou filtres illisibles : l'alerte
  s'éteint. Suppression : créateur ou administrateur. `/app/recherche/enregistree/<id>` rouvre la recherche (lien de
  l'e-mail). Export RGPD : dans `freelanceLists.savedSearches` ; effacement : la recherche reste à l'entreprise, sans
  créateur ni alerte. Préférence d'e-mail « Une recherche enregistrée trouve de nouveaux profils » côté entreprise.
- Texte cherché tenu **par la base** (`FreelanceProfile.searchText`, déclencheurs sur le profil, les compétences, les
  expériences et le libellé d'une compétence ; une écriture directe est recalculée), index GIN partiel.

**Annuaire public des freelances** (`/[lang]/freelances`) : cartes en HTML/CSS (même dessin), filtres GET (compétences,
ville, mode, poste, disponible maintenant, faits vérifiés), page filtrée en `noindex`, aucun script hors JSON-LD,
`marketplace-verify` vert. Le dépôt passe par la recherche des entreprises (mêmes profils, mêmes exclusions).

**Annuaire public des entreprises** (`/[lang]/entreprises`) : seulement les pages publiques ouvertes (C16), jamais une
entreprise masquée, suspendue ou sans membre actif (`LISTED_COMPANY`). Cartes : monogramme, type, ville, SIRET actif
(date), ancienneté, missions ouvertes, délai médian de réponse (n). Filtres : ville, type, recrute en ce moment, SIRET
actif, avec effectifs ; ordre : nom, page récente, missions ouvertes. Dans `sitemap-pages.xml`, `llms.txt` et le menu
public (« Entreprises »).

**Espace freelance** : `/[lang]/app/entreprises` (menu « Entreprises »), mêmes faits et filtres, boutons « Suivre » /
« Ne plus suivre » (C16), retour sur les mêmes filtres.

## Tests

- `packages/db/test/advanced-search.test.ts` (mots-clés et déclencheurs, poste, faits, photo, réalisations, ordre des
  faits, facettes, annuaire), `saved-searches.test.ts` (accès, plafonds, alerte, RGPD) ; `ai-act`, `public-directory`
  mis à jour.
- `packages/hub/test/company-directory.test.ts` (échappement, effectifs, noindex, llms.txt, `marketplace-verify` sur les
  deux annuaires), `profile-directory.test.ts` refait (photo, monogramme, échappement, filtres).
- `apps/web/test/advanced-search.test.ts` (adresse, puces, filtres enregistrés, annuaire des entreprises),
  `freelancer-search.test.ts`, `directory-filters.test.ts`.

## Vérifié dans le navigateur

Rendu des cartes (annuaire public et recherche des entreprises) avec des données de démonstration servies en local :
grille, badges, panneau ouvert sur grand écran. Pas de base ni de session Clerk dans le worktree : la page connectée
complète, l'alerte et les annuaires sont à jouer en recette avec les comptes de test.

## À savoir pour la fusion

- Fichiers partagés touchés (ajouts) : `schema.prisma` (enum `NotificationKind` + `profile_match`, relations),
  `notifications.ts` (`NOTIFICATION_KINDS`), `packages/notify/src/templates.ts`, `db/src/index.ts` (bloc en fin de
  fichier), `gdpr.ts` (export), `public-profiles.ts` (l'annuaire délègue à `public-directory.ts`), `market-shell.ts`
  (menu), `AppShell.tsx` (menu freelance), `fr.ts`/`en.ts` (clé `discovery`), route cron (passage des alertes).
- Disque C plein pendant le lot (0 octet libre un moment, revenu à ~2 Go) : à surveiller sur le poste.

## Non fait

- Pas de filtre de séniorité (aucune donnée déclarée ; non déduite, par règle).
- Pas de logo d'entreprise déposé : monogramme.
- La photo servie fait 800 px pour un avatar de 56 px : une variante réduite côté `/fichiers` gagnerait en poids.
- Facettes de l'annuaire public non affichées (seulement dans l'espace entreprise et l'annuaire des entreprises).
