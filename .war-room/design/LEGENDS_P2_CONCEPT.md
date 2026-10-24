# LEGENDS P2 CONCEPT : la phase 2 vue par la Création (Shogun, 2026-10-24)

> Mission L0, vague 0, siège Création. Base lue : arbre `wt-l0`, branche `sprint/l0-legion-plan`, révision `f9a5afd`
> (= `origin/main`, v2 en production). Sources : `.war-room/brand/BRAND_BOOK_V2.md`, `.war-room/design/VERDICT.md`,
> `.war-room/design/CONNECTED_PLAN.md`, `.war-room/design/21ST_SHORTLIST.md`, `.war-room/PROMPTS_LEGENDS.md`,
> `packages/db/prisma/schema.prisma`, `packages/brand/`, `apps/web/src/app/[lang]/app/operateur/`, `apps/web/src/components/`.
> Je n'ai rendu aucun écran connecté (aucune session, la Légion ne se connecte jamais au compte du founder) : tout ce
> qui est dit de l'existant vient du code, avec fichier et ligne. Le socle réglementaire
> (`.war-room/research/LEGENDS_P2_REGLEMENTAIRE.md`, cité « Régl. § ») et le flux d'argent du Trésor
> (`.war-room/tresor/L0_FLUX_ARGENT.md`, cité « Flux § ») sont arrivés pendant la rédaction : ils font foi pour tout
> point de droit ou d'argent, et je m'y suis aligné. Ce qui n'y est pas reste marqué À SOURCER. Ce document décide ce
> qui se voit ; il ne décide ni d'un prix, ni d'un taux, ni d'un prestataire.

---

## 0. La décision en huit lignes

1. Une seule métaphore pour toute la phase 2 : **l'empreinte**. Chaque acte (document, signature, apport, versement)
   reçoit une empreinte, et c'est cette empreinte qu'on poinçonne.
2. Le mot est vrai deux fois : en orfèvrerie, l'empreinte est la marque laissée par le poinçon ; en informatique,
   l'empreinte SHA-256 d'un fichier est déjà le mot du schéma (`schema.prisma:1353`, « Empreinte SHA-256 du contenu »).
3. Elle devient un objet visible et unique : le **poinçon d'empreinte**, un losange calculé à partir des bits du
   document. Changer une virgule change le dessin. Ce n'est pas une illustration, c'est une mesure.
4. Les trois états de l'espace connecté (`CONNECTED_PLAN.md:92-98`, déclaré, à l'essai, poinçonné) s'étendent tels quels
   aux actes. Aucun nouvel état, aucune nouvelle couleur.
5. Le back-office devient la **Tour de contrôle** : files de revue datées, inspecteur, palette de commandes, clavier. Il
   ne joue aucun spectacle ; il est rapide, dense et calme.
6. Onze visualisations, toutes dessinées par le serveur en SVG, zéro octet de JavaScript pour les figures.
7. Le moment qui arrête un inconnu : **`/verifier`**, où l'on dépose un PDF que le navigateur ne téléverse jamais, et
   où son poinçon d'empreinte se dessine puis se frappe en vert, ou reste à l'encre.
8. Je coupe : la porte de coffre-fort en 3D, le gribouillis de signature au doigt, tout classement d'apporteurs, tout
   diff vert et rouge, tout donut, tout compteur qui roule.

---

## A. La métaphore : l'empreinte

### A.1 La phrase

> **Proofseen ne garde pas des documents, il garde des empreintes. Une empreinte se dépose, passe à l'essai, puis se
> poinçonne.**

La vitrine raconte déjà le bureau de garantie : le poinçon se frappe sur un fait vérifié par un tiers
(`BRAND_BOOK_V2.md:115-121`). La phase 2 ne change pas de bâtiment ; elle étend le poinçon **des faits aux actes**.
Un contrat signé par les deux parties, un apport confirmé par l'entreprise apportée, un versement arrivé : ce sont des
actes, et chacun laisse une empreinte qu'on peut recalculer, comparer et frapper.

### A.2 Pourquoi pas le coffre, le sceau ou le registre

| Candidate | Ce qu'elle a de juste | Pourquoi je la refuse comme métaphore centrale |
|---|---|---|
| Le coffre | concret, sombre, désirable ; dit « vos documents sont en sûreté » | un coffre **cache**. Proofseen **montre** : la marque entière repose sur ce qu'on peut voir et vérifier. Et le coffre appelle la porte blindée en 3D, le cadenas partout : le décor que la Forge coupe. Il reste le **nom d'un lieu** (l'écran « Coffre »), pas l'idée. |
| Le sceau | c'est le geste de la signature | il entre en concurrence avec le poinçon : deux marques de garantie dans une seule marque, le visiteur ne sait plus laquelle compte. Le sceau devient le **nom d'un geste** (« apposer le sceau »), qui frappe le poinçon existant. |
| Le registre | ajout seul, daté, vrai ; relie argent, documents, journal | c'est l'atmosphère que le founder a rejetée en v1 (« journal de news », `BRAND_BOOK_V2.md:3-7`). Il reste la **forme technique** (chaîne d'empreintes, journal en ajout seul, `schema.prisma:1757`), pas l'image. |
| **L'empreinte** | relie les trois : le coffre garde des empreintes, le sceau frappe une empreinte, le registre enchaîne des empreintes | une seule image, déjà dans la marque (le poinçon laisse une empreinte), déjà dans le code (SHA-256), et **calculable** : on peut la dessiner sans rien inventer. |

### A.3 Le poinçon d'empreinte (le motif de la phase 2)

Un dessin déterministe calculé à partir des 256 bits de l'empreinte SHA-256 d'un document figé (PDF ou HTML canonique).
Précédent réel : l'art aléatoire des clés d'hôte d'OpenSSH (VisualHostKey), qui sert à reconnaître une clé d'un coup
d'oeil. Ici, même rôle : **reconnaître**, jamais suffire à vérifier.

Faits d'orfèvrerie retenus (source : fr.wikipedia.org, article « Poinçon de maître », lu le 2026-10-24) : le poinçon de
maître français est « en forme de losange » pour les ouvrages aux titres légaux ; le poinçon de titre est apposé par
l'État ou son délégataire après un essai ; le poinçon « de responsabilité » est celui du fabricant ou de l'importateur.

Spécification pour Sumi (forme) et Tetsu (calcul) :

- **Cadre** : un losange, comme le poinçon de maître. Jamais un cercle, jamais un écusson.
- **Contenu** : une grille de cases inscrite dans le losange, chaque case pleine ou vide selon un bit ; des encoches sur
  les quatre bords selon d'autres bits. Sumi fixe la grille exacte (lisibilité à 96 px) ; la règle est que deux
  empreintes qui diffèrent d'un seul bit d'entrée donnent deux dessins visiblement différents (effet d'avalanche du
  SHA-256, donc environ la moitié des bits changent).
- **Toujours accompagné** des seize premiers caractères de l'empreinte en PS Mono, groupés par quatre
  (`7F3A 91C2 0B4E D2A8`), et de l'empreinte complète dans le dossier de preuve. Le dessin aide l'oeil ; la chaîne fait foi.
- **Tailles** : 16 px (liste, losange seul et son état), 32 px (carte, encoches seules), 96 à 160 px (document,
  cérémonie, `/verifier`, grille complète).
- **États** (A.4) : filet `--ps-line-strong` (déposé), filet `--ps-signal` et mot « À signer » (à l'essai), plein
  `--ps-proof` avec `--ps-glow-proof` et la phrase datée (poinçonné). Le vert n'arrive que quand **toutes** les parties
  ont signé et que l'horodatage est enregistré.
- **Accessibilité** : `role="img"`, nom accessible « Empreinte du document, 7F3A 91C2 0B4E D2A8, signé par les deux
  parties le 24 octobre 2026 ». Le dessin n'est jamais la seule porteuse de l'état : le mot l'est.
- **Calcul** : fonction pure `lib/viz/hallmark.ts` (bits vers géométrie), testée sur des vecteurs fixes ; rendu SVG
  serveur ; même fonction côté client pour `/verifier` (îlot), aucune autre dépendance que `crypto.subtle.digest`.

### A.4 Les trois états, étendus aux actes

| Acte | Déposé (filet, encre) | À l'essai (ambre et mot, échéance en mono) | Poinçonné (vert, phrase datée, source) |
|---|---|---|---|
| Document | généré depuis un gabarit, empreinte calculée | envoyé aux signataires, « 1 signature sur 2, expire le 7 novembre 2026 » | « Signé par les deux parties le 24 octobre 2026 », empreinte, horodatage |
| Apport d'affaires | déposé par l'apporteur, daté à la seconde | en attente de la confirmation de l'entreprise apportée | « Apport confirmé par l'entreprise le … » |
| Commission d'apport | calculée sur un fait | due, en attente du versement de la mission | « Versée le … » (fait lu chez le prestataire de paiement) |
| Portage | demande d'adhésion | conventions à signer, attestation de garantie financière à lire | « Adhésion signée le … » ; la garantie financière vérifiée a sa propre ligne poinçonnée |
| Versement | paiement ouvert | fonds sous séquestre (`Payment.status = held`, `schema.prisma:152`) | « Versé le … » (`Payment.releasedAt`, `schema.prisma:768`) |

### A.5 La couleur dans la phase 2 (règles ajoutées au livre de marque)

- **Vert** : seulement un acte poinçonné lu en base. Toute nouvelle utilisation s'ajoute à la liste triée de
  `apps/web/test/seal.test.ts`.
- **Violet** : la lumière de l'action (focus, sélection dans la Tour, ligne survolée, palette de commandes) et la
  mesure (simulateurs, calculs). Un simulateur de portage est violet, jamais vert : c'est un calcul, pas un fait.
- **Ambre** : ce qui attend quelqu'un, avec son mot et son échéance.
- **Comparaison de versions** : **interdit d'utiliser le vert pour un ajout**. Ajout : soulignement `--ps-aura-text` et
  marque « + » en marge ; retrait : texte barré en `--ps-muted` et marque « − » en marge ; clause modifiée : filet
  `--ps-signal` en marge et le mot « Modifiée ». Le diff vert et rouge de GitHub dirait « vérifié » à chaque ligne ajoutée.
- **Danger** (`--ps-danger`) : litige, refus, expiration dépassée. Jamais pour une simple attente.

### A.6 Les cinq moments signatures et le scénario d'ouverture

| # | Moment | Écran | Pourquoi il compte |
|---|---|---|---|
| M1 | **La frappe de l'empreinte** : la dernière signature tombe, le losange se remplit et se frappe | cérémonie de signature (D.1) | c'est l'instant où un contrat devient preuve ; on ne le vit qu'une fois par contrat |
| M2 | **Les deux empreintes** : deux versions côte à côte, deux losanges différents, les clauses qui ont bougé | coffre, comparaison (D.3) | on voit d'un coup que deux PDF au même nom ne sont pas le même document |
| M3 | **La généalogie d'une preuve** : depuis le cartouche vert d'une mission, remonter au contrat, aux signatures, au versement, à la facture | profil, preuves, coffre (C, V4) | un badge seul demande qu'on le croie ; ici on ouvre ce sur quoi il repose |
| M4 | **Le flux** : l'argent d'une affaire en un seul dessin, de l'entreprise au freelance, commission et TVA comprises | contrat (C, V1) | le freelance et l'entreprise voient la même vérité, commission et TVA comprises (ce que montrent les concurrents sur ce point : à relever en veille) |
| M5 | **La Tour au calme** : « Rien n'attend. Dernière décision à 09:42 » ; ou les files classées par échéance | Tour, Aujourd'hui (B.4) | un opérateur sait en une seconde s'il peut fermer l'onglet |

**Scénario d'ouverture (celui qui arrête un humain) : `/verifier`.**
Une page publique, sombre, l'aurore du héros, une seule phrase : « Déposez un document Proofseen. Il ne quitte pas
votre ordinateur. » La personne dépose un PDF. 0 ms : le nom du fichier s'affiche. 0 à 300 ms : le navigateur calcule
l'empreinte (`crypto.subtle.digest`, aucun envoi). 300 à 940 ms : le losange se trace case par case dans l'ordre des
bits (le dessin est déjà là au filet, la trace l'encre, `--ps-dur-trace` 640 ms). 940 ms : seule l'empreinte part au
serveur (64 caractères). Réponse connue et scellée : frappe (140 + 120 ms, puis encre 240 ms, les gestes existants de
`packages/brand/seal.css`) et la phrase « Signé par 2 parties le 24 octobre 2026, version 3 ». Réponse inconnue : le
losange reste à l'encre, et la phrase dit « Proofseen ne connaît pas cette empreinte. Si ce document vient de
Proofseen, il a été modifié depuis sa signature. » Puis : « Changez une virgule et recommencez : le dessin change. »
Sans JS : un champ où coller l'empreinte imprimée en pied de page du PDF. Mouvement réduit : le dessin et l'état
s'affichent d'un coup. Ce que la page ne dit jamais : qui sont les signataires (le seul fait de connaître une empreinte
ne donne aucun nom).

---

## B. La Tour de contrôle (refonte du back-office opérateur)

### B.1 Ce qui existe, mesuré dans le code

| Constat | Preuve |
|---|---|
| Dix sections en liste plate, sans regroupement | `components/operator/OperatorParts.tsx:7-18` (overview, moderation, community, contacts, verifications, users, feedback, funnel, measurements, journal) |
| L'accueil est six compteurs nus, sans âge ni échéance | `app/[lang]/app/operateur/page.tsx:36-43` |
| Un fichier « parties » mélange navigation, retour d'action, champ de motif, champ caché de langue | `OperatorParts.tsx:20-64` |
| 17 balises `<table>` écrites à la main dans 15 fichiers, avec deux systèmes de classes : `.ops` (13) et `.op-table` (2) | `grep "<table"` sur `apps/web/src` le 2026-10-24 |
| Le journal filtre par formulaire GET, sans lien entre une ligne et le dossier de la cible au-delà du filtre | `operateur/journal/page.tsx:105-118` |
| La page d'un compte titre sur l'adresse e-mail en clair | `operateur/utilisateurs/[id]/page.tsx` (h1 `summary.email`) |
| **L'argent qui demande une personne n'a aucun écran** : `Payment.needsReviewAt` et `Payment.disputeOpenedAt` existent (`schema.prisma:772-775`) et ne sont lus que par `packages/db/src/payments.ts` et `validation-reminders.ts`, jamais par une page de `apps/web` | `grep -rln needsReviewAt apps/web/src packages/db/src` le 2026-10-24 |
| La modération est réactive : l'opérateur tape une référence pour masquer ; aucune file de signalements venus des utilisateurs | `operateur/moderation/page.tsx` ; aucun modèle de signalement dans le schéma |
| Ce qui est bon et se garde : le rôle vérifié avant tout dessin (`operateur/layout.tsx:17-24`), le journal en ajout seul écrit dans la même transaction que l'action (`schema.prisma:1753-1773`), le motif obligatoire, le seul vert de l'écran sur une attestation vérifiée (`VerificationQueues.tsx:20-42`) | |

### B.2 Architecture d'information

Une barre latérale de quatre groupes, pas dix liens. Les adresses restent sous `/[lang]/app/operateur` (les anciennes
redirigent en 308) ; le libellé visible devient « Tour de contrôle ».

| Groupe | Entrées | Ce qu'on y fait |
|---|---|---|
| **Aujourd'hui** | une seule page | tout ce qui attend une décision, toutes files confondues, trié par échéance puis par ancienneté (jamais par personne) |
| **Files de revue** | Modération · Premiers contacts · Identités · Attestations · Apports à valider · Signatures · Litiges · Versements · Rapprochement | décider, avec motif, une ligne à la fois ou par lot |
| **Registres** | Personnes · Entreprises · Contrats · Coffre (métadonnées) · Factures · Journal | lire un dossier complet, retrouver une décision |
| **Observatoire** | Entonnoir (existe) · Mesures (existe) · Flux d'argent de la plateforme · Délai de signature · Âge des files | comprendre la plateforme, jamais noter quelqu'un |
| (pied) | Articles · Retours · Raccourcis | contenu et aide |

### B.3 Les files de revue

Chaque file est une **configuration**, pas une page écrite à la main : source de données, colonnes, règle d'entrée,
échéance, actions, inspecteur. Les échéances sont des règles datées dans un fichier de règles (Thomas Vidal les
propose, le founder les valide) ; aucune n'est inventée ici.

| File | Entre dans la file quand | Donnée | Actions (toujours avec motif si elles touchent quelqu'un) | Vert possible |
|---|---|---|---|---|
| Modération | un contenu est signalé, ou un opérateur ouvre une référence | **à créer** : modèle de signalement (auteur, cible, motif fermé, date) ; existe : masquage et restauration (`OperatorActionKind`, `schema.prisma:1714-1737`) | masquer, restaurer, classer sans suite | non |
| Premiers contacts | premier message d'une entreprise récente | existe : `ContactReview.flaggedAt`, `reviewedAt`, `outcome` (`schema.prisma:1782-1792`) | rien à redire, fermer le fil | non |
| Identités | un signataire, un apporteur ou un porté doit être identifié ; un compte de versement n'est pas actif | **à créer** : vérification d'identité (statut fourni par le prestataire choisi par le founder, jamais la pièce elle-même dans la Tour) ; existe : `BillingIdentity.payoutsEnabledAt` (`schema.prisma:374`) | relancer, refuser avec motif | oui, l'accusé « identité vérifiée le … » |
| Attestations | attestation URSSAF déclarée ; bientôt garantie financière de portage, pack fournisseur | existe : `VigilanceAttestation` (`schema.prisma:392-410`) ; **à créer** pour les autres pièces | vérifier (code de sécurité), refuser | oui, existe déjà (`VerificationQueues.tsx:27-42`) |
| Apports à valider | un apport est contesté (deux apporteurs pour la même entreprise, entreprise déjà cliente, apport sur soi-même) | **à créer** : apport, empreinte, fenêtre d'attribution | trancher l'antériorité, refuser | non (le vert vient de l'entreprise apportée, pas de l'opérateur) |
| Signatures | enveloppe bloquée : expirée, trop d'essais de code, signataire qui conteste | **à créer** : enveloppe, signataire, événement | relancer, annuler l'enveloppe (jamais signer à la place) | non |
| Litiges | litige de paiement ouvert ; preuve d'adresse contestée ; litige de mission (L8) | existe : `Payment.disputeOpenedAt`, `disputeWon` (`schema.prisma:772-773`) ; disputes d'adresses (`proof-disputes.ts`) ; **à créer** : litige de mission | joindre les pièces du coffre, décider, révoquer une preuve | non |
| Versements | `Payment.needsReviewAt` posé ; versement `releasing` bloqué ; fonds `held` sans validation après l'échéance | existe : `schema.prisma:756-786` | relancer la validation, signaler au Trésor ; jamais un versement manuel depuis l'écran sans le GO du founder | non |
| Rapprochement | écart entre l'événement du prestataire, le paiement et la facture | partiel : `StripeEvent` ne garde que `id`, `type`, `receivedAt` (`schema.prisma:847-853`) ; **à créer** : montants des mouvements du prestataire | marquer expliqué, ouvrir un dossier comptable | non |

### B.4 Les écrans

1. **Aujourd'hui.** En tête, une rangée de `KpiTile` : une par file, avec trois chiffres seulement : en attente, la plus
   ancienne (« depuis 3 j »), en retard sur l'échéance. Aucune flèche de tendance tant que l'historique n'existe pas
   (il n'est pas stocké). Dessous, la liste unifiée (`DataTable`), une ligne par élément : file, sujet (référence en
   mono, jamais un nom de personne en premier), âge, échéance, qui l'a pris. À zéro : M5, « Rien n'attend. Dernière
   décision à 09:42 par vous », et le lien vers le journal.
2. **File + Inspecteur.** Écran partagé : la liste à gauche, l'inspecteur à droite (`?voir=<id>` dans l'adresse, rendu
   par le serveur, donc lisible sans JS, partageable entre opérateurs, et le bouton retour marche). L'inspecteur porte :
   les faits de l'élément, la frise de ses événements (`AuditTimeline`), les pièces du coffre en métadonnées, les
   actions avec motif. Sur 375 px, l'inspecteur est sa propre page.
3. **Dossier d'une personne ou d'une entreprise.** Faits vérifiés et déclarés séparés, contrats, documents, argent
   (V1 agrégé, V3), décisions passées (journal filtré), suspension. L'adresse e-mail est **masquée par défaut**
   (`a•••@domaine.fr`) et se révèle par un bouton qui écrit une ligne au journal (à créer : `OperatorActionKind`
   `personal_data_revealed`) : la Tour voit tout, mais pas sans laisser de trace.
4. **Contrat.** Le fil de l'affaire existant (`lib/deal-steps.ts`), V2 la frise, V1 le flux, les documents et leurs
   empreintes, les validations (`ContractApproval`, `schema.prisma:812-826`).
5. **Rapprochement.** Trois colonnes (prestataire, paiement Proofseen, facture), une ligne par mouvement, un trait qui
   relie ce qui concorde, une rupture ambre là où ça ne concorde pas (V10).
6. **Journal.** L'existant, plus : chaque ligne ouvre l'inspecteur de sa cible ; une vue frise par cible.
7. **Recherche** (`/operateur/recherche?q=`). La page sans JS de la palette de commandes (B.5).

### B.5 La palette de commandes

- `Ctrl+K` (et `Cmd+K`), ou le bouton « Rechercher ou agir » toujours visible en haut de la barre latérale.
- Elle **trouve** par identifiant exact ou préfixe : référence `FR-XXXXX`, numéro de facture, début d'un identifiant
  de contrat ou de document, empreinte (seize caractères). Par adresse e-mail : seulement l'adresse complète, jamais
  une recherche partielle sur les personnes (minimisation).
- Elle **ouvre** une file, un dossier, un écran (« Aller à Versements »).
- Elle **prépare** une action (« Vérifier l'attestation de FR-7H2XK ») : elle ouvre l'inspecteur sur le formulaire
  avec son champ de motif. **Elle n'exécute jamais une décision d'une seule touche.**
- Technique : `<dialog>` natif et motif combobox des ARIA Authoring Practices ; résultats d'une route serveur réservée
  à l'opérateur (même garde que `operatorOnly`), limitée en débit, trois caractères minimum ; îlot chargé au premier
  appel (`import()` dynamique), cible 6 Ko compressés. Sans JS : le bouton est un lien vers `/operateur/recherche`.

### B.6 Le clavier

| Touche | Effet | Portée |
|---|---|---|
| `Ctrl+K` | palette | partout dans la Tour |
| `j` / `k` | ligne suivante / précédente | liste ayant le focus |
| `Entrée` | ouvrir l'inspecteur | liste |
| `Échap` | fermer l'inspecteur, puis la palette | partout |
| `x` | cocher la ligne (action par lot) | liste |
| `g` puis `a`, `m`, `v`, `l`, `j` | aller à Aujourd'hui, Modération, Versements, Litiges, Journal | partout |
| `/` | aller au filtre | liste |
| `?` | aide des raccourcis | partout |

Règle d'accessibilité (WCAG 2.1, critère 2.1.4, raccourcis d'un seul caractère) : les raccourcis d'une lettre sont
**actifs seulement quand la liste a le focus**, et un réglage les coupe. Aucune action n'existe au clavier seulement ni
à la souris seulement. Ordre de tabulation = ordre de lecture ; anneau `--ps-focus` de 2 px.

### B.7 La structure des composants (arborescence proposée sous `apps/web/src/components/`)

```
components/
  ui/                         socle sans vocabulaire métier ; serveur d'abord ; chaque fichier importe sa feuille styles/ui/*.css
    table/      DataTable.tsx · columns.ts · SortLink.tsx · BulkBar.tsx
    filter/     FilterBar.tsx · FilterChip.tsx · SavedView.tsx
    layout/     SplitView.tsx · Pane.tsx · PageHead.tsx · Section.tsx
    inspector/  Inspector.tsx · InspectorKeys.tsx ("use client", cible 2 Ko)
    command/    CommandPalette.tsx ("use client", chargé à la demande) · command-registry.ts
    keys/       Kbd.tsx · ShortcutsHelp.tsx · shortcuts.ts
    data/       Money.tsx · When.tsx · Ref.tsx · Count.tsx
    status/     StatusTag.tsx (vient de market/) · StateMark.tsx (les trois états, A.4)
    feedback/   EmptyState.tsx (vient de la racine) · Outcome.tsx (vient de OperatorParts) · Notice.tsx
    form/       ReasonField.tsx · ConfirmAction.tsx · LangField.tsx (viennent de OperatorParts)
    kpi/        KpiTile.tsx
  proof/        Seal.tsx · StrikeOnce.tsx (existent) · Hallmark.tsx (poinçon d'empreinte) · ProofLineage.tsx
  viz/          serveur seulement, aucun "use client" (tenu par un test)
                Figure.tsx (figure, desc, tableau replié) · Bars.tsx (vient de insights/BarChart.tsx)
                MoneyFlow.tsx · DealFrieze.tsx · TreasuryCalendar.tsx · ReferralLanes.tsx · PortageCascade.tsx
                VersionStrata.tsx · SignerProgress.tsx · QueueAges.tsx · ReconciliationLinks.tsx · CycleTime.tsx
  vault/        VaultList.tsx · DocumentCard.tsx · DocumentView.tsx · VersionCompare.tsx · ClauseDiff.tsx
                SignerList.tsx · EvidenceFile.tsx · VerifyDrop.tsx ("use client", /verifier)
  ceremony/     SignatureCeremony.tsx · ReadPane.tsx · ConsentStep.tsx · CodeStep.tsx · SealStep.tsx
  referral/     ReferralForm.tsx · ReferralLedger.tsx · AttributionWindow.tsx
  portage/      PortageEntry.tsx · PortageTriangle.tsx · PortageSimulator.tsx ("use client", cible 5 Ko)
  tower/        remplace operator/
    shell/      TowerShell.tsx · TowerNav.tsx · TowerSearch.tsx
    today/      TodayBoard.tsx
    queues/     QueueView.tsx (liste + inspecteur, générique) · queue-registry.ts (une entrée par file)
                inspectors/ Moderation · FirstContact · Identity · Attestation (vient de VerificationQueues) ·
                            Referral · Signature · Dispute · Payout · Reconciliation
    dossiers/   PersonDossier.tsx · CompanyDossier.tsx · ContractDossier.tsx
    journal/    AuditTimeline.tsx
  deal/         vient de market/ : DealThread · QuotesSection · EscrowPayment · PaymentReturn
  money/        vient de market/ : InvoiceList · PayoutAccountButton · BillingForm
  mission/      vient de market/ : MissionForm · ApplicantsBoard · ProfilesForMission · MatchReasons · MissionCounts
  (insights/, profile/, search/, visibility/, community/, registre/, landing/ : inchangés, sauf les graphiques qui passent dans viz/)
lib/viz/        fonctions pures et testées : scale.ts · sankey.ts · frieze.ts · calendar.ts · lineage.ts · hallmark.ts · cascade.ts
```

Contrats des primitives (ce qu'elles garantissent, pour Tetsu) :

| Primitive | Garantit | Ne fait jamais |
|---|---|---|
| `DataTable` | `<table>` réel avec `<caption>`, en-têtes `scope`, tri par lien GET (`SortLink`, état dans l'adresse), en-tête collant, nombres en `tabular-nums`, ligne entière cliquable par un lien étiré (comme `.op-tiles`, `operator.css:12`), sélection par cases natives dans un `<form>` (le lot marche sans JS), état vide et erreur fournis, défilement horizontal dans son cadre à 375 px | trier des personnes par un score ; virtualiser (au-delà de 50 lignes on pagine) |
| `FilterBar` | formulaire GET, puces des filtres actifs retirables par lien, vues enregistrées = adresses | filtrer côté client seulement |
| `Inspector` | panneau rendu serveur depuis `?voir=`, titre `h2`, focus déplacé sur le titre à l'ouverture (îlot), `Échap` ferme | s'ouvrir sans que l'adresse change |
| `AuditTimeline` | une ligne par événement (journal opérateur + événements de domaine), date `<time>`, acteur (rôle, jamais l'e-mail par défaut), motif, lien vers la cible | réécrire ou masquer une ligne |
| `KpiTile` | un compte, sa définition en une phrase, son âge le plus ancien, son lien ; chiffre posé, jamais roulé | une tendance sans historique stocké |
| `QueueCard` (ligne de file en vue carte, mobile) | sujet, âge, échéance, qui l'a prise, actions | un nom de personne avant la référence |
| `MoneyFlow` | V1 | voir C |
| `Money` | centimes entiers vers texte (`Intl.NumberFormat`), signe, devise, `tabular-nums` | un calcul ; il affiche seulement |

### B.8 Ce qui doit être cassé

| Aujourd'hui | Sort | Pourquoi |
|---|---|---|
| `components/operator/OperatorParts.tsx` | éclaté en `tower/shell/TowerNav`, `ui/feedback/Outcome`, `ui/form/ReasonField`, `ui/form/LangField` | quatre responsabilités dans un fichier |
| `SECTIONS` plat (`OperatorParts.tsx:7-18`) | `tower/shell` à quatre groupes (B.2) | dix liens sans hiérarchie |
| `.op-tiles` et l'accueil à six compteurs (`operateur/page.tsx:36-55`) | `KpiTile` + `TodayBoard` | un compte sans âge ne dit pas ce qui presse |
| 17 tableaux écrits à la main, classes `.ops` et `.op-table` | `DataTable` | deux styles, aucune garantie commune (tri, vide, 375 px) |
| `operateur/moderation`, `contacts`, `verifications`, `communaute`, `retours` (pages séparées) | `tower/queues/QueueView` + `queue-registry` ; anciennes adresses en 308 | une file = une configuration, pas une page |
| `components/operator/VerificationQueues.tsx` | `tower/queues/inspectors/Attestation` (son accusé vert se garde tel quel) | |
| `components/insights/BarChart.tsx` + `lib/chart.ts` | `viz/Bars.tsx` + `lib/viz/scale.ts` | un seul endroit pour les figures |
| `components/market/` (26 fichiers de nature différente) | `deal/`, `money/`, `mission/` | un dossier fourre-tout ne se relit pas |
| `operator.css` | `styles/ui/*.css` + `styles/tower.css` | les primitives portent leur style |
| Ce qui ne se casse pas | `operatorOnly` dans la mise en page, `recordAction` dans la transaction, journal en ajout seul, tests `operator-access.test.ts` | c'est la colonne vertébrale de la confiance |

---

## C. Les visualisations

### C.0 Règles communes (aucune exception)

1. **Faits, argent, temps. Jamais une note sur une personne.** Aucune visualisation n'ordonne, ne compare, ne colore ni
   ne dimensionne des personnes entre elles. `Review.rating` (`schema.prisma:908`) n'est jamais agrégé ni dessiné.
   `VisibilityResult.top5` (`schema.prisma:968`) est un compte de ce que disent les moteurs d'IA, montré au seul
   freelance concerné, jamais comparé à d'autres.
2. **Aucune date inventée.** Un événement sans date en base est dessiné sans position temporelle (« à la validation »),
   jamais placé à une date déduite. Les dates d'acceptation du devis et de mise sous séquestre n'existent pas
   (`packages/db/src/deal-dates.ts:6-10`) : L1 les ajoute, aucune figure ne les suppose avant.
3. **Forme lisible sans couleur** : hachures pour « à l'essai », plein pour « fait », filet pour « à venir » ; chaque
   valeur écrite ou dans le tableau.
4. **Accessibilité** : `<figure>`, `<svg role="img" aria-labelledby>` avec une `<desc>` d'une phrase, puis un tableau
   de toutes les valeurs dans un `<details>` (motif déjà en place, `components/insights/BarChart.tsx:31-58`).
5. **Rien de caché** : l'état final est dans le HTML ; un mouvement part toujours d'un dessin visible ; transform et
   opacité seulement ; une fois, sur un événement réel ; figé en mouvement réduit ; en pause hors écran.
6. **Deux figures au plus par écran**, 400 éléments SVG au plus chacune.

### C.1 Les onze figures

**V1. Le flux d'une affaire** (`viz/MoneyFlow`, moment M4)
- Donnée : existe : `Payment.amountCents`, `commissionCents`, `refundedCents` (`schema.prisma:759-761`) ;
  `Invoice.netCents`, `vatCents`, `vatRateBp`, `kind` (`schema.prisma:873-898`) ; `Contract.repeatClient` (taux de
  fidélité, `schema.prisma:727`). À créer : part de l'apporteur ; frais et cotisations du portage.
- Sens : où va chaque euro d'une affaire. Entreprise, séquestre, puis freelance (ou société de portage), commission ou
  frais de service, TVA, et (si un apport existe) la part de l'apporteur, prise sur la commission de Proofseen et
  jamais sur le contrat client-freelance (Régl. §1.5, Flux §2 P2).
- Modèle : la figure ne choisit pas qui paie la commission (décision D5 du founder ; recommandation de Camille au bus,
  L0-007 : l'entreprise paie des frais de service, le freelance 0 %). Elle dessine le parcours que le contrat a figé.
  Ses fixtures de test sont les parcours chiffrés du Trésor (Flux §2 : P1, P1-bis, P2, P3), avec leurs mentions
  HYPOTHÈSE, jamais des montants inventés par la Forge. Exemple P2 : 12 000,00 du client, 10 800,00 au freelance,
  360,00 à l'apporteur, 840,00 à Proofseen.
- Qui : freelance et entreprise (leur affaire), apporteur (seulement le nœud de sa part et son origine), opérateur
  (agrégé par mois, toute la plateforme).
- Forme : Sankey de gauche à droite, colonnes dans l'ordre réel de l'argent, épaisseur proportionnelle aux centimes,
  montant écrit sur chaque nœud. Nœud final « Versé le … » en vert seulement si `releasedAt` existe.
- Mouvement : une seule lueur violette parcourt chaque lien une fois, dans l'ordre de l'argent (`offset-path`,
  900 ms, décalage 120 ms par lien). Le dessin est complet avant, pendant et après.
- AI Act : aucun enjeu, ce sont des montants d'une affaire.
- Contradiction relevée : `packages/db/src/freelance-insights.ts:59` calcule la TVA de la commission à 2000 points de
  base écrits en dur. V1 doit lire la TVA de la facture de commission (`Invoice.vatRateBp`), pas ce taux. CHALLENGE à
  Bertrand Lacombe et Maxwell (I).

**V2. La frise de l'affaire** (`viz/DealFrieze`)
- Donnée : existe : `Conversation.decidedAt`, `Contract.acceptedByFreelanceAt` et `acceptedByOrgAt`
  (`schema.prisma:734-735`), `ContractApproval.approvedAt` (`:817`), `Payment.releasedAt` (`:768`),
  `VerifiedMission.verifiedAt` (`:467`), `Timesheet.month`, `submittedAt`, `decidedAt` (`:788-810`), `Invoice.issuedAt`,
  `dueOn` (`:889-890`). À créer : `Quote.acceptedAt`, `Payment.heldAt`, événements de signature, et le cycle de vie
  de chaque facture renvoyé par la plateforme agréée (déposée, reçue, acceptée, refusée, encaissée, Régl. §4.5), avec
  l'acceptation par le freelance des factures émises sous mandat (Régl. §4.3, point 3), qui devient une ligne « à
  accepter » de son coffre.
- Sens : le temps réel d'une affaire, du premier échange à la mission vérifiée ; en régie, les mois et leurs relevés.
- Qui : freelance, entreprise, opérateur.
- Forme : axe du temps à l'échelle des vraies dates (`d3-scale` côté serveur), un jalon par étape aux tons de
  `lib/deal-steps.ts` (encre, ambre, filet, vert final), un curseur « aujourd'hui » ; en régie, une bande par mois.
- Mouvement : la ligne est tracée au filet ; à l'ouverture, une lueur la parcourt de l'origine à aujourd'hui
  (640 ms, `--ps-dur-trace`).
- AI Act : aucun enjeu ; jamais de comparaison « plus lent que la moyenne » pour une personne.

**V3. Le calendrier de trésorerie** (`viz/TreasuryCalendar`)
- Donnée : existe : `Invoice.dueOn`, `Payment.status` (`held`, `released`), `releasedAt`, `Timesheet` validés ;
  agrégats mensuels déjà calculés (`packages/db/src/freelance-insights.ts:71-87`, `company-insights.ts:76-91`).
- Sens : pour le freelance, l'argent reçu et celui qui arrive ; pour l'entreprise, ce qu'elle doit et quand.
- Qui : freelance, entreprise ; pour un porté, ce qui est versé à sa société de portage (Proofseen ne connaît pas son
  salaire, Flux §2 P3).
- Forme : douze semaines en lignes, sept jours en colonnes ; chaque jour porte des barres écrites en montants ; passé
  à l'encre, échéance à venir au filet ambre, fonds sous séquestre hachurés avec le mot « à la validation » **sans date**
  (la date de versement dépend d'une validation qui n'a pas eu lieu).
- Mouvement : aucun. C'est un outil consulté souvent.
- AI Act : aucun enjeu.

**V4. La généalogie d'une preuve** (`proof/ProofLineage`, moment M3 ; c'est la « constellation des preuves » ramenée
à ce qu'elle doit dire)
- Donnée : existe : `VerifiedMission.confirmationId`, `contractId` (`schema.prisma:472-474`), le contrat, ses
  validations, son paiement, ses factures ; `OwnedUrl.verifiedAt` (`:442`), `BillingIdentity.registryCheckedAt`
  (`:377`), `VigilanceAttestation.verifiedAt` (`:398`). À créer : documents et signatures liés.
- Sens : sur quoi repose un cartouche vert. Le cartouche « payée sur Proofseen » remonte au versement, au contrat signé,
  à ses empreintes, à la facture.
- Qui : le freelance pour ses propres preuves ; l'entreprise qui lit un profil (seulement ce qui est public) ; l'opérateur.
- Forme : un graphe orienté de gauche à droite, quatre à huit nœuds, le cartouche à droite, ses sources à gauche ; pas
  d'étoiles qui scintillent, pas de nœud plus gros parce qu'il « compte plus ».
- Mouvement : les liens sont visibles au filet ; à l'ouverture, ils s'encrent un par un du cartouche vers les sources
  (240 ms chacun).
- AI Act : une preuve d'une personne, jamais deux généalogies côte à côte, aucune somme ni score.

**V5. Les couloirs d'apports** (`viz/ReferralLanes`, le pipeline)
- Donnée : **tout à créer** : apport (empreinte, date à la seconde, entreprise, statut), lien vers mission, contrat,
  paiement, commission.
- Sens : où en est chacun de mes apports, et combien il me rapportera, calcul écrit.
- Qui : l'apporteur (les siens) ; l'opérateur (comptes par étape, jamais par apporteur).
- Forme : une ligne par apport, huit étapes en colonnes (déposé, confirmé par l'entreprise, mission publiée, contrat
  signé, payé et libéré, commission en garde, commission due, commission versée), marque à chaque étape franchie,
  montant prévu écrit avec sa formule (« part de la commission Proofseen HT, née à la libération, payable fin du mois
  suivant », règle du fait générateur, Flux §3.4), fenêtre d'attribution en barre qui se vide (V5b,
  `AttributionWindow`, 12 mois recommandés, Flux §3.3). Le taux vient de la configuration validée par le founder ;
  tant qu'il n'existe pas, la colonne dit « taux à fixer ». Une commission suspendue (litige ouvert) ou reprise (avoir)
  porte son mot, en danger ou en ambre.
- Mouvement : la marque d'une étape franchie depuis la dernière visite se frappe une fois (îlot `StrikeOnce`
  existant, `components/proof/StrikeOnce.tsx`).
- AI Act : **aucun classement d'apporteurs**, aucun palier, aucun « top ». L'opérateur voit des comptes d'apports.

**V6. La cascade du portage** (`viz/PortageCascade` + simulateur)
- Donnée : **à créer**. Les frais de gestion et la réserve sont ceux du partenaire choisi par le founder ; les sources
  secondaires citent 5 à 10 % (Régl. §2.1, non confirmé). La rémunération minimale à défaut d'accord est 75 % du
  plafond mensuel de la sécurité sociale (L1254-2 II, Régl. §2.1), soit 3 004 EUR brut sur le PMSS 2026 de 4 005 EUR ;
  les taux de branche (70, 75, 85 %) restent NON CONFIRMÉS. Le salaire et le compte d'activité mensuel sont produits
  par la société de portage (L1254-25), jamais par Proofseen (Régl. §2.5).
- Sens : de ce que paie l'entreprise cliente à ce qui arrive sur le compte du porté, chaque marche avec sa règle et sa
  source. Le premier tronçon (client, séquestre, société de portage, frais de service de Proofseen facturés à
  l'entreprise) est un fait de Proofseen (Flux §2 P3) ; la suite est une **simulation** aux taux publiés du partenaire,
  le réel arrivant sur son compte d'activité.
- Qui : le porté (et le visiteur de `/portage`, en simulation).
- Forme : une cascade horizontale (barre de départ, marches descendantes, barre d'arrivée), chaque marche nommée,
  chiffrée, sourcée (« taux du partenaire au 1er novembre 2026 »). Violet : c'est un calcul. Le bulletin réel, lui,
  arrive au coffre.
- Mouvement : en simulation, les marches suivent le curseur du TJM sans animation propre (la valeur change, la forme
  suit en 160 ms).
- AI Act et vérité : jamais « vous gagnerez » ; toujours « simulation, pas une promesse ».

**V7. Les strates de versions** (`viz/VersionStrata`, moment M2)
- Donnée : **à créer** : document, version, empreinte, auteur de la version, date. Existe en appui : `StoredFile.sha256`
  (`schema.prisma:1354`), donc le stockage sait déjà empreindre un fichier.
- Sens : l'histoire d'un document, version par version, et ce qui a changé entre deux.
- Qui : les parties du document ; l'opérateur (métadonnées).
- Forme : les versions empilées comme des strates, chacune avec son poinçon d'empreinte à 32 px, la version signée
  poinçonnée ; un clic sur deux strates ouvre la comparaison (D.3).
- Mouvement : aucun en liste ; à la comparaison, les deux poinçons se posent côte à côte (320 ms, `--ps-dur-reveal`).
- AI Act : aucun enjeu.

**V8. La progression des signataires** (`viz/SignerProgress`)
- Donnée : **à créer** : enveloppe, signataire (rôle, ordre), événements (envoyé, ouvert, code vérifié, signé, refusé,
  expiré) datés.
- Sens : qui doit encore signer, depuis quand, jusqu'à quand.
- Qui : les parties, l'opérateur (file Signatures).
- Forme : une ligne par signataire, quatre jalons, l'échéance en mono ; le poinçon d'empreinte au bout, qui ne se
  remplit qu'à la dernière signature.
- Mouvement : seulement la frappe finale (M1).
- AI Act : aucun enjeu.

**V9. L'âge des files** (`viz/QueueAges`, Tour)
- Donnée : existe pour une partie : `ContactReview.flaggedAt` et `reviewedAt` (`schema.prisma:1785`),
  `VigilanceAttestation.createdAt`, `Payment.needsReviewAt`, `Feedback.createdAt` ; à créer pour les nouvelles files.
- Sens : ce qui vieillit dans chaque file, par rapport à son échéance.
- Qui : opérateur.
- Forme : une barre horizontale par file, découpée en tranches d'âge (moins de 24 h, 1 à 3 j, au-delà de l'échéance),
  chaque tranche comptée ; au-delà de l'échéance, ambre et le mot « en retard ».
- Mouvement : aucun.
- AI Act : des éléments, jamais des opérateurs comparés entre eux (aucune vitesse par opérateur).

**V10. Le rapprochement** (`viz/ReconciliationLinks`, Tour)
- Donnée : partielle : `Payment`, `Invoice` existent ; `StripeEvent` sans montant (`schema.prisma:847-853`) ; **à créer** :
  mouvements du prestataire avec montant.
- Sens : chaque euro reçu a son paiement et sa facture.
- Qui : opérateur, Trésor.
- Forme : trois colonnes, un trait par concordance, une rupture ambre et l'écart écrit en centimes là où ça ne concorde
  pas. Un virement qui ne porte pas la charge du client comme transaction source (défaut K2 relevé par Camille au bus,
  L0-008, `packages/payments/src/stripe.ts:114`) se dessine comme une rupture : le trait part du solde commun, pas de
  la charge. Les rapprochements de chaque nuit du Trésor (Flux §4.4) en sont la source.
- Mouvement : aucun.
- AI Act : aucun enjeu.

**V11. Le délai jusqu'à la signature** (`viz/CycleTime`, le chiffre qui dit si on gagne, `PROMPTS_LEGENDS.md:71-72`)
- Donnée : existe : `Contract.createdAt`, `acceptedByFreelanceAt`, `acceptedByOrgAt`. À créer : le moment « mission
  choisie » (`ApplicationStatus.hired` existe, `schema.prisma:102-108`, mais sans date de passage).
- Sens : combien de jours entre « je choisis ce freelance » et « signé des deux côtés ».
- Qui : l'entreprise (ses propres affaires), l'opérateur (toute la plateforme).
- Forme : une distribution en bandes (médiane écrite, n écrit, période écrite).
- Mouvement : aucun.
- AI Act : des affaires, jamais des personnes ; aucune ligne « ce freelance signe vite ».

### C.2 Le choix technique et les budgets

**Recommandation : SVG rendu par le serveur, mises en page écrites en fonctions pures dans `apps/web/src/lib/viz/`,
`d3-scale` et `d3-shape` importés seulement côté serveur.** C'est le chemin déjà pris par le projet (`lib/chart.ts`,
94 lignes, et `BarChart.tsx` « server-drawn SVG, no script, no library », ligne 27).

| Option | Verdict | Raison mesurée |
|---|---|---|
| SVG serveur + `d3-scale` 4.0.2 et `d3-shape` 3.2.0 (licence ISC, `npm view` le 2026-10-24) | **retenu** | 0 Ko de JavaScript client ; lisible sans JS ; texte dans le DOM ; testable par rendu serveur |
| `d3-sankey` 0.12.3 (BSD-3) | **refusé** | il exige `d3-shape ^1.2.0` et `d3-array 1 - 2` (`npm view`, même date) : deux versions de d3 en parallèle pour un graphe de huit nœuds dont on connaît déjà l'ordre des colonnes. Une mise en page en colonnes fixes tient en environ 150 lignes testées (`lib/viz/sankey.ts`) |
| `@visx/sankey` 4.0.0 (MIT) | refusé | il dépend de `d3-sankey` (même problème) et de composants React dont on n'a pas besoin |
| visx en général | refusé comme base | utile pour un tableau de bord riche côté client ; ici tout est serveur |
| Canvas | **refusé** | aucun texte dans le DOM, pas lisible sans JS, pas de lecteur d'écran |

Budgets (Mamori les tient, Kensa les mesure) :
- Figures : **0 Ko de JS client** ; au plus 400 éléments SVG par figure, deux figures par écran ; un test refuse tout
  import de `d3-*` dans un fichier `"use client"`.
- Îlots, cibles en octets compressés, chacun chargé seulement là où il sert : `InspectorKeys` 2 Ko,
  `CommandPalette` 6 Ko (au premier `Ctrl+K`), `VersionCompare` 3 Ko, `PortageSimulator` 5 Ko (il réutilise le même
  module de règles que le serveur), `VerifyDrop` 3 Ko (`crypto.subtle`, natif). Ces cibles sont des **budgets**, pas
  des mesures : Tetsu relève d'abord la base actuelle (`next build`, colonne « First Load JS » par route) avant L1.
- Pages publiques nouvelles (`/verifier`, `/apporteurs`, `/portage`) : Lighthouse mobile performance au moins 0,95,
  accessibilité, bonnes pratiques et SEO à 1, CLS au plus 0,05, mesuré sur le VPS (jamais en local,
  `PROMPTS_LEGENDS.md`, pièges connus).
- Écrans connectés : accessibilité 1, contraste AA ; ils ne se mesurent pas sans session (problème connu,
  `CONNECTED_PLAN.md:333-336`) : rendus serveur sur données de test en attendant les comptes de test du founder.

---

## D. La cérémonie de signature et le coffre

### D.1 Storyboard de la signature d'un contrat, seconde par seconde

Point de départ : la personne arrive depuis une notification ou un lien signé (signataire sans compte, comme
`confirmer-mission/[id]`). Le contrat est figé : son empreinte est calculée avant l'envoi.

| Temps | Ce que voit la personne | Ce que fait le serveur | Mouvement | Mouvement réduit / sans JS |
|---|---|---|---|---|
| **Lecture**, 0 s | à gauche le contrat en HTML lisible (pas seulement un PDF dans un cadre), sommaire des articles ; à droite le rail « Ce que vous signez » : parties, montant, dates, durée, les clauses tirées des **variables du gabarit** (aucune IA), le poinçon d'empreinte au filet et « Version 3, empreinte 7F3A 91C2 0B4E D2A8 » ; en haut, quatre étapes : Lire, Consentir, Recevoir le code, Apposer le sceau | journalise « version 3 affichée à cette personne le … » (la preuve qu'on lui a montré cette version) | aucun ; la lumière violette n'éclaire que le rail | identique ; tout est HTML serveur |
| Lecture, en continu | une marque discrète dans le sommaire suit l'article lu (« Article 7 sur 12 ») | rien (aucun suivi du temps de lecture : ce serait du pistage) | la marque glisse en 160 ms | marque fixe ; sans JS, absente |
| **Consentement**, quand elle veut | deux cases, jamais précochées : « J'ai lu le contrat, version 3, empreinte 7F3A 91C2 0B4E D2A8 » et « J'accepte de le signer électroniquement » ; bouton « Recevoir mon code » | rien avant l'envoi | appui 90 ms | formulaire serveur |
| **Code**, +0 à 2 s | « Code envoyé à a•••@domaine.fr à 14:02:11 » ; six cases, `autocomplete="one-time-code"`, collage accepté ; durée de validité et essais restants écrits | envoie le code, n'en garde que l'empreinte, compte les essais | aucun | un seul champ texte, formulaire serveur |
| Code faux | « Code incorrect, 4 essais restants », focus remis sur le champ | compte l'essai ; au dernier, l'enveloppe passe dans la file Signatures de la Tour | aucun tremblement | identique |
| **Sceau**, +0 ms | appui sur « Apposer mon sceau » | vérifie le code, enregistre l'événement (empreinte du document, identité vérifiée, consentements, horodatage), l'ajoute à la chaîne d'empreintes | appui 90 ms | formulaire serveur, redirection vers l'accusé lu en base |
| +300 ms environ (réponse) | sa ligne dans la liste des signataires passe d'ambre « À signer » à l'encre « Signé le 24 octobre 2026 à 14:03:07 » | | la ligne change en 160 ms | changement immédiat |
| +300 à 1 320 ms, **si c'est la dernière signature** (M1) | le losange se trace case par case puis se **frappe** en vert ; la phrase « Signé par les deux parties le 24 octobre 2026 » ; l'empreinte complète s'affiche | | trace 640 ms, puis frappe et encre (`ps-strike`, `ps-ink`, `packages/brand/seal.css`), une fois, jamais au rechargement (règle de `Seal.tsx:28`) | poinçon posé, aucune frappe |
| Si d'autres doivent signer | le losange reste ambre : « 1 signature sur 2. Nous prévenons Prénom N. » | notifie la partie suivante | aucun | identique |
| **Dossier de preuve**, juste après | « Télécharger le contrat signé » et « Télécharger le dossier de preuve » ; « Vérifier ce document » ouvre `/verifier` | produit le dossier (D.2) | aucun | liens simples |

### D.2 Le dossier de preuve

Un PDF lisible par un juge et un JSON lisible par une machine, avec les mêmes faits : l'empreinte du document signé ; pour
chaque signataire, comment il a été identifié, le texte exact de ses consentements, les horodatages de chaque étape ;
la chaîne des événements, chacun portant l'empreinte du précédent ; et la marche à suivre pour vérifier soi-même
(recalculer l'empreinte du PDF, la comparer, ou ouvrir `/verifier`). Chaque page du contrat signé porte en pied le
poinçon d'empreinte à 16 px, les seize premiers caractères et l'adresse de vérification.

Aligné sur Régl. §3 : signature **simple** faite par Proofseen, avec dossier de preuve, pour les contrats B2B, NDA,
contrats d'apport et mandats de facturation ; jeton d'horodatage RFC 3161 d'un prestataire qualifié sur l'empreinte
(achat : décision du founder) ; signature avancée par un prestataire en option pour les grands comptes. Parce que la
fiabilité d'une signature simple n'est pas présumée (Code civil 1367, décret 2017-1416, Régl. §3.1), **c'est le dossier
de preuve qui la porte** : il est le vrai produit, et il mérite le soin de la Forge. Contenu de référence : Régl. §3.3
(empreinte, version, identité, code à usage unique et ses essais, IP et navigateur, horodatages, jeton, journal chaîné,
PDF scellé avec sa page de preuve).

Règles de texte visible qui en découlent (à tenir par un test de vocabulaire, comme `truth-vocabulary.test.ts`) :
jamais « qualifiée », « eIDAS qualifiée » ni « valeur de signature manuscrite » pour la signature simple
(Régl. §3.6) ; la phrase du poinçon dit « Signé électroniquement sur Proofseen par les deux parties le … », et le
dossier de preuve nomme le niveau. Reste à Inès Kader : la durée de conservation, et l'arbitrage entre minimisation et
force probante pour l'IP et le navigateur.

### D.3 Le coffre

**La liste.** Le coffre se range **par affaire**, pas par type de fichier : une affaire ouvre ses documents dans l'ordre
de leur naissance (devis, NDA, contrat, avenants, CRA mensuels, PV de recette, factures, attestations). Chaque
`DocumentCard` : type, titre, version, poinçon d'empreinte à 32 px, état en mot (A.4), signataires en pastilles (initiale
et état écrit), dernier événement daté. Filtres : affaire, type, état, « attend ma signature ». En tête : « 2 documents
attendent votre signature », lien direct.

**Le document.** À gauche le document. À droite : les strates de versions (V7), la progression des signataires (V8),
le dossier de preuve, les liens vers les faits qu'il fonde (V4 dans l'autre sens : « ce contrat a donné la mission
vérifiée du 12 octobre »).

**La comparaison entre deux versions (M2).**
- En tête, les deux poinçons d'empreinte côte à côte, 96 px, avec leurs chaînes : on voit d'abord que ce ne sont pas
  les mêmes documents.
- Dessous, la comparaison **par clause**, possible parce que nos documents naissent de gabarits structurés (les
  factures sont déjà rendues en HTML depuis des données, `packages/invoicing/src/render.ts`) : une clause identique se
  replie (« 9 clauses identiques »), une clause modifiée s'ouvre avec le texte avant et après, marques de marge de A.5.
- Pour un PDF déposé de l'extérieur (sans structure), comparaison page par page en superposition avec un curseur
  (`VersionCompare`, îlot), en annonçant honnêtement que la comparaison est visuelle.
- Sans JS : les deux versions l'une sous l'autre, clauses modifiées marquées.
- Statut de chaque signataire par version : une signature vaut pour une empreinte. Si la version 4 remplace la 3 signée
  par une partie, la ligne le dit : « Signé la version 3 ; la version 4 doit être signée à nouveau. »

### D.4 Données à créer (proposition à la piste A, que Maxwell et `database-reviewer` tranchent)

Ce que la Forge a besoin de lire, en plus des tables déjà nommées par le Trésor (`signature_request`,
`signature_event`, `signature_evidence`, Régl. §3.6 ; `introducer`, `introduction`, `introducer_commission`, Régl.
§1.5 ; `billing_mandate`, Régl. §4.5) : document (affaire, type, gabarit, statut) ; version (empreinte, fichier, auteur,
date, variables du gabarit figées, ce qui rend possible la comparaison par clause) ; signataire (rôle, ordre, mode
d'identification, statut) ; signalement (B.3) ; `Quote.acceptedAt`, `Payment.heldAt`, date de passage à `hired` ; mouvements du prestataire de
paiement avec montant. Contenu des documents chiffré au repos (`PROMPTS_LEGENDS.md`, règle 9).

---

## E. L'espace apporteur et l'entrée « travailler en portage »

### E.1 Les apporteurs

L'idée qui change tout, et qui vient de la marque : **un apport est un fait comme un autre, il se fait confirmer.**
L'apporteur dépose l'apport (entreprise par SIRET, horodaté à la seconde, ce qui fixe l'antériorité, Régl. §1.4),
reçoit un lien d'invitation signé qu'il transmet lui-même, et c'est **l'entreprise apportée qui confirme** « Prénom N.
nous a présenté Proofseen ». Déclaré, à l'essai, poinçonné : les mêmes trois états, la même source de vérité.
Avantage de forme : Proofseen ne reçoit les coordonnées du contact que de lui-même, au moment où il confirme ; le
Trésor prévoit sinon une information de la personne au premier contact (Régl. §1.4, RGPD art. 14). Que ce parcours
allège cette obligation est une **interprétation** à valider par Inès Kader.

Contraintes de forme tirées du droit (Régl. §1.1 à §1.3) : l'espace apporteur n'a **aucun outil de négociation** (pas de
fil avec le client sur le prix, pas de devis, pas de pouvoir de conclure), sinon l'apporteur devient agent commercial ;
ni objectif, ni classement, ni obligation de compte rendu (risque de requalification) ; avant le premier dépôt, deux
signatures au coffre : le contrat d'apport et la déclaration d'absence de conflit d'intérêts ; un salarié, dirigeant ou
mandataire de l'entreprise apportée est refusé par défaut (risque de corruption privée, Régl. §1.1).

Écrans :
1. **`/apporteurs`** (public, performance au moins 0,95). Titre en `--ps-step-6` : « Vous connaissez une entreprise
   qui cherche un freelance. » Trois scènes : l'apport daté à la seconde et confirmé par l'entreprise (le poinçon
   d'empreinte de l'apport) ; le calcul écrit sur un exemple marqué comme exemple ; le versement sur un fait (la mission
   payée), pas sur une promesse. Le taux n'apparaît que lorsque le founder l'a fixé.
2. **Déposer un apport** : entreprise par SIRET (contrôle au répertoire, comme `Organisation.registryStatus`,
   `schema.prisma:227`), la mission pressentie en une phrase, le lien d'invitation généré. Avant le premier dépôt :
   le contrat d'apport, signé dans le coffre (D.1).
3. **Mes apports** : V5 et la fenêtre d'attribution de chaque entreprise (« attribué jusqu'au 24 avril 2027 », durée
   fixée par le founder).
4. **Mon relevé** : commissions en garde, dues, versées, suspendues, reprises, chacune liée à son fait ; cumul annuel
   (Proofseen déclare en DAS2 au-delà de 2 400 EUR par an et par bénéficiaire, Régl. §1.1, BOFiP ACTU-2024-00154) ;
   pour un particulier, l'invitation à s'immatriculer au-delà du seuil que fixera Thomas Vidal (Flux §3.4).

Ce qui attire : la transparence du calcul, l'antériorité scellée (personne ne peut lui voler un apport), le versement
automatique sur un fait. Ce qui rassure l'entreprise apportée : le devis dit qu'une mission peut avoir été apportée par
un tiers rémunéré par Proofseen (Régl. §1.2, point 5), et V1 montre que la part de l'apporteur sort de la commission de
Proofseen, pas de son prix (Flux §2 P2). Ce qui rassure le freelance : le contrat client-freelance est identique au
centime près, apport ou pas (même source).

Interdits : classement, palier, badge, tableau d'honneur des apporteurs ; apport sur soi-même ou sur son propre
employeur sans contrôle (file Apports à valider) ; relance automatique de l'entreprise apportée au-delà d'un rappel.

### E.2 Travailler en portage

Le portage est une relation à trois (le porté, l'entreprise de portage, l'entreprise cliente), Code du travail L1254-1
à L1254-31 (Régl. §2.1). Proofseen **ne peut pas** être l'entreprise de portage (activité exclusive, L1254-24, Régl.
§2.2) : le cocontractant du client et le bénéficiaire du paiement est la société de portage partenaire (Flux §2 P3).
Le design s'appuie sur la métaphore : en orfèvrerie, le poinçon « de responsabilité » est celui de qui engage sa
responsabilité sur l'ouvrage (fait lu le 2026-10-24, A.3). En portage, la société de portage engage la sienne : ses
documents portent sa marque, et l'écran le dit (« Émis par <société de portage> »).

Écrans :
1. **Entrée** : dans l'identité de facturation (`facturation`), là où le SIRET est demandé aujourd'hui
   (`BillingIdentity.siret`, `schema.prisma:366`), une seconde porte de même poids : « Je n'ai pas de SIRET : travailler
   en portage ». Et une page publique `/portage`.
2. **Éligibilité** : les conditions de L1254-2 I (expertise, qualification, autonomie pour trouver ses clients et
   fixer son prix) et les exclusions (services à la personne, L1254-5), en trois à cinq questions tirées du fichier de
   règles ; une réponse non éligible dit pourquoi et ce qui existe à la place, jamais un refus nu.
3. **Simulation** : V6, violet, « simulation, pas une promesse », taux publiés du partenaire et date ; le TJM plancher
   pour atteindre la rémunération minimale est affiché comme **indicatif** (Flux §2 P3).
4. **Le triangle** (`PortageTriangle`) : trois sommets (vous, la société de portage, l'entreprise cliente), et sur
   chaque côté le document qui lie les deux sommets, avec son émetteur et son état (A.4) : contrat de travail en
   portage (société de portage et porté, L1254-14) ; contrat commercial de prestation de portage (société de portage et
   client, **au plus tard 2 jours ouvrables après le début**, L1254-22, avec l'identité du garant financier et de
   l'assureur, L1254-23) ; la mission sur Proofseen. Au centre, le compteur des **36 mois** par couple porté-client
   (L1254-4). C'est le seul schéma de la page ; il remplace trois paragraphes de droit.
5. **Adhésion** : les documents de la société de portage arrivent au coffre avec leur émetteur ; Proofseen pré-remplit
   le contrat commercial à partir de la mission (Régl. §2.6) mais ne signe aucun contrat de travail et n'émet aucun
   bulletin (Régl. §2.5). Les pièces du partenaire (garantie financière, assurance RC, vigilance URSSAF, Régl. §2.4)
   passent par la file Attestations de la Tour et reçoivent chacune leur ligne poinçonnée.
6. **Ensuite** : le porté vit le même parcours de mission ; ses bulletins et son compte d'activité mensuel (L1254-25)
   arrivent au coffre s'il les y dépose ou si le partenaire les transmet ; V3 montre ce qui est versé à la société de
   portage, pas un salaire que Proofseen ne connaît pas.

Ce qui attire : « commencer sans créer d'entreprise », un chiffre simulé et sourcé, le même espace que les autres
freelances. Ce qui rassure : la garantie financière visible, le triangle clair, les documents au coffre, et une phrase
vraie : Proofseen ne prend rien au porté (ses frais sont facturés à l'entreprise, Flux §2 P3). Interdit de texte :
« sans risque », « garanti » appliqués au portage (Régl. §2.5). Décisions qui appartiennent au founder : le choix du
ou des partenaires (un à trois recommandés, Régl. §2.7), le contrat avec eux, et la décision D2 (pas de portage au
nom de la société du founder, L0-003).

---

## F. 21st.dev et motifs à aller chercher

Méthode (le serveur MCP peut être en panne) : recherche publique `https://21st.dev/s/<mot>` (elle a répondu le
2026-10-24), page du composant `https://21st.dev/@auteur/components/slug`, code
`https://cdn.21st.dev/user_<lib>/<slug>/code.tsx`. Chaque composant retenu : **licence lue avant reprise** (aucune ne
l'a été pour cette liste, sauf la page visx qui affiche « unknown »), **réécrit sans Tailwind** sur nos tokens, serveur
d'abord, crédité dans `apps/web/NOTICE.md`. On prend une idée de structure, jamais un style.

| Besoin | Composant (auteur), page | Ce qu'on prend | Ce qu'on laisse |
|---|---|---|---|
| Palette | Command Menu (Victor Teles), `https://21st.dev/@victor-teles/components/command-menu` ; Command (Origin UI), `https://21st.dev/@originui/components/command` | groupes de résultats, raccourci affiché à droite | dépendance `cmdk` et Radix : `<dialog>` natif |
| Touches | Kbd (Sean Hello), `https://21st.dev/@sean0205/components/kbd-1` | le dessin d'une touche | |
| Tableau | Data Table Bulk Actions (Mohamed Uvaish), `https://21st.dev/@uvain/components/data-table-bulk-actions` ; Data Table Filter (Sonu kumar), `https://21st.dev/@uniquesonu/components/data-table-filter` | barre d'action par lot qui apparaît à la sélection ; puces de filtres | TanStack côté client : tri et filtre par l'adresse |
| Journal | Audit Log (corr), `https://21st.dev/@corr/components/audit-log` (déjà présélectionné, `21ST_SHORTLIST.md`) ; Interactive Logs Table (Moumen Soliman), `https://21st.dev/@moumensoliman/components/interactive-logs-table-shadcnui` | ligne acteur, action, cible, date ; ligne dépliable | couleurs par niveau de journal |
| Frise | Lifeline (evilrabbit), `https://21st.dev/@evilrabbit/components/lifeline` ; Timeline (kuratlielia, déjà présélectionné) | rail daté et jalons | le connecteur caché qui se dessine depuis zéro |
| Signataires | Order tracking (Javi), `https://21st.dev/@javierdev0/components/order-tracking` | jalons d'une livraison appliqués à une enveloppe | |
| Âge des files | Status Bar (OpenStatus), `https://21st.dev/@openstatusHQ/components/status-bar` | barres par tranche avec leur compte | le vert « opérationnel » (le vert est réservé) |
| Comparaison | File Diff (Kevin), `https://21st.dev/@kvnkld/components/file-diff` ; Github Inline Diff (Jatin Yadav), `https://21st.dev/@jatin-yadav05/components/github-inline-diff` | repli des parties identiques, marques de marge | **le vert des ajouts** (A.5) |
| Code reçu | Otp Input (Edu Calvo), `https://21st.dev/@educalvolpz/components/otp-input` ; Input OTP (halaska-studio), `https://21st.dev/@halaska-studio/components/input-otp` | six cases, collage | animation de secousse |
| `/verifier` | Dropzone (Hayden Bleasel), `https://21st.dev/@haydenbleasel/components/dropzone` | zone de dépôt accessible au clavier | tout téléversement |
| Coffre | File Tree, variante badges (halaska-studio), `https://21st.dev/@halaska-studio/components/file-tree/badges` | arborescence affaire puis documents, pastille d'état | icônes de type de fichier colorées |
| Calendrier | Returns Calendar (Savva Sicevs), `https://21st.dev/@ssychui/components/returns-calendar` ; Heatmaps (Airbnb visx), `https://21st.dev/@airbnb-visx/components/heatmaps` | grille jours et semaines avec valeur écrite | l'intensité de couleur seule (un montant s'écrit) |
| Frappe | Stamp (designali-in, id 3417, `21ST_SHORTLIST.md`) | référence du geste, déjà traduit dans `seal.css` | |

Écartés après recherche : Kanban (Hayden Bleasel, Dice UI et autres, `https://21st.dev/s/kanban`) pour les files, car
glisser une carte n'est pas une décision motivée ; Signature Pad (Mohamed Uvaish, kuratlielia) ; tous les fonds animés,
cartes en verre, inclinaisons 3D (déjà écartés, `21ST_SHORTLIST.md`).

Motifs de produits à observer en veille (Kage, une page publique à la fois, datée) : la palette et les raccourcis
« g puis lettre » de Linear ; la page d'un paiement et sa frise d'événements dans le tableau de bord Stripe ; le
certificat de fin de signature de Docusign et Yousign ; l'art aléatoire de clé d'OpenSSH. Ce sont des souvenirs de
produits, **non vérifiés** ce jour.

---

## G. Au-delà, et ce que je coupe

### G.1 Ce qui ferait de cette phase une légende

1. **`/verifier`** : vérifier un document sans l'envoyer. Aucun concurrent de la mise en relation freelance ne le fait
   à ma connaissance (à confirmer en veille). C'est la page que l'on partage.
2. **Le poinçon d'empreinte sur chaque page de chaque document** : un contrat Proofseen se reconnaît imprimé, à
   distance, et se vérifie par son pied de page.
3. **La chaîne d'empreintes publique** : chaque jour, l'empreinte racine des événements de signature et du journal
   opérateur est publiée (page publique et flux). Le registre ne peut plus se réécrire en silence, même par nous.
   Proposition pour Maxwell (coût, clé, rotation).
4. **L'apport confirmé par l'entreprise apportée** : l'attribution devient une preuve, pas une déclaration.
5. **La comparaison par clause** : on lit ce qui a changé dans un contrat, pas des pixels.
6. **La Tour qui ne montre pas une adresse e-mail sans laisser de trace** : la confiance vaut aussi à l'intérieur.
7. **Le délai jusqu'à la signature** montré à l'entreprise pour ses propres affaires : la plateforme se mesure elle-même
   sur ce qui compte pour le client.
8. **La généalogie d'une preuve** dans la page publique : un badge que l'on peut ouvrir.

### G.2 Ce que je coupe, et pourquoi

| Coupé | Raison |
|---|---|
| Porte de coffre-fort, cadenas, coffre en 3D | décor ; un coffre cache, la marque montre |
| Gribouillis de signature au doigt | la preuve tient à l'identification, au consentement et à l'intégrité, pas à un dessin ; c'est du théâtre (CHALLENGE ouvert à Victoria si elle juge l'attente des utilisateurs plus forte) |
| Classement, paliers, badges d'apporteurs, « top apporteurs » | AI Act et mauvais goût ; un apporteur voit ses faits |
| Pourcentage de complétude d'un « pack fournisseur » montré aux clients | un score de personne déguisé ; une liste de pièces datées suffit |
| Diff vert et rouge | le vert est réservé |
| Donut, camembert, jauge, radar de compétences | illisibles ou scores de personnes |
| Compteur qui roule, confettis à la signature | déjà refusés (`CONNECTED_PLAN.md:43`) ; une signature est grave, pas une fête |
| Téléscripteur en direct de l'argent de la plateforme dans la Tour | vanité, et dangereux sur un écran partagé |
| Clauses de contrat générées par un LLM | GO API et risque juridique ; gabarits relus par le Trésor seulement |
| Carte de chaleur de l'activité d'un freelance | surveillance |
| Glisser-déposer dans les files | une décision s'écrit avec son motif |
| Aurore et bords lumineux dans la Tour | un outil ouvert vingt fois par jour ne joue pas de spectacle (`CONNECTED_PLAN.md:88-90`) ; seuls le focus et la sélection sont violets |

---

## H. Ce que je n'ai pas vérifié

- Aucun écran connecté rendu ; la Tour actuelle est lue dans le code seulement.
- Aucun texte de loi relu par moi : je m'appuie sur Régl. et Flux (Trésor, 2026-10-24), dont les points NON CONFIRMÉS
  le restent ici (taux de branche du portage, liste exhaustive du dossier de preuve, RGPD de l'apport).
- Les licences des composants 21st.dev listés (seule la page visx a été lue : « unknown »).
- Le poids actuel du JavaScript par route (`next build` non lancé) ; les budgets d'îlots sont des cibles.
- La lisibilité du poinçon d'empreinte à 16 et 32 px : à prototyper par Sumi.
- Que la comparaison par clause tienne pour tous les gabarits : vrai seulement si chaque document naît de données
  structurées.
- Les souvenirs de Linear, Stripe, Docusign, Yousign : à revoir en veille, page publique, datée.
- La définition exacte du critère WCAG 2.1.4 est citée de mémoire ; Mamori la confirme.

---

## I. Messages de vague 0 pour le bus (`.war-room/a2a/L0/BUS.md`, que le Chancelier ouvre)

- **RISK (Shogun, Création)** : le danger de la phase 2 est d'empiler des écrans riches qui ressemblent à n'importe quel
  SaaS (Kanban, donuts, cartes en verre) et de perdre la seule chose que Malt n'a pas : le vert qui se mérite. Second
  risque : un poinçon d'empreinte illisible en petit, qui deviendrait un ornement. Parade : A.5, C.0, prototype de Sumi
  avant tout code, et le vert tenu par `seal.test.ts`.
- **LÉGENDE (Shogun)** : `/verifier` et le poinçon d'empreinte sur chaque page signée ; un inconnu vérifie un contrat
  Proofseen sans compte et sans téléverser, et voit une virgule changer le dessin.
- **CHALLENGE à Bertrand Lacombe et Maxwell Reid** : `packages/db/src/freelance-insights.ts:59` écrit la TVA de la
  commission à 2000 points de base en dur ; une visualisation d'argent doit lire le taux de la facture de commission
  ou d'un fichier de règles daté.
- **ACK au Trésor** : Régl. §1 à §4 et Flux §2 à §3 repris dans D.2, E.1, E.2, V1, V5, V6, V10 ; la Forge n'invente
  aucun montant, les fixtures des figures d'argent sont les parcours P1 à P3 du Trésor.
- **REQUEST à Inès Kader** : durée de conservation du dossier de preuve ; arbitrage minimisation contre force probante
  pour l'IP et le navigateur ; validation de l'interprétation RGPD du parcours d'apport confirmé par l'entreprise (E.1).
- **REQUEST à Nadia Ferreira** : questions d'éligibilité au portage en langage clair, et calcul indicatif du TJM
  plancher (E.2, V6).
- **REQUEST à Thomas Vidal** : échéances de chaque file de la Tour, contrôles des apports contestés (B.3).
- **REQUEST à Victoria Chen** : position sur le gribouillis de signature (G.2) ; priorité de `/verifier` dans L2.
- **REQUEST à Maxwell Reid** : modèle de données de D.4, chaîne d'empreintes publique (G.1, point 3).

---

## Résumé pour le Chancelier (20 lignes)

1. Métaphore unique : l'empreinte. Un acte laisse une empreinte (SHA-256), l'empreinte se poinçonne.
2. Motif nouveau : le poinçon d'empreinte, un losange calculé depuis les bits du document, toujours avec sa chaîne.
3. Les trois états existants (déclaré, à l'essai, poinçonné) couvrent documents, apports, portage, versements.
4. Vert seulement sur un acte poinçonné ; un ajout dans une comparaison n'est jamais vert.
5. Cinq moments : frappe de l'empreinte, deux empreintes, généalogie d'une preuve, flux d'argent, Tour au calme.
6. Ouverture : `/verifier`, un PDF vérifié dans le navigateur sans être envoyé.
7. Tour de contrôle : quatre groupes au lieu de dix liens, neuf files configurées, un inspecteur dans l'adresse.
8. Palette `Ctrl+K` qui trouve et prépare, n'exécute jamais une décision ; raccourcis conformes à WCAG 2.1.4.
9. Arborescence proposée : `ui/` (primitives), `viz/`, `vault/`, `ceremony/`, `referral/`, `portage/`, `tower/`.
10. Cassé : `OperatorParts`, les 17 tableaux faits main, `market/` fourre-tout, `operator.css`.
11. Trouvé : l'argent qui attend une personne (`needsReviewAt`, litiges) n'a aucun écran aujourd'hui.
12. Onze visualisations, chacune avec sa donnée vérifiée dans le schéma ou marquée « à créer ».
13. Technique : SVG serveur, `d3-scale` et `d3-shape` côté serveur, Sankey écrit à la main ; `d3-sankey` refusé (d3 v1 en double).
14. Budget : 0 Ko de JS pour les figures, îlots de 2 à 6 Ko, pages publiques nouvelles à 0,95 au moins.
15. Signature simple faite par Proofseen (Régl. §3) : lire, consentir, code, sceau ; le dossier de preuve est le vrai produit.
16. Coffre rangé par affaire ; comparaison par clause pour nos gabarits, visuelle pour un PDF externe.
17. Apporteurs : l'apport se fait confirmer par l'entreprise apportée ; aucun outil de négociation ; aucun classement.
18. Portage via société partenaire : porte « sans SIRET », triangle des trois contrats et compteur de 36 mois, simulation violette.
19. Coupé : coffre 3D, gribouillis, donuts, diff vert, compteurs, Kanban de décisions, aurore dans la Tour.
20. Au founder : taux et payeur de la commission (D5), part de l'apporteur, partenaires de portage (D2), horodatage qualifié.

## La question du serment : qu'ai-je livré au-delà de la demande ?

1. Un motif calculé, pas dessiné : le poinçon d'empreinte, qui fait de la cryptographie une image de marque vraie, avec
   sa spécification de calcul et d'accessibilité (A.3). Preuve : la double vérité du mot, dans le schéma
   (`schema.prisma:1353`) et dans l'orfèvrerie (article lu le 2026-10-24).
2. Une page que personne n'a demandée et qui sera partagée : `/verifier`, chronométrée (A.6).
3. Un défaut réel trouvé en lisant le code : l'argent en revue humaine sans écran (`needsReviewAt`, `disputeOpenedAt`,
   recherche du 2026-10-24, B.1), et un taux de TVA en dur (`freelance-insights.ts:59`), envoyés en CHALLENGE.
4. Une parade de vérité pour les apporteurs : l'attribution confirmée par l'entreprise apportée (E.1), qui règle aussi
   la question des coordonnées de tiers.
5. Un choix technique mesuré et non supposé : dépendances de `d3-sankey` et `@visx/sankey` relevées par `npm view`
   (C.2), d'où le refus.
6. Une recherche 21st.dev faite par la recherche publique, sans le MCP : douze besoins couverts, URL réelles relevées
   le 2026-10-24 (F), et ce qu'on laisse de chaque composant.
7. Une règle d'accessibilité que les tours de contrôle oublient : les raccourcis d'une lettre actifs seulement sur la
   liste, et que l'on peut couper (B.6).
