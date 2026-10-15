# C14 — lot 2 : profils riches, stockage des fichiers, import d'un CV

Branche `sprint/c14-profiles`. Rien de poussé. Server Components et actions serveur seulement : aucun JavaScript client.

## Construit

- **Stockage des fichiers sur le VPS** (`apps/web/src/data/uploads.ts`) : volume Docker nommé `proofseen-uploads`
  monté sur `/data/uploads` (`PROOFSEEN_UPLOADS_DIR`). Fichier rangé sous un identifiant tiré au hasard
  (`<racine>/<2 caractères>/<uuid>`), jamais le nom envoyé ; écrit à côté puis renommé ; ligne `StoredFile` (propriétaire,
  usage, type reconnu, taille, SHA-256, dimensions) écrite après, sous verrou du compte, quota **30 fichiers / 40 Mo par
  compte** ; refusée, le fichier est effacé du disque.
  - Type lu dans les premiers octets (`apps/web/src/lib/file-sniff.ts`), jamais l'extension ni le type annoncé :
    photo et image de portfolio en JPEG/PNG/WebP ≤ 2 Mo, côtés de 64 à 8 000 px lus dans l'en-tête avant tout décodage ;
    CV en PDF ≤ 5 Mo, refusé s'il porte `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFiles`, `/RichMedia` ou `/XFA`.
    SVG, HTML, GIF, scripts : refusés.
  - **Toute image est réencodée** par `sharp` (déjà dans l'arbre de Next, ajouté en dépendance directe de l'app, Apache-2.0)
    : WebP neuf, 800 px (photo) ou 1 600 px (portfolio), EXIF et toutes métadonnées retirés, orientation appliquée,
    limite de 40 Mpx contre les bombes de décompression. Un fichier polyglotte redevient une simple image.
  - Route **`/fichiers/<id>`** : photo publique **seulement sur un profil nominatif** (un profil pseudonyme ne montre
    jamais de visage) ; image de portfolio publique dès que le profil est publié ; CV au seul propriétaire ; sinon 404,
    comme un identifiant inconnu. En-têtes : `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src
    'none'; sandbox`, `Content-Disposition` `attachment` pour un CV, `inline` pour une image,
    `Cross-Origin-Resource-Policy: same-site`, `Cache-Control` public 5 min ou `private, no-store`, ETag = SHA-256.
  - RGPD : l'export liste les fichiers (type, taille, empreinte, date) et les sections ; l'effacement (`DELETE /api/me`)
    lit les identifiants avant d'effacer le compte, puis efface les fichiers du disque (les lignes partent en cascade).
- **Profil enrichi** (migration `20261015120000_rich_profiles`) : `ProfileExperience` (intitulé, entreprise facultative
  et masquable, mois de début/fin, description, compétences), `ProfileEducation`, `ProfileCertification` (organisme,
  année, adresse de vérification https, compétences attestées), `ProfileLanguage` (ISO 639-1, CECRL A1–C2 ou langue
  maternelle, liste fermée de 50 langues), `PortfolioItem` (titre, https, description, image), photo
  (`FreelanceProfile.photoFileId`), `ProfileImportDraft`. CHECK en base alignés sur les schémas zod
  (`packages/db/src/profile-section-schemas.ts`). Plafonds sous verrou du profil : 30 expériences, 15 formations,
  30 certifications, 12 langues, 20 réalisations. Aucune coordonnée dans les textes publiés ; adresses https sans
  identifiants. Séniorité : **non calculée**, rien n'est déduit des expériences.
- **Écran `/app/profil`** : sections Disponibilité, Photo, Expériences, Certifications, Formation, Langues,
  Réalisations, CV et import ; formulaires d'ajout dans `<details>`, retrait par élément, avis après chaque action
  (`?section=…&avis=…`, seuls des codes connus sont relus). Actions serveur limitées par personne (120 écritures/h,
  30 dépôts/h), rôle freelance vérifié, IndexNow sur un profil publié.
- **Disponibilité confirmée** : « Je confirme ma disponibilité » (et l'enregistrement du formulaire du profil) pose
  `availabilityAt`. Affichée sur `/app/profil` et sur la page publique (« Disponibilité confirmée le … »). Dans la
  recherche entreprise, les filtres « disponible au plus tard le » et « exclure les indisponibles » **écartent une
  disponibilité confirmée il y a plus de 30 jours** ; c'est écrit sous les filtres. Sans ces filtres, le profil reste
  trouvable.
- **Page publique** (`packages/hub/src/profile-sections.ts`) : « Expériences déclarées » (séparées des missions
  vérifiées), Certifications, Formation, Langues, Réalisations ; HTML simple, aucun script hors JSON-LD, tout échappé,
  liens déposés en `nofollow noopener ugc`. JSON-LD `Person` : `knowsLanguage`, `alumniOf`, `hasCredential`
  (`EducationalOccupationalCredential`), `worksFor` pour la seule expérience en cours dont l'entreprise n'est pas
  masquée, `image` pour la photo d'un profil nominatif. Profil pseudonyme : ni photo, ni adresse de portfolio, ni
  adresse de vérification. Tests hub et `marketplace-verify` verts.
- **Import d'un CV ou d'un PDF LinkedIn déposé par le freelance** : texte extrait sur le serveur par `unpdf` (MIT,
  PDF.js sans évaluation de code, 10 pages au plus) ; `createCvReader` (`packages/engines/src/cv-reader.ts`, sans outil,
  CV encadré comme donnée, aucune note ni ancienneté) avec `claude-haiku-4-5` ; la proposition passe par les schémas de
  chaque section (`packages/db/src/cv-draft.ts`), tout autre champ est jeté. Brouillon privé : « Ajouter » ou
  « Ignorer » élément par élément (empreinte de l'élément vérifiée sous verrou : pas de double ajout, pas d'élément
  changé entre-temps) ; un élément refusé par sa section revient au brouillon. **Rien n'est publié automatiquement.**
  Limites : 5 lectures par personne et par jour, plafond plateforme `PROOFSEEN_IMPORT_DAILY_CAP` (20 par défaut).
  Sans `ANTHROPIC_API_KEY`, le bouton n'apparaît pas. **Jamais de récupération sur LinkedIn.** Tests avec un faux
  modèle : aucun appel payant.
- **Liste de contrôle** : « Au moins une expérience », « Langues », « Photo (recommandée) » — la photo est montrée comme
  recommandée et n'est jamais comptée comme manquante.

## Variables d'environnement

- `PROOFSEEN_UPLOADS_DIR` : racine des fichiers (`/data/uploads` en production, posée par le compose ; dossier
  temporaire du système en développement).
- `PROOFSEEN_IMPORT_DAILY_CAP` : lectures de CV par jour pour toute la plateforme (20 par défaut).
- `ANTHROPIC_API_KEY` : déjà connue ; sans elle, pas d'import.

## Mise en production (après merge, GO DEPLOY)

1. `prisma migrate deploy` sur Railway (migration `20261015120000_rich_profiles`, additive : tables neuves et une
   colonne nullable).
2. Sur le VPS : `docker compose -f deploy/vps/docker-compose.yml up -d --build` crée le volume `proofseen-uploads` et le
   monte sur `/data/uploads`. Vérifier : `docker volume inspect proofseen-uploads`, puis un dépôt de photo.
3. Sauvegarder le volume avec la base (ex. `docker run --rm -v proofseen-uploads:/d -v $PWD:/b alpine tar czf
   /b/uploads.tgz -C /d .`).
4. Le corps des actions serveur passe à 6 Mo (`next.config.ts`) ; Caddy n'impose pas de limite.

## Non fait

- Pas de vérification dans un navigateur ni de `next build` (ni base ni session Clerk dans le worktree) : à jouer en
  recette, avec la red team téléversement de la définition de fini (type, taille, contenu actif, adresse devinée).
- Pas d'adresses signées pour les fichiers : l'accès est vérifié à chaque requête (session pour un fichier privé), ce
  qui couvre l'adresse devinée. À reprendre pour les pièces jointes de C15 si un lien doit sortir de la session.
- Le CV n'est pas encore lisible par les entreprises auxquelles le freelance a postulé (propriétaire seulement) : à
  brancher avec les candidatures de C16.
- Pas de modification d'un élément déclaré : on le retire et on le rajoute.
- Filtre « langues » de la recherche entreprise (lot 1) : la colonne existe désormais, le filtre reste à ajouter.
- Le marqueur de contenu actif d'un PDF ne voit pas l'intérieur des flux d'objets compressés ; le CV n'est de toute
  façon servi qu'à son propriétaire, en téléchargement, sous une politique qui interdit tout.
