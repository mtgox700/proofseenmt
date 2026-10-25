# Passation : écrans du coffre, L1.6 (T1 à T16)
De : katana-tetsu · Vers : katana-shogun (porte du chef-d'oeuvre), katana-kensa (inspection) ; copie Chancelier, backend,
documents, katana-mamori · Mission : L1 · Vague : 2 · Date : 2026-10-25.

Arbre : `C:\Users\HP\AppData\Local\Temp\wt-l1`, branche `sprint/l1-coffre`, aucun commit. Storyboard qui fait foi :
`.war-room/design/L1_COFFRE_STORYBOARD.md`. Bus : L1-142, L1-143 (mes demandes), L1-144 (réponse du backend),
L1-145 (formulaire du devis), L1-146 à L1-149 (cette livraison).

## État des tâches (§10 du storyboard)

| T | État | Fichiers (sous `apps/web/`) |
|---|---|---|
| T1 | fait | lit `contentDigest`, `by`, `side`, `frozen`, `listMine` du dépôt (L1-144) ; aucun type local restant |
| T2 | fait | `src/i18n/market/vault-fr.ts`, `vault-en.ts` (complétés : `formerMember`, `otherParty`, légendes, unités, sujets accordés « du contrat de prestation ») |
| T3, T4 | faits | `src/lib/vault/affair-state.ts`, `replay.ts` |
| T5 | fait | `components/vault/AffairTabs.tsx` (+ `SectionTabs`), `AffairHead.tsx`, `VaultState.tsx` ; route `app/[lang]/app/contrats/[id]/documents/page.tsx` ; insertion unique dans `contrats/[id]/page.tsx` (onglets sous l'en-tête, compte lu par `affairDocumentCount`) ; `lib/vault/load.ts`, `lib/vault/errors.ts` |
| T6 | fait | `DocumentCard.tsx`, `VersionStrata.tsx`, `VersionPicker.tsx`, `DownloadLink.tsx`, `VaultStamp.tsx` (M1), `lib/vault/mark-rows.ts`, `lib/vault/versions.ts` |
| T7 | fait | `lib/vault/explain.ts`, `ChangeSummary.tsx` |
| T8 | fait | `lib/vault/words.ts`, `compare.ts`, `attribution.ts` |
| T9 | fait | route `app/[lang]/app/documents/[documentId]/comparer/page.tsx`, `CompareHead.tsx` (M2), `DiffLegend.tsx`, `ClauseDiff.tsx` (+ `SameClauses`), `InlineDiff.tsx`, `lib/vault/load-compare.ts` ; vues `texte`, `cote`, `complete` ; 307 d'ordre |
| T10 | fait | route `.../documents/preparer/page.tsx`, action `.../documents/actions.ts` (`prepareVersion`), `PrepareForm.tsx`, `ChoiceField.tsx`, `ErrorSummary.tsx`, `PendingSubmit.tsx` (seul îlot), `lib/vault/choices.ts`, `drafts.ts`, `record-version.ts` |
| T11 | fait, branchement de la route à faire par le backend | route `app/[lang]/app/documents/[documentId]/page.tsx`, `DocumentView.tsx`, `DocumentRail.tsx`, `Digests.tsx` ; `lib/vault/download-fallback.ts` prêt et testé, à brancher dans `api/documents/[id]/versions/[number]/route.ts` (REQUEST L1-146) |
| T12 | fait | route `app/[lang]/app/documents/page.tsx`, `AllDocumentsTable.tsx` |
| T13 | fait | `src/styles/vault.css` ; test `vault-screens.test.ts` « no green in the vault » ; `seal.test.ts` sans nouvelle entrée |
| T14 | partiel (mesures locales faites ; `next build` et First Load JS sur le VPS) | voir Preuve |
| T15 | fait | `.war-room/sprints/L1_specimens/tooling/build-vault-specimen.tsx`, `shoot-vault.sh` ; captures dans `.war-room/sprints/L1_specimens/vault/` |
| T16 | NON FAIT ici | aucun navigateur piloté ni axe-core sur ce poste ; à jouer par Mamori sur le VPS |

Hors coffre, bloquant traité en premier (L1-144, L1-038) : `components/market/QuotesSection.tsx` (objet obligatoire,
livrables, validité) et six libellés dans `deals-fr.ts`, `deals-en.ts` ; test `test/quote-section.test.ts`.

## Décisions prises pendant la mission (à relire par Shogun)
- **Le formulaire revient sans JavaScript avec ses valeurs** : brouillon gardé dix minutes en mémoire du serveur, clé
  aléatoire liée à la personne et au contrat (`lib/vault/drafts.ts`), jamais dans l'adresse ni en cookie (une
  description de traitement de données n'a rien à faire dans une URL). La redirection porte `#erreurs` : le navigateur
  pose le focus sur le résumé (`tabindex="-1"`) sans script. Limite : un redémarrage perd le brouillon, la page le dit.
- **Pas de `required` natif sur les choix** : le résumé du serveur dit tous les choix manquants d'un coup, dans les mots
  du gabarit, au lieu d'une bulle du navigateur sur le premier.
- **M1 par bandes d'écran** : les cases du niveau 32 sont coupées en 4 bandes horizontales (rangées d'écran 0-1, 2-3,
  4-5, 6), du haut vers le bas, comme une encre qui se pose ; la réunion des bandes est le dessin gelé, octet pour octet
  (test). Le storyboard disait « 4 rangées » ; la grille 4 x 4 posée en losange a 7 rangées d'écran.
- **Casse de l'empreinte** : le poinçon écrit `7F3A 91C2…` (capitales, `fingerprintPrefix`), le pied du PDF
  `7f3a 91c2…` (minuscules, `digestGroups`). Sur E4, le pied du texte et « Vérifier » écrivent en minuscules, comme le
  papier et comme `sha256sum`. RISK L1-147 : une seule casse à choisir.
- **E6 sur téléphone** : l'empreinte passe en libellé au-dessus de la carte (seule place libre de la `DataTable`), puis
  document et version, puis « par » et date.
- **E4, rail non collant** : l'ordre téléphone du storyboard (poinçon, téléchargement, versions, sommaire, texte,
  vérifier) impose un DOM où le rail précède le texte ; la grille de 64 rem place le texte à gauche. Le lien
  d'évitement « Aller au texte du document » saute le rail.

## Pièges
- L'outil d'écriture (et un `python` lancé par Bash) décode `\u202f`, `\u00a0` et `\n` dans une chaîne en caractère
  réel : écrire `String.fromCharCode(...)`. `sed` GNU mange `\u` dans un remplacement.
- `vitest` sur 8 fichiers : 4 à 5 min sur ce poste ; `tsc` web : 6 à 19 min ; les lancer en arrière-plan.
- React rend `aria-current` avant `href` et `name` en dernier sur un `input` : les tests de rendu cherchent dans cet ordre.
- Chrome sans tête : la hauteur de fenêtre coûte cher (6 000 px à 1 280, 7 000 px à 375 au double) ; `H1280`, `H375`.

## Preuve (sorties de ce poste, 2026-10-25)
- Rouge d'abord : `vault-compare.test.ts` sans module (« no tests », 04:37) ; `vault-explain.test.ts` 6 rouges
  (`template_not_effective`, date de ma fixture) ; `vault-screens.test.ts` 2 rouges (ordre d'attributs, apostrophe).
- Vert final (run du 09:04, code final) : `npx vitest run apps/web/test/vault- apps/web/test/quote-section.test.ts
  apps/web/test/seal.test.ts apps/web/test/french-spacing.test.ts` : 130 tests verts, 1 en échec = `seal.test.ts` en
  dépassement de 60 s (lecture de tout `src` sur un disque saturé, pas une assertion). Même motif rejoué à la main :
  `grep -rlE` de `STRIKES_GREEN` sur `apps/web/src` rend exactement les 5 fichiers de `GREEN_FILES`, aucun du coffre.
- Dont `vault-record.test.ts` : un formulaire complet passe par l'adaptateur et le MOTEUR RÉELS jusqu'à une version 1
  rangée sur une vraie base (PGlite), dont l'aperçu rejoue la même empreinte de contenu ; le même envoi rejoué rend
  `stale` (latest 1) et n'écrit aucun second fichier ; un choix manquant rend `engine` avec `input.ipRegime`.
- `npx tsc -p apps/web/tsconfig.json --noEmit` : exit 0 (après correction de 5 erreurs `exactOptionalPropertyTypes`).
- `npx eslint` sur tous mes fichiers, `QuotesSection.tsx`, `deals-*.ts`, les routes et les tests : exit 0.
- Îlot `PendingSubmit` (esbuild, React externe) : 673 o minifié, **430 o gzip**, 365 o brotli (budget 600).
- E5 sur le contrat de référence (2 versions, 1 clause modifiée, 1 ajoutée) : **39 261 o** de HTML de corps (budget
  120 Ko) ; travail serveur (2 rejeux vérifiés + comparaison + « En bref ») : **médiane 155,9 ms**, min 99,8, max
  1 232,8 sur 20 runs, poste saturé (CPU 100 %) : à remesurer sur le VPS.
- Captures regardées avec Read, horodatées après la dernière retouche de leur page (dossier neuf, aucune périmée) :
  `.war-room/sprints/L1_specimens/vault/` `e1-s3@1280` (09:21), `e1-s5@1280` (08:29), `e1-s5@375` (08:39),
  `e2-errors@1280` (09:35), `e4@1280` (08:43), `e5@1280` (08:45, avant la retouche des codes, refaite 09:39),
  `e5-gris@1280` (09:47), `e6@375` (09:03). Défauts trouvés à l'image et corrigés : bloc des droits visible sans régime
  (spécificité CSS), « à la charge de le freelance », libellés doublés, codes d'empreinte collés, « 1520 », liens de
  légende collés, « le freelance » seul sur la carte E6.

## Pas fait, ou pas vérifié
- `next build`, First Load JS des routes, Lighthouse, rendu réel de E4 et E5 depuis le bundle (D7) : VPS.
- T16 : aucun navigateur piloté, aucun axe-core installé sur ce poste ; parcours clavier, sans JS, mouvement réduit et
  accessibilité à jouer par Mamori sur données de test. Les pages n'ont été rendues qu'en spécimen (composants réels,
  pas les routes, qui demandent une base et une session).
- Couleurs forcées : pas de capture (Chrome sans tête ne les émule pas) ; règles écrites, NON VÉRIFIÉ.
- Focus sur le résumé d'erreur sans script par `#erreurs` : NON VÉRIFIÉ dans Safari et Firefox.
- Le branchement du repli de téléchargement dans la route (L1-146), l'onglet de la section Contrats et la ligne du
  panneau Signatures (L1-148) : demandés, pas faits (hors périmètre).
- Les lignes « Pour vous / Pour le Client » ne s'affichent jamais tant que le gabarit n'a pas de table `explain`
  (L1-132) : le composant et la fonction les savent rendre (tests), aucune phrase n'est inventée.

## Au-delà de la demande (question du serment)
- Le texte affiché est le PDF ou rien : l'aperçu rejoue la version et compare l'empreinte au pied du papier ; un test
  le prouve avec le moteur réel, de la saisie au coffre (`vault-record.test.ts`).
- « En bref » attribue chaque choix à la version et à la partie qui l'a changé, même entre versions non voisines,
  et dit « Changé dans la version 2, puis dans la version 3 » quand un choix a bougé deux fois (tests).
- Le formulaire revient sans JavaScript avec ses valeurs et ses erreurs nommées dans les mots du gabarit, sans jamais
  mettre une donnée dans l'adresse (brouillon serveur de dix minutes, lié à la personne).
- J'ai trouvé une faute de vérité entre écran et papier (casse de l'empreinte, RISK L1-147) et le JSON brut d'un
  téléchargement raté (L1-146), avec leur correction prête.

## Révision 2 : décisions du Chancelier (L1-146, L1-147, L1-148), appliquées, bus L1-157
- **Onglet de la section Contrats** : `app/[lang]/app/contrats/page.tsx`, `SectionTabs` au-dessus de l'en-tête, seulement
  coffre ouvert.
- **Panneau Signatures** de `contrats/[id]/page.tsx` : prop `document` ajoutée, avec la ligne « Contrat de prestation :
  version n, empreinte … » qui mène au document. Fichiers : `components/vault/AffairDocumentLine.tsx`, lecture
  `affairSummary` dans `lib/vault/load.ts`, qui remplace `affairDocumentCount`.
- **Route de téléchargement** : `downloadFallback` branché, une ligne.
- **Une seule copie des règles d'enregistrement : reportée en L2.** Fusionner `renderAndRecord` dans `recordVersion`
  changerait deux réponses d'API déjà testées :
  - « requête invalide » et « version invalide » seraient confondues ;
  - la raison par défaut ne dépendrait plus du numéro de version.
- **Casse (L1-147)** : l'empreinte du contenu s'écrit en capitales groupées par quatre (pied du texte E4 par
  `fingerprintPrefix`, « Vérifier »). L'empreinte du fichier reste en minuscules. Le pied du PDF reste à passer en
  capitales par la piste A.
- **« · » orphelin** : `SEP` (U+00A0 puis « · » et une espace) dans tous les textes et composants du coffre, et
  dans l'en-tête partagé. Sous chaque poinçon de E5, deux lignes (`stampVersion`, `stampBy`) ; un test refuse un
  « · » en tête de ligne.
- **Preuve** :
  - eslint sur les fichiers touchés : exit 0 ;
  - tests `apps/web/test/vault-` et `french-spacing.test.ts` : 121/121 verts ;
  - `tsc` non relancé, sur consigne (poste saturé) ; dernier `tsc` web vert avant cette révision.
- **Captures regardées**, toutes postérieures aux retouches de 10:15 : `e5@1280` (10:20), `e4-verifier@1280` (10:27,
  « Vérifier » ouvert et pied du texte), `e1-s5@375` (10:30).
- **Pas refaites** : `e4@1280` et `e4@375`, `e6@1280` et `e6@375`. Les retouches de ces pages (séparateur, casse du
  pied, « par » sur la carte E6) sont vérifiées par les tests de rendu, pas à l'image.
- **Mesure de E5 refaite** : médiane 280,5 ms, 39 412 o de HTML ; poste plus chargé qu'à la première mesure.
