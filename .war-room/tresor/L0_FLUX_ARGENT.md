# L0 · Le flux d'argent de Proofseen

Camille Aubert, directrice financière (Trésor), mission L0, vague 0. Écrit le 2026-10-24 sur l'arbre `wt-l0`,
révision `f9a5afd` (= origin/main).

Standard de ce document : chaque euro qui entre a un chemin écrit, une écriture comptable et un document qui le prouve.

Conventions :
- Montants en centimes entiers dans le code ; en euros avec deux décimales dans ce texte.
- **HYPOTHÈSE** : valeur de travail, avec sa raison ; jamais un prix ou un taux décidé.
- **NON VÉRIFIÉ** : je ne l'ai pas lu dans une source pendant cette session.
- **À SOURCER (recherche L0)** : règle juridique ou fiscale qui n'est pas dans `research/LEGENDS_P2_REGLEMENTAIRE.md`
  et que je n'ai pas recherchée moi-même (consigne du Chancelier).
- **À VALIDER (Bertrand)** : compte ou écriture proposés, à confirmer par l'expert-comptable.
- Les faits juridiques cités viennent de `research/LEGENDS_P2_REGLEMENTAIRE.md` (noté « Recherche L0 §n »).
- Exemple de référence, utilisé partout : mission de **10 000,00 EUR HT**, freelance assujetti à la TVA à 20 %,
  commission au taux de **10 %** (`PROOFSEEN_COMMISSION_BP=1000`). Tous les montants ont été recalculés par un
  script qui reprend les formules exactes de `packages/db/src/payments.ts` (sortie citée en §1.4).

Rien ici n'est un avis juridique. Tout taux, prix ou statut de société reste une décision du founder (§7).

---

## 0. Ce que le code fait vraiment, et les dix constats qui changent le plan

Lu sur `f9a5afd`. Gravité : CRITIQUE (perte ou mélange d'argent possible), HAUT (règle financière ou document faux),
MOYEN (coût ou limite).

| N° | Constat | Preuve | Gravité | Correction proposée |
|---|---|---|---|---|
| K1 | **Le payeur de la commission se contredit.** Le code la prélève sur le freelance (facture PS au freelance, déduite du virement). La décision du founder du 2026-09-20 dit « commission facturée à l'entreprise, jamais prélevée sur le consultant », à cause du risque de placement privé (C. trav. L5321-3) lié au portage. La War Room a ensuite fixé « 10 %, payée par le freelance » le 2026-10-07, par délégation. | `ROADMAP.md:203`, `foundations/MODELE_PASSERELLE.md:24`, `TEAM_MEMORY.md:224` et `:644`, `invoices.ts:212`, `payments.ts:175` | HAUT | Décision D5 (§6). Le portage revenant (L4), la question se rouvre d'elle-même. |
| K2 | **Le virement au freelance est pris sur le solde commun de la plateforme, sans lien avec le paiement du client.** `transfer()` n'envoie pas `source_transaction`. Stripe : « Par défaut, une demande de transfert échoue lorsque le montant dépasse le solde de compte disponible de la plateforme » et « Pour empêcher l'exécution d'un transfert avant que les fonds du paiement associé ne soient disponibles, utilisez l'attribut `source_transaction` ». Deux conséquences : un client qui valide le jour même du paiement fait échouer le virement (fonds encore en attente) ; et, quand le solde le permet, le freelance A peut être payé avec l'argent encore bloqué du client B. Le chemin de l'euro n'est pas écrit. | `packages/payments/src/stripe.ts:114` ; https://docs.stripe.com/connect/separate-charges-and-transfers (variante Payment Intents, lue le 2026-10-24, sections « Disponibilité des transferts » et `transfer_group`) | CRITIQUE | Enregistrer l'identifiant de la charge (`latest_charge`) à `payment.succeeded` ; passer `source_transaction` à chaque virement (freelance, apporteur, société de portage). Stripe : « Vous pouvez créer plusieurs transferts avec la même `source_transaction`, tant que la somme des transferts ne dépasse pas le montant du paiement source ». |
| K3 | **Le taux de commission n'est pas figé au contrat.** Il est lu dans l'environnement à l'ouverture du paiement. Seul `repeatClient` est figé. Si le taux change entre la signature et le paiement, le freelance paie un taux qu'il n'a pas signé. La décision C11 dit pourtant « taux figé au contrat et affiché avant signature ». | `apps/web/src/app/api/contracts/[id]/payment/route.ts:40`, `payments.ts:226`, `schema.prisma` (aucun champ de taux sur `Contract`) | HAUT | Colonnes `commissionBp`, `feePayer`, `introducerShareBp` sur `Contract`, écrites à la création, gelées par déclencheur comme `repeatClient`. `open()` lit le contrat, plus l'environnement. |
| K4 | **Une seule facture de chaque sorte et un seul paiement actif par contrat.** La contrainte `@@unique([contractId, kind])` et la garde `existing.status !== "pending"` rendent impossibles le mensuel (une facture par mois), les jalons (une par jalon) et les avoirs. | `schema.prisma:892`, `payments.ts:233`, `payments.ts:221` | HAUT | Rattacher paiement et factures à une **échéance de facturation** (`BillingItem` : contrat, rang, période ou jalon, HT figé). Unicité sur `(billingItemId, kind)`. Nouveau type `credit_note`. |
| K5 | **Les factures sont émises après l'encaissement, avec une échéance à 30 jours et des pénalités de retard**, alors qu'elles sont déjà réglées. Par ailleurs, le client paie avant toute facture : ce versement pourrait être un **acompte**, qui rendrait la TVA du freelance exigible à l'encaissement et appellerait une facture d'acompte. | `invoices.ts:164`, `render.ts:41-43` | HAUT | Mention « Facture acquittée le JJ/MM/AAAA par paiement sécurisé Stripe » et échéance égale à la date de paiement. Exigibilité et facture d'acompte : **À SOURCER (recherche L0)**, CGI art. 269 et 289 I-1, question posée à Bertrand (§9). |
| K6 | **Litige perdu ou remboursement après versement : la perte tombe sur Proofseen, sans règle.** Stripe : « Le solde de votre compte sera débité du coût des frais Stripe, des remboursements et des contestations de paiement. » Aucune reprise de virement (`transfer reversal`) n'est codée ; le paiement passe « à revoir ». Perte maximale : le TTC entier (12 000,00) plus 20,00 de frais de litige. | `payments.ts:293-310` ; https://docs.stripe.com/connect/separate-charges-and-transfers (lu le 2026-10-24) ; frais de litige 20,00 EUR, https://stripe.com/fr/pricing (lu le 2026-10-24) | HAUT | Décision D9 (§7) ; clause des CGU (Inès) qui autorise la reprise ; reprise Stripe, possible « uniquement si le solde disponible du compte connecté est supérieur au montant de l'annulation » (même page). |
| K7 | **La carte bancaire mange 21 % à 37 % de la commission** sur un gros ticket. `automatic_payment_methods[enabled]` laisse le client choisir la carte. Sur 12 000,00 TTC : 209,35 de frais (carte standard EEE) ou 365,35 (carte premium, souvent les cartes d'entreprise : NON VÉRIFIÉ), contre 29,45 en prélèvement SEPA. | `stripe.ts:101-104` ; calcul §1.4 ; tarifs https://stripe.com/fr/pricing et https://stripe.com/fr/connect/pricing (lus le 2026-10-24) | MOYEN, premier levier de marge | Décision D10 : moyen de paiement par défaut (virement ou prélèvement SEPA), carte en option. |
| K8 | **Un remboursement partiel bloque tout le versement**, sans avoir ni recalcul de la commission : le freelance n'est jamais payé de la part non contestée. | `payments.ts:152` | MOYEN | Parcours P6 (avoir et remboursement partiel). |
| K9 | **Un freelance en franchise de TVA paie une TVA qu'il ne récupère pas** : commission 1 000,00 + TVA 200,00 sur 10 000,00 facturés, soit un coût réel de 12 % (Malt affiche le même effet : « 12 % TTC » pour les micro non assujettis, `research/CONQUETE_PARITE.md:41`, À VÉRIFIER). | `invoices.ts:210-212` | MOYEN | Argument central de D5 (§6). |
| K10 | **Un prix a une valeur de repli écrite dans le code** : taux de fidélité 500 bp par défaut. Décision de la War Room par délégation, pas une décision écrite du founder. | `apps/web/src/data/payments-config.ts` (`DEFAULT_REPEAT_COMMISSION_BP = 500`) | MOYEN | Le founder confirme 5 % (D11) ; sinon la fidélité se ferme sans variable, comme le taux principal. |

Ce qui est juste et à garder : séquestre réservé avant appel, recherche du virement avant d'en créer un, faits de
litige enregistrés quel que soit l'ordre, montants en `Int`, factures immuables et séries sans trou, mandat de
facturation exigé avant tout contrat, clé réelle refusée sans `PROOFSEEN_PAYMENTS_LIVE=GO`. L'arrondi actuel est exact
(preuve §1.4).

**Verdict de la porte du Trésor sur le paiement actuel, pour un GO PAIEMENT LIVE : FAIL**, tant que K2, K3 et K5
(mentions) ne sont pas corrigés et que D9 n'est pas prise. Le bac à sable peut continuer.

---

## 1. Règles communes à tous les parcours

### 1.1 Montants
- R1. Tout montant est un entier de centimes. `Int` (32 bits, maximum 21 474 836,47 EUR) suffit pour une ligne ; tout
  **agrégat** (cumul annuel DAS2, DAC7, solde de compte du grand livre) est un `BigInt`.
- R2. Aucun nombre flottant ne porte un montant, ni en base, ni en API, ni en front. Un taux est un entier de points
  de base (1 bp = 0,01 %).

### 1.2 Arrondi (règle écrite, testée)
- R3. `applyBp(cents, bp) = arrondi au centime le plus proche, demi vers le haut`, calculé sur une valeur positive.
  La formule actuelle `Math.round(cents * bp / 10000)` est exacte : le produit est un entier exact (inférieur à 2^53),
  la division IEEE est correctement arrondie et un demi-centime est représentable. Preuve : 2 000 000 tirages
  aléatoires comparés à un calcul en `BigInt`, **0 écart** (§1.4).
- R4. **Montants négatifs (avoirs)** : `Math.round(-2.5)` rend `-2` alors que `Math.round(2.5)` rend `3`. Un avoir se
  calcule donc sur la valeur absolue, puis prend le signe. Test obligatoire.
- R5. **Méthode du cumul** pour tout montant découpé (jalons, mois, avoir partiel) : la commission de la tranche k vaut
  `applyBp(cumul_k) - applyBp(cumul_(k-1))`. Sinon la somme des tranches dérive d'un centime. Preuve : trois jalons de
  333,33 / 333,33 / 333,34 donnent 33,33 + 33,33 + 33,33 = **99,99** au lieu de 100,00 en calcul tranche par tranche,
  et 33,33 + 33,34 + 33,33 = **100,00** par la méthode du cumul.
- R6. TVA calculée une fois par facture, sur le total HT de la facture (comme `vatOf`), jamais ligne par ligne.
- R7. Mensuel : `HT du mois = applyBp(TJM × demi-journées, 5000)` (la moitié, arrondie demi vers le haut), figé sur le
  relevé à sa validation. Preuve qu'il le faut : TJM 600,01 × 37 demi-journées / 2 = 1 110 018,5 centimes.

### 1.3 Faits générateurs
| Montant | Fait générateur | Ce qui le prouve |
|---|---|---|
| Fonds sous séquestre | `payment_intent.succeeded` reçu et signé | événement Stripe, `Payment.status = held` |
| Dette du freelance envers rien ni personne | jamais : le freelance n'avance jamais d'argent | |
| Commission Proofseen | **la libération** : virement créé vers le bénéficiaire et facture de commission émise | `transferId`, facture PS |
| Commission d'apporteur | **l'encaissement effectif de la commission Proofseen** (Recherche L0 §1.4), donc la libération ; payable après le délai de garde (§3.3) | ligne `IntroducerCommission` liée à la facture PS |
| Avoir | accord écrit des deux parties, ou décision d'arbitrage selon les CGU, ou litige bancaire perdu | avenant signé ou décision journalisée |

Toute règle de taux (commission, part d'apporteur, payeur) est **lue sur le contrat**, jamais dans l'environnement
au moment du paiement (K3).

### 1.4 Preuve des calculs
Script de travail (reprend `vatOf` et la formule de `payments.ts:226`), sortie du 2026-10-24 :

```
rounding mismatches vs BigInt half-up on 2e6 random draws: 0
Math.round(-2.5) = -2  Math.round(2.5) = 3 (asymmetric for credit notes)
current assujetti 20%: client pays 12000.00, commission 1000.00 + VAT 200.00, transfer 10800.00
current franchise: client pays 10000.00, commission 1000.00 + VAT 200.00, transfer 8800.00
edge 333.33 HT: { ttc: '400.00', com: '33.33', comVat: '6.67', transfer: '360.00' }
cost card_std: 209.35 = 20.9 % of commission; margin before introducer 790.65
cost card_premium: 365.35 = 36.5 % of commission; margin before introducer 634.65
cost sepa_dd: 29.45 = 2.9 % of commission; margin before introducer 970.55
client pays: total 13200.00 (mission 12000.00 + fee 1000.00 + VAT 200.00), transfer 12000.00
odd split 333.33/333.33/333.34: commissions [ '33.33', '33.33', '33.33' ] sum 99.99 vs global 100.00
cumulative method commissions: [ '33.33', '33.34', '33.33' ] sum 100.00
partial credit: refund client 2400.00 TTC; commission becomes 800.00 (credit note commission 200.00); transfer 8640.00
TJM 600.01 x 37 half-days / 2 = 1110018.5 cents -> needs explicit rounding rule
```

Frais retenus (pages lues le 2026-10-24) : carte standard EEE 1,5 % + 0,25 EUR ; carte premium EEE 2,8 % + 0,25 EUR ;
prélèvement SEPA 0,35 EUR ; litige 20,00 EUR (https://stripe.com/fr/pricing). Connect, option « vous gérez les
tarifs » : 2 EUR par compte actif et par mois ; 0,25 % + 0,10 EUR par virement vers la banque du compte connecté
(https://stripe.com/fr/connect/pricing). Virement bancaire reçu (SEPA Credit Transfer) : tarif non affiché sur la
page, **NON VÉRIFIÉ**. TVA facturée par Stripe sur ses frais : **NON VÉRIFIÉ** (À VALIDER Bertrand).

---

## 2. Les parcours, un par un

Légende des comptes (proposition, **À VALIDER (Bertrand)**, base Recherche L0 §7.2) : 512S solde Stripe de la
plateforme ; 512B banque d'E-KIGAI ; 467F fonds reçus pour le compte d'un freelance (un auxiliaire par freelance) ;
467P idem pour une société de portage ; 4191 avances reçues d'un client sur frais de service ; 411 client de Proofseen
(auxiliaire par tiers) ; 706 commissions et frais de service ; 44571 TVA collectée ; 44566 TVA déductible ;
627 frais bancaires et de paiement ; 6222 commissions d'apporteurs ; 401A fournisseur apporteur.

Les écritures 467F ne sont pas du chiffre d'affaires de Proofseen : seul le 706 l'est (Recherche L0 §7.1).

### P1. Mission directe au forfait (le parcours actuel)

| Étape | Qui paie qui | Quand | Assiette et montant | TVA | Pièce émise (par, à, sous quel mandat) | Où attend l'argent | Écriture |
|---|---|---|---|---|---|---|---|
| 1. Signature | personne | deux clics datés | contrat 10 000,00 HT | figée au contrat (taux du freelance) | contrat (aujourd'hui sans PDF ni signature électronique, L1 et L2) | | aucune |
| 2. Paiement | l'entreprise (administrateur) vers le compte Stripe de la plateforme | après signature | 12 000,00 TTC = 10 000,00 + TVA 2 000,00 | TVA du freelance, collectée par lui | **aucune facture** (K5) ; reçu Stripe | solde Stripe de la plateforme (Stripe Technology Europe, établissement de monnaie électronique : Recherche L0 §6), statut `held` | 512S D 12 000,00 / 467F C 12 000,00 |
| 3. Validation | personne | 1 ou 2 administrateurs du client | | | validation datée (`ContractApproval`) | inchangé | aucune |
| 4. Libération | Stripe plateforme vers le compte connecté du freelance | à la validation, ou rejouée par la tâche périodique | 10 800,00 = 12 000,00 - (1 000,00 + 200,00) | | **F1 mission** : n° `{référence freelance}-2026-NNNN`, émise par Proofseen **au nom et pour le compte du freelance** (mandat, CGI art. 289 I-2), adressée à l'entreprise, 10 000,00 + 2 000,00. **F2 commission** : n° `PS-2026-NNNN`, émise par E-KIGAI, adressée au freelance, 1 000,00 + 200,00, réglée par compensation | compte connecté du freelance, puis sa banque | 467F D 12 000,00 / 512S C 10 800,00 / 411(freelance) C 1 200,00 ; puis 411(freelance) D 1 200,00 / 706 C 1 000,00 / 44571 C 200,00 |
| 5. Frais Stripe | Stripe se paie sur le solde de la plateforme | à la charge, puis chaque mois (Connect) | 180,25 (carte standard) + 27,10 (virement Connect) + 2,00 (compte actif) | NON VÉRIFIÉ | facture Stripe | | 627 D 209,35 / 512S C 209,35 |
| 6. Versement à E-KIGAI | Stripe vers la banque d'E-KIGAI | calendrier de versement Stripe | solde propre de Proofseen | | relevé Stripe | banque | 512B D / 512S C |

Marge de Proofseen sur la mission : 1 000,00 - 209,35 = **790,65** en carte standard ; 634,65 en carte premium ;
970,55 en prélèvement SEPA. Coût de la plateforme agréée : 0,01 EUR HT par facture chez Super PDP (lu par Victoria
le 2026-10-07, `TEAM_MEMORY.md:657`), soit 0,02 par mission.

```
 Entreprise                    Stripe (compte plateforme)                Freelance
     |   12 000,00 TTC   ------------>  [ held : 467F 12 000,00 ]
     |                                         |
     |  validation (1 ou 2 admins)             |
     |  ------------------------------------>  |  libération
     |                                         |-- 10 800,00 --> compte connecté --> banque
     |                                         |-- 1 200,00 reste : 706 1 000,00 + 44571 200,00
     |  <---- F1 mission (au nom du freelance, mandat 289 I-2)
     |                                    F2 commission PS ----> freelance (compensée)
     |                                         |-- frais Stripe 209,35 (627)
     |                                         '-- solde propre --> banque E-KIGAI
```

Annulation :
- avant paiement : contrat annulé, aucun argent, aucune écriture ;
- après paiement, avant validation : remboursement intégral sur décision d'arbitrage (`refundHeld`), 467F D 12 000,00 /
  512S C 12 000,00 ; les frais de la charge initiale restent probablement à Proofseen (**NON VÉRIFIÉ** sur Stripe) :
  627 sans contrepartie, perte de 180,25 en carte ;
- mission payée jamais validée : relance à J+14, revue humaine, jamais de versement automatique (décision du
  2026-10-07, `validation-reminders.ts`).

### P1-bis. Mission directe, variante « l'entreprise paie les frais de service » (recommandée pour D5)

| Étape | Qui paie qui | Montant | Pièce | Écriture |
|---|---|---|---|---|
| 2. Paiement | l'entreprise vers Stripe plateforme | 13 200,00 = mission 12 000,00 TTC + frais de service 1 000,00 HT + TVA 200,00 | aucune facture avant la libération (même question K5) | 512S D 13 200,00 / 467F C 12 000,00 / 4191 C 1 200,00 |
| 4. Libération | Stripe vers le freelance | **12 000,00** (le freelance touche 100 % de son prix) | F1 mission (inchangée) ; **F2 frais de service** `PS-2026-NNNN`, E-KIGAI vers l'entreprise, 1 000,00 + 200,00, acquittée | 467F D 12 000,00 / 512S C 12 000,00 ; 4191 D 1 200,00 / 706 C 1 000,00 / 44571 C 200,00 |

Différence clé : la TVA de 200,00 est récupérée par l'entreprise assujettie, au lieu d'être un coût pour un freelance
en franchise. Annulation identique à P1 ; l'avance 4191 est remboursée avec le reste.

### P2. Mission apportée

Préalables (Recherche L0 §1.2) : contrat d'apport signé, déclaration d'absence de conflit d'intérêts signée, apport
déclaré et horodaté avant le premier contact, entreprise ni déjà cliente ni en discussion, apporteur ni salarié ni
dirigeant du client (interdit par défaut).

Le flux client-freelance est **identique à P1 ou P1-bis, au centime près** : l'apporteur ne touche jamais au contrat
client-freelance (Recherche L0 §1.5). Il s'ajoute trois étapes, prises sur la commission de Proofseen.

| Étape | Qui paie qui | Quand | Montant (part de 30 %, HYPOTHÈSE pour l'exemple) | Pièce | Écriture |
|---|---|---|---|---|---|
| 5. Naissance | personne | à la libération (commission Proofseen encaissée) | 30 % de 1 000,00 = 300,00 HT (3,00 % du HT de la mission) | ligne de commission « acquise, en garde » | aucune avant la pièce de l'apporteur (charge à payer en clôture : À VALIDER Bertrand) |
| 6. Fin de garde | personne | fin du mois suivant la libération (HYPOTHÈSE, §3.3) | 300,00, recalculé si un avoir est passé entre-temps | relevé mensuel | |
| 7. Paiement | Stripe plateforme vers le compte connecté de l'apporteur, **avec `source_transaction` = la charge du client** | au relevé | 300,00 + TVA 60,00 si l'apporteur est assujetti ; 300,00 sinon | **autofacture** sous mandat de l'apporteur assujetti, sa propre facture, ou **relevé de commission** pour un particulier (Recherche L0 §1.1, NON CONFIRMÉ pour le particulier) ; compteur DAS2 (seuil 2 400 EUR par an et par bénéficiaire, Recherche L0 §1.1) | 6222 D 300,00 / 44566 D 60,00 / 401A C 360,00 ; puis 401A D 360,00 / 512S C 360,00 |

Avec `source_transaction`, la charge de 12 000,00 du client se lit en entier : 10 800,00 au freelance, 360,00 à
l'apporteur, 840,00 à Proofseen (dont 200,00 de TVA collectée et 60,00 de TVA déductible). Chaque euro a son chemin.

```
 Entreprise -- 12 000,00 --> [ Stripe plateforme, held ]
                                   | libération
                                   |-- 10 800,00 ------------------------> Freelance
                                   |-- 1 200,00 commission Proofseen (706 + 44571)
                                   |        | garde jusqu'à fin M+1
                                   |        '-- 300,00 + TVA 60,00 -----> Apporteur (même source_transaction)
                                   '-- solde propre -> E-KIGAI
```

Annulation et accidents :
- remboursement total avant libération : aucune commission Proofseen, donc aucune commission d'apporteur ;
- avoir partiel avant la fin de garde : commission d'apporteur recalculée sur la commission nette ;
- avoir ou litige perdu après paiement de l'apporteur : reprise par **compensation** sur ses commissions suivantes
  pendant 12 mois ; au-delà, demande de remboursement si le reste dépasse un seuil (HYPOTHÈSE 50,00 EUR), sinon
  abandon passé en charge. Clause du contrat d'apport (Inès) ;
- litige ouvert : la commission d'apporteur est suspendue jusqu'à l'issue.

### P3. Mission en portage salarial

Faits (Recherche L0 §2) : ni E-KIGAI ni Proofseen ne peuvent être entreprise de portage (activité exclusive,
L1254-24 ; garantie financière, L1254-26 et L1254-27 ; déclaration préalable, R1254-3 et R1254-4). Le cocontractant
du client et le **bénéficiaire du paiement est la société de portage partenaire** (modèle Malt, Recherche L0 §2.3).

| Étape | Qui paie qui | Montant | Pièce (par, à) | Où attend l'argent | Écriture |
|---|---|---|---|---|---|
| 0. Contrats | | | contrat commercial de prestation de portage, société de portage et client, au plus tard 2 jours ouvrables après le début (L1254-22, mentions L1254-23) ; CDD ou CDI de portage, société de portage et porté (L1254-14) ; contrat de partenariat Proofseen et société de portage | | aucune |
| 2. Paiement | l'entreprise vers Stripe plateforme | 12 000,00 TTC si la société de portage facture la TVA à 20 % (HYPOTHÈSE) ; 13 200,00 si P1-bis | aucune facture avant libération | `held` | 512S D / 467P C |
| 4. Libération | Stripe vers le compte connecté **de la société de portage** | 12 000,00 en P1-bis | **F1 émise par la société de portage** à l'entreprise, dans sa série et par sa propre plateforme agréée (recommandé), ou par Proofseen sous mandat de la société de portage ; **F2 frais de service** E-KIGAI vers l'entreprise | compte de la société de portage | 467P D / 512S C ; 4191 D / 706 C / 44571 C |
| 5. Hors Proofseen | la société de portage paie le salaire | CA moins frais de gestion (5 % à 10 % selon des sources secondaires, Recherche L0 §2.1), cotisations, réserve | bulletin de paie, compte d'activité mensuel (L1254-25), par la société de portage | | aucune chez Proofseen |

Ce que Proofseen touche : ses frais de service sur la mission, facturés à l'entreprise. **Jamais au porté.**
La raison est double : (1) le risque de placement privé noté le 2026-09-20 (L5321-3, « gratuité pour le travailleur »,
`TEAM_MEMORY.md:224`, **À SOURCER (recherche L0)** : non repris dans la recherche du jour) ; (2) une commission
facturée à la société de portage serait reportée par elle sur le compte d'activité du porté, donc payée
indirectement par le travailleur. Seule P1-bis évite les deux. Aucune rétrocession de la société de portage à
Proofseen sans qu'elle soit écrite et montrée au porté (Recherche L0 §2.7).

Contrôles d'argent propres au portage : compteur de 36 mois par couple porté-client (L1254-4) ; services à la
personne refusés (L1254-5) ; TJM plancher indicatif pour atteindre la rémunération minimale (L1254-2 II, 75 % du PMSS
à défaut d'accord, PMSS 2026 = 4 005 EUR, Recherche L0 §2.1), calcul à écrire par Nadia, affiché comme indicatif.

```
 Entreprise -- 13 200,00 --> [ Stripe plateforme, held ]
                                   |-- 12 000,00 --> Société de portage --(salaire, hors Proofseen)--> Porté
                                   '-- 1 200,00 frais de service (facturés à l'entreprise) --> E-KIGAI
 Factures : F1 société de portage -> entreprise ; F2 E-KIGAI -> entreprise. Le porté ne reçoit aucune facture.
```

Annulation : avant le début, aucun contrat commercial de portage n'est dû ; après, la société de portage émet son avoir
dans sa série, et le parcours P6 s'applique avec 467P au lieu de 467F.

### P4. Contrat mensuel sur CRA (régie)

Aujourd'hui : relevés en demi-journées validés par le client, mais aucun paiement (`payments.ts:221`). Trois façons
de payer un mois ; je recommande la première par défaut.

| Option | Fonctionnement | Pour le freelance | Pour le client | Pour Proofseen |
|---|---|---|---|---|
| **A. Provision du mois (recommandée)** | le 1er du mois, le client met sous séquestre l'estimation (jours prévus × TJM, plafonnée au reste du contrat) ; à la validation du CRA, libération du montant réel, **remboursement partiel immédiat** de l'excédent | payé le jour de la validation, aucun risque d'impayé | avance un mois, récupère l'excédent | double frais de charge et de remboursement partiel (frais non rendus : NON VÉRIFIÉ) |
| B. Paiement sur CRA validé | le CRA validé appelle un paiement à J+N ; libération immédiate dès l'encaissement (pas de séquestre utile) | risque d'impayé, relances | trésorerie | risque de recouvrement, aucun |
| C. Provision unique | tout le plafond au départ, libération mois par mois | maximal | lourd | argent de tiers immobilisé longtemps ; durée maximale de détention chez Stripe NON VÉRIFIÉE |

Calcul du mois (option A, TJM 600,00, 37 demi-journées) : HT = 11 100,00 ; TTC 13 320,00 ; commission par la méthode
du cumul sur le HT cumulé du contrat ; plafond : le cumul des HT validés ne dépasse jamais `totalCents`.

| Étape | Qui paie qui | Pièce | Écriture |
|---|---|---|---|
| Provision M | client vers Stripe plateforme, estimation TTC | aucune (ou facture d'acompte : K5, À SOURCER) | 512S D / 467F C |
| CRA M validé | | CRA figé, montant figé (`BillingItem` du mois) | |
| Libération M | Stripe vers le freelance : réel TTC - commission TTC | **F1 du mois** (au nom du freelance, mandat) ; **F2 du mois** (commission ou frais de service) | comme P1 étape 4 |
| Excédent | Stripe vers le client (remboursement partiel) | aucune facture si aucune n'a été émise pour l'excédent | 467F D / 512S C |

Annulation : CRA refusé, il se corrige et se redépose, la provision attend ; mois non travaillé, provision remboursée
en entier ; fin anticipée du contrat, CRA partiel puis clôture.

Prérequis : K4 (une facture par mois), K2 (`source_transaction`), R7 (arrondi du mois).

### P5. Jalons

Contrat au forfait découpé en jalons (libellé, montant HT ou part en bp, date prévue, critère de recette). Le dernier
jalon absorbe le reste pour que la somme égale le total du contrat.

| Étape | Qui paie qui | Montant (30 / 40 / 30) | Pièce | Écriture |
|---|---|---|---|---|
| Financement du jalon k | client vers Stripe, **avant le début du jalon k** | 3 600,00 / 4 800,00 / 3 600,00 TTC | aucune avant libération (K5) | 512S D / 467F C |
| Recette du jalon k | | PV de recette daté (Coffre, L1) | | |
| Libération du jalon k | Stripe vers le freelance | commission par la méthode du cumul : 300,00 / 400,00 / 300,00 | F1 et F2 du jalon | comme P1 |

Recommandation : financer jalon par jalon (le client n'immobilise pas tout ; le freelance ne commence jamais un jalon
non financé), avec l'option « tout financer au départ » pour qui la veut. Annulation : jalon non financé, rien à
rendre ; financé non recetté, arbitrage ou remboursement ; recetté et libéré, acquis (avoir seulement par P6).

### P6. Avoir et remboursement partiel

Exemple : les parties conviennent d'une réduction de 2 000,00 HT sur la mission de 10 000,00.

**Cas a. Avant la libération** (aucune facture émise, si K5 se règle sans facture d'acompte) :
- avenant signé (montant réduit) ; remboursement partiel Stripe au client : 2 400,00 TTC ;
- commission recalculée sur 8 000,00 : 800,00 + 160,00 ; virement au freelance : 12 000,00 - 2 400,00 - 960,00 =
  **8 640,00** ;
- factures F1 et F2 émises directement sur les montants réduits ; écritures : 467F D 2 400,00 / 512S C 2 400,00, puis
  libération comme P1.

**Cas b. Après la libération** (factures émises, argent parti) :
- **avoir de mission** au nom du freelance, sous mandat, qui référence la facture d'origine : -2 000,00 HT,
  -400,00 TVA ; **avoir de commission** PS : -200,00 HT, -40,00 TVA (méthode du cumul, R5 ; signe appliqué après
  calcul, R4) ;
- argent : Proofseen rembourse 2 400,00 au client. Il le récupère par **reprise de virement** sur le compte connecté
  du freelance (2 400,00 - 240,00 = 2 160,00), si le solde disponible le permet, sinon le freelance doit la somme.
  Proofseen n'avance jamais un remboursement sur ses fonds propres sans la règle de D9 ;
- numérotation de l'avoir (même série ou série dédiée) et mentions : **À SOURCER (recherche L0)**, question à Bertrand.

Le blocage actuel de tout versement dès le premier centime remboursé (K8) disparaît : un remboursement partiel décidé
selon les règles devient un avoir, pas une alerte.

### P7. Litige

| Type | Avant libération | Après libération |
|---|---|---|
| **Litige commercial** (la prestation est contestée) | fonds bloqués ; arbitrage selon les règles écrites des CGU (Recherche L0 §6 : jamais de décision sans règle contractuelle préalable) ; issues : libération totale (P1), partielle (P6 a), remboursement total | avoir (P6 b) et reprise de virement |
| **Contestation bancaire** (le porteur de la carte conteste) | versement bloqué (déjà codé) ; 20,00 EUR de frais à Proofseen ; gagné : libération ; perdu : remboursé, aucune commission | Stripe débite la plateforme du montant contesté et des frais (K6) ; reprise de virement si possible ; sinon perte, selon D9 |

Écritures (perdu après libération, À VALIDER Bertrand) : 467F ou créance sur le freelance D / 512S C pour le montant
repris par Stripe ; 627 D 20,00 / 512S C 20,00 ; avoirs F1 et F2 si l'expert-comptable confirme que la prestation est
annulée. La commission d'apporteur est suspendue pendant tout litige.

Délais de contestation des cartes et des prélèvements SEPA : **NON VÉRIFIÉ**, à lire sur les pages de Stripe avant de
fixer le délai de garde de l'apporteur.

### P8. Contrat-cadre et bons de commande

Le contrat-cadre fixe une fois : TJM, plafond global, durée, payeur et taux de la commission, règles de recette et de
paiement. Chaque **bon de commande** est un contrat (forfait, jalons ou mensuel) qui hérite de ces conditions et
suit P1, P4 ou P5. Le cumul des bons sert à trois compteurs : plafond du cadre, seuil de vigilance de 5 000 EUR HT
(R8222-1, Recherche L0 §5.2 ; le cumul des avenants est une recommandation de la recherche, non une règle lue),
fenêtre de l'apporteur.

### Synthèse des parcours

| Parcours | Payeur | Bénéficiaire du virement | Factures | Commission Proofseen : fait générateur | Prérequis code |
|---|---|---|---|---|---|
| P1 directe | entreprise, TTC | freelance | F1 mandat ; F2 au freelance | libération | K2, K3, K5 |
| P1-bis | entreprise, TTC + frais | freelance (100 %) | F1 mandat ; F2 à l'entreprise | libération | + payeur sur le contrat |
| P2 apportée | comme P1 ou P1-bis | freelance, puis apporteur | + autofacture ou relevé apporteur | libération ; apporteur après garde | + modèles apporteur, grand livre |
| P3 portage | entreprise | société de portage | F1 par la société de portage ; F2 à l'entreprise | libération | + bénéficiaire société de portage |
| P4 mensuel | entreprise, par mois | freelance | F1 et F2 par mois | libération du mois | K4, R7 |
| P5 jalons | entreprise, par jalon | freelance | F1 et F2 par jalon | libération du jalon | K4, R5 |
| P6 avoir | | reprise de virement | avoirs F1 et F2 | recalcul | type `credit_note`, R4 |
| P7 litige | | selon issue | avoirs selon issue | suspendue | D9, reprise de virement |
| P8 cadre | par bon | freelance | par bon | par bon | modèle `FrameworkAgreement` |

---

## 3. Le programme d'apporteurs

### 3.1 Trois modèles de rémunération

| | **A. Part de la commission Proofseen** | B. Pourcentage additionnel payé par le client | C. Pourcentage pris sur le freelance |
|---|---|---|---|
| Qui paie | Proofseen, sur sa commission encaissée | l'entreprise, en plus | le freelance, en plus de la commission |
| Prix de la mission | inchangé | +X % pour l'entreprise | inchangé, net du freelance réduit |
| Transparence | simple : « l'apporteur est rémunéré par Proofseen » (Recherche L0 §1.2, point 5) | le client voit un frais d'apport : il doit savoir à qui et pourquoi ; l'apporteur devient un coût pour celui qu'il a apporté | Recherche L0 §1.3 : ne pas faire payer l'apporteur par le freelance à son insu ; à visage découvert, il faut le dire avant le devis |
| Risque juridique | le plus faible (Recherche L0 §1.4 : assiette « la plus simple et la moins risquée ») | risque de conflit d'intérêts accru si l'apporteur est proche du client (rétrocommission, C. pén. 445-1 et 445-2, Recherche L0 §1.1, NON CONFIRMÉ sur Légifrance) | en portage, paiement indirect par le travailleur (L5321-3, À SOURCER) |
| Effet face à Free-Work | neutre : rien ne change pour le freelance | défavorable côté client | **très défavorable** : Free-Work affiche « Et c'est gratuit, aucune commission sur votre mission freelance » (https://www.free-work.com/fr/tech-it, lue le 2026-10-24) |
| Calcul et avoirs | suit automatiquement la fidélité (5 %), les avoirs et les litiges | assiette séparée à gérer | assiette séparée, et un second prélèvement sur le virement |
| Rentabilité | marge réduite d'autant | marge préservée | marge préservée |

**Ma recommandation : modèle A.** C'est le seul où l'apport ne change aucun montant du contrat client-freelance, ce
qui est la règle d'or du flux (§2, P2). Il est aligné sur la recherche L0 et sur D1 du plan.

### 3.2 Options chiffrées (le taux est une décision du founder)

Seul repère public trouvé : le programme d'apport de Malt, « 5 % du facturé pendant 1 an, projet de 3 000 EUR ou
plus » (`research/CONQUETE_PARITE.md:268`, lu par extraits du moteur, **À VÉRIFIER** à la main : la page
https://www.malt.fr/resources/article/malt-programme-dapport-daffaires a répondu 403 le 2026-10-24). Un taux de
20 % récurrent apparaît dans les CGV d'un programme apporteur sans rapport avec notre marché
(https://lmnp.ai/legal-pdf/cgv-apporteur, vu en extrait seulement, NON VÉRIFIÉ). Aucun autre programme public de
plateforme freelance trouvé.

Sur la mission de référence (commission 1 000,00 au taux standard, 500,00 au taux de fidélité) :

| Option | Part de la commission | Soit, du HT de la mission | Apporteur | Proofseen garde (carte standard / SEPA) | Proofseen garde au taux de fidélité (carte / SEPA) |
|---|---|---|---|---|---|
| O1 | 20 % | 2,00 % | 200,00 | 590,65 / 770,55 | 189,15 / 369,05 |
| **O2 (recommandée)** | **30 %** | **3,00 %** | **300,00** | **490,65 / 670,55** | **139,15 / 319,05** |
| O3 | 50 % | 5,00 % (niveau affiché par Malt) | 500,00 | 290,65 / 470,55 | 39,15 / 219,05 |

Lecture : O3 égale le chiffre de Malt mais laisse 39,15 à Proofseen sur une mission de fidélité payée par carte.
O2 est le meilleur équilibre si D10 (moyen de paiement par défaut) passe en SEPA ; sinon O1. Avant toute annonce,
relire à la main la page de Malt pour comparer une assiette identique (Malt dit « du facturé », nous parlons de la
part d'une commission).

### 3.3 Durée, plafonds, seuil
| Paramètre | Options | Recommandation |
|---|---|---|
| Durée | première mission seulement ; **12 mois** sur le client apporté après la première facture ; durée de vie du client | 12 mois sur toutes les missions payées du client apporté, quel que soit le freelance (Recherche L0 §1.4, même ordre que Malt) |
| Seuil de mission | aucun ; 3 000 EUR HT comme Malt (À VÉRIFIER) | aucun seuil : l'assiette en part de commission rend une petite mission naturellement petite |
| Plafond | aucun ; par client apporté et par an ; par apporteur et par an | plafond par client apporté et par an (HYPOTHÈSE 10 000,00 EUR de commission d'apporteur) ; au-delà, revue humaine. Raison : un très gros compte apporté change de nature (agent commercial, L134-1) |
| Délai de garde | aucun ; fin du mois suivant ; 120 jours | fin du mois suivant la libération (HYPOTHÈSE à confirmer avec les délais de contestation, NON VÉRIFIÉS) |
| Versement minimal | aucun ; 50,00 EUR | report au mois suivant sous 50,00 EUR (HYPOTHÈSE), versement forcé au 31 décembre pour la DAS2 |

### 3.4 Auto-apport et cas limites (règles testables)
| Cas | Règle proposée |
|---|---|
| Le freelance apporte son propre client | pas de commission d'apporteur ; option d'un **taux réduit « client apporté par le freelance »** sur le contrat (Malt : 2 %, À VÉRIFIER). Décision D1-c |
| L'apporteur est le freelance de la mission | même règle que la ligne précédente, jamais les deux cumulés |
| L'apporteur est salarié, dirigeant ou mandataire du client | refusé par défaut ; accord écrit de l'employeur exigé sinon (Recherche L0 §1.3) |
| Domaine de courriel de l'apporteur = domaine du client | alerte opérateur, paiement bloqué jusqu'à revue (Recherche L0 §1.5) |
| Deux apporteurs déclarent la même entreprise | le premier horodaté gagne ; le second voit la raison |
| Entreprise déjà cliente ou déjà en discussion | refus d'antériorité, raison affichée |
| Apporteur et freelance de la même organisation ou du même foyer fiscal | revue opérateur (collusion) |
| Contrat de fidélité (5 %) sur un client apporté | la part s'applique à la commission réelle : elle baisse avec elle, sans règle spéciale |
| Fin de la fenêtre de 12 mois pendant un contrat mensuel | la date de libération de chaque mois fait foi |
| Particulier qui dépasse N commissions par an | invitation à s'immatriculer (Recherche L0 §1.5), N à fixer par Thomas |

Règle testable du fait générateur, pour la piste A (L3.3) :

```
introducerCommissionCents(release) =
  if release.contract.introductionId is null                      -> 0
  if release.releasedAt > introduction.firstInvoiceAt + 12 months -> 0
  if introduction.status != "accepted" or introducer.conflictDeclarationAt is null -> 0 (and flag)
  else applyBp(cumulCommission_k, contract.introducerShareBp) - applyBp(cumulCommission_(k-1), contract.introducerShareBp)
born at release, payable at end of month(releasedAt) + 1, recomputed on every credit note before payment,
clawed back by offset after payment, suspended while a dispute is open.
```

`contract.introducerShareBp` est figé à la création du contrat (K3).

---

## 4. Le modèle de données comptable

### 4.1 Recommandation : les deux, chacun son rôle
**Les tables métier gardent l'état** (contrat, paiement, échéance, facture, commission d'apporteur : où en est le
parcours). **Un grand livre interne en partie double dit où est l'argent.** Les deux sont écrits dans la même
transaction de base.

Pourquoi pas les tables métier seules : avec l'apporteur, le portage, les jalons, les mois et les avoirs, la question
« combien doit-on au freelance X ce soir » devient une somme de cas particuliers dispersés dans cinq tables. Une
erreur de cas ne se voit pas. Dans un grand livre, elle se voit : le solde du 467 de X est faux ou négatif.

Pourquoi un grand livre :
1. **Chaque euro a un compte** : fonds de tiers (467) séparés du chiffre d'affaires (706), conformément à la nature
   d'intermédiaire (Recherche L0 §7.1).
2. **Immuable** : une écriture ne se modifie jamais ; une erreur se corrige par contre-passation datée.
3. **Rapprochement Stripe ligne à ligne** : chaque écriture porte l'identifiant Stripe qui l'a causée (charge,
   virement, remboursement, litige, versement, frais), unique en base.
4. **Le FEC sort du grand livre** sans retraitement (18 champs, Recherche L0 §7.1) : `EcritureNum` continu, `PieceRef`
   = numéro de facture ou identifiant Stripe, `CompAuxNum` = le tiers.
5. **DAC7, DAS2, relevé annuel** deviennent des requêtes sur le grand livre (montants versés nets, commissions
   retenues, par trimestre et par bénéficiaire, Recherche L0 §5.1).

Contre : plus de code. Parade : une seule fonction `post(event)` qui applique un gabarit d'écriture par type
d'événement, aucune saisie manuelle, `assertBalanced` testé.

### 4.2 Schéma minimal (pour la piste A, L3.4)
```
LedgerEntry            (écriture : en-tête)
  id uuid, number BigInt unique (EcritureNum, continu par exercice), journal ("STR" | "VTE" | "ACH" | "OD"),
  kind (enum des événements ci-dessous), occurredAt, postedAt,
  pieceRef (n° de facture ou id Stripe), pieceDate,
  stripeObjectId unique nullable, idempotencyKey unique,
  contractId, billingItemId, paymentId, invoiceId (nullables), reversesEntryId nullable (contre-passation),
  label
LedgerLine             (lignes)
  id, entryId, account (char, plan validé par Bertrand), partyType ("freelance" | "company" | "introducer" |
  "umbrella" | "stripe" | "state"), partyId, debitCents Int >= 0, creditCents Int >= 0 (un seul des deux > 0),
  currency char(3)
Contraintes : déclencheur différé « somme des débits = somme des crédits par écriture » ; déclencheur
  « aucune mise à jour, aucune suppression » sur les deux tables ; une écriture sans ligne est refusée ;
  les soldes sont des BigInt calculés, jamais stockés comme vérité.
```

Compatible avec l'intitulé du plan (`LedgerEntry`, immuable, centimes) : `LedgerEntry` est l'écriture, `LedgerLine`
ses lignes.

### 4.3 Événements qui créent une écriture
| Événement | Source | Écriture type (À VALIDER Bertrand) |
|---|---|---|
| Paiement reçu sous séquestre | `payment_intent.succeeded` | 512S D / 467F C (et 4191 C en P1-bis) |
| Frais Stripe de la charge | `balance_transaction` de la charge | 627 D / 512S C |
| Libération vers le bénéficiaire | `transfer.created` | 467F D / 512S C |
| Facture de commission ou de frais de service | émission F2 | 411 D (ou 4191 D) / 706 C / 44571 C |
| Compensation de la commission sur le virement (P1) | libération | 467F D / 411(freelance) C |
| Facture de mission sous mandat | émission F1 | **aucune écriture au bilan de Proofseen** (c'est la vente du freelance) ; journal de pièces seulement |
| Remboursement total ou partiel avant libération | `charge.refunded` | 467F D / 512S C (et 4191 D) |
| Avoir de commission | émission de l'avoir | 706 D / 44571 D / 411 C |
| Reprise de virement | `transfer.reversed` | 512S D / 467F C (ou créance sur le freelance) |
| Litige ouvert, frais | `charge.dispute.created` | 627 D 20,00 / 512S C ; montant contesté : 467F ou créance D / 512S C |
| Litige gagné | `charge.dispute.closed` (won) | contre-passation du montant |
| Naissance de la commission d'apporteur | libération | aucune avant la pièce ; charge à payer à la clôture d'exercice |
| Pièce de l'apporteur (autofacture, facture, relevé) | émission | 6222 D / 44566 D / 401A C |
| Virement à l'apporteur | `transfer.created` | 401A D / 512S C |
| Compensation d'une reprise sur l'apporteur | relevé | 401A D / 6222 C (et 44566 C) |
| Frais Connect mensuels | facture Stripe | 627 D / 512S C |
| Versement Stripe vers la banque | `payout.paid` | 512B D / 512S C |
| Abonnement de la plateforme agréée, signature, horodatage | factures fournisseurs reçues par la PA | 6xx D / 44566 D / 401 C |

### 4.4 Rapprochements automatiques (chaque nuit)
1. **Stripe = grand livre** : solde 512S calculé = solde du compte Stripe de la plateforme (API `balance`), au
   centime ; chaque `balance_transaction` du jour a exactement une écriture (clé `stripeObjectId`).
2. **Fonds de tiers = argent bloqué** : somme des 467F et 467P = somme des paiements `held` et `releasing` ; aucun
   467 d'un tiers n'est jamais débiteur.
3. **Factures = écritures** : chaque facture F2 et chaque avoir a son écriture ; chaque facture F1 a son paiement.
Un écart ouvre une alerte opérateur et bloque les versements du tiers concerné jusqu'à explication.

---

## 5. Portage : qui facture, où passe l'argent, et la décision Ekigai

### 5.1 Le flux (rappel de P3)
L'entreprise paie Stripe ; Stripe libère vers la société de portage ; la société de portage facture l'entreprise et
paie le salaire ; E-KIGAI facture ses frais de service à l'entreprise. Proofseen fournit les données du contrat
commercial de portage (L1254-23), jamais le contrat de travail, le bulletin ou le compte d'activité (Recherche L0 §2.5).

### 5.2 « Ekigai entreprise de portage, ou partenaire » : pourquoi c'est au founder, et ce que ça coûte

Le founder a demandé le portage « au nom de Ekigai ». **Je le contredis sur un point de fait** : E-KIGAI telle
qu'elle est (SCOP SAS, qui exploite déjà d'autres activités, `TEAM_MEMORY.md:643`) ne peut pas l'être, parce que la
loi impose l'activité **exclusive** (L1254-24, Recherche L0 §2.2). La vraie alternative est : partenaires, ou
**filiale dédiée exclusivement au portage**. C'est une décision sur le statut d'une société et sur du capital : elle
appartient au founder.

| | Partenaire(s) de portage (recommandé) | Filiale d'E-KIGAI dédiée au portage |
|---|---|---|
| Délai d'ouverture | semaines : choix, vérifications, contrat de partenariat | création de société, garantie financière obtenue **avant** toute activité (L1254-27), déclaration préalable (R1254-3, R1254-4) |
| Coûts fixes | aucun pour Proofseen (vérification des attestations) | garantie financière : taux historiques de 8 % à 10 % de la masse salariale, minimum actuel **NON CONFIRMÉ** (Recherche L0 §2.1) ; paie, médecine du travail (L1254-28), application de la CCN IDCC 3219, assurance RC, comptabilité : **À SOURCER** |
| Revenu supplémentaire | aucun (pas de rétrocession cachée) | frais de gestion du portage (5 % à 10 % du CA selon des sources secondaires, Recherche L0 §2.1) : **HYPOTHÈSE**, à confronter aux coûts |
| Risque porté | celui du partenaire (salaires, rémunération minimale, requalification) | tout : salaires garantis, rémunération minimale (L1254-2), contentieux prud'homal |
| Documents | produits par le partenaire, pré-remplis par Proofseen | produits par la filiale ; Proofseen les génère pour elle |
| Image | « Proofseen travaille avec X, Y » | « au nom de Ekigai », ce que veut le founder |

Ma recommandation : partenaires d'abord (1 à 3, comparatif de Sofia), mesure du volume réel de freelances sans
SIRET pendant six mois, puis filiale seulement si le volume paie la garantie financière. Le produit est conçu pour
que le passage du partenaire à la filiale ne change rien au code : la société de portage est un bénéficiaire
configurable.

---

## 6. La contradiction sur le payeur de la commission (D5)

### 6.1 Les faits
- 2026-09-20, décision du founder : « commission facturée à l'entreprise, jamais prélevée sur le consultant »
  (`MODELE_PASSERELLE.md:24`, `ROADMAP.md:203`), à cause du portage.
- 2026-10-07, War Room par délégation : 10 % payée par le freelance (`TEAM_MEMORY.md:644`), point laissé au juriste
  (`sprints/C11_DECISIONS.md:73`).
- Le code applique la seconde.

### 6.2 Les chiffres
| Critère | Le freelance paie (actuel) | L'entreprise paie (P1-bis) |
|---|---|---|
| Freelance assujetti, mission 10 000,00 HT | client 12 000,00 TTC ; freelance 10 800,00 TTC | client 13 200,00 TTC ; freelance 12 000,00 TTC |
| Freelance en franchise, à revenu net égal (8 800,00) | client 10 000,00 ; Proofseen 1 000,00 ; 200,00 de TVA perdue par le freelance | le freelance facture 8 800,00 ; client 9 680,00 net de TVA récupérée ; Proofseen 880,00 ; aucune TVA perdue |
| Pour 1 000,00 dépensés par le client (HT) | Proofseen 100,00 | Proofseen 90,91 ; taux neutre en revenu : 11,11 % |
| Comparaison Malt, revenu du freelance 900,00 par jour (taux Malt À VÉRIFIER : 10 % freelance, 5 % à 9 % client) | client 1 000,00 sur Proofseen ; 1 050,00 à 1 090,00 sur Malt | client **990,00** sur Proofseen |
| Face à Free-Work (« aucune commission sur votre mission freelance », lu le 2026-10-24) | 10 % contre 0 % : argument perdu | **0 % pour le freelance, avec contrat, séquestre et factures**, que Free-Work ne fournit pas (Free-Work n'est pas partie aux contrats : `TEAM_MEMORY.md:605`) |
| Portage (P3) | interdit de fait (L5321-3, À SOURCER) : il faudrait deux modèles | un seul modèle pour tous |
| Apporteur (modèle A) | fonctionne | fonctionne |
| Transparence | la commission est cachée à l'entreprise (`invoices.ts:106`) | la facture de frais est à l'entreprise : rien de caché, aucun problème de « commission invisible » |
| Risque commercial | aucun pour le client | l'entreprise voit une ligne de frais (les grands comptes acceptent déjà 5 % à 9 % chez Malt, À VÉRIFIER) |

### 6.3 Ma recommandation
**L'entreprise paie des frais de service, le freelance paie 0 %.** Le taux est au founder (10 % ou le taux neutre de
11,11 %, ou autre). Trois raisons, par ordre de poids : un seul modèle qui couvre le portage ; une TVA non récupérable
supprimée pour tous les freelances en franchise ; la phrase de conquête « 0 % pour le freelance, comme Free-Work, mais
avec le contrat, le séquestre et la facture ».

Mise en œuvre sans casse : `feePayer` (`company` | `freelance`) et `commissionBp` figés sur chaque contrat (K3) ; les
contrats déjà signés gardent leur règle ; le changement de règle s'applique aux devis envoyés après la décision.
La fidélité (5 %) et Vivier+ (3 % client, `C11_DECISIONS.md`) se recalculent dans le même cadre : D5 et D11 se
tranchent ensemble.

---

## 7. Les décisions du founder, prêtes à poser

Numérotation : D1, D2 et D5 reprennent `PROMPTS_LEGENDS.md:231-235` ; D8 à D12 sont nouvelles (le Chancelier ajuste).

| N° | Question | Ma recommandation | Bloque |
|---|---|---|---|
| D1-a | L'apporteur est-il payé sur une part de la commission Proofseen (modèle A), un frais en plus pour le client (B) ou un prélèvement sur le freelance (C) ? | A | L3 en production |
| D1-b | Quelle part de la commission : 20 %, 30 % ou 50 % (soit 2 %, 3 % ou 5 % du HT au taux standard), pendant 12 mois sur le client apporté ? | 30 % sur 12 mois si D10 = SEPA par défaut ; sinon 20 % | L3 en production |
| D1-c | Un freelance qui amène son propre client a-t-il un taux réduit, et lequel ? | oui, taux configurable (Malt affiche 2 %, À VÉRIFIER) | rien |
| D1-d | Interdit-on par défaut les apporteurs salariés ou dirigeants du client ? | oui | L3 |
| D2 | Portage : 1 à 3 sociétés de portage partenaires, ou une filiale d'E-KIGAI dédiée exclusivement au portage (E-KIGAI elle-même ne peut pas, L1254-24) ? | partenaires d'abord, filiale si le volume le justifie | L4 en production |
| D5 | Qui paie la commission : l'entreprise (frais de service, freelance à 0 %) ou le freelance (règle actuelle) ? À quel taux ? | l'entreprise ; taux à fixer (10 % ou 11,11 %) | rien : la règle actuelle continue d'ici là |
| D8 | Comment paie-t-on un contrat mensuel : provision du mois libérée au CRA validé (A), paiement après CRA (B) ou provision unique (C) ? | A | L8 |
| D9 | Un litige perdu ou un remboursement après versement : Proofseen reprend-il le virement au freelance (clause des CGU), absorbe-t-il la perte jusqu'à un plafond, ou les deux ? | reprise d'abord, perte absorbée sous un plafond fixé par le founder, revue humaine au-delà | GO PAIEMENT LIVE |
| D10 | Quel moyen de paiement par défaut pour l'entreprise : virement ou prélèvement SEPA, la carte en option ? Qui paie le surcoût de la carte ? | SEPA par défaut ; carte permise, surcoût absorbé pendant la bêta puis réexaminé (le refacturer au client est une question à Inès) | rien |
| D11 | Confirmes-tu le taux de fidélité à 5 % aujourd'hui écrit en valeur de repli dans le code, et Vivier+ à 3 % côté client ? | à trancher avec D5 | rien |
| D12 | Seuils de l'apporteur : plafond annuel par client apporté (10 000,00 EUR de commission ?), délai de garde (fin du mois suivant ?), versement minimal (50,00 EUR ?) | oui aux trois, à revoir après les délais de contestation lus chez Stripe | L3 |
| D6 | Relecture par un expert-comptable (plan de comptes, écritures, acompte, avoirs, FEC) et un avocat (contrat d'apport, CGU de libération et de reprise) | avant l'ouverture réelle | usage réel |

---

## 8. La légende : ce que la finance peut offrir et que personne n'offre

Chaque idée est vraie dans le code proposé ici ; aucune ne promet un résultat.

1. **Le reçu « chaque euro »** pour chaque paiement : le client voit 13 200,00 = 12 000,00 au freelance + 1 000,00 de
   frais + 200,00 de TVA ; le freelance voit sa ligne ; l'apporteur la sienne. Tiré du grand livre et de
   `source_transaction`, il est exact au centime. Je n'en connais pas d'équivalent public chez Malt ou Free-Work
   (non vérifié en détail).
2. **Virement le jour de la validation** : avec `source_transaction` et des fonds déjà disponibles, le virement part
   à la seconde où le client valide. On dit « virement émis le jour de la validation », jamais un délai bancaire
   garanti. Malt annonce une avance sous 10 jours (`CONQUETE_PARITE.md:39`, À VÉRIFIER).
3. **La trésorerie du freelance, en clair** : « 12 000,00 sous séquestre chez Stripe pour toi, libérables à la recette
   du jalon 2 prévue le 14/11 ; 4 800,00 attendus fin novembre sur ton contrat mensuel ». Seulement des montants
   réels et des dates du contrat, pas de prévision inventée.
4. **La réserve fiscale affichée à chaque versement** : « sur 10 800,00 reçus, 2 000,00 sont de la TVA collectée et
   200,00 de la TVA déductible ». Pour le micro-entrepreneur, l'estimation des cotisations attend un taux sourcé
   (Nadia), sinon rien n'est affiché.
5. **Le relevé annuel automatique** avant le 31 janvier : obligation DAC7 de Proofseen (Recherche L0 §5.1) transformée
   en document utile, avec le total facturé, les commissions retenues, la TVA, par trimestre, et le lien vers
   impots.gouv et urssaf.fr (art. 242 bis).
6. **Facture électronique offerte** : le freelance micro, obligé d'émettre en septembre 2027 (Recherche L0 §4.1),
   n'a rien à faire ; ses factures sous mandat partent déjà par la plateforme agréée de Proofseen.
7. **L'avoir en un clic, sans tableur** : une réduction convenue produit en même temps l'avenant, le remboursement
   partiel, les deux avoirs, le recalcul de la commission et celui de l'apporteur.
8. **Le tableau de bord de l'apporteur au centime** : apport déclaré, horodaté, statut, commissions à venir (avec leur
   date de fin de garde), versées, compteur DAS2. Aucun gain promis, des états vides honnêtes.
9. **La preuve de solvabilité de la plateforme, pour les grands comptes** : un rapprochement nocturne qui prouve que
   les fonds de tiers égalent l'argent bloqué chez Stripe (§4.4), résumé dans le dossier fournisseur que demandent
   les services achats soumis à Sapin II (Recherche L0 §1.1).
10. **Export FEC du freelance** : ses écritures Proofseen en 18 champs, que son expert-comptable importe sans
    ressaisie.

---

## 9. Messages envoyés (bus L0)

Écrits dans `.war-room/a2a/L0/BUS.md` : CHALLENGE à Maxwell (K2, K3, K4) ; REQUEST à Bertrand (acompte et exigibilité,
avoirs, plan de comptes, TVA des frais Stripe) ; REQUEST à Inès (reprise de virement et compensation de l'apporteur
dans les CGU et le contrat d'apport) ; REQUEST à Nadia (TJM plancher du portage) ; REQUEST à Sofia (comparatif des
sociétés de portage avec leurs frais) ; RISK au conseil (K2, K6) ; ANSWER à L0-006 ; HANDOFF.

---

## 10. Passation

De : tresor-cfo (Camille Aubert) · Vers : Chancelier, piste A de L3, L4, L8, tresor-comptable, tresor-juriste ·
Mission : L0 · Vague : 0 · Date : 2026-10-24

**Livré** : ce fichier. Huit parcours d'argent avec tableau, diagramme et annulation ; dix constats sur le code avec
fichier et ligne ; règles d'arrondi prouvées ; trois modèles d'apporteur et trois options chiffrées ; grand livre en
partie double avec schéma, événements et rapprochements ; décision portage cadrée ; recommandation D5 ; douze
décisions prêtes à poser ; dix idées de légende.

**Preuve** : script de calcul qui reprend les formules de `payments.ts` et `invoices.ts` (sortie §1.4) ; citations
littérales de la documentation Stripe et de la page publique de Free-Work, lues le 2026-10-24 ; fichier:ligne pour
chaque constat.

**Pas fait, ou pas vérifié** :
- Les règles fiscales de l'acompte, de l'avoir et de la TVA des frais Stripe : À SOURCER, posées à Bertrand.
- Les délais de contestation des cartes et des prélèvements SEPA, et le non-remboursement des frais Stripe sur un
  remboursement : NON VÉRIFIÉS.
- Les chiffres de Malt : repris de `CONQUETE_PARITE.md`, toujours À VÉRIFIER à la main. **Signalement** : j'ai tenté
  une lecture automatique d'une page publique de Malt (programme d'apport), qui a répondu 403 ; je n'ai pas réessayé.
  CLAUDE.md interdit toute automatisation sur Malt : cette tentative n'aurait pas dû partir, elle ne se reproduira pas.
- Aucun code modifié : le livrable est une spécification.

**Pour le receveur** : corriger K2 et K3 avant toute autre fonction d'argent ; K4 (échéances de facturation) est le
socle de P4, P5 et P6 ; le grand livre s'écrit en même temps que l'apporteur (L3.4), pas après.

**Au-delà de la demande (question du serment)** : voir la fin du compte rendu.
