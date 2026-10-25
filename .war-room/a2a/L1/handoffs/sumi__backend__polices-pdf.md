# Passation : polices PDF de la marque (instances TTF statiques)
De : katana-sumi · Vers : piste A (backend, `packages/documents`), Maxwell (CTO) ; copie Inès, Chancelier · Mission : L1 · Vague : 1 · Date : 2026-10-24

## Livré
- `packages/brand/pdf-fonts/` (nouveau dossier, rien d'autre touché) :
  - `ps-display-400.ttf`, `ps-display-600.ttf`, `ps-display-700.ttf` : titres, Source Serif 4 opsz 48 (le dessin du site).
  - `ps-text-400.ttf`, `ps-text-700.ttf` : corps du document, Source Serif 4 opsz 10 (proposition, voir plus bas).
  - `ps-mono-500.ttf` : la trace (références, dates, empreintes), Source Code Pro 500, graisse figée de la marque.
  - `OFL-source-serif-4.txt`, `OFL-source-code-pro.txt` : licences.
  - `build_pdf_fonts.py` : génération déterministe depuis les originaux d'Adobe, sources épinglées par SHA-256,
    contrôles intégrés (couverture, nom réservé, police non variable), écrit `manifest.json`.
  - `manifest.json` : fichier, famille, graisse, axes, octets, SHA-256, glyphes, nom PostScript.
  - `verify.mjs` : contrôle d'intégrité Node sans dépendance (taille et SHA-256 contre le manifeste), sortie 0 ou 1.
  - `specimen.mjs` et `specimen.png` : rendu pdfkit de contrôle et sa page à 110 dpi.
  - `README.md` : origine, licence, commande exacte, empreintes, branchement pdfmake, pièges mesurés.

## Licence (lue avant toute conversion)
- Source Serif 4 et Source Code Pro : SIL OFL 1.1 (Adobe). Texte de l'archive officielle comparé au dépôt : identique
  pour Serif (`cmp`), identique à la fin de ligne près pour Code Pro (CRLF chez Adobe, LF au dépôt ; `diff` ligne à
  ligne vide hors fins de ligne).
- L'OFL permet explicitement l'embarquement (« can be bundled, embedded ») et la modification ; conditions tenues : la
  licence accompagne les fichiers, « Source » (nom réservé) n'est dans aucun nom principal (identifiants 1 à 6, 16, 17
  vérifiés par le script et par vidage de la table `name`), mentions d'Adobe 0, 7, 13, 14 conservées. Aucune police de
  remplacement nécessaire.

## Preuve
- Provenance : archives retéléchargées depuis les publications GitHub d'Adobe le 2026-10-24 ;
  `source-serif-4.005_Desktop.zip` SHA-256 `549fdb8f…c425` (identique à la copie du banc) ; `VF-source-code-VF-1.026R.zip`
  `0660ba0c…9fb1`. Le script refuse toute autre source.
- Déterminisme des polices : deux générations indépendantes et simultanées → 7 fichiers sur 7 identiques (`cmp`).
- Déterminisme des PDF : spécimen pdfkit rendu deux fois → 43 068 o, `94083010…24e6` deux fois ; contrat court pdfmake
  0.3.12 rendu deux fois → 14 400 o, `36a574d6…ace6`, IDENTIQUE.
- `pdffonts` : chaque police embarquée en sous-ensemble, CID TrueType, Identity-H, ToUnicode présent (`PSDisplay-Bold`,
  `PSText-Regular`, `PSMono-Regular`…, préfixe stable `CZZZZZ+`).
- `pdftotext` : « Œuvre, cœur, déjà, « guillemets », 1 250,00 EUR, € » restitué pour les 6 instances ; 24 U+202F
  conservées ; « Nguyễn » et « HAŸ » retrouvés ; ligatures « fi » restituées en lettres (recherche et copie intactes).
- Regardé (outil Read) : `specimen.png`. Les six lignes rendent juste en regular, semi-gras et gras ; en mono les
  guillemets prennent une chasse pleine (normal en chasse fixe) ; le corps à 10 pt est nettement plus solide et plus
  ouvert en opsz 10 qu'en opsz 48 ; la police du site convertie telle quelle imprime des carrés vides à la place de
  Ł, Ș, Ț, ễ, ị, ằ, ğ, ř et Ÿ ; nos instances les dessinent tous. Zéro barré vérifié à 600 dpi (pdfkit `features` et
  pdfmake `fontFeatures`) : pointé sans, barré avec.
- Fidélité au site (fontTools, 246 points de code communs) : PS Display 400 et PS Mono 500 identiques au WOFF2 servi
  (avances et boîtes, 0 unité d'écart) ; 600 et 700 à 2 unités sur 1 000 au plus.
- `node packages/brand/pdf-fonts/verify.mjs` → `6 fonts match manifest.json`, sortie 0 ; sur une copie altérée d'un
  octet → message `SHA-256 dc4b97fa… manifest says 4d32f080…`, sortie 1.
- git : dans un dépôt jetable avec le `.gitattributes` du projet (`* text=auto eol=lf`), les TTF sont détectés
  `-text` et l'index garde les mêmes octets (empreintes comparées).

## Pas fait, ou pas vérifié
- Aucun commit (consigne). Rien hors de `packages/brand/pdf-fonts/` et du bus.
- `package.json` de `@proofseen/brand` n'exporte pas `./pdf-fonts/*` : hors de mon périmètre (demande L1-022).
- `.gitattributes` n'a pas de ligne `*.ttf binary` : la détection automatique suffit aujourd'hui (prouvé), la ligne
  explicite serait plus sûre (demande L1-022).
- PS Text (corps opsz 10) est une proposition de Sumi, pas une décision de marque : le Shogun tranche (L1-022).
- Non vérifié : rendu sur macOS Aperçu, Acrobat et pdf.js (seul poppler a été regardé) ; l'effet de la fusion des
  contours sur les coutures d'anticrénelage n'a pas été mesuré, seulement appliqué.
- Non vérifié : validation PDF/A-3b des polices par veraPDF (prévu en L5 ; les polices sont embarquées, sans
  restriction `fsType` = 0, ce qui est la condition requise).
- Manquent dans les polices d'Adobe elles-mêmes : U+2011 partout, U+2009 en mono, Ĭ ĭ Ĳ ĳ Ŧ ŧ en Serif. Les gabarits
  v1 n'emploient que 16 caractères non ASCII, tous couverts (relevé sur `tresor/L1/templates/**`).

## Au-delà de la demande (question du serment)
- J'ai trouvé que convertir les WOFF2 du site, la voie prévue par le banc et L1-006, aurait imprimé des carrés à la
  place des noms de parties : 3 points de code sur 336 en Latin étendu, pas de Ÿ. La preuve est sur la page :
  `specimen.png`, deux lignes côte à côte. J'ai donc reconstruit depuis les originaux d'Adobe, avec 639 points de code
  au lieu de 246 : polonais, tchèque, roumain, turc, hongrois, vietnamien.
- J'ai mesuré au glyphe près que le PDF garde le dessin du site (0 unité d'écart en 400 et en mono).
- J'ai prouvé le déterminisme de bout en bout : polices, PDF pdfkit, PDF pdfmake. J'ai ajouté `verify.mjs`, qui dit
  pourquoi le test d'empreinte casserait si une police changeait.
- J'ai relevé trois pièges et les ai consignés avec leur preuve : la politique d'accès de pdfmake sous Windows refuse
  les polices (barres inverses), les chiffres sont déjà tabulaires, le zéro barré demande `fontFeatures`.
- J'ai trouvé un défaut de typographie française dans les gabarits, prouvé à l'image (L1-021).

## Pour le receveur
1. Charger les polices par `resolve('packages/brand/pdf-fonts')` et comparer des chemins résolus dans
   `setLocalAccessPolicy` (bloc prêt dans le README, joué avec pdfmake 0.3.12).
2. Familles : `PSText` pour le corps, `PSDisplay` (600 normal, 700 gras) pour les titres, `PSMono` pour la trace avec
   `fontFeatures: ['zero']`. Aucun italique : `italics` pointe sur le romain.
3. Brancher `node packages/brand/pdf-fonts/verify.mjs` dans la CI à côté du test d'empreinte du document de référence.
4. Normaliser en NFC les noms et textes saisis avant le rendu ; appliquer l'espacement français de L1-021 dans le
   formateur pur de `packages/documents`.
5. Ne jamais régénérer les TTF sans relancer le script complet : toute nouvelle génération change les octets de tous
   les PDF de référence.
