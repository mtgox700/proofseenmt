# L1 · Banc du moteur PDF (le Coffre)

Auteur : architect (banc PDF). Date : 2026-10-24. Réponse à la REQUEST L1-002 de Maxwell.
Banc hors du dépôt : `%TEMP%\claude\...\scratchpad\pdf-bench` (scripts `bench-*.mjs`, `run-all.sh`, `docker-run.sh`,
sorties dans `out/` et `out-docker/`). Aucun fichier du dépôt modifié en dehors de ce rapport et du bus.

## 1. Protocole

- Document identique pour chaque moteur : contrat A4 de 2 pages, titre, bloc des parties, tableau de 5 clauses
  (2 colonnes, bordures), accents `é è à ç œ Œ « » € É ’`, pied « Page x / n », pièce jointe XML CII (Factur-X MINIMUM
  factice) avec `AFRelationship /Alternative`.
- Police : Source Serif 4 TTF statique (Regular + Semibold), téléchargée depuis le dépôt officiel Adobe
  `github.com/adobe-fonts/source-serif` (branche release, dossier TTF). Licence SIL OFL 1.1, déjà au dépôt
  (`apps/web/public/fonts/OFL-source-serif-4.txt`).
- Polices de la marque : le dépôt ne contient que du WOFF2 (`ps-display-v1.woff2`, 38 Ko, police variable `wght`
  400 à 700, tables fvar/gvar/HVAR ; `ps-mono-v1.woff2`, 11 Ko, statique). Aucun TTF/OTF source au dépôt.
- Mesure : rendu n°1 et n°2 comparés en SHA-256, puis 10 rendus chronométrés (médiane et minimum). Variantes
  « défaut » : mêmes scripts sans les réglages de déterminisme, 1,1 s d'écart entre les deux rendus.
- Contrôles de sortie avec poppler (`pdfinfo`, `pdffonts`, `pdfdetach`, `pdftotext`, `pdftoppm`) : 2 pages pour tous
  les moteurs, texte extrait « Œuvre, cœur, déjà, où, naïf, Noël, à côté » à l'identique pour les 5 moteurs, rendu
  visuel vérifié page par page.
- Deux environnements : Windows 11, Node 22.16.0 (portable chargé, temps bruités) et Docker `node:22-bookworm-slim`,
  Node 22.23.4 (l'image de production).

## 2. Tableau comparatif (mesuré)

| Moteur | Version, dernière publication, téléchargements/semaine | Déterministe | Hash identique Windows et Linux | Temps médian (min) Windows | Temps médian Docker | Taille | Polices | Pièce jointe | Dépendances (paquets, disque) |
|---|---|---|---|---|---|---|---|---|---|
| **pdfkit** | 0.20.2, 2026-09-07, 7,2 M | oui, avec dates figées | oui (`bd8d8840…`) | 420 ms (319) | 389 ms | 18 416 o | TTF, OTF via fontkit 2 ; sous-ensemble, préfixe stable `CZZZZZ+` ; WOFF2 : plantage | oui, native, `AFRelationship`, `/AF` du catalogue | 20, 21,3 Mo |
| pdfkit en PDF/A-3b | idem | oui | oui (`a9335279…`) | 815 ms (503) | 1 089 ms | 21 728 o | idem | oui + XMP `pdfaid:part 3`, OutputIntent sRGB, balisage | idem |
| **pdfmake** | 0.3.12, 2026-10-17, 1,8 M | oui, avec dates figées | oui (`e5d40924…`) | 492 ms (393) | 240 ms | 22 580 o | idem pdfkit (le moteur dessous) | oui, `files` transmis à pdfkit (source en data URI) | 23, 32,9 Mo |
| pdfmake en PDF/A-3b | idem | oui | non mesuré sous Linux | 443 ms (266) | n.m. | 25 891 o | idem | oui + XMP PDF/A-3 | idem |
| @react-pdf/renderer | 4.9.0, 2026-08-27, 4,1 M | oui, avec `creationDate` et `modificationDate` | oui (`79e874fd…`) | 210 ms (194) | 391 ms | 20 351 o | TTF/OTF (pdfkit 0.20.1 dessous) | **non** (post-traitement pdf-lib : 29 ms, déterministe) | 63 avec React, 39,6 Mo |
| pdf-lib + @pdf-lib/fontkit | 1.17.1, **2022-05-12** ; fontkit 1.1.1, **2022-04-06** ; 12,6 M | oui, avec `updateMetadata:false` et dates figées | oui (`5e309596…`) | 517 ms (430) | 675 ms | 14 848 o | TTF ; WOFF2 : plantage non rattrapable | oui, native, `afRelationship`, `/AF` | 6, 24,9 Mo |
| @cantoo/pdf-lib (fork maintenu) + fontkit 2 | 2.11.1, 2026-09-15, 1,0 M | oui | oui (`93662e72…`) | 750 ms (426) | 678 ms | 17 754 o | TTF ; plante avec @pdf-lib/fontkit, marche avec fontkit 2 | oui, native | 18, 35,5 Mo |
| jsPDF | 4.2.1, 2026-03-17, 9,9 M | oui, avec `setCreationDate` et `setFileId` | **non** : la date dépend du fuseau du processus (`+02'00'` contre `-00'00'`) | 63 ms (52) | 138 ms | 47 812 o | TTF seulement, sans mise en forme OpenType | **non** (post-traitement pdf-lib possible) | 7, 31,7 Mo |

Les temps sont mesurés sur un portable Windows très chargé (l'installation npm a pris 24 minutes) : l'écart entre deux
passes atteint un facteur 1,7 pour un même moteur. Ordre de grandeur fiable : jsPDF environ 60 à 140 ms, tous les
autres entre 200 et 900 ms pour 2 pages, polices sous-ensemblées comprises. Pour un contrat, une facture ou un devis
généré à la demande, cet écart n'est pas un critère de choix.

Rendu par défaut, sans réglage : **aucun moteur n'est déterministe** (pdfkit, pdfmake, pdf-lib, jsPDF, react-pdf : hash
différent entre deux rendus).

Vérifié aussi : même hash d'un processus à l'autre (première passe et passe finale) pour toutes les variantes figées.

## 3. Ce qu'il a fallu régler pour le déterminisme

| Moteur | Source d'aléa trouvée dans le code | Réglage |
|---|---|---|
| pdfkit / pdfmake | `info.CreationDate = new Date()` ; l'ID du fichier est un MD5 de `info` (dont `CreationDate.getTime()`) ; pièce jointe : `creationDate`/`modifiedDate` = date du fichier source ou maintenant | `info: { CreationDate, ModDate }` fixes (pdfmake : `info.creationDate`, `info.modDate`) ; `doc.file(…, { creationDate, modifiedDate })` fixes ; source en Buffer ou data URI, jamais un chemin (sinon `fs.statSync` injecte les dates du disque) |
| pdfkit / pdfmake | compression via `zlib` de Node | rien : hash identique entre Node 22.16 Windows et Node 22.23 Linux ; à surveiller à chaque montée de version de Node |
| pdfkit | préfixe de sous-ensemble de police | rien : dérivé de l'identifiant de la police (`CZZZZZ+`), stable |
| pdf-lib | `updateMetadata: true` par défaut (dates « maintenant ») ; dates de pièce jointe à `new Date()` | `PDFDocument.create({ updateMetadata: false })`, `setCreationDate`, `setModificationDate`, `attach(…, { creationDate, modificationDate })` |
| pdf-lib | suffixe aléatoire du nom de police | rien d'obligatoire : le RNG est à graine fixe (`SimpleRNG.withSeed(1)`) ; `customName` le supprime (vérifié : déterministe dans les deux cas) |
| pdf-lib | flux d'objets | `useObjectStreams` true ou false : déterministe dans les deux cas (14 848 o contre 19 018 o) ; aucun `/ID` écrit, à ajouter à la main pour PDF/A |
| jsPDF | `fileId` de 32 caractères `Math.random()` ; date de création `new Date()` ; date formatée dans le fuseau local | `setFileId(hex fixe)`, `setCreationDate(date fixe)`, et `TZ=UTC` imposé au processus |
| react-pdf | `creationDate` par défaut à maintenant | props `creationDate` et `modificationDate` du `<Document>` |

## 4. Polices de la marque

- WOFF2 direct : **échec partout**. pdfkit (fontkit 2) : `RangeError: Offset is outside the bounds of the DataView` au
  sous-ensemble. pdf-lib (@pdf-lib/fontkit) : `RangeError: Index out of range` levée dans un minuteur, donc **non
  rattrapable** : elle tue le processus.
- Conversion WOFF2 vers TTF avec fontTools (`TTFont(...).flavor = None`) : 102 Ko variable, 55 Ko instancié à 400.
  Les deux s'embarquent avec pdfkit et pdf-lib, déterministes (pdfkit `248802fd…`, pdf-lib `90e6ce77…`). Le PDF ne
  connaît pas les polices variables : seule l'instance par défaut (400) est dessinée ; un gras de marque exige une
  instance statique 600 ou 700 générée par `fontTools.varLib.instancer`.
- Toutes les polices testées couvrent `éèàçœ«»ÉÈÀÇŒ€’êâîôûëïüÿ` (contrôle fontkit `hasGlyphForCodePoint`).

## 5. Réglages clés des scripts

- pdfkit : `size A4`, `bufferPages: true` (numéros « x / n » écrits à la fin via `switchToPage`), `compress: true`,
  `pdfVersion: '1.7'`, `lang: 'fr-FR'`, `info` complet à dates fixes ; PDF/A : `subset: 'PDF/A-3b'`, `tagged: true` ;
  tableau à la main avec `heightOfString` (pdfkit 0.20 expose aussi `doc.table()`, non testé ici).
- pdfmake : définition JSON (`table` avec `widths`, `dontBreakRows`, `footer: (page, total) => …`), polices limitées
  au dossier `fonts/` par `setLocalAccessPolicy`, `setUrlAccessPolicy(() => false)` (aucun appel réseau).
- Factur-X : `doc.appendXML()` de pdfkit ajoute le bloc XMP `fx:` (DocumentType, DocumentFileName, Version,
  ConformanceLevel) au flux de métadonnées PDF/A-3 ; vérifié avec `pdfinfo -meta`, déterministe (`5c9d2779…`).

## 6. Recommandation

**pdfmake 0.3 sur pdfkit 0.20**, avec pdfkit direct en réserve pour la piste Factur-X.

1. Même moteur dessous : un seul jeu de polices, un seul comportement de compression, hash identique Windows et
   image de production.
2. Le gabarit est une donnée JSON (tableaux, pieds de page, sauts de page, justification gérés par la bibliothèque) :
   il colle au format de gabarit structuré d'Inès, se versionne et se hache, sans React côté serveur.
3. Pièce jointe avec `AFRelationship`, `/AF` au catalogue, PDF/A-3b avec XMP et OutputIntent : natifs. Le bloc XMP
   Factur-X passe par `appendXML` de pdfkit (pdfmake ne l'expose pas) : en L5, la facture Factur-X peut être produite
   par pdfkit directement ou par un accès à l'instance pdfkit.
4. Maintenus : pdfmake publié il y a 7 jours, pdfkit il y a 7 semaines ; 23 paquets, licences MIT, Apache-2.0, 0BSD,
   BlueOak (png-js sans champ `license` mais fichier LICENSE MIT).

Écartés : pdf-lib (aucune publication depuis mai 2022, fontkit idem, pas de mise en page, plantage non rattrapable sur
WOFF2) ; à garder seulement comme outil de post-traitement, de préférence via le fork `@cantoo/pdf-lib` + fontkit 2.
jsPDF (pas de pièce jointe, pas de forme OpenType, dépend du fuseau, 2,6 fois plus lourd). @react-pdf/renderer (pas de
pièce jointe, 63 paquets, React dans le chemin de rendu serveur ; défendable si l'équipe veut des gabarits en JSX).

## 7. Règles à inscrire dans `packages/documents` (ou équivalent)

- Toute date du PDF vient des données métier (date d'émission), jamais de l'horloge ; idem pour les pièces jointes.
- Pièces jointes passées en Buffer, jamais en chemin de fichier.
- Polices : TTF statiques dérivées des WOFF2 de la marque par un script de build fontTools versionné, hash des TTF
  fixé dans un test.
- Test de non-régression : SHA-256 attendu d'un document de référence, exécuté en CI dans `node:22-bookworm-slim`.
- Le Coffre scelle le hash des octets produits et stockés ; la régénération identique est un test, pas la preuve.

## 8. Risques

- **Conformité PDF/A-3 et Factur-X non validée** : veraPDF n'a pas été lancé (Java, absent de la machine). Le schéma
  d'extension XMP (`pdfaExtension`) du namespace `fx` n'a pas été ajouté. À faire en L5 avec veraPDF en CI (jamais au
  runtime).
- Compression zlib de Node : identique aujourd'hui entre deux versions de Node 22, sans garantie contractuelle. Une
  montée de Node ou de pdfkit peut changer les octets : le test de hash de référence le détectera, et le hash scellé
  au moment de l'émission reste la référence.
- Polices de la marque : seule l'instance 400 est utilisable sans build ; la conversion WOFF2 vers TTF ajoute un
  outil Python au build (pas au runtime). Licence OFL : la dérivation reste sous OFL, nom réservé « Source » à
  respecter pour une police modifiée (les fichiers s'appellent déjà « PS Display »).
- pdfmake : les pièces jointes en Buffer cassent (`URLResolver` attend une chaîne) ; passer par data URI ou pdfkit.
- Temps mesurés sur une machine chargée : à remesurer sur le VPS avant de dimensionner une génération en masse.
