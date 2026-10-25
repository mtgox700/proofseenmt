# Passation : format de gabarit et gabarits v1 (piste T, sprint L1)
De : tresor-juriste (Inès Kader) · Vers : piste A (architect, tdd-guide, database-reviewer), Chancelier · Mission : L1
· Vague : 1 · Date : 2026-10-24

Arbre : `C:\Users\HP\AppData\Local\Temp\wt-l1`, branche `sprint/l1-coffre`, base `origin/main` f9a5afd. Aucun commit.
Périmètre tenu : `.war-room/tresor/L1/` et entrées L1-010 à L1-019 ajoutées à la fin de `.war-room/a2a/L1/BUS.md`.

## Livré

- `.war-room/tresor/L1/TEMPLATE_FORMAT.md` : le format que la piste A implémente. Arborescence, YAML 1.2 « core »,
  types de variables et formatage sans `Intl` (déterminisme de l'empreinte), sept sortes de sources (`db`, `derived`,
  `rule`, `platform`, `input`, `document`, `pending`), clauses `locked`, `optional`, `conditional`, variantes,
  variantes bloquées par une décision du founder (`gates`), `requiredWhen`, `requires`, `variantRequires`, `prefill`,
  défauts marqués `HYPOTHESIS`, mention de relecture injectée par le moteur et liée à une empreinte, neuf erreurs
  nommées, conservation par type de document, vocabulaire interdit et ses raisons, exemple complet et minimal avec ses
  six rendus attendus.
- `.war-room/tresor/L1/templates/sources.yaml` : 61 sources (URL officielle, date de lecture, statut de lecture,
  `validUntil`).
- `.war-room/tresor/L1/templates/service-agreement/` (`template.yaml`, `fr.yaml`, `en.yaml`) : contrat de prestation,
  forfait et régie, 48 variables, 33 clauses (26 verrouillées, 3 optionnelles, 4 conditionnelles), 17 points de
  relecture. Couvre : parties depuis les snapshots, rôle de Proofseen (intermédiaire non partie, mandataire de
  facturation, outil de paiement opéré par Stripe, jamais employeur, aucune garantie de résultat), objet et livrables,
  documents contractuels, durée (quatre formes), prix, TVA (deux régimes), paiement sécurisé et versement à la
  recette (jamais « séquestre »), financement mensuel bloqué par D8, commission de Proofseen montrée à son payeur
  (deux variantes prêtes pour D5), facturation sous mandat, recette avec délai d'au plus 30 jours et recette réputée
  acquise, réductions, remboursements et contestations de paiement (L0-011), indépendance du prestataire, vigilance
  URSSAF conditionnelle au seuil lu dans le fichier de règles, sous-traitance, propriété intellectuelle (cession,
  licence ou droits conservés, sans défaut), confidentialité à durée finie, données des parties, sous-traitance RGPD
  conditionnelle (art. 28.3 a à h), responsabilité plafonnée réciproque, assurance, force majeure, fin du contrat,
  non-sollicitation proportionnée, référence et mission vérifiée, signature et convention de preuve (deux méthodes :
  acceptation datée actuelle, signature simple L2), notifications, transfert, avenants, différends, droit applicable.
- `.war-room/tresor/L1/templates/quote/` : devis, 8 clauses, pseudonymat du freelance respecté (référence publique,
  identité légale au contrat seulement), validité, devis qui n'engage qu'à la signature du contrat, frais de Proofseen.
- `.war-room/tresor/L1/templates/acceptance-report/` : procès-verbal de recette, quatre décisions (sans réserve,
  réserves mineures, refus motivé, recette réputée acquise), effets sur le versement et sur le transfert des droits,
  une ou deux validations du client.
- `.war-room/tresor/L1/templates/nda/` : accord de confidentialité réciproque ou unilatéral, durée finie, aucune
  clause pénale, avertissement que signer révèle l'identité légale.
- `.war-room/tresor/L1/templates/amendment/` : avenant qui s'ajoute à une chaîne (le contrat est figé en base),
  modifications décrites en phrases calculées, effet sur l'argent en quatre cas, vigilance recalculée avenants compris.
- Bus : L1-010 (HANDOFF), L1-011 (REQUEST données), L1-012 (ANSWER à L0-020), L1-013 (ACK de L0-011), L1-014 (RISK
  CGI abrogé), L1-015 (CHALLENGE validation sans délai), L1-016 (RISK vocabulaire), L1-017 (RISK arrêt de 2026),
  L1-018 (HANDOFF), L1-019 (RISK document généré après coup).

## Preuve

Contrôle structurel écrit pour cette passation (hors dépôt, script de travail lancé avec le paquet `yaml@2.9.1` du
dépôt) : analyse YAML stricte (clés uniques), chaque placeholder déclaré, chaque variable facultative gardée, chaque
variante présente dans chaque langue, chaque source citée présente au registre, chaque point de relecture rattaché à
une clause existante, tiret cadratin, tiret demi-cadratin, emoji et mots interdits refusés. Sortie :

```
acceptance-report: 15 variables, 6 clauses (5 locked, 0 optional, 1 conditional), 3 review points, languages fr
amendment: 17 variables, 9 clauses (7 locked, 0 optional, 2 conditional), 3 review points, languages fr
nda: 8 variables, 13 clauses (13 locked, 0 optional, 0 conditional), 4 review points, languages fr
quote: 17 variables, 8 clauses (8 locked, 0 optional, 0 conditional), 4 review points, languages fr
service-agreement: 48 variables, 33 clauses (26 locked, 3 optional, 4 conditional), 17 review points, languages fr+en
sources: 61 entries; expiring: cgi-289 until 2026-12-31, cgi-293b until 2026-12-31; not read: eidas-910-2014
OK: no structural problem
```

Dernier passage le 2026-10-24 vers 20:15, après toutes les modifications, sortie identique. Balayage des 15 fichiers
de la piste T et des entrées L1-010 et suivantes du bus : 0 tiret cadratin, 0 tiret demi-cadratin, 0 emoji.

Test rouge du contrôle : sur une copie, cinq fautes injectées (source inconnue, tiret cadratin, mot « séquestre »,
placeholder non déclaré, variable facultative non gardée) ; sortie :

```
FAIL  service-agreement: clause force-majeure cites unknown source civ-9999
FAIL  service-agreement/fr: forbidden em dash U+2014
FAIL  service-agreement/fr: forbidden word "séquestre"
FAIL  service-agreement/fr: scope: undeclared placeholder {{input.scopee}}
FAIL  service-agreement/fr: insurance: optional {{input.ipPurpose}} not guarded
```

Sources : chaque article cité a été lu le 2026-10-24 sur Légifrance, code.travail.gouv.fr ou cnil.fr, ou porte le
statut `official-search` (lu dans l'extrait officiel renvoyé par la recherche limitée au domaine), `official-by-research`
(lu par la recherche L0 du même jour) ou `not-read` (registre `sources.yaml`). Aucune lecture de malt.fr ni de
linkedin.com.

## Pas fait, ou pas vérifié

- **Aucun rendu réel** : il n'y a pas encore de moteur ; les gabarits sont validés en structure, pas rendus en PDF.
- **Données du parcours réel du 2026-10-21** : je n'ai pas accès à la base ; seul le total de 500 EUR HT est connu
  (`TEAM_MEMORY.md:689`). TJM et jours de ce contrat : NON VÉRIFIÉS. Voir L1-019 sur le sens d'un rendu après coup.
- **eIDAS (règlement 910/2014)** : EUR-Lex a renvoyé une page vide à l'outil de lecture (deux adresses) : NON VÉRIFIÉ.
  Aucune clause ne dépend du seul eIDAS ; le contrat s'appuie sur le Code civil 1366, 1367 et le décret 2017-1416.
- Lus seulement dans l'extrait officiel de recherche, à rouvrir à la main avant la relecture : 1375 (alinéa sur le
  contrat électronique), 2061, 2254, CPC 48 et 287, L110-4, L123-22, L151-1, D441-5, L442-1, 293 B, ordonnance
  2025-1247, décret 2017-1416.
- Lus par la recherche L0 et non relus par moi : L8222-1, R8222-1.
- NON VÉRIFIÉS : article du CIBS qui reprend le mandat de facturation et mention de franchise en 2027 (L1-014) ;
  règlement Rome I pour un client étranger ; jurisprudence sur la non-sollicitation ; mentions obligatoires d'un devis
  de prestation intellectuelle entre professionnels ; nom exact de l'entité Stripe à citer ; refacturation du surcoût
  de la carte (L1-013).
- Point de départ des 10 ans de L123-22 et périmètre « pièce justificative » pour un contrat client-freelance :
  HYPOTHÈSE à valider par Bertrand.
- Version anglaise : traduction non relue par un juriste anglophone ; la française fait foi.
- Défauts marqués `HYPOTHESIS` à trancher (sortie du contrôle) : délai de recette 15 jours (L1-015), confidentialité
  5 ans, préavis 30 jours, non-sollicitation 12 mois, sous-traitance refusée par défaut, méthode de signature actuelle,
  sens du NDA réciproque, payeur de commission au devis (D5).

## Au-delà de la demande (question du serment)

« Qu'est-ce que j'ai livré qui va au-delà de ce qu'on m'a demandé, et quelle preuve le montre ? »

1. **Un article abrogé détecté dans le code en production, et un format qui empêche de le refaire.** Les articles 289
   et 293 B du CGI, cités par `render.ts` et le mandat, sont abrogés au 1er janvier 2027 (ordonnance n° 2025-1247,
   art. 9, page Légifrance de l'article 289 lue le 2026-10-24). Le registre porte `validUntil`, le moteur refuse de
   rendre une clause qui cite une source expirée, et un test doit échouer 60 jours avant. Preuve : `sources.yaml`
   (`cgi-289`, `cgi-293b`), ligne `expiring` de la sortie du contrôle, RISK L1-014.
2. **Le trou que personne n'avait vu : un contrat Proofseen n'a pas d'objet.** `Contract` et `Quote` n'ont ni
   description ni livrables (`schema.prisma`, modèles lus) ; un contrat dont l'objet n'est pas déterminable (1163) se
   perd le jour du litige. Preuve : REQUEST L1-011 et variables `pending` des gabarits, qui font échouer le rendu tant
   que la colonne manque.
3. **Les décisions du founder deviennent des données.** D5 : les deux variantes de commission sont écrites, la colonne
   `feePayer` choisit. D8 : les trois modes de financement mensuel sont écrits et bloqués (`decision_pending`) tant que
   la décision n'est pas prise. Preuve : `service-agreement/template.yaml` (`commission`, `monthly-funding`).
4. **Minimisation et force probante, les deux à la fois** pour l'IP et le navigateur : engagement d'empreinte dans le
   journal chaîné, valeurs complètes en archive scellée, valeurs masquées pour la contrepartie. Preuve : § « Réponse à
   L0-020 » ci-dessous, sources CNIL lues.
5. **Le document parle au profil** (au-delà prévu par le prompt L1) : la clause optionnelle « Référence et mission
   vérifiée » porte le consentement du client à être nommé, que `VerifiedMission.clientName` exige aujourd'hui
   (commentaire du modèle). Preuve : `service-agreement/fr.yaml`, clause `reference`, point R17.
6. **Un arrêt de 2026 qui change la page de preuve** : Cass. civ. 3e, 5 mars 2026, n° 24-21.034, lu sur Légifrance
   (RISK L1-017).
7. **Une contradiction tranchable avant le GO PAIEMENT LIVE** : l'argent d'un freelance peut rester bloqué sans fin
   (validation sans délai), contre L441-10 III ; alternative écrite au contrat. Preuve : CHALLENGE L1-015.
8. **Un contrôle qui sait échouer** : 5 fautes injectées, 5 détectées (sortie ci-dessus), prêt à devenir le test de
   chargement de `packages/documents`.

## Pour le receveur

1. **Ordre de reprise.** (a) Lire `TEMPLATE_FORMAT.md` §1, §3, §5 ; (b) écrire le schéma zod du format et le
   chargeur, puis le test de chargement sur les cinq gabarits (le contrôle de cette passation en donne la liste de
   règles) ; (c) `renderTemplate` et ses neuf erreurs nommées, en commençant par les tests de l'exemple §9 ; (d) les
   fonctions `derived` ; (e) le passage vers pdfmake (L1-006) : un bloc par clause, intitulé numéroté au rendu, pied de
   page avec le poinçon et la ligne `reviewFooter`.
2. **Données à créer (L1-011), colonne par colonne.**
   - `Quote.scope` (texte, 6 000 caractères, filtré par `containsDirectContact`), `Quote.deliverables` (liste, 30 au
     plus), `Quote.validUntil` (date, postérieure à la création) ; recopiés et figés sur `Contract.scope`,
     `Contract.deliverables` à la création, sous le même déclencheur que les autres conditions.
   - `Contract.acceptanceWindowDays` (1 à 30), figé ; `Contract.deliveredAt` posé par le freelance (« déclarer la
     livraison ») ; tâche qui constate la recette réputée acquise à `deliveredAt + délai`, et l'équivalent pour un
     relevé mensuel (`Timesheet.submittedAt + délai`), **après la décision de L1-015**.
   - Modèle `Amendment` : contrat, rang unique par contrat, changements (avant et après par variable), date d'effet,
     raison, statut, dates de signature, version du coffre ; immuable une fois signé ; conditions en vigueur calculées
     sur la chaîne ; `contractBlocker` étendu aux avenants pour le cumul de vigilance.
   - `Contract.clientNameConsentAt` (ou lecture de la clause `reference` incluse dans la version signée) pour
     alimenter `VerifiedMission.clientName`.
   - Snapshot allégé pour le NDA (nom légal, adresse, SIRET et TVA facultatifs, sans exigence de mandat) ; un
     `Document` doit pouvoir se rattacher à une `Conversation`.
   - Peuvent vivre dans les variables figées de `DocumentVersion`, sans colonne : `workMode`, `ipRegime`, `ipPurpose`,
     `ipTerritory`, `ipDurationYears`, `processesPersonalData`, `dpaDetails`, `confidentialityYears`, `noticeDays`,
     `subcontractingAllowed`, `insurerName`, `insurancePolicy`, `nonSolicitationMonths`, état des clauses optionnelles.
   - Fichier de règles `packages/documents/rules/payment-terms.ts` : `RECOVERY_FEE_CENTS = 4000` (D441-5) ; le texte
     `RECOVERY_FEE` de `render.ts` le lit au lieu d'écrire « 40 € ».
3. **Fonctions pures à écrire** (`packages/documents/src/derive.ts`) : `vatRegimeOf`, `vatOfTotal` (R3, R6 de
   `tresor/L0_FLUX_ARGENT.md`), `totalWithVat`, `applyBp`, `durationShapeOf`, `vigilanceRequired` (même calcul que
   `contractBlocker`), `vatRegimeOfProfile`, `describeChanges`, `priceChangeKind`, plus le snapshot allégé.
4. **Pièges.**
   - La date d'un document vient de la version du coffre, jamais de l'horloge du rendu (sinon l'empreinte change).
   - Aucun `Intl` dans le formatage : U+202F pour les milliers, virgule décimale, U+00A0 avant « EUR » et « % ».
   - Les variantes `"true"` et `"false"` de `subcontracting` sont des chaînes en YAML : les lire comme telles.
   - Ne jamais retirer l'avertissement de relecture sans `reviewedBy`, `reviewedOn` et une empreinte relue qui
     correspond (décision D6 du founder).
   - L1-019 : le rendu sur le parcours du 2026-10-21 est un rendu de test filigrané, jamais rangé comme contrat.
   - Veto Trésor tenu par ces gabarits, à ne pas défaire : aucune clause de non-concurrence, aucune clause de
     non-contournement de la plateforme dans le contrat entre client et freelance (elle relève des CGU, L5),
     aucune commission sans son taux montré à son payeur, aucune signature sans consentement exprès ni dossier de
     preuve, aucune promesse de résultat, aucun lien de subordination.

## Réponse à L0-020 (détail sourcé)

**1. Durée de conservation du dossier de preuve.**
- Finalité : prouver l'identification du signataire et l'intégrité de l'écrit, que la loi exige à l'établissement
  **et à la conservation** (Code civil 1366) ; pour une signature simple, la fiabilité n'est pas présumée (1367,
  décret 2017-1416) et le juge la vérifie si elle est déniée (CPC 287). Le dossier n'a donc de raison d'être que tant
  que le document qu'il prouve peut être invoqué : même durée, ni plus, ni moins (RGPD 5.1 e).
- Durée : base active jusqu'à la fin du contrat (recette, dernier paiement ou dernier relevé) ; puis archivage
  intermédiaire de **5 ans** (Code civil 2224 ; Code de commerce L110-4 entre commerçants ou avec des non-commerçants),
  prolongé jusqu'à l'issue d'un litige ou d'une demande d'un juge en cours. Si le contrat justifie une écriture de
  Proofseen (commission, fonds reçus pour compte de tiers), **10 ans** (L123-22) : HYPOTHÈSE à valider par Bertrand.
  Nous ne proposons pas de raccourcir la prescription par contrat (2254 le permet entre professionnels jusqu'à un an) :
  ce serait au détriment de la partie qui doit prouver.
- Conditions (guide CNIL « Les durées de conservation », juillet 2020, p. 5, 10 et 11) : séparation logique ou
  physique, accès limité aux personnes habilitées pour le contentieux, accès tracés, aucune modification ; à
  l'échéance, suppression ou anonymisation.
- Effacement demandé par une partie pendant ce temps : refusé pour le dossier et le document signé (RGPD 17.3 e,
  défense de droits en justice ; 17.3 b pour une pièce comptable), la personne étant informée de la durée restante.
- Code à usage unique : seule son empreinte est gardée, et seulement pendant sa validité ; le dossier garde le fait
  (« code vérifié à telle heure, N essais »), jamais le code.
- Journal d'accès au coffre (qui a ouvert ou téléchargé quoi) : 6 mois à 1 an glissants (CNIL, recommandation
  journalisation, délibération n° 2021-122, publiée le 18 novembre 2021). Les événements de signature ne sont pas ce
  journal : ils font partie du dossier et en suivent la durée.

**2. IP et navigateur : minimisation contre force probante.**
- Ce sont des données personnelles (guide CNIL, p. 3, qui cite l'adresse IP en exemple). Base légale proposée :
  intérêt légitime de preuve (RGPD 6.1 f), à mentionner dans la politique de confidentialité avant L2 (règle 5 du bloc
  commun et `legal-pages.test.ts`).
- Valeur probante : faible seule, utile en faisceau (même réseau et même appareil entre la demande de code et le
  sceau). L'arrêt du 5 mars 2026 montre qu'un juge examine le procédé, pas la présence d'un certificat.
- Règle proposée, qui tient les deux exigences :
  1. collecte aux seuls événements de signature (version affichée, consentement, envoi du code, code vérifié, sceau),
     jamais sur la navigation, jamais dans les journaux applicatifs ; aucune géolocalisation déduite et stockée ;
     navigateur tronqué à 512 caractères ;
  2. dans le journal chaîné, chaque événement porte seulement `SHA-256(sel || IP || navigateur)` ; les valeurs
     complètes et le sel vont dans l'archive scellée, chiffrée au repos, à accès restreint ;
  3. l'exemplaire remis à la contrepartie montre l'IP masquée (IPv4 au /24, IPv6 au /48) et le navigateur résumé
     (famille et système) ; le signataire voit ses propres valeurs complètes ;
  4. devant un juge, on produit les valeurs complètes et le sel : chacun recalcule l'empreinte et la retrouve dans la
     chaîne ; à l'échéance de conservation, effacer les valeurs complètes laisse la chaîne vérifiable sans donnée
     personnelle.
- NON VÉRIFIÉ : aucun référentiel officiel du contenu d'un dossier de preuve de signature simple n'a été lu (déjà noté
  par la recherche L0 §3.3).

**3. Lecture RGPD de l'apport confirmé par l'entreprise apportée** : ACK, traitée en vague 1 de L3 avec le contrat
d'apport.

## Points à faire relire par un avocat inscrit au barreau (décision D6, jamais bloquant pour le code)

Détail et question exacte dans le bloc `review.points` de chaque `template.yaml`.
- Contrat de prestation (R1 à R17) : rôle de Proofseen et entité Stripe ; contrat d'adhésion ou non (1110, 1171,
  1190) ; paiement avant facture et acompte ; recette réputée acquise ; contestation bancaire et reprise ; mandat de
  facturation et article de reprise en 2027 ; cession et rémunération forfaitaire (L131-3, L131-4) ; indépendance face
  aux indices de subordination ; durée de confidentialité ; plafond de responsabilité (1170, 1171) ; vérification de
  vigilance par Proofseen ; préavis et rupture brutale ; absence de clause attributive (CPC 48) ; non-sollicitation ;
  convention de preuve et arrêt de 2026 ; client étranger ; consentement à la référence.
- Devis (R1 à R4) : devis qui n'engage qu'au contrat ; pseudonymat et mentions ; information sur la commission ;
  durée de validité.
- Procès-verbal de recette (R1 à R3) : versement malgré des réserves mineures ; recette réputée acquise ; double
  validation.
- NDA (R1 à R4) : durée et secret des affaires ; clause pénale ; capacité du signataire ; données personnelles.
- Avenant (R1 à R3) : baisse de prix après versement ; écrit des modifications ; cumul de vigilance.
