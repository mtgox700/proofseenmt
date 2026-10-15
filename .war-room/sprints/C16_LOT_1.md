# C16 — lot 1 : espace missions vivant

Branche `sprint/c16-missions` (non poussée, pas de PR). Migration `20261015130000_missions_space`.

## Ce qui est livré

**Liste publique `/[lang]/missions`**
- Recherche plein texte (Postgres, configurations `french` et `english`) sur l'intitulé, la description et les
  compétences (colonne `JobPost.skillsText`, tenue par le dépôt, remplie pour l'existant par la migration). Index GIN
  partiel `JobPost_open_fulltext_idx` sur les missions ouvertes. C'est un **filtre** : aucun `ts_rank`, l'ordre reste
  celui choisi (récentes, TJM) et il est **écrit au-dessus de la liste**.
- Nouveaux filtres : mots-clés `q`, TJM min `tjmMin` / max `tjmMax` (€ entiers), durée max `dureeMax`, publiée depuis
  `depuis` (1, 7, 30 jours), en plus de compétence, ville, mode. Lecture tolérante (`apps/web/src/lib/mission-filters.ts`) :
  un paramètre faux redevient « pas de filtre ». Page filtrée toujours `noindex, follow`.
- La liste nue relie les pages par ville.

**Pages par ville `/[lang]/missions/ville/[cle]`** : seulement à partir de 2 missions ouvertes (sinon 404), dans
`sitemap-missions.xml`. Faits datés (nombre, compétences demandées, fourchette de TJM seulement à partir de n = 5, avec n),
JSON-LD `CollectionPage` + `ItemList`. Dépôt `cityPages`, rendu `renderCityPage`.

**Candidatures**
- **« Candidature lue »** : la première ouverture par un membre de l'entreprise (page
  `/app/missions/[id]/candidatures/[applicationId]`, lien sans préchargement) date `readAt` une fois ; `readByUserId`
  reste privé à l'entreprise. Écriture en SQL direct pour ne pas toucher `updatedAt` (qui mesure le délai de réponse
  publié). Un déclencheur garde la première date et le premier lecteur. Le freelance voit « lue par l'entreprise le … »
  dans ses candidatures et reçoit l'e-mail `application_read` (réglable dans `/app/alertes`).
- **Questions** : 3 au plus par mission (formulaire de mission, modèles, duplication) ; le formulaire de candidature les
  pose, une réponse par question exigée, sans coordonnées ; réponses montrées à l'entreprise. Réponses immuables
  (déclencheur). Le profil public reste joint d'office (le CV vient dans un autre lot).

**Missions enregistrées** `/app/missions/enregistrees` (200 au plus, privées), bouton sur la page « Postuler ».

**Invitations à postuler** : un membre invite un freelance publié par sa référence `FR-XXXXX` depuis la page de la
mission ouverte. Plafonds sous verrou de l'entreprise : 20 par jour et par entreprise, 100 par mission, 10 par semaine
pour un même freelance ; référence inconnue, profil privé et membre de l'entreprise donnent la même réponse. Notification
`mission_invitation` ; le freelance voit ses invitations dans « Vos candidatures », postule ou écarte (l'entreprise ne
le sait pas). Action limitée en débit.

**Pages d'entreprise `/[lang]/entreprises/[slug]`** : **seulement sur activation** par un propriétaire ou un
administrateur (`/app/equipe/page-publique`, lien depuis `/app/equipe`) : nom public, présentation, site https, ville.
Faits : actif au répertoire (date du contrôle), inscrite depuis, délai médian de réponse (n), missions ouvertes. JSON-LD
`Organization`. Nouveau `sitemap-companies.xml`, déclaré dans l'index des sitemaps et dans `robots.txt`. Sans activation :
404, absente des sitemaps. La page d'une mission relie celle de l'entreprise quand elle existe. L'adresse est gardée si
la page est retirée puis republiée.

**Entreprises suivies** `/app/entreprises-suivies` (confirmation depuis « Suivre cette entreprise » de la page publique,
100 au plus) : notification `company_mission` à chaque publication tant que la page publique existe, jamais aux membres.

**Côté entreprise** : candidatures en colonnes (sections HTML par statut, lu / non lu), duplication d'une mission en
brouillon (plafond de 50 brouillons partagé), modèles de mission (enregistrer depuis une mission, partir d'un modèle à la
création, supprimer ; 30 par entreprise).

**Accueil freelance** : nombre d'invitations en attente et de missions enregistrées ouvertes, chacun en lien.

**RGPD** : export `missionsSpace` (enregistrements, suivis, invitations reçues et envoyées, modèles créés, candidatures
ouvertes) ; réponses et date de lecture dans les candidatures exportées ; effacement par les clés étrangères ; une ligne
ajoutée à `RETAINED_AFTER_ERASURE`.

**marketplace-verify** (CLI) : vérifie aussi les pages par ville et les pages d'entreprise publiées.

## Reste à faire (hors de ce lot)

- Jouer le parcours publier → trouver → postuler → lu → retenu sur la production (définition de fini du sprint).
- CV joint à la candidature (autre lot).
- Recherche insensible aux accents (« developpeur » sans accent ne trouve pas « développeur ») : extension `unaccent`
  à décider, absente de PGlite.
- Pages par « métier » au sens d'intitulé de poste : seules les pages par compétence existent.
