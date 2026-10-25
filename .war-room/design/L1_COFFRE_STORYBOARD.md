# L1_COFFRE_STORYBOARD : les écrans du coffre (L1.6), seconde par seconde

> Sensei (Katana Forge), mission L1, piste B, 2026-10-25. Arbre lu : `C:\Users\HP\AppData\Local\Temp\wt-l1`, branche
> `sprint/l1-coffre`, sans commit. Ce document décide ce que voit une personne dans le coffre ; il n'écrit aucun code.
> Il ne touche pas `apps/web/src/components/ui/` (Tetsu y corrige L1-090 et L1-091) : il dit seulement ce que le coffre
> en réutilise. Les valeurs d'exemple (empreintes, noms, dates, montants) sont marquées EXEMPLE ; aucune n'est un fait.

Sources lues, celles qui font foi pour chaque décision ci-dessous :
- Concept : `wt-l0/.war-room/design/LEGENDS_P2_CONCEPT.md` §A.3 à §A.5 (poinçon, états, couleur de comparaison), §B.7
  (primitives), §C.0 (règles des figures), §D.3 (le coffre), §G.2 (ce qu'on coupe).
- Prompt : `wt-l0/.war-room/PROMPTS_LEGENDS.md:395-399` (L1.6), `:432` (aucun vert en L1), `:451-454` (la comparaison
  qui parle).
- Passation du backend : `.war-room/a2a/L1/handoffs/backend__forge__coffre-donnees.md` (modèle de lecture, états, erreurs).
- Bus L1 : L1-019 et L1-030 (aucun texte rédigé après coup), L1-072 (deux empreintes), L1-090 et L1-091 (poinçon).
- Code : `apps/web/src/app/api/documents/vault.ts`, `apps/web/src/lib/document-renderer.ts`,
  `packages/db/src/documents.ts`, `packages/db/src/document-affairs.ts`, `packages/documents/src/{model,render,errors,pdf-layout}.ts`,
  `packages/documents/templates/service-agreement/{template,fr}.yaml`, `apps/web/src/components/ui/**`,
  `apps/web/src/app/[lang]/app/contrats/{page,[id]/page}.tsx`, `components/market/DealThread.tsx`, `.war-room/design/CONNECTED_PLAN.md`.

---

## 0. La décision en dix lignes

1. Le coffre vit **dans l'affaire** : un onglet « Documents » à côté de « L'affaire », sur `/app/contrats/[id]`. Une vue
   « Tous mes documents » existe aussi, comme second onglet de la section Contrats, jamais comme entrée de menu en plus.
2. Un document a **une seule adresse**, quelle que soit son affaire : `/app/documents/[id]`. On y lit le texte en HTML
   (pas un PDF dans un cadre), on télécharge le PDF, on voit ses versions en strates.
3. Le texte affiché est **recalculé depuis les données figées de la version et vérifié** : son empreinte de contenu doit
   égaler celle imprimée en pied de page du PDF, sinon l'aperçu est refusé et le PDF reste la seule référence.
4. Le poinçon du coffre est dessiné depuis **l'empreinte du contenu**, celle que le PDF imprime (L1-072). L'empreinte du
   fichier (SHA-256 du PDF) est montrée à part, avec la commande pour la recalculer chez soi.
5. En L1 tout document est **Déposé** : filet, encre, jamais d'ambre « À signer », jamais de vert (`PROMPTS_LEGENDS.md:432`).
6. La comparaison se fait **clause par clause, par identifiant de clause**, jamais par numéro d'article ni par pixels.
   Ajout : `+` en marge et soulignement ; retrait : `−` en marge et texte barré ; clause modifiée : filet en marge et
   mot « Modifiée ». Aucune couleur ne porte seule un sens, aucun vert.
7. En tête de la comparaison, **une phrase par choix changé**, calculée depuis les variables, attribuée à la version et
   à la partie qui l'a changé, et lue pour chaque partie (« Pour vous », « Pour le Client »).
8. Un seul mouvement par écran : l'empreinte qui s'encre à la naissance d'une version ; les deux poinçons qui se
   séparent à l'ouverture d'une comparaison. Tout le reste est immobile.
9. **Zéro octet de JavaScript requis** : listes, formulaires, comparaison, filtres et téléchargement marchent sans
   script. Un seul îlot facultatif (l'état « en cours » du bouton), budget 600 octets compressés.
10. J'ai trouvé six défauts réels en lisant le code (§9), dont deux qui auraient fait mentir l'écran : le poinçon du
    coffre n'aurait pas été celui du papier, et un collègue de la même entreprise aurait été appelé « l'autre partie ».

---

## 1. Où vit le coffre

### 1.1 Architecture d'information

| Lieu | Adresse | Rôle | Qui le voit |
|---|---|---|---|
| Onglet de l'affaire | `/[lang]/app/contrats/[id]/documents` | les documents d'une affaire, leurs versions, l'action de préparer | les deux parties du contrat (sinon 404, comme la page du contrat) |
| Préparer une version | `/[lang]/app/contrats/[id]/documents/preparer` | le formulaire des choix des parties | les deux parties, tant que le contrat est à accepter et que personne ne l'a accepté |
| Un document | `/[lang]/app/documents/[documentId]?version=3` | lire, télécharger, versions, vérifier | les parties de l'affaire du document ; tout autre : 404 « introuvable » |
| Comparer deux versions | `/[lang]/app/documents/[documentId]/comparer?de=2&a=3` | la comparaison clause par clause | idem |
| Tous mes documents | `/[lang]/app/documents` | tous les documents des affaires de la personne, filtrables | la personne connectée |
| Téléchargement | `/api/documents/[id]/versions/[n]` (existe, `vault.ts:228-263`) | les octets du PDF, en pièce jointe | idem, contrôle d'empreinte avant envoi |

Pourquoi une adresse par document et pas une adresse sous le contrat : un document peut appartenir à un devis, un fil,
une entreprise ou un profil (`Document`, passation du backend, « une affaire, exactement une de ») ; l'accord de
confidentialité d'un fil n'a pas de contrat. La page du document porte en tête le lien vers son affaire.

### 1.2 Le menu (sections de base, aucun nom de projet)

Le menu de l'espace ne gagne **aucune entrée**. La section Contrats (`CONNECTED_PLAN.md` §2.5) reçoit deux onglets :
« Contrats » (`/app/contrats`, l'existant) et « Documents » (`/app/documents`). Dans une affaire, deux onglets : « L'affaire »
(`/app/contrats/[id]`, l'existant) et « Documents (n) ».

Les onglets sont des **liens**, pas un `role="tablist"` (qui exige du script) : `<nav aria-label="Sections de l'affaire">`,
`<a aria-current="page">` sur l'onglet ouvert, filet `--ps-aura` de 2 px sous l'onglet courant, cibles de 48 px.

Quand le coffre est fermé (`vaultOpen` faux en production, `vault.ts:51`), **les onglets « Documents » ne sont pas
rendus**. Une adresse tapée à la main rend l'état E1-S0.

### 1.3 Les portes d'entrée

- Depuis l'affaire : l'onglet ; et, dans le panneau « Signatures » existant (`contrats/[id]/page.tsx:34-78`), une ligne
  « Contrat de prestation : version 3, empreinte 7F3A 91C2 0B4E D2A8 » (EXEMPLE) qui mène au document. Rien d'autre ne
  change sur l'onglet « L'affaire » en L1.
- Depuis « Tous mes documents » : chaque ligne ouvre le document.
- Après « Préparer » : retour sur l'onglet, la nouvelle strate en tête (mouvement M1, §6).
- En L2 (hors L1) : « 2 documents attendent votre signature » dans l'accueil « À traiter » de l'entreprise et du freelance.

---

## 2. La visite, seconde par seconde (le parcours qui sert de critère à L1.6)

Fixture : un contrat **au forfait** à accepter, avec objet et livrables, créé par
`activeContract(db, { scope, deliverables, signed: false })` (`packages/db/test/support/active-contract.ts`). Le contrat
de 500 EUR HT du 2026-10-21 n'a pas d'objet : il joue l'état « sans objet » (E1-S2), jamais une version (L1-030).

| Temps | Qui | Ce qu'il voit | Ce qu'il fait |
|---|---|---|---|
| 0 s | l'entreprise | la page du contrat, deux onglets, « Documents (0) » | ouvre « Documents » |
| 1 s | | E1-S3 : « Aucun document pour l'instant. », ce que reprendra le contrat, le bouton « Préparer le contrat de prestation » | clique |
| 2 s | | E2 : ce qui vient du contrat (figé, lecture seule), puis les choix, chacun avec à qui il revient | remplit 6 choix en 40 s environ (estimation, non mesurée) |
| 45 s | | appui (90 ms), « Préparation de la version 1… » | attend |
| 45,3 s | | retour sur l'onglet, la strate « Version 1 » ; son poinçon de 32 px s'encre en 640 ms (M1) ; « Version 1 déposée. Empreinte du contenu : 7F3A 91C2 0B4E D2A8. » | ouvre « Lire » |
| 50 s | | E4 : le contrat en HTML, le rail avec le poinçon de 96 px, « Télécharger le PDF » | télécharge |
| plus tard | le freelance | l'onglet : « Version 1 · déposée par l'entreprise » | « Préparer une nouvelle version », porte le délai de recette de 15 à 20 jours, raison « Délai de recette porté à 20 jours » |
| plus tard | l'entreprise | deux strates ; « Ce qui a changé depuis la version 1 » | ouvre la comparaison |
| +0 ms | | les deux poinçons de 96 px, d'abord l'un sur l'autre, se séparent en 320 ms (M2) | lit |
| +1 s | | « En bref » : « Délai de recette : 15 jours devient 20 jours. Changé par le freelance dans la version 2. » ; dessous, « Pour vous, Client : vous disposez de 20 jours après la déclaration de livraison pour prononcer la recette ou formuler des réserves motivées. » | descend |
| +3 s | | « 25 clauses identiques » repliées (EXEMPLE), puis « Article 13 · Recette · Modifiée », `15` barré, `20` souligné | accepte le contrat dans l'onglet « L'affaire » |
| après | les deux | l'onglet : « Plus de nouvelle version : le contrat a été accepté par l'entreprise le 25 octobre 2026. » | |

Rythme : un moment fort (M1) sur l'onglet, une respiration (la lecture), un moment fort (M2) sur la comparaison. Jamais
les deux sur le même écran.

---

## 3. Le poinçon dans le coffre (règles d'emploi, tirées de L1-090)

| Où | Taille | Ce qui est dessiné | Texte à côté |
|---|---|---|---|
| Strate courante (onglet) | 32 px | cadre et 4 x 4 cases (niveau de majorité) | 16 caractères de l'empreinte du contenu, « Déposé » |
| Strates plus anciennes, « Tous mes documents » | 16 px | **cadre et état seulement, aucune case** (L1-090 point 1) | les 16 caractères portent l'identité |
| Rail du document, en-tête de la comparaison | 96 px (64 px dans l'en-tête du document à 375 px) | grille complète | 16 caractères ; l'empreinte complète dans « Vérifier » |

- État : toujours `filed` (« Déposé ») en L1. Une version remplacée garde son poinçon `filed` ; le mot « Remplacée par la
  version 3 » est un texte à côté, **pas un quatrième état**.
- Composants : `FingerprintStamp` et `FingerprintMark` (`components/ui/fingerprint/FingerprintMark.tsx:103-141`), tels
  quels. Nom accessible : « Empreinte du contrat de prestation, version 3, 7F3A 91C2 0B4E D2A8. Déposé » (prop `subject`).
- Source du dessin : **`contentDigest`**, pas `sha256`. Le PDF imprime `contentDigest` en pied de page et y dessine le
  poinçon (`packages/documents/src/pdf-layout.ts:128` et `:140`) ; l'API n'expose que `sha256`, l'empreinte des octets
  (`packages/db/src/documents.ts:170`). Sans correction, l'écran et le papier montreraient deux dessins et deux chaînes
  différents pour le même document. CHALLENGE au backend (§9, défaut D1).
- Vert : aucun. Aucun fichier de `components/vault/` ne construit `kind: "sealed"` ; `seal.test.ts` et
  `test/support/green-files.ts` ne reçoivent aucune entrée en L1.

---

## 4. Les écrans et leurs états

Conventions de texte (pour Tetsu) : espaces fines insécables avant `;` `:` `!` `?` et dans les guillemets, écrites par
`String.fromCharCode(0x202f)` (piège noté par Tetsu) ; heure de Paris (`components/ui/when.ts`) ; montants par
`lib/format` ; jamais de tiret cadratin, d'emoji ni de flèche dans un texte lu (le « ← » du lien retour reste
`aria-hidden`, comme aujourd'hui). « Vous » désigne la personne connectée ; l'autre partie est nommée par son rôle :
« l'entreprise » ou « le freelance » dans l'interface, « le Client » ou « le Prestataire » quand on cite le contrat.

### E1. L'onglet « Documents » de l'affaire

En-tête partagé avec « L'affaire » (le `h1` du contrat, l'étiquette d'état, le montant), puis les onglets, puis
`<h2>Documents de l'affaire</h2>` et la phrase : « Rangés dans l'ordre de leur naissance. Chaque version garde son
empreinte : changer une virgule change l'empreinte et son dessin. »

L'état se calcule par une seule fonction pure (`lib/vault/affair-state.ts`, T3), dans cet ordre :

| # | État | Condition (lue en base) | Texte exact | Action |
|---|---|---|---|---|
| S0 | Coffre fermé | `vaultOpen` faux | « Les documents ne sont pas encore ouverts. » / « Les conditions de votre affaire restent dans l'onglet L'affaire. » | lien « Revenir à l'affaire » |
| S1 | Régie | `contract.billing === "monthly"` et aucun document | « Le contrat de prestation en régie n'est pas encore disponible : le mode de paiement des mois de régie reste à fixer par Proofseen. Les contrats au forfait peuvent déjà être rédigés. » | aucune |
| S1b | Annulé | `contract.status === "cancelled"` et aucun document | « Ce contrat a été annulé : aucun document ne lui est rédigé. » (s'il a des documents : S5, sans aucune action de préparation) | aucune |
| S2a | Sans objet, accepté | `scope === null` et au moins une acceptation (ou contrat actif, terminé) | « Ce contrat a été accepté sans objet de prestation décrit : il n'a pas de contrat de prestation rédigé. » / « Ses conditions acceptées sont celles de l'onglet L'affaire : parties, prix, dates et dates d'acceptation. Aucun texte ne lui est rédigé après coup. » | aucune (L1-019, L1-030) |
| S2b | Sans objet, à accepter | `scope === null`, contrat à accepter, personne n'a accepté | « Le devis de ce contrat ne décrit pas l'objet de la prestation : le contrat de prestation ne peut pas être rédigé sans lui. » / freelance : « Un nouveau devis peut le décrire, avec ses livrables. » / entreprise : « Le freelance peut envoyer un nouveau devis qui le décrit. » | aucune |
| S3 | Vide, à préparer | contrat à accepter, personne n'a accepté, `scope !== null`, aucun document | titre « Aucun document pour l'instant. » / « Le contrat de prestation reprend les conditions du devis accepté (parties, objet, livrables, prix, dates) et les choix que vous faites ensemble : lieu d'exécution, propriété intellectuelle, confidentialité. Tant que personne n'a accepté le contrat, chacun peut en préparer une nouvelle version ; toutes restent au coffre, avec leur empreinte. » | bouton « Préparer le contrat de prestation » (lien vers E2) |
| S4 | Vide, trop tard | `scope !== null`, au moins une acceptation, aucun document | titre « Aucun document pour l'instant. » / « Le contrat de prestation se prépare avant la première acceptation. Ce contrat a été accepté par {l'entreprise · le freelance · vous} le {25 octobre 2026} : aucun texte ne lui est rédigé après coup. » | aucune |
| S5 | Liste | au moins un document | voir ci-dessous | voir ci-dessous |
| S6 | Erreur de lecture | la lecture échoue (`erreur serveur`) | « Les documents n'ont pas pu être lus. Réessayez dans un instant. » | lien « Réessayer » (même adresse) |

Pourquoi S2 ne dit pas « avant la mise en service du coffre » (texte proposé par le backend) : un devis envoyé après
le coffre peut lui aussi être sans objet (les champs `scope` et `deliverables` de `sendQuote` sont facultatifs,
passation du backend, « L1-011 »). Le texte dit le fait, pas une date qu'il ne connaît pas.

Pourquoi S1 existe : le gabarit refuse tout contrat en régie tant que la décision D8 du founder n'est pas prise
(`template.yaml:467-475`, `gates` en `decision_pending` pour les trois variantes). Sans S1, l'entreprise remplirait dix
champs pour un refus. RISK au Chancelier (§9, D4).

**S5, la liste.** Une carte par document (`DocumentCard`), dans l'ordre de naissance (`createdAt` croissant), `h3` par
document :

```
 Contrat de prestation                                            (h3)
 Version 3 · déposée le 24 octobre 2026 à 14:02 par vous
 [poinçon 32]  7F3A 91C2 0B4E D2A8 · Déposé                        (EXEMPLE)
 Modèle Proofseen v1, en cours de relecture par un avocat.
 Raison : Délai de recette porté à 20 jours.
 [ Lire ]  [ Télécharger le PDF, 412 Ko ]  [ Ce qui a changé depuis la version 2 ]
 [ Préparer une nouvelle version ]

 Versions précédentes
 |  [◇16] Version 2 · 23 octobre 2026 · par l'entreprise · 3C09 77D1 A4E2 0F6B · Remplacée par la version 3
 |        Lire · Télécharger
 |  [◇16] Version 1 · 22 octobre 2026 · par l'entreprise · 91B4 ...
 Comparer la version [2 v] à la version [3 v]  [ Comparer ]
```

- Les strates : `<ol>` de la plus récente à la plus ancienne, filet `--ps-line` à gauche comme une coupe géologique ;
  la courante a la barre `--ps-aura` de la ligne sélectionnée de la Tour (L1-091, « À GARDER »). Au-delà de trois
  versions précédentes : `<details>` « 4 versions plus anciennes ».
- « Modèle Proofseen v1, en cours de relecture par un avocat. » : présent tant que le modèle rendu porte
  `reviewNotice` (`model.ts:67-69`). Règle de la Légion : un document juridique généré dit qu'il doit être relu.
- « Préparer une nouvelle version » : seulement quand l'état de l'affaire le permet (même règle que `refusalFor`,
  `document-affairs.ts:173`). Sinon, à sa place : « Plus de nouvelle version : le contrat a été accepté par
  l'entreprise le 25 octobre 2026. Le texte rédigé le plus récent est la version 3. » (formulation à valider par Inès,
  REQUEST §9).
- Après une création réussie (`?depose=3`, et la version 3 lue en base est la dernière et écrite par vous) : une ligne
  `role="status"` en tête de la liste, « Version 3 déposée. Empreinte du contenu : 7F3A 91C2 0B4E D2A8. », et le
  mouvement M1 sur la strate.
- Taille du fichier : `size` en Ko arrondis au Ko supérieur, « 412 Ko » (EXEMPLE).

**Sans JS** : identique (liens, `<details>`, formulaire GET de comparaison). **Mouvement réduit** : strate posée.
**375 px** : la carte prend toute la largeur ; les quatre actions passent en colonne, pleine largeur, 48 px ; « Lire » et
« Télécharger » d'abord ; les strates gardent 16 px et leurs 16 caractères passent sous le titre (groupes de quatre en
`inline-block`, jamais coupés au milieu). **Clavier** : ordre de lecture = ordre de tabulation (onglets, première carte,
ses actions, ses strates, le formulaire de comparaison) ; aucun raccourci d'une lettre hors de la Tour.

### E2. Préparer une version (le formulaire des choix)

`<h1>` « Préparer le contrat de prestation, version {n} ». Phrase : « Les conditions acceptées au devis ne changent pas
ici : parties, objet, livrables, prix et dates viennent du contrat. Vous choisissez le reste. Chaque choix dit à qui il
revient ; l'autre partie le confirme en acceptant le contrat, ou le change dans une nouvelle version. »

1. **« Ce qui vient du contrat »** (`<dl>`, lecture seule) : Prestataire, Client, Objet (replié au-delà de 6 lignes dans un
   `<details>`), Livrables (liste), Prix (« 5 jours à 100,00 EUR HT, soit 500,00 EUR HT », EXEMPLE), Dates, Commission
   de Proofseen et qui la paie. Sous la liste : « Une condition fausse ? Elle se corrige par un nouveau devis, avant toute
   acceptation. »
2. **Les choix**, un `<fieldset>` et sa `<legend>` par sujet, libellés repris du gabarit (`label.fr`), jamais un nom de
   variable :

| Fieldset | Variable | Contrôle | Pré-rempli | Aide (texte exact) | À qui |
|---|---|---|---|---|---|
| Lieu d'exécution | `input.workMode` | 3 boutons radio (libellés du gabarit) | depuis la mission (`prefill`, `template.yaml:293`), sinon rien | « Repris de la mission, à confirmer. » (seulement si pré-rempli) | Choix commun |
| Propriété intellectuelle | `input.ipRegime` | 3 boutons radio | non | « Les trois régimes sont décrits à l'article Propriété intellectuelle. » | Choix commun |
| Destination, territoire et durée des droits | `input.ipPurpose`, `input.ipTerritory`, `input.ipDurationYears` | zone de texte (1 000 caractères), 3 boutons radio, nombre | non | « Décrivez les usages prévus des livrables. » ; « Entre 1 et 70 ans. » | Choix commun |
| Recette | `input.acceptanceWindowDays` | nombre, 1 à 30 | 15 (décision L1-030, pas une hypothèse) | « Jours dont dispose le Client, après la déclaration de livraison, pour prononcer la recette ou formuler des réserves motivées. Entre 1 et 30. » | Choix commun |
| Confidentialité | `input.confidentialityYears` | nombre, 1 à 10 | **non** (défaut HYPOTHÈSE refusé par `refuseHypothesisDefaults`, `document-renderer.ts:159`) | « Entre 1 et 10 ans après la fin du contrat. » | Choix commun |
| Données personnelles | `input.processesPersonalData`, `input.dpaDetails` | Oui / Non (radio, aucun présélectionné), zone de texte (4 000) | non | « Si oui, l'article Traitement de données personnelles pour le compte du Client s'ajoute. » | Choix du Client |
| Sous-traitance | `input.subcontractingAllowed` | Oui / Non (radio, aucun présélectionné) | **non** (défaut HYPOTHÈSE) | « Non : le Prestataire exécute lui-même la prestation. Oui : il peut en sous-traiter une partie et en reste seul responsable. » | Choix du Client |
| Articles facultatifs | `optionalClauses.insurance` (+ `input.insurerName`, `input.insurancePolicy`) | case à cocher **non cochée**, puis 2 champs | non | « Ajouter l'article Assurance » | Choix du Prestataire |
| | `optionalClauses.non-solicitation` (+ `input.nonSolicitationMonths`, 1 à 12) | case non cochée, puis nombre | non | « Ajouter l'article Non-sollicitation » ; « Entre 1 et 12 mois. » | Choix commun |
| | `optionalClauses.reference` | case non cochée | non | « Ajouter l'article Référence et mission vérifiée : le Client accepte d'être cité comme référence et que la mission figure, une fois payée, comme mission vérifiée sur le profil du Prestataire. » | Choix du Client |
| Langue (version 1 seulement) | `lang` | Français / English | langue de l'interface | « La langue du document ne change plus ensuite. » | |
| Raison de cette version | `reason` (300 caractères) | champ texte, facultatif | « première version » si vide (`vault.ts:169`) | « Lue par l'autre partie dans la liste des versions. » | |

   - Pré-remplissage d'une version 2 et suivantes : **les valeurs de la version courante**, lues dans ses variables
     figées (côté serveur seulement). On change ce qu'on veut, la comparaison dira le reste.
   - Les champs conditionnels (destination des droits, détail du traitement, assurance, mois de non-sollicitation)
     restent dans le DOM et se montrent par CSS seulement (`fieldset:has(input[value="retained"]:checked) + .ui-cond`),
     sans script. Sans `:has()`, tout est montré avec l'aide « Seulement si … ». **Le serveur ignore** la valeur d'un
     champ dont la condition n'est pas remplie (un champ masqué par CSS est quand même envoyé).
   - « À qui » s'écrit sous la légende, en casse normale : « Choix commun », « Choix du Client », « Choix du Prestataire ».
     En L1 le choix reste **indicatif** (chacun peut tout proposer, l'acceptation de l'autre vaut accord) ; voir le
     REQUEST à Inès (§9, D3) avant de le rendre bloquant.
   - Une case ou un bouton radio n'est jamais présélectionné pour une valeur que le gabarit marque HYPOTHÈSE.
3. **Note de relecture**, au-dessus du bouton : « Ce modèle est en cours de relecture par un avocat. Le document le dit
   en tête et en pied de page. Relisez-le avant de l'accepter. »
4. **Bouton** « Préparer la version {n} » (`btn btn-primary`, 48 px) et lien « Annuler » vers l'onglet. Champ caché
   `attendu={n}` (concurrence, §9 D5).

**Le gabarit incomplet, en langage clair.** Le serveur renvoie le formulaire avec les valeurs saisies et, en tête, un
résumé `role="alert"`, `tabindex="-1"`, `autofocus` (le focus y arrive sans script) :

```
 Il manque 2 choix pour préparer le contrat :
   - Propriété intellectuelle : régime de propriété intellectuelle     (lien vers le fieldset)
   - Confidentialité : durée après la fin du contrat, en années        (lien vers le champ)
```

Chaque nom de `missing` (409 `gabarit incomplet`, `vault.ts:150`) est traduit par le libellé du gabarit
(`template.yaml`, `label.fr`), jamais affiché brut. Sur chaque champ fautif : `aria-invalid="true"`, message lié par
`aria-describedby`, texte selon le cas :

| Cas | Texte sous le champ |
|---|---|
| choix manquant (radio, case) | « Choisissez une réponse. » |
| nombre manquant ou hors bornes | « Indiquez un nombre entre {min} et {max}. » |
| texte manquant | « Ce champ est nécessaire pour cet article. » |
| coordonnées dans un texte (`NO_CONTACT`) | « Le texte contient des coordonnées (adresse, téléphone, messagerie, lien). Elles s'échangent une fois la mission payée sur Proofseen. » (même voix que `community-fr.ts:37`) |
| variable manquante qui n'est **pas** une saisie (un fait du contrat, par exemple `contract.commissionBp`) | pas de champ : dans le résumé, « Une condition du contrat manque ({libellé du gabarit}). Elle ne se choisit pas ici : contactez-nous. » |

Autres refus du moteur, rendus dans le résumé à la place de la liste :

| `code` | Texte |
|---|---|
| `decision_pending` | texte de S1 (ne devrait pas arriver : S1 l'empêche avant) |
| `source_expired`, `template_not_effective` | « Ce modèle de contrat ne s'applique pas à la date d'aujourd'hui : une nouvelle version du modèle est nécessaire. Contactez-nous. » |
| `invalid_variable` sur `optionalClauses` ou une clé refusée par `splitInputs` | « Cette demande n'est pas valide. Rechargez la page et recommencez. » |
| tout autre (`template_not_found`, `template_not_wired`, `language_missing`, `locked_clause_removed`, `unknown_clause`, `condition_unresolvable`, `contract_not_found`) | « Le document ne peut pas encore être rédigé. Contactez-nous si cela dure. » |

**Sans JS** : formulaire POST vers une action serveur, page rechargée avec le résultat. **Mouvement réduit** : rien ne
bouge de toute façon. **375 px** : une colonne, champs à 16 px (pas de zoom iOS), radios en lignes de 48 px, résumé
d'erreur en tête. **Clavier** : flèches dans un groupe de radios (natif), `Tab` de fieldset en fieldset, liens du résumé
qui posent le focus sur le premier contrôle du fieldset (`href="#ip-regime"` sur l'`id` du premier radio).

### E3. Rendu en cours

| Temps | Ce que voit la personne | Avec JS (îlot `PendingSubmit`) | Sans JS |
|---|---|---|---|
| 0 ms | appui | bouton enfoncé 90 ms (`--ps-dur-press`), désactivé, `aria-busy="true"` sur le formulaire | l'indicateur de chargement du navigateur |
| 0 à 400 ms | rien de plus (le moteur rend en 240 ms médianes, L1-005 : la plupart des rendus finissent ici) | | |
| après 400 ms | « Préparation de la version 3… » dans le bouton, et la même phrase dans une région `aria-live="polite"` | | |
| réponse | redirection vers l'onglet (`?depose=3`) ou retour du formulaire avec le résumé d'erreur | | identique |

Aucune roue qui tourne, aucune barre qui respire (`CONNECTED_PLAN.md:44-45`) : un texte.

### E4. Le document : lire, télécharger, vérifier

Adresse `/app/documents/[id]?version=3` (sans `version` : la dernière). En tête : lien retour « Documents de l'affaire »
vers l'onglet, `h1` « Contrat de prestation », ligne « Version 3 sur 3 · déposée le 24 octobre 2026 à 14:02 par vous ·
Déposé ».

**À partir de 64 rem, deux colonnes** (`minmax(0, 1fr) 20rem`) :

```
 +------------------------------------------------+  +-------------------------------+
 | [note] Document établi à partir d'un modèle     |  |  [poinçon 96]                 |
 | Proofseen en cours de relecture par un avocat...|  |  7F3A 91C2 0B4E D2A8 · Déposé |
 |                                                 |  |  Version 3 sur 3              |
 | Contrat de prestation de services               |  |  [ Télécharger le PDF ]       |
 | Référence ..., version 3 du 24 octobre 2026     |  |  Version 3 · 412 Ko · PDF     |
 |                                                 |  |  > Vérifier ce document       |
 | Article 1 · Les parties                         |  |  Versions                     |
 | ...                                             |  |   * Version 3 (vous lisez)    |
 | Article 13 · Recette                            |  |   * Version 2 · l'entreprise  |
 | ...                                             |  |  [ Ce qui a changé depuis 2 ] |
 +------------------------------------------------+  |  Sommaire : 1 Les parties ... |
                                                      +-------------------------------+
```

- **Le texte** : `DocumentView` rend le `DocumentModel` recalculé (T4) dans un `<article lang="{langue du document}">` :
  note de relecture encadrée (`reviewNotice`), titre, sous-titre, puis chaque clause en `<section id="clause-{id}">`
  avec `<h2>` « Article {number} · {heading} », paragraphes, puces, blocs de parties ; les valeurs venues des données
  (`Run.value`, `model.ts:9-13`) en PS Text graisse normale, sans couleur (le texte d'un contrat ne se colore pas).
  Pied de l'article : « Ce texte est celui du PDF : même empreinte de contenu, 7F3A 91C2 0B4E D2A8, vérifiée à
  l'affichage. »
- **Le rail** (collant à partir de 64 rem) : `FingerprintStamp` 96 px ; `DownloadLink` « Télécharger le PDF » (lien
  `<a href="/api/documents/{id}/versions/3" download>`, aucun bouton, aucun script) et sa ligne « Version 3 · 412 Ko ·
  PDF » ; `<details>` « Vérifier ce document » ; la liste des versions (courante marquée `aria-current="page"`) ; le lien
  « Ce qui a changé depuis la version 2 » ; le sommaire (liens vers `#clause-{id}`).
- **« Vérifier ce document »** (`Digests`), texte exact :
  « Deux empreintes, deux usages. L'empreinte du contenu est imprimée en pied de chaque page du PDF et dessine le
  poinçon : 7F3A 91C2 0B4E D2A8 … (64 caractères en quatre lignes de seize). L'empreinte du fichier identifie le PDF
  exact : 9E41 … (64 caractères). Pour la recalculer sur votre ordinateur : `certutil -hashfile
  contrat-de-prestation-v3.pdf SHA256` sous Windows, `shasum -a 256 contrat-de-prestation-v3.pdf` sous macOS,
  `sha256sum contrat-de-prestation-v3.pdf` sous Linux. Le résultat doit être identique. »
  Le nom de fichier est celui que sert l'API (`vault.ts:242`, « contrat-de-prestation-v3.pdf »).
- **Version ancienne** (`?version=2` alors que 3 existe) : bandeau `role="note"` sous le titre, « Vous lisez la version 2.
  La plus récente est la version 3, déposée le 24 octobre 2026. » avec « Lire la version 3 » et « Voir ce qui a changé ».
- **Aperçu indisponible** (le contenu recalculé n'a pas la même empreinte que celle rangée, ou le gabarit de cette
  version n'est plus dans le registre) : à la place du texte, « L'aperçu de cette version n'est pas disponible. Le PDF
  reste la référence : téléchargez-le. » et le bouton de téléchargement. Jamais un texte approché. L'incident est
  journalisé par son seul nom (`logError`, comme `vault.ts:239`).
- **Version inconnue** (`?version=9`) : 404 « Ce document est introuvable. », comme un document étranger.
- **Téléchargement en échec** : la route répond en JSON (`introuvable`, `erreur serveur`) et le navigateur afficherait
  du JSON brut. Tetsu ajoute à la route, pour une requête de navigation (`Accept: text/html`), une redirection vers le
  document avec `?erreur=telechargement` ; le document affiche alors `role="alert"` : « Le document n'a pas pu être
  servi. Contactez-nous. » (T11).

**Sans JS** : tout, y compris le téléchargement et les replis. **Mouvement réduit** : aucun mouvement sur cet écran.
**375 px** : une colonne dans cet ordre : titre et ligne d'état ; poinçon de 64 px et ses 16 caractères côte à côte ;
« Télécharger le PDF » pleine largeur ; `<details>` « Versions (3) » ; `<details>` « Sommaire, 26 articles » (EXEMPLE) ;
le texte ; « Vérifier ce document » en bas. Mesure du texte : 343 px, PS Text à `--ps-step-0`, interligne 1,65.
**Clavier** : lien d'évitement « Aller au texte du document » ; le sommaire et les ancres posent le focus sur le `h2` de
l'article (`tabindex="-1"`), `scroll-margin-top` égal à la hauteur de l'en-tête collant.

### E5. La comparaison de deux versions (moment M2)

Adresse `/app/documents/[id]/comparer?de=2&a=3`. Règles d'adresse : `de` et `a` sont des numéros de 1 à 999 ; s'ils sont
inversés, redirection 307 vers l'ordre croissant (la plus ancienne d'abord, pour que « ajouté » veuille toujours dire
« apparu dans la plus récente ») ; s'ils sont égaux, la page affiche le formulaire de choix et « Choisissez deux versions
différentes. » ; un seul paramètre `a=3` vaut `de=2&a=3`. Un numéro inconnu : 404.

**1. L'en-tête : deux empreintes.** `h1` « Ce qui a changé entre la version 2 et la version 3 ». Dessous, les deux
`FingerprintStamp` de 96 px côte à côte (aussi à 375 px : 2 x 96 + 16 = 208 px sur 343), chacun avec « Version 2 ·
23 octobre 2026 · par l'entreprise » et ses 16 caractères. Puis la phrase : « Deux empreintes différentes : ce sont deux
documents distincts. » Mouvement M2 (§6).

**2. « En bref » (la comparaison qui parle).** Une phrase par changement, dans l'ordre des articles, calculée par
`lib/vault/explain.ts` (T7) depuis les variables figées des deux versions, sans modèle de langage :

| Changement | Phrase neutre (forme exacte) | Exemple (EXEMPLE) |
|---|---|---|
| énumération | « {Libellé} : « {avant} » devient « {après} ». » | « Lieu d'exécution : « à distance » devient « en partie à distance, en partie dans les locaux du Client ». » |
| nombre avec unité | « {Libellé sans unité} : {avant} {unité} devient {après} {unité}. » | « Délai de recette : 15 jours devient 20 jours. » |
| oui ou non | « {Libellé} : non devient oui. » | « Sous-traitance autorisée par le Client : non devient oui. » |
| texte libre | « {Libellé} : texte modifié, voir l'article {heading}. » | « Destination des droits (usages prévus) : texte modifié, voir l'article Propriété intellectuelle. » |
| article facultatif ajouté ou retiré | « Article ajouté : {heading}. » / « Article retiré : {heading}. » | « Article ajouté : Non-sollicitation. » |
| article conditionnel qui apparaît ou disparaît | même phrase, suivie de « (suit le choix {libellé}) » | « Article ajouté : Traitement de données personnelles pour le compte du Client (suit le choix Données personnelles). » |
| version du modèle Proofseen | « Le modèle Proofseen passe de la version {1} à la version {2} : {n} articles réécrits par Proofseen, sans changement de vos choix. » | |

Chaque phrase porte son **auteur et sa version** : « Changé par le freelance dans la version 2. » Pour une comparaison
de versions non voisines (1 et 3), l'auteur se lit en parcourant les versions intermédiaires (`lib/vault/attribution.ts`,
T8) : chaque version étant un instantané complet écrit par une seule personne, le changement d'une variable appartient
à la première version où la nouvelle valeur apparaît. Un changement défait puis refait s'écrit « Changé dans la version
2, puis dans la version 3. »

**Ce que cela change pour chaque partie.** Sous la phrase neutre, une ou deux lignes : d'abord « Pour vous, {rôle} : … »,
puis « Pour le {autre rôle} : … ». Les deux parties lisent donc la même vérité, chacune à sa place. Ces phrases ne
s'inventent pas à l'écran : elles viennent d'une table écrite par Inès dans le gabarit (champ `explain` par variable et
par valeur, REQUEST §9 D3), reprises du texte même de la clause. Tant qu'une phrase manque, seule la phrase neutre
s'affiche. Propositions à faire valider, tirées des clauses de `service-agreement/fr.yaml` :

| Variable, passage | Pour le Prestataire | Pour le Client |
|---|---|---|
| `ipRegime`, vers `assignment` | « Vous cédez au Client, à titre exclusif, vos droits patrimoniaux d'auteur sur les livrables créés pour lui, pour la destination, le territoire et la durée de l'article Propriété intellectuelle. » | « Les droits patrimoniaux d'auteur sur les livrables créés pour vous vous sont cédés, à titre exclusif, pour la destination, le territoire et la durée de l'article Propriété intellectuelle. » |
| `ipRegime`, vers `licence` | « Vous restez titulaire des droits et accordez au Client une licence non exclusive. » | « Le Prestataire reste titulaire des droits ; vous recevez une licence non exclusive. » |
| `ipRegime`, vers `retained` | « Vous conservez tous les droits ; le Client utilise les livrables pour ses besoins internes. » | « Vous utilisez les livrables pour vos besoins internes ; toute autre exploitation exige l'accord écrit du Prestataire. » |
| `subcontractingAllowed`, vers oui | « Vous pouvez sous-traiter une partie de la prestation ; vous en restez seul responsable et annoncez chaque sous-traitant au Client avant son intervention. » | « Le Prestataire peut sous-traiter une partie de la prestation ; il en reste seul responsable et vous annonce chaque sous-traitant avant son intervention. » |
| `acceptanceWindowDays` | « Le Client dispose de {n} jours après votre déclaration de livraison pour prononcer la recette ou formuler des réserves motivées. » | « Vous disposez de {n} jours après la déclaration de livraison pour prononcer la recette ou formuler des réserves motivées ; sans réponse, la recette est réputée prononcée. » |
| `confidentialityYears` | « La confidentialité dure {n} ans après la fin du contrat. » (une seule ligne, « Pour les deux parties ») | |

**3. Le résumé chiffré et la légende.** Une ligne : « 3 changements : 1 clause modifiée, 1 ajoutée, 1 retirée. », chaque
compte étant un lien vers la première clause de son genre. Puis la légende, en texte, lisible sans couleur :
« + ajouté, souligné · − retiré, barré · filet en marge et mot Modifiée : clause modifiée ». À partir de 64 rem, cette
ligne reste collée en haut pendant la lecture ; à 375 px, elle ne colle pas.

**4. Clause par clause.** `h2` « Clause par clause ». Les clauses s'alignent par `id` (`model.ts:27`, « la comparaison de
versions se fait par `id`, jamais par numéro »), dans l'ordre de la version la plus récente, les retirées à leur
ancienne place :

| Genre | Marque de marge | Mot | Rendu | Sans couleur |
|---|---|---|---|---|
| Identiques consécutives | aucune | « {n} clauses identiques » | un `<details>` fermé ; son contenu : la liste de leurs titres, chacun dépliable en texte | le mot |
| Modifiée | filet `--ps-signal` de 2 px | « Modifiée » (étiquette `.tag` en casse normale) | `h3` « Article 13 · Recette » ; paragraphes inchangés en `--ps-muted` ; paragraphe changé en entier ; mots retirés dans `<del>` (barré, `--ps-muted`), mots ajoutés dans `<ins>` (souligné 1 px, décalé de 0,2 em, `--ps-aura-text`) ; paragraphe ajouté marqué `+` en marge, paragraphe retiré `−` | filet, mot, barré, souligné, `+` et `−` |
| Ajoutée | `+` en marge de chaque paragraphe, filet `--ps-aura` | « Ajoutée » | texte entier en `--ps-text`, **non souligné** (un article entier souligné ne se lit plus) | `+`, mot |
| Retirée | `−` en marge | « Retirée » | `h3` barré, texte replié dans un `<details>` « Lire le texte retiré », barré dedans | `−`, mot |
| Renumérotée sans changement | aucune | aucun | comptée parmi les identiques ; son titre dans la liste dit « Article 14, auparavant article 13 » | texte |

- Lecteurs d'écran : `<ins>` et `<del>` ne sont pas annoncés par la plupart des lecteurs ; chaque marque porte un
  préfixe masqué à l'oeil (`sr-only`) « Ajouté : » et « Retiré : », et « fin de l'ajout » après. `<ins datetime>` et
  `<del datetime>` portent la date de la version. Les signes de marge sont `aria-hidden` (le préfixe les dit déjà).
- Signes : `+` (U+002B) et `−` (U+2212, signe moins), en PS Mono, dans une gouttière de 1,5 rem à gauche, jamais un
  tiret.
- Grain du découpage : paragraphes et puces alignés par plus longue sous-suite commune ; dans un paragraphe changé,
  mots alignés de même, une valeur venue des données (`Run.value`) comptant pour un seul mot. Au-delà de 2 000 mots
  dans un paragraphe, on montre « Avant » puis « Après » en entier plutôt qu'un découpage illisible.
- Fin de chaque clause changée : « Changement suivant : article 18, Confidentialité » (lien d'ancre), et sur la dernière
  « Fin des changements. Revenir au résumé. » Sans script, au clavier, sans raccourci.
- Toujours différents d'une version à l'autre, dits une fois sous l'en-tête et jamais comptés comme changements : le
  numéro de version et la date d'établissement (« Numéro : 2 puis 3. Date d'établissement : 23 puis 24 octobre 2026. »).

**5. Les vues.** Formulaire GET « Afficher » : « Les changements dans le texte » (défaut) ou « Avant et après, côte à
côte » (`?vue=cote`, deux colonnes `minmax(0, 1fr)` à partir de 64 rem ; à 375 px la vue revient au texte). Et « Version
complète, à imprimer » (`?vue=complete`) : rien de replié, pour le conseil d'une des parties ; `@media print` garde les
soulignés, les barrés, les signes et les mots.

**6. Les états de la comparaison.**

| État | Texte exact |
|---|---|
| Aucune clause ne change | « Aucune clause ne change entre la version 2 et la version 3. Seuls le numéro et la date d'établissement diffèrent, d'où deux empreintes différentes. » |
| Une version n'a pas pu être recalculée à l'identique (T4) | « La comparaison clause par clause n'est pas disponible pour ces deux versions : leur texte n'a pas pu être recalculé à l'identique. Téléchargez les deux PDF pour les comparer. » et les deux liens de téléchargement |
| Deux modèles Proofseen différents (v1 et v2 du gabarit) | la phrase « Le modèle Proofseen passe de la version… » en tête de « En bref », et chaque clause réécrite par le modèle porte « Modifiée par le modèle » au lieu de « Modifiée » |
| Une seule version | pas de lien de comparaison ; adresse tapée : « Ce document n'a qu'une version. » |

**Sans JS** : tout. **Mouvement réduit** : poinçons posés côte à côte, aucun défilement doux. **375 px** : poinçons côte
à côte à 96 px, « En bref » en liste, une seule colonne de clauses, gouttière des signes réduite à 1,25 rem, phrases par
partie l'une sous l'autre. **Clavier** : résumé chiffré, puis chaînage « Changement suivant » ; `:target` reçoit le focus
visible `--ps-focus` et `scroll-margin-top`. **Couleur retirée** (capture en niveaux de gris et `forced-colors: active`) :
signes, mots, barré et souligné suffisent ; en couleurs forcées, filets et soulignés passent en `CanvasText`.

### E6. Tous mes documents

Adresse `/app/documents`, onglet « Documents » de la section Contrats. `h1` « Documents ». Phrase : « Tous les documents
de vos affaires. Ils naissent dans l'onglet Documents de chaque affaire. »

- `FilterBar` (formulaire GET) : « Sorte » (Toutes, puis seulement les sortes présentes : Contrat de prestation, Devis,
  Procès-verbal de recette, Accord de confidentialité, Avenant) ; « Déposé par » (Tous, Vous, L'autre partie). Puces
  retirables, « Tout effacer ».
- `DataTable`, `caption` « Vos documents, du plus récent au plus ancien » ; colonnes : Document (« Contrat de prestation ·
  Atelier Exemple », EXEMPLE, en-tête de ligne, lien étiré vers E4), Version (nombre), Empreinte (poinçon 16 px, cadre
  seul, et 16 caractères), Déposé (date `<time>`, triable, tri par défaut décroissant), Par (vous, l'entreprise, le
  freelance, un compte supprimé). Aucun tri par personne, aucun score (la primitive le refuse déjà). 50 lignes par page,
  « 1 à 12 sur 12 ».
- Vide : `EmptyState` « Aucun document pour l'instant. » / « Les documents naissent dans l'onglet Documents de chaque
  affaire, avant la première acceptation du contrat. »
- Vide après filtre : « Aucun document ne correspond à ces filtres. » et « Tout effacer ».
- **375 px** : la table passe en cartes (mode `card` de la `DataTable`, L1-091 K11) : ligne 1 sorte et version, ligne 2
  affaire et date, ligne 3 empreinte. **Sans JS**, **clavier** : ceux de la `DataTable` et de la `FilterBar`.

### E7. Les erreurs (HTTP, code, texte, où)

| HTTP · `error` | Où l'écran le rencontre | Texte |
|---|---|---|
| 404 · `introuvable` | document, version ou affaire inconnus **ou étrangers** | page 404 de l'espace : « Ce document est introuvable. » Jamais « accès refusé ». |
| 400 · `requête invalide` | action de préparation | « Cette demande n'est pas valide. Rechargez la page et recommencez. » |
| 400 · `version invalide` | action de préparation | « La version n'a pas pu être enregistrée. Réessayez. » |
| 409 · `objet de la prestation manquant` | action (course avec un changement d'état) | texte de S2a ou S2b |
| 409 · `état de l'affaire` | action, le contrat vient d'être accepté pendant la saisie | « Le contrat vient d'être accepté : son texte ne change plus. » (et non « passe par un avenant », que L1 ne permet pas : le moteur ne rend que le contrat de prestation, `document-renderer.ts:29`) |
| 409 · `gabarit incomplet` | action | E2, « Le gabarit incomplet, en langage clair » |
| 409 · version déjà prise (§9 D5, à créer) | action, l'autre partie a déposé une version entre-temps | « L'entreprise vient de déposer la version 3. Lisez-la avant d'en préparer une autre. » avec le lien vers la comparaison 2 et 3 |
| 429 · `trop de demandes` | action | « Trop de demandes. Réessayez plus tard. » |
| 503 · `non-configuré` (coffre fermé) | toutes les pages du coffre | S0 |
| 503 · `non-configuré` (moteur absent, coffre ouvert) | action | « La préparation des documents n'est pas disponible pour l'instant. Les documents déjà déposés restent lisibles. » |
| 500 · `erreur serveur` | action, lecture, téléchargement | « Le document n'a pas pu être servi. Contactez-nous. » |

Les actions serveur redirigent vers la page d'origine avec `?erreur={clé}` (même convention que
`contrats/actions.ts:20`) ; la clé se traduit par le dictionnaire, une clé inconnue donne le texte générique de 400.

---

## 5. Ce que le coffre ne montre pas, et pourquoi

- Le journal d'accès (`DocumentAccess`) à l'autre partie : « l'entreprise a téléchargé la version 2 le … » serait du
  suivi d'une personne. Hors L1 ; question à Thomas si un jour on le veut.
- Les variables figées par l'API : jamais en JSON. Le serveur les lit pour rendre l'aperçu et la comparaison aux seules
  parties, dans le HTML de leur page, qui ne contient rien que le PDF ne contienne déjà.
- Un état « à signer » : L2. En L1, l'acceptation du contrat reste celle de l'onglet « L'affaire ».
- Le PDF dans un cadre : illisible sur téléphone (iOS ne montre que la première page), et la route le sert en pièce
  jointe sous `sandbox` (`vault.ts:252`), ce qui est juste.

---

## 6. Le mouvement (Kaze), seconde par seconde

Règles tenues : un dessin visible avant, pendant et après ; transformation et opacité seulement ; une fois, sur un
événement réel lu en base ; durées par jetons, que `tokens.css:46` met à zéro en mouvement réduit ; enveloppe
`@media (prefers-reduced-motion: no-preference)` en plus ; CSS seulement, aucun script.

**M1. L'empreinte s'encre (naissance d'une version, onglet E1).** Sens : la version existe parce que son empreinte vient
d'être calculée ; on la voit se poser, comme l'encre d'un poinçon.

| Temps | Ce qui bouge | Comment |
|---|---|---|
| 0 ms | rien : la strate est à sa place, son cadre au filet, ses 4 rangées de cases déjà dessinées en `--ps-line` | rendu serveur |
| 0 à 280 ms | rangée 1 des cases : de l'opacité 0,25 à 1 sur le chemin encré posé au-dessus du chemin au filet | `--ps-ease-ink` |
| 120 à 400 ms | rangée 2 | |
| 240 à 520 ms | rangée 3 | |
| 360 à 640 ms | rangée 4 (fin à `--ps-dur-trace`, 640 ms) | |
| après | immobile ; la ligne `role="status"` était là dès 0 ms, posée | |

Déclencheur : `?depose={n}` **et** la version `n` lue en base est la dernière, écrite par vous, il y a moins de dix
minutes. Un rechargement dans ces dix minutes rejoue 640 ms d'encre, sans plus ; tout autre lien enlève le paramètre.
Pour Tetsu : le chemin des cases du niveau 32 se découpe en 4 chemins par rangée (`fingerprintMark` rend aujourd'hui un
seul chemin `cells`, T6 demande une fonction de découpage, sans toucher le module du poinçon, qui part dans
`packages/brand` avant le gel de son vecteur (L1-036) : un module voisin `lib/vault/mark-rows.ts` qui relit `gridAt`
depuis son nouvel emplacement).

**M2. Les deux empreintes se séparent (ouverture d'une comparaison, E5).** Sens : on croyait tenir un seul document ;
il y en a deux. C'est le moment M2 du concept (§A.6), avec la durée du concept (§C.1 V7, 320 ms).

| Temps | Ce qui bouge | Comment |
|---|---|---|
| 0 ms | les deux poinçons sont dessinés ; celui de la version la plus récente est posé exactement sur l'autre | `transform: translateX(calc(-100% - var(--gap)))` au départ |
| 0 à 320 ms | il glisse à sa place, à droite | `--ps-dur-reveal`, `--ps-ease-out` |
| 320 ms | immobile ; la phrase « Deux empreintes différentes : ce sont deux documents distincts. » était posée dès 0 ms | |

Joué à chaque ouverture d'une comparaison (c'est une demande de la personne, pas un rechargement passif) ; jamais quand
on navigue par ancre dans la page.

**M3. Arrivée sur un changement (E5, au clic sur « Changement suivant »).** Défilement doux (`scroll-behavior: smooth`,
seulement sans réduction) ; le filet de marge de la clause `:target` passe de 2 à 4 px par `transform: scaleX(2)` en
160 ms (`--ps-dur-ui`), puis reste. C'est un retour de la personne, pas un spectacle : il n'entre pas dans le compte des
effets lourds.

**Ce qui ne bouge jamais** : les listes, le texte du document, les `<details>` (aucune animation de hauteur), le
formulaire, les erreurs (aucun tremblement), la table de « Tous mes documents ».

---

## 7. Routes, composants, réutilisation

### 7.1 Routes à créer (toutes `dynamic = "force-dynamic"`, gardées comme `contrats/[id]/page.tsx:119-127`)

| Fichier | Rend |
|---|---|
| `app/[lang]/app/contrats/[id]/documents/page.tsx` | E1 |
| `app/[lang]/app/contrats/[id]/documents/preparer/page.tsx` | E2 |
| `app/[lang]/app/contrats/[id]/documents/actions.ts` | action `prepareVersion` (création ou version suivante), redirections |
| `app/[lang]/app/documents/page.tsx` | E6 |
| `app/[lang]/app/documents/[documentId]/page.tsx` | E4 |
| `app/[lang]/app/documents/[documentId]/comparer/page.tsx` | E5 |
| `app/[lang]/app/contrats/[id]/layout.tsx` (ou un composant d'en-tête partagé) | l'en-tête et les onglets communs à « L'affaire » et « Documents » |

### 7.2 Composants `apps/web/src/components/vault/` (serveur, sauf mention)

| Composant | Rôle | Réutilise |
|---|---|---|
| `AffairTabs.tsx` | les deux onglets de l'affaire, et ceux de la section Contrats | rien (liens, `aria-current`) ; si Tetsu en fait une primitive, `ui/tabs/NavTabs.tsx` en fichier neuf |
| `VaultState.tsx` | S0 à S4 et S6 | `components/EmptyState.tsx` (titre, texte, actions) |
| `DocumentCard.tsx` | une carte de S5 | `FingerprintStamp` 32 px, `DownloadLink`, `VersionStrata` |
| `VersionStrata.tsx` | les strates (`<ol>`) | `FingerprintStamp` 16 px, `ui/when.ts` |
| `VersionPicker.tsx` | le formulaire GET « Comparer la version … à la version … » | champs `select` stylés de `ui.css` (`FilterField` si exporté) |
| `DownloadLink.tsx` | le lien de téléchargement, sa taille, son nom | rien |
| `PrepareForm.tsx` | E2 entier : faits, fieldsets, note, bouton | `ChoiceField`, `ErrorSummary`, `PendingSubmit` |
| `ChoiceField.tsx` | un contrôle depuis la déclaration d'une variable (énumération, entier, booléen, texte, case de clause) | libellés et bornes du gabarit |
| `ErrorSummary.tsx` | le résumé `role="alert"` et ses liens | rien |
| `PendingSubmit.tsx` | **le seul îlot** (`"use client"`, `useFormStatus`), bouton désactivé et texte après 400 ms | budget 600 o compressés |
| `DocumentView.tsx` | le `DocumentModel` en HTML | rien (blocs `paragraph`, `bullet`, `party`) |
| `DocumentRail.tsx` | le rail de E4 | `FingerprintStamp` 96 px, `DownloadLink`, `Digests`, `VersionStrata` |
| `Digests.tsx` | « Vérifier ce document » | `<details>`, `<code>` |
| `CompareHead.tsx` | les deux poinçons et la phrase, M2 | `FingerprintStamp` 96 px |
| `ChangeSummary.tsx` | « En bref », phrases neutres et par partie | sortie de `lib/vault/explain.ts` |
| `DiffLegend.tsx` | résumé chiffré et légende | rien |
| `ClauseDiff.tsx` | une clause : identiques repliées, modifiée, ajoutée, retirée | `InlineDiff` |
| `InlineDiff.tsx` | les mots d'un paragraphe en `<ins>` et `<del>` | rien |
| `AllDocumentsTable.tsx` | E6 | `DataTable`, `FilterBar`, `FingerprintStamp` 16 px, `ui/url.ts` |

Écart assumé au concept : §B.7 range `VersionStrata` dans `viz/`. Ce n'est pas une figure (pas de SVG à décrire, pas de
tableau de valeurs) mais une liste ordonnée : je la range dans `vault/`. À trancher par Shogun s'il tient à `viz/`.

### 7.3 Fonctions pures `apps/web/src/lib/vault/` (testées, couverture d'au moins 80 %)

| Fichier | Fait | Test qui doit exister |
|---|---|---|
| `affair-state.ts` | ContractDetail + liste + `vaultOpen` vers S0 à S5 | une table de cas : chaque état, et l'ordre des conditions (régie avant vide) |
| `replay.ts` | variables figées d'une version vers `DocumentModel`, refus si `contentDigest` diffère de celui rangé | rendu, rejoué, mêmes octets de `canonical` ; variable altérée : refus |
| `compare.ts` | deux modèles vers la liste des clauses (identique, modifiée, ajoutée, retirée, renumérotée) | aligne par `id` ; une clause renumérotée n'est pas un changement ; numéro et date d'établissement jamais comptés |
| `words.ts` | découpage en mots et plus longue sous-suite commune ; `Run.value` atomique ; seuil de 2 000 mots | « 15 » remplacé par « 20 » donne un retrait et un ajout, rien d'autre |
| `explain.ts` | variables changées vers phrases neutres, et phrases par partie quand la table du gabarit les porte | une phrase par type ; aucune phrase pour `document.*` ; sortie identique pour les deux lecteurs, seul l'ordre « Pour vous » change |
| `attribution.ts` | changement vers la version et l'auteur qui l'a fait | versions 1, 2, 3 : un changement fait en 2 est attribué à 2 dans la comparaison 1 et 3 |
| `choices.ts` | déclaration du gabarit vers les champs à montrer, valeurs ignorées si leur condition n'est pas remplie | `ipPurpose` ignoré quand `ipRegime = retained` |
| `mark-rows.ts` | chemin des cases du niveau 32 découpé en 4 rangées | la réunion des 4 chemins égale le dessin de `fingerprintMark(hex, 32)` |

### 7.4 Feuille et budgets

- `apps/web/src/styles/vault.css`, importée par les composants du coffre seulement : jetons de la marque, grilles en
  `minmax(0, 1fr)`, cibles de 48 px, aucune transition de `box-shadow` ni de `filter`, **aucune lecture de
  `--ps-proof`** (test).
- JavaScript : 0 octet requis ; `PendingSubmit` au plus 600 o compressés, mesuré comme `InspectorKeys` (esbuild, React
  externe). Tetsu relève le « First Load JS » des routes du coffre par `next build` (T14).
- HTML : la comparaison d'un contrat de neuf pages (L1-075) est longue, car un `<details>` replié doit contenir son
  texte pour être lisible sans script. Budget : au plus 120 Ko de HTML non compressé pour la comparaison du contrat de
  référence, mesuré (T14) ; au-delà, les clauses identiques ne portent que leurs titres et un lien vers l'article dans
  E4 (`#clause-{id}`).
- Performances serveur : `renderTemplate` est pur et sans PDF ; deux rendus par comparaison. À mesurer (T14), jamais
  supposé.

---

## 8. Ce que je coupe

| Coupé | Raison |
|---|---|
| Diff vert et rouge | le vert est réservé à un acte poinçonné (§A.5) ; un ajout n'est pas vérifié |
| Un troisième poinçon « différence » (ou exclusif des deux dessins) entre les deux empreintes | il se lirait comme un troisième document |
| Le PDF dans un cadre, et toute visionneuse PDF en JavaScript | illisible à 375 px, lourd, et le texte HTML vérifié dit plus |
| La comparaison superposée de pages au curseur (`VersionCompare` îlot du concept) | sert aux PDF déposés de l'extérieur, qui n'existent pas en L1 ; elle reviendra avec eux |
| Les raccourcis `j` et `k` dans la comparaison | une lettre seule hors d'une liste focalisée viole WCAG 2.1.4 ; le chaînage par liens suffit |
| Une animation de hauteur des `<details>` | du mouvement sans sens, et du script |
| Un compteur « 3 changements » qui roule | refusé partout (`CONNECTED_PLAN.md:43`) |
| Le mot « Générer » | on prépare un contrat, on ne le génère pas ; le mot dit la machine, pas l'acte |

---

## 9. Défauts et risques relevés en lisant le code (envoyés au bus)

| # | Constat | Preuve | Proposition | À qui |
|---|---|---|---|---|
| D1 | L'écran dessinerait le poinçon depuis `sha256` (octets) alors que le PDF imprime et dessine `contentDigest` : deux empreintes et deux dessins pour un même document | `pdf-layout.ts:128,140` (contentDigest) ; `documents.ts:170` (`VERSION_SELECT` sans contentDigest) ; passation : « Empreinte : `sha256` en PS Mono » | exposer `contentDigest` dans `VersionSummary` (lu dans `variables.contentDigest`, ce n'est pas une donnée personnelle) ; l'écran dessine depuis lui, montre `sha256` comme « empreinte du fichier » | backend (CHALLENGE L1-131) |
| D2 | Un collègue de la même entreprise qui dépose une version est « l'autre partie » pour son collègue | `documents.ts:178` : `authorId === actor.userId ? "you" : "other_party"` | `by` donne le côté : `{ you: boolean, side: "seller" \| "buyer" \| null }` | backend (L1-131) |
| D3 | `editableBy` (qui peut faire un choix) est déclaré par le gabarit mais n'est lu par aucun code | recherche de `editableBy` dans `*.ts,*.tsx` : seulement `packages/documents/src/schema.ts:46,76` | décider s'il est indicatif (L1 : chacun propose, l'acceptation vaut accord, l'auteur de chaque version est visible) ou bloquant (alors un brouillon partagé de choix est nécessaire, sinon le freelance ne peut jamais préparer la version 1 : `processesPersonalData` est requis, sans défaut, réservé au Client) ; écrire aussi les phrases par partie (`explain`) et une `unit` pour les entiers | Inès (REQUEST L1-132) |
| D4 | Tout contrat en régie est refusé par le gabarit tant que D8 n'est pas décidée | `template.yaml:434-444` (source `pending`), `:467-475` (gates `decision_pending`) | état S1 avant tout formulaire ; à dire au founder avec D8 | Chancelier (RISK L1-134) |
| D5 | Sans script, un double clic sur « Préparer » crée deux versions ; et deux parties qui préparent en même temps ne savent pas que l'autre a déposé | `vault.ts:135-182` : aucune version attendue n'est vérifiée | l'action envoie `attendu={n}` ; `record` refuse si la dernière version n'est plus `n - 1` (409, texte en E7) | backend (L1-131) |
| D6 | Le texte proposé « Une modification passe par un avenant » promet ce que L1 ne fait pas ; « accepté avant la mise en service des documents » est faux pour un devis récent sans objet | `document-renderer.ts:29,148` (seul le contrat de prestation est branché) ; `sendQuote` accepte `scope` facultatif (passation) | textes de E1-S2 et E7 ; et décider si l'objet devient obligatoire sur un nouveau devis (Code civil 1163, L1-011) | backend, Victoria (L1-131, L1-134) |
| D7 | Les pages du coffre importent le moteur côté serveur (aperçu, comparaison) : le risque de lecture de fichiers au runtime de L1-074 vaut aussi pour elles, pas seulement pour la route d'API | L1-074 | prouver un `next build` et un rendu réel de E4 et E5 avant de clore | Tetsu (T14) |
| D8 | Rejouer `renderTemplate` sur les variables figées donne-t-il le même `contentDigest` ? Les variables dérivées (`computed.*`) sont rangées comme valeurs et `hypotheses` entre dans le contenu canonique (`render.ts:77-88`) : NON VÉRIFIÉ | `document-renderer.ts:136-144`, `render.ts:77-88` | une fonction `replayVersion(stored)` dans `packages/documents`, testée sur le contrat de référence ; l'aperçu et la comparaison en dépendent, `/verifier` (L2.7) aussi | piste A (REQUEST L1-133) |

---

## 10. Les tâches pour Tetsu (dans cet ordre)

Chaque tâche a son critère ; aucune ne touche `components/ui/` ni le module du poinçon (`lib/fingerprint-mark.ts`,
bientôt dans `packages/brand`, L1-036), dont le dessin est gelé par la DÉCISION L1-120 de Shogun.

| # | Tâche | Critère |
|---|---|---|
| T1 | Attendre l'ANSWER de L1-131 (contentDigest, `by` par côté, `attendu`) et de L1-133 (`replayVersion`) ; en attendant, coder contre des types locaux | aucune maquette ne montre `sha256` comme empreinte du poinçon |
| T2 | Dictionnaires `i18n/market/vault-fr.ts` et `vault-en.ts` : tous les textes de §4 et §6, mot pour mot en français | test : aucun tiret cadratin (U+2014) ni demi-cadratin (U+2013), aucun emoji, espace fine avant `: ; ! ?` (comme le test de vocabulaire existant) |
| T3 | `lib/vault/affair-state.ts` et ses tests | S0 à S5 dans l'ordre de E1, table de cas verte |
| T4 | `lib/vault/replay.ts` (ou l'import de `replayVersion`) | empreinte rejouée égale à celle rangée sur le contrat de référence ; refus prouvé sur une variable altérée |
| T5 | Onglets et en-tête partagé de l'affaire ; E1 complet | rendu serveur de chaque état de E1 (S0 à S6) ; onglet absent quand le coffre est fermé |
| T6 | `DocumentCard`, `VersionStrata`, `VersionPicker`, `DownloadLink`, `lib/vault/mark-rows.ts`, M1 | réunion des 4 rangées égale le dessin du niveau 32 ; mouvement seulement si la version lue en base est la vôtre, récente et dernière |
| T7 | `lib/vault/explain.ts` et `ChangeSummary` | une phrase par type de changement ; aucune phrase inventée hors de la table du gabarit |
| T8 | `lib/vault/attribution.ts`, `compare.ts`, `words.ts` | tests de §7.3 verts |
| T9 | E5 : `CompareHead` (M2), `DiffLegend`, `ClauseDiff`, `InlineDiff`, vues `cote` et `complete`, redirection 307 d'ordre | lisible sans couleur (capture en niveaux de gris regardée) ; `<ins>` et `<del>` avec préfixes masqués ; chaînage des changements au clavier |
| T10 | E2 : `PrepareForm`, `ChoiceField`, `ErrorSummary`, `PendingSubmit`, action `prepareVersion` (extraire `renderAndRecord` en couche `data/`, passation du backend « Pour le receveur ») | parcours sans JS : formulaire incomplet, résumé d'erreur avec libellés clairs, puis version 1 rangée ; double envoi refusé |
| T11 | E4 : `DocumentView`, `DocumentRail`, `Digests` ; redirection de la route de téléchargement pour une navigation en échec | texte HTML égal au PDF (empreinte vérifiée) ; aperçu refusé quand elle diffère ; commandes de vérification exactes |
| T12 | E6 : `AllDocumentsTable` sur la `DataTable`, après `documents(db).listMine(actor, { sorte, par, tri, page })` du backend (L1-131) | tri et filtres par l'adresse, cartes à 375 px |
| T13 | `styles/vault.css` ; test qui refuse `--ps-proof` et `kind: "sealed"` dans `components/vault/` | `seal.test.ts` vert sans nouvelle entrée (critère L1.6) |
| T14 | Mesures : `next build` (First Load JS de chaque route du coffre, avant et après), poids de `PendingSubmit`, HTML de E5 sur le contrat de référence, temps serveur de E5 | chiffres collés dans la passation ; rendu réel de E4 et E5 depuis le bundle (D7) |
| T15 | Spécimens régénérables (`tooling/shoot.sh`) : E1 (S2a, S3, S5), E2 avec erreurs, E4, E5, E6, à 1 280 et 375 px (cadre de 375 réel, piège de Tetsu), plus E5 en niveaux de gris et en couleurs forcées | captures regardées par Shogun avant la porte du chef-d'oeuvre |
| T16 | Parcours joué dans un vrai navigateur (critère L1.6), avec Mamori : clavier seul, sans JS, mouvement réduit, axe-core | accessibilité 1 sur E1, E2, E4, E5, E6 rendus sur données de test |

---

## 11. Ce que je n'ai pas vérifié

- Aucun écran rendu : tout ce qui précède vient du code et des documents cités. Les durées de saisie (40 s) sont des
  estimations.
- Que `renderTemplate`, rejoué sur les variables rangées, redonne le même `contentDigest` (D8) : non joué.
- Que `autofocus` sur un élément `tabindex="-1"` déplace le focus sans script dans Safari et Firefox : à confirmer par
  Mamori ; repli si non : le résumé reste en tête de page, premier élément après le lien d'évitement.
- Le comportement des lecteurs d'écran avec `<ins>` et `<del>` est cité de connaissance générale, pas mesuré.
- `:has()` pour les champs conditionnels : pris en charge par les navigateurs récents ; le repli « tout montré » est
  prévu mais pas joué.
- Les phrases « Pour le Prestataire » et « Pour le Client » sont des propositions tirées du texte des clauses, **non
  relues par Inès** : elles ne s'affichent qu'après sa validation dans le gabarit.
- Le poids de l'îlot (600 o) est un budget, pas une mesure.

---

## 12. Passation (gabarit A2A)

De : katana-sensei · Vers : katana-tetsu (écrans), katana-shogun (verdict) ; copie backend, piste A, Inès, Chancelier ·
Mission : L1 · Vague : 2 · Date : 2026-10-25.

**Livré** : ce storyboard (`.war-room/design/L1_COFFRE_STORYBOARD.md`) ; les messages L1-130 à L1-134 au bus.

**Preuve** : chaque décision cite son fichier et sa ligne ; les six défauts de §9 sont lus dans le code (lignes citées) ou
par recherche (`editableBy`).

**Pas fait** : aucun code, aucune capture (rien n'est encore rendu) ; §11.

**Au-delà de la demande (question du serment)** : voir le compte rendu au Chancelier ; en bref, l'aperçu vérifié par
empreinte, l'attribution de chaque changement à sa version et à sa partie, la ligne « Pour vous » et « Pour l'autre
partie » qui fait lire la même vérité aux deux, les commandes pour recalculer l'empreinte chez soi, la vue imprimable
pour le conseil d'une partie, et les défauts D1, D2, D5 qui auraient fait mentir l'écran ou perdre une version.

**Pour le receveur** : commencer par T1 à T4 (sans eux, l'écran dessinerait la mauvaise empreinte) ; le parcours de
référence est celui de §2 ; le contrat de 500 EUR HT du 2026-10-21 ne sert qu'à l'état S2a.
