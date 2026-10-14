# C13 — lot B : « Ma visibilité IA », liste de contrôle du profil, accueil freelance

Branche `sprint/c13-visibility` (non poussée). Server Components seulement, aucun JavaScript client, aucune migration.

## Construit

- **`/[lang]/app/visibilite` devient « Ma visibilité IA »** : la dernière vague d'abord, une carte par moteur avec
  l'entonnoir page retrouvée → nommé·e → cinq premiers → cité·e avec lien, chaque étape en « x sur n », sa part et son
  intervalle à 95 % (règle de `lib/format.ts` : jamais une part sans son intervalle), barre en CSS. Date et moteurs
  interrogés, sens de chaque étape en clair. **Évolution** entre les deux dernières vagues, moteur par moteur : comptes
  bruts des deux vagues et écart en points de part (les dénominateurs peuvent différer) ; moteur nouveau ou absent
  signalé sans écart inventé. Sans vague : les trois étapes dans l'ordre (publier → prouver une adresse → lancer),
  chacune faite ou à faire, avec le lien exact. Le panneau de demande, l'historique des demandes et le tableau de toutes
  les vagues restent.
- **Liste de contrôle du profil** (`apps/web/src/lib/profile-checklist.ts`, pure, testée) : profil publié, titre, résumé
  (≥ `MIN_SUMMARY_CHARS` = 120, le seuil « contenu mince » des pages publiques), compétences (≥ `MIN_SKILLS` = 3), ville,
  mode de travail, TJM, disponibilité à jour (une date « à partir du » dépassée compte comme manquante), au moins une
  adresse prouvée, SIRET actif au répertoire, attestation URSSAF valide et vérifiée. Chaque fait : fait / manquant, une
  remarque quand quelque chose est saisi mais ne suffit pas (résumé trop court, SIRET en attente ou non confirmé,
  attestation expirée ou en attente de l'équipe), pourquoi en une phrase, lien vers le champ (`profil#headline`…,
  `preuves`, `facturation#siret`, `facturation#vigilance-title`). **Aucune note, aucun pourcentage** : un nombre de
  faits manquants, rien d'autre.
- Données lues par les dépôts existants (`profiles.findMine`, `billingView.freelance`, `vigilance.status`) dans
  `apps/web/src/data/profile-checklist.ts`.
- **Accueil freelance** : bloc « Ma visibilité IA » avec la tuile des citations de la dernière mesure par moteur (ou
  « Pas encore mesurée » + lien) et la tuile « n faits manquants » → liste complète. Tuiles existantes gardées.
- **`/app/profil`** : la liste complète en tête (`#liste-de-controle`).
- Vues pures `apps/web/src/lib/visibility-view.ts` : `funnelOf`, `evolutionOf`, `firstSteps`, `latestCitations`.
- Dictionnaires : `checklist-fr/en.ts`, rattachés à `visibility-fr/en.ts` (l'index du marché n'est pas touché).

## Non fait

- Pas de vérification dans un navigateur (ni base ni Clerk dans le worktree) ni de `next build` : à faire sur le serveur.
- Les résultats par question et les sources citées ne sont pas stockés par vague (seul l'entonnoir l'est) : l'écran ne
  peut pas les montrer sans changer le modèle de `Wave`.
