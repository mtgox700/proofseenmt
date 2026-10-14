# C14 — lot 1 : recherche réelle côté entreprise, listes partagées

Branche `sprint/c14-search`. Rien de poussé.

## Livré

- **Recherche** `/[lang]/app/recherche` (entreprise, tout rôle de membre) : compétences (toutes requises), ville, mode,
  TJM min/max, « disponible au plus tard le », exclure les indisponibles, faits vérifiés (adresse prouvée, SIRET actif,
  attestation URSSAF en cours). Ordre choisi et affiché : mise à jour du profil, TJM croissant/décroissant,
  disponibilité la plus proche. Jamais de score. Formulaire GET : chaque recherche a son adresse, aucun script client.
  Cartes : faits publics, nom pour un profil nominatif seulement, lien profil public, « Contacter », ajout à une liste.
- **Dépôt** : `profiles.search` délègue à `packages/db/src/profile-search.ts` (profils publiés et complets seulement).
  Nouveau tri `availability` : le test AI Act est mis à jour en conscience (fait daté, choisi par l'entreprise).
- **Brief** : boîte « Décrivez votre besoin en une phrase » → action serveur → filtres visibles et modifiables.
  Logique partagée avec `/api/search/brief` dans `apps/web/src/data/brief.ts` (mêmes compteurs par personne et
  plafond plateforme). Sans `ANTHROPIC_API_KEY`, la boîte est masquée. La phrase n'est jamais recopiée dans l'adresse.
- **Listes** `/[lang]/app/listes` et `/[lang]/app/listes/[id]` : modèles `FreelanceList`, `FreelanceListItem`
  (note privée), `FreelanceListReaction` (pouce par membre, compté à la lecture, jamais agrégé entre entreprises).
  Accès vérifié dans chaque requête ; plafonds 50 listes / entreprise et 200 freelances / liste, sous verrou.
  Suppression d'une liste : créateur ou administrateur. Migration `20261014150000_freelance_lists`.
- **RGPD** : effacement d'un freelance → ses lignes partent (cascade) ; membre effacé → listes gardées sans créateur,
  pouces supprimés. L'export de la personne inclut ses listes, ajouts et pouces.
- Accueil entreprise et menu : « Rechercher » + « Listes » remplacent l'annuaire public.

## Non fait

- Langues : le modèle n'en a pas encore (lot profil). Filtre à ajouter quand la colonne existe.
- Aucun index ajouté : les index partiels existants suffisent au volume actuel.
- Pas de vérification dans le navigateur (pas de base ni de session Clerk dans le worktree) : à jouer en recette.
