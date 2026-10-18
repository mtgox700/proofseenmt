# C22 — Lot A : rapprochement expliqué

Branche `sprint/c22-matching`. Décision appliquée : « Rapprochement oui, note opaque non » (TEAM_MEMORY, 2026-10-18).

## Ce qui est livré

- **`packages/db/src/matching-criteria.ts`** (pur, sans base ni réseau) : douze critères typés (`MATCH_CRITERIA`), chaque
  comparaison renvoie `matched` (raisons typées, avec le fait : compétences en commun, ville, mode…) et `missing`. Un
  critère sans objet (ville d'une mission en télétravail, TJM non affiché) n'apparaît ni dans l'un ni dans l'autre.
  - compétences : clés normalisées (`skillKey`, la même que la recherche) ;
  - métier : familles de `job-titles.ts` (intitulé de mission, titre du profil) ;
  - mode de travail : seul le couple sur site / télétravail est incompatible ;
  - TJM : profil ↔ mission = TJM au plus égal au plafond du budget ; mission ↔ mission = fourchettes qui se recouvrent ;
    profil ↔ profil = écart d'au plus un cinquième ;
  - disponibilité (profils pour une mission) : disponible, ou à partir d'une date dans les 30 jours, déclarée depuis
    moins de 30 jours (même fraîcheur que la recherche, testé). `JobPost` n'a pas de date de début : la mission est
    tenue pour ouverte maintenant ;
  - langues (C21) : profil ↔ profil seulement (une mission ne déclare pas de langue) ;
  - faits vérifiés, chacun un critère explicite : adresse prouvée, missions vérifiées, SIRET actif, URSSAF valide (profil),
    entreprise active au répertoire (mission).
- **Règle d'ordre, affichée partout** : nombre de critères remplis parmi ceux que la personne compte, puis nombre de
  compétences en commun, puis la date la plus récente (publication / mise à jour), puis l'identifiant. Critères exigés :
  une proposition qui ne remplit pas un critère exigé sort, un critère sans objet ne la fait pas sortir.
- **`packages/db/src/matching.ts`** : `missionsForProfile(actor)`, `similarMissions(missionId)`,
  `profilesForMission(actor, missionId)` (membres de l'entreprise seulement, sinon `null`), `similarProfiles(slug)`.
  Présélection SQL par compétence partagée (index `JobPostSkill(skillId, jobPostId)` et `FreelanceSkill(skillId,
  profileId)` existants), 500 fiches au plus (`capped` le dit), 12 propositions par défaut, 50 au plus. Visibilité dans
  la requête : `LISTED_MISSION` + ouverte et publiée, `LISTED_PROFILE` + publié et complet ; un pseudonyme n'a pas de clé
  `displayName`. Exclus : ses propres missions et celles où l'on a postulé (freelance), les membres de l'entreprise et
  les candidats déjà reçus (entreprise). Rien n'est mis en cache.
- **Écrans** : bloc « Missions pour vous » sur l'accueil freelance et `/app/missions` ; page
  `/[lang]/app/missions/pour-vous` (critères comptés et exigés, formulaire GET) ; section « Profils qui correspondent »
  sur `/[lang]/app/missions/[id]` (inviter = invitations existantes, ajouter à une liste = action
  `matching-actions.ts`, retour sur la mission). Textes FR/EN dans `i18n/market/matching-*.ts`.
- **Pages publiques** (hub, zéro JS) : « Missions proches » sur `/[lang]/missions/[id]`, « Profils proches » sur
  `/[lang]/profils/[slug]` (`packages/hub/src/nearby.ts`, branché par une option `nearby` des deux renderers). Seules
  les raisons de similitude sortent en public, jamais les preuves d'une personne. Une erreur de rapprochement ne fait pas
  tomber la page (`apps/web/src/data/nearby.ts`, journalisée).
- **Garde AI Act** : `packages/db/test/no-ai-matching.test.ts` suit toutes les importations de valeurs des modules de
  rapprochement et échoue si l'une atteint `packages/engines`, un autre paquet Proofseen, un SDK d'IA, un fichier hors
  `packages/db/src`, ou si un fichier appelle le réseau ; aucun pourcentage ni score dans le code ni dans les sorties.

## Pas fait

- Alertes de missions par e-mail : les raisons ne sont pas reprises (le modèle d'e-mail vit dans `@proofseen/notify`,
  hors périmètre simple).
- « Profils proches » côté application entreprise (fiche d'un candidat, listes) : la fonction `similarProfiles` est
  prête, seul l'écran public l'utilise.
- Aucune migration : les index nécessaires existent.
