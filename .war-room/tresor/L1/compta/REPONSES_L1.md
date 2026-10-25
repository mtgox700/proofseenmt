# L1 · Réponses comptables et fiscales du Trésor (Bertrand Lacombe)

Mission L1, vague 1, piste T. Écrit le 2026-10-24 sur l'arbre `wt-l1`, branche `sprint/l1-coffre`.
Répond à L1-014 (Inès), L0-010 (Camille) et à la question de la passation backend L1.0 (mentions d'une facture acquittée).

Statut de ce document : **cadre de conformité, pas un avis d'expert-comptable signé.** La liste de ce qu'un
expert-comptable inscrit à l'Ordre doit valider avant usage réel est au §5. Rien ici ne bloque le code.

Conventions : toute source a son URL et a été lue le **2026-10-24** (sauf mention contraire). **NON VÉRIFIÉ** : non lu
dans une source officielle pendant cette session. **HYPOTHÈSE** : position de travail argumentée. Les textes de Légifrance
et du BOFiP ont été lus page par page ; les citations entre guillemets sont littérales.

---

## Synthèse en dix règles (ce que le produit doit faire)

| N° | Règle produit | Urgence | Source principale |
|---|---|---|---|
| R1 | **Garder les pénalités de retard sur une facture acquittée.** L441-9 I exige sur toute facture le taux des pénalités, l'indemnité de 40 EUR et les conditions d'escompte ; aucun texte lu ne dispense une facture déjà réglée. Le backend les retire en ce moment : à annuler. | **IMMÉDIATE** (L1-042) | C. com. L441-9, L441-10, D441-5 |
| R2 | **Date d'acquittement de la facture de mission = jour où les fonds arrivent au freelance (libération), pas le jour de la charge Stripe.** « Le règlement est réputé réalisé à la date à laquelle les fonds sont mis, par le client, à la disposition du bénéficiaire ». Le code actuel mélange deux qualifications incompatibles (§2.1). | **IMMÉDIATE** (L1-042) | C. com. L441-9 I al. 5 |
| R3 | Le taux de pénalités imprimé est **celui du contrat** ; « trois fois le taux d'intérêt légal » seulement si le contrat le stipule. Sinon, taux légal par défaut : BCE plus 10 points. | haute | C. com. L441-10 II |
| R4 | Toutes les dates légales d'une facture (émission, acquittement, échéance) sont calculées **dans le même fuseau que l'année du numéro (Europe/Paris)**. Aujourd'hui, le numéro est à l'heure de Paris et la date imprimée en UTC. | haute (L1-043) | 242 nonies A I 6° et 7° |
| R5 | Mention de franchise : « TVA non applicable, article 293 B du CGI » pour toute facture **émise** jusqu'au **30 juin 2028** inclus ; la date d'émission (Paris) décide. Au-delà, mention non publiée à ce jour : le rendu échoue tant qu'elle n'est pas sourcée. | moyenne (L1-040) | BOI-RES-TVA-000253 §3.1 ; ord. 2025-1247 art. 46 II modifié par ord. 2026-671 art. 17 |
| R6 | Nouvelles références au 1er janvier 2027 (CIBS, rédaction de l'**ordonnance n° 2026-671**, pas celle de 2025-1247) : mandat de facturation **L. 216-35**, facture d'acompte **L. 216-32**, exigibilité des services **L. 214-6**, autoliquidation **L. 215-5** et **L. 214-7**, franchise **L. 233-3, L. 233-18, L. 233-21**. Les numéros L. 223-x cités ailleurs sont périmés. | moyenne | Légifrance, versions « à venir » du 01/01/2027 |
| R7 | Paiement avant facture : la qualification (acompte ou consignation) **dépend des CGU, pas du code**. Le produit applique une seule qualification de bout en bout (§2.1), et **les frais de service payés d'avance par l'entreprise (P1-bis) sont, eux, un acompte encaissé par E-KIGAI** : facture d'acompte et TVA collectée dès la charge. | haute avant GO PAIEMENT LIVE | CGI 269-2-c, 289 I-1 c ; CE 24/02/2021 n° 429647 ; BOFiP BASE-20-20 §80 |
| R8 | Avoir sous mandat : numéro dans **la série du freelance** (même séquence que ses factures), référence au numéro et à la date de la facture d'origine, toutes les mentions, émis au nom et pour le compte du freelance, accepté par lui ; **le mandat doit couvrir expressément les factures rectificatives**. | haute (P6, L3) | CGI 289 I-5 ; BOFiP DECLA-30-20-20-20 §180, §220 ; DECLA-30-20-10-30 §140 |
| R9 | Frais Stripe (Irlande, sans TVA) : autoliquidation par E-KIGAI si la prestation est taxable ; part exonérée NON VÉRIFIÉE. Écriture 6278 et, si taxable, 44566 / 4452. | moyenne | CGI 283-2 ; CIBS L. 215-5 ; aide Stripe |
| R10 | Plan de comptes : **468** (et non 467) pour les fonds dus aux tiers, **517** pour le solde Stripe, **580** pour les versements en transit ; les autres comptes de Camille sont confirmés (§2.4). | moyenne (L1-044) | PCG 2025 et règlement ANC 2014-03 version 2026 |

---

## 1. Question 1 (L1-014) : 289 et 293 B abrogés au 1er janvier 2027

### 1.1 Règle produit, en tête

```
franchiseMention(issuedOn: ParisDate):
  issuedOn <= 2028-06-30  -> "TVA non applicable, article 293 B du CGI"
  issuedOn >= 2028-07-01  -> throw SourceExpired("franchise-mention")   // tant qu'aucune mention CIBS n'est publiée et sourcée
CI: fails from 2028-05-01 (60 days before) if no successor mention is registered with an official source
Invoices already issued are never re-rendered with another mention (immutable).
```

- **C'est la date d'émission qui décide**, à l'heure de Paris (R4). Une facture émise le 31/12/2026 et une facture émise
  le 15/03/2027 portent la même mention ; aucune n'est à refaire.
- Libellé exact à imprimer : « TVA non applicable, article 293 B du CGI » (texte du BOFiP). Le code imprime aujourd'hui
  « TVA non applicable, art. 293 B du CGI. » : l'abréviation est d'usage courant et n'est pas une faute, mais un test
  écrit contre le texte officiel est plus sûr. Recommandation : aligner sur le libellé du BOFiP.
- Mention de repli déjà admise aujourd'hui et indépendante de toute recodification : « une référence à l'article 284 de
  la directive 2006/112/CE » (même paragraphe du BOFiP). Libellé exact de cette variante : non fixé par le texte ; à
  arrêter avec l'expert-comptable si l'on veut basculer avant 2028.
- Contrats et mandats (gabarits d'Inès) : les références au CGI des contrats **existants au 1er janvier 2027** se lisent
  de plein droit comme des références au CIBS (art. 46 I 1°) ; celles des actes et contrats « susceptibles de produire
  des effets jusqu'au 30 juin 2028 » aussi (art. 46 II modifié). Pour un **nouveau** gabarit rendu à partir du
  1er janvier 2027, je recommande de citer directement le CIBS (L. 216-35 pour le mandat), parce qu'un contrat-cadre peut
  produire des effets après le 30 juin 2028. Le `validUntil: 2026-12-31` d'Inès pour `cgi-289` dans les **contrats** est
  donc prudent et juste, à condition d'ajouter la source qui prend le relais (§1.4). Pour les **factures**,
  `cgi-293b` vaut jusqu'au **2028-06-30**, pas 2026-12-31 : sinon le moteur refuserait à tort toute facture en
  franchise dès janvier 2027.

### 1.2 Ce que disent les textes

**Abrogation.** Ordonnance n° 2025-1247 du 17 décembre 2025 portant recodification de la TVA (JORF n° 0298 du
20/12/2025), art. 9, 27° : « Le chapitre premier du titre II est abrogé. » Ce chapitre est celui de la TVA dans le CGI
(art. 256-0 et suivants), donc 269, 283, 289 et 293 B. Les pages Légifrance de ces articles affichent « Abrogé par
Ordonnance n° 2025-1247 du 17 décembre 2025, art. 9 », avec effet au 1er janvier 2027, sauf les dispositions listées à
l'art. 15 (maintenues jusqu'à leur reprise réglementaire).
https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053091516

**Date d'entrée en vigueur : 1er janvier 2027, par une seconde ordonnance.** L'art. 49 de 2025-1247 disait « La
présente ordonnance entre en vigueur le 1er septembre 2026 ». L'**ordonnance n° 2026-671 du 27 juillet 2026** portant
divers ajustements du CIBS (JORF n° 0174 du 28/07/2026), art. 17 : à l'art. 49, « La date : « 1er septembre 2026 » est
remplacée par la date : « 1er janvier 2027 » » ; à l'art. 46 II, « la date : « 31 décembre 2027 » est remplacée par la
date : « 30 juin 2028 » ». Son art. 3 : « L'annexe de l'ordonnance du 17 décembre 2025 susvisée est remplacée par
l'annexe A à la présente ordonnance. » Son art. 19 : entrée en vigueur au 1er janvier 2027.
https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054497160

Conséquence que personne n'avait vue : **l'annexe de 2025-1247 (celle qui numérotait la franchise en L. 223-x et les
factures en L. 216-33 à L. 216-46) a été remplacée.** Le livre II en vigueur au 1er janvier 2027 est celui de l'annexe A
de 2026-671, avec une autre numérotation (franchise en L. 233-x, factures en L. 216-25 à L. 216-38). Les sites qui citent
« L. 223-3 du CIBS » se trompent pour 2027.

**Article 46 de 2025-1247 (texte initial), cité mot pour mot :** « I. - Dans l'ensemble des textes législatifs et
réglementaires, des actes de l'administration, y compris les titres exécutoires, des factures et des contrats existants
à la date mentionnée, selon le cas, à l'article 15, à l'article 47 ou à l'article 49 : 1° Les références aux
dispositions du code général des impôts relatives à la taxe sur la valeur ajoutée s'entendent de références aux
dispositions du code des impositions sur les biens et services qui les reprennent ; [...] II. - Le 1° du I est également
applicable à l'ensemble des actes de l'administration, y compris les titres exécutoires, des factures et des contrats
susceptibles de produire des effets jusqu'au 31 décembre 2027. » (date portée au 30 juin 2028 par 2026-671, art. 17).

**Doctrine sur les factures.** BOI-RES-TVA-000253-20261007 (rescrit, publié le 07/10/2026), section 3.1 « Quelles sont
les incidences sur les règles de facturation [...] ? » : « les règles déterminant le format des factures et la
transmission électronique de données restent régies par les dispositions du code général des impôts à compter du
1er janvier 2027 » ; « il convient de continuer à se référer aux dispositions du code général des impôts » ;
« s'agissant des mentions juridiques devant figurer sur les factures elles-mêmes, les renvois au code général des impôts
seront possibles jusqu'au 30 juin 2028 conformément au II de l'article 46 de l'ordonnance n° 2025-1247 du 17 décembre
2025 ». Section 3.2 : les actes « restent valables y compris lorsqu'ils interviennent après le 1er janvier 2027 ».
https://bofip.impots.gouv.fr/bofip/14901-PGP.html/identifiant=BOI-RES-TVA-000253-20261007

**Mention de franchise aujourd'hui.** BOI-TVA-DECLA-40-10-20 (publié le 01/07/2026), § 50 et alinéa suivant : « Les
bénéficiaires de la franchise doivent indiquer sur les factures, la note d'honoraires ou sur tout autre document en tenant
lieu, la mention : TVA non applicable, article 293 B du CGI ou « TVA non applicable, article 293 B bis du CGI » ou une
référence à l'article 284 de la directive 2006/112/ CE du Conseil du 28 novembre 2006 modifiée relative au système
commun de taxe sur la valeur ajoutée. » https://bofip.impots.gouv.fr/bofip/1079-PGP

Remarque de rigueur : l'art. 242 nonies A de l'annexe II (mentions obligatoires, en vigueur depuis le 01/01/2025, décret
n° 2024-1195) ne fixe aucun libellé de franchise ; son II dispense même les factures des franchisés des mentions 2° et
12°. Le libellé vient du BOFiP, opposable à l'administration. https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050811276

### 1.3 Articles de destination au 1er janvier 2027 (CIBS, versions « à venir » lues sur Légifrance)

| Règle | CGI (jusqu'au 31/12/2026) | CIBS au 01/01/2027 | Texte lu (extrait littéral) | URL |
|---|---|---|---|---|
| Mandat de facturation | 289 I-2 | **L. 216-35** | « Le fournisseur d'une opération peut remplir l'obligation de facturation en mandatant une autre personne afin qu'elle effectue matériellement l'émission de la facture. L'obligation de facturation est alors remplie du fait de l'acceptation de la facture par le fournisseur. La facture émise par le mandataire et acceptée par le fournisseur est réputée émise au nom et pour le compte de ce fournisseur. » Un décret fixe les conditions d'information et d'acceptation. | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054525397/2027-01-01 |
| Autofacturation (le client émet) | 289 I-2 | L. 216-35 (même article : « une autre personne ») | idem | idem |
| Obligation de facturer | 289 I-1 a et b | L. 216-30 | « Le fournisseur assujetti s'assure de l'émission d'une facture [...] pour chaque opération qu'il effectue à titre onéreux » vers un assujetti ou une personne morale | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054525409/2027-01-01 |
| Facture d'acompte | 289 I-1 c | **L. 216-32** | « [...] pour toute contrepartie d'une opération effectuée à titre onéreux relevant de l'article L. 216-30 perçue avant l'intervention du fait générateur de cette opération. » | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054525405/2027-01-01 |
| Mentions | 289 II, ann. II 242 nonies A | L. 216-33 (renvoi à un décret ; l'art. 242 nonies A reste la référence, BOI-RES §3.1) | « Un décret détermine les mentions [...] » | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054525403/2027-01-01 |
| Délai d'émission | 289 I-3 | L. 216-34 | délais fixés par arrêté, « au plus tard à la fin du deuxième mois qui suit le fait générateur ou l'exigibilité de la taxe » | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054525399/2027-01-01 |
| Exigibilité des services | 269-2-c | **L. 214-6** | « la taxe à laquelle est soumise une prestation de services [...] devient exigible au moment de chaque perception par le fournisseur d'une contrepartie de cette opération » ; option pour les débits (L. 214-9) ; « En cas de restitution d'une contrepartie par le fournisseur, le droit à minoration de taxe devient exigible à ce moment. » | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054525647/2027-01-01 |
| Autoliquidation (redevable) | 283-2 | **L. 215-5** | « le destinataire est redevable de la taxe à laquelle est soumise l'opération fournie depuis l'étranger à un assujetti ou une personne morale non assujettie. » | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054525595/2027-01-01 |
| Exigibilité en autoliquidation | (269) | L. 214-7 | exigible « Lors de toute perception par le fournisseur avant le fait générateur » et « Lors de l'intervention du fait générateur » | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054525645/2027-01-01 |
| Franchise : qualification | 293 B I | **L. 233-3** | l'entreprise franchisée « s'entend de l'assujetti qui remplit l'ensemble des conditions suivantes » (rattachement, aucun plafond dépassé, pas de renonciation au sens de L. 233-6) | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054524584/2027-01-01 |
| Franchise : opérations | 293 B | L. 233-18 | « L'opération soumise à la franchise française s'entend de la livraison de biens ou prestation de services qui remplit l'ensemble des conditions suivantes » | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054524542/2027-01-01 |
| Franchise : effet | 293 B | **L. 233-21** | « L'opération soumise à la franchise française relève d'une exonération dérogatoire. » | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054524534/2027-01-01 |
| Plafonds | 293 B I | L. 233-9 à L. 233-13 | non relus (montants inchangés à droit constant : NON VÉRIFIÉ) | table des matières CIBS au 01/01/2027 |

**Libellé de la mention de franchise sous le CIBS : NON VÉRIFIÉ, non publié** dans les textes lus (le CIBS ne contient
aucun article de mention ; le BOFiP de juillet 2026 cite encore 293 B). Si l'on veut une mention CIBS après le
30 juin 2028, le candidat logique est l'article d'exonération (L. 233-21), mais ce n'est qu'une HYPOTHÈSE : on n'imprime
rien tant que l'administration n'a pas publié le libellé. Table de concordance officielle : annoncée sur Légifrance par le
BOI-RES-TVA-000253, non consultée.

### 1.4 Sources à ajouter au registre d'Inès (proposition, je ne touche pas à `sources.yaml`)

```yaml
cgi-293b-invoice-mention:      # pour les factures, distinct de cgi-293b des contrats
  title: "Mention « TVA non applicable, article 293 B du CGI » (BOI-TVA-DECLA-40-10-20 §50), admise sur les factures jusqu'au 30 juin 2028"
  url: "https://bofip.impots.gouv.fr/bofip/1079-PGP"
  readOn: "2026-10-24"
  read: official
  validUntil: "2028-06-30"
  note: "BOI-RES-TVA-000253 §3.1 ; ord. 2025-1247 art. 46 II modifié par ord. 2026-671 art. 17."
cibs-l216-35:
  title: "CIBS, art. L. 216-35 (mandat de facturation ; obligation remplie par l'acceptation du fournisseur)"
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054525397/2027-01-01"
  readOn: "2026-10-24"
  read: official
  validFrom: "2027-01-01"   # champ à créer dans TEMPLATE_FORMAT si absent
  validUntil: null
ord-2026-671:
  title: "Ordonnance n° 2026-671 du 27 juillet 2026 portant divers ajustements du CIBS (entrée en vigueur du livre II au 1er janvier 2027 ; renvois au CGI jusqu'au 30 juin 2028)"
  url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054497160"
  readOn: "2026-10-24"
  read: official
  validUntil: null
bofip-res-tva-000253:
  title: "BOI-RES-TVA-000253-20261007 (incidences de la recodification sur les factures et les contrats)"
  url: "https://bofip.impots.gouv.fr/bofip/14901-PGP.html/identifiant=BOI-RES-TVA-000253-20261007"
  readOn: "2026-10-24"
  read: official
  validUntil: null
```

La note de `cgi-289` (« Article de reprise du mandat de facturation : NON VÉRIFIÉ ») peut être remplacée par :
« repris par CIBS L. 216-35 au 1er janvier 2027 (ord. 2026-671, annexe A) ».

### 1.5 Endroits du code qui citent 289, 293 B ou le mandat (git grep sur `wt-l1`, 2026-10-24)

Commande : `git grep -n -I -E "(art\.?|article) ?289|289 ?(I|bis)\b|293 ?B|242 nonies" -- . ':!pnpm-lock.yaml'`, plus
lecture de `billing-fr.ts`.

| Fichier:ligne | Ce qui est cité | Nature | À faire |
|---|---|---|---|
| `packages/invoicing/src/render.ts:53` | `VAT_EXEMPT = "TVA non applicable, art. 293 B du CGI."` | **texte légal imprimé** | remplacer la constante par `franchiseMention(issuedOn)` (§1.1) ; libellé BOFiP |
| `packages/invoicing/src/render.ts:2-8` | commentaire 242 nonies A, L441-9, L441-10, 293 B | commentaire | mettre à jour avec la règle datée |
| `packages/invoicing/src/cii.ts:62` (via `VAT_EXEMPT`) | `ExemptionReason` du XML | **texte légal transmis** | même fonction datée ; en EN 16931, prévoir aussi un code de motif d'exonération (BT-121) : liste à lire, NON VÉRIFIÉ |
| `packages/invoicing/src/cii.ts:9` | commentaire « art. 289 I-2 du CGI » | commentaire | ajouter « CIBS L. 216-35 au 01/01/2027 » |
| `packages/invoicing/test/cii.test.ts:75` | attend la chaîne exacte | test | réécrire en deux tests datés (2026-12-31 et 2027-03-15 donnent 293 B ; 2028-07-01 lève) |
| `packages/db/src/billing.ts:40` | commentaire `vatRateBp` « art. 293 B du CGI » | commentaire | sans effet légal |
| `packages/db/prisma/schema.prisma:377` et `:388` | commentaires 293 B et « mandat de facturation (art. 289 I-2 du CGI) » | commentaire (recopié dans `src/generated/models/BillingIdentity.ts:823,842`) | sans effet légal ; mise à jour au prochain `prisma generate` |
| `apps/web/src/i18n/market/billing-fr.ts:14` et `billing-en.ts:15` | libellé « Franchise en base (art. 293 B du CGI) » | texte d'interface | exact jusqu'au 30/06/2028 ; à dater comme la mention |
| `apps/web/src/i18n/market/billing-fr.ts:21` | texte du mandat accepté, une phrase, aucun article | **texte contractuel** | voir §3.3 : il ne couvre ni les factures rectificatives, ni l'acceptation, ni le délai de contestation |
| `packages/db/prisma/seeds/articles-drafts.ts:75` et `:160` | articles éditoriaux : 293 B et seuils 37 500 / 41 250 EUR | contenu publié | ajouter « jusqu'au 30 juin 2028, puis CIBS » au plus tard en décembre 2026 |
| `.war-room/tresor/L1/templates/*/template.yaml` (`quote` vat, `service-agreement` platform-role, vat, invoicing) | sources `cgi-289`, `cgi-293b` | gabarits d'Inès | §1.4 |

Aucun endroit du code produit ne cite l'art. 269 du CGI.

---

## 2. Question 2 (L0-010) : acompte, avoir sous mandat, frais Stripe, plan de comptes

### 2.1 (a) Le client paie avant toute facture : acompte ou consignation ?

**Règle produit, en tête.** La réponse fiscale dépend d'un fait juridique que le code ne décide pas : **à qui appartient
l'argent pendant qu'il attend la validation.** Deux qualifications sont possibles ; le produit doit en appliquer **une
seule, de bout en bout**. Aujourd'hui il en mélange deux.

| | **Q-A. Consignation (recommandée, sous réserve de validation)** | **Q-B. Encaissement par un mandataire du freelance** |
|---|---|---|
| Ce que disent les CGU | les fonds du client sont conservés par Stripe sur le compte de la plateforme, ne sont ni acquis au freelance ni à sa disposition, et lui sont versés à la validation ; le règlement du client est réputé réalisé à ce versement | Proofseen encaisse au nom et pour le compte du freelance ; le paiement du client à Proofseen le libère |
| TVA du freelance exigible | à la **libération** (versement sur son compte connecté) | à la **charge Stripe** |
| Facture d'acompte sous mandat | **aucune** | **obligatoire** à la charge (CGI 289 I-1 c ; CIBS L. 216-32), avec la date du versement (242 nonies A I 10°) |
| Facture de mission (F1) | une seule, à la libération, acquittée **le jour de la libération** | facture définitive à la réalisation, qui rappelle la ou les factures d'acompte ; reste dû nul |
| Compte chez Proofseen | 4681 « Clients, fonds consignés en attente de validation » (auxiliaire par contrat) | 4681 « Fonds reçus pour le compte des freelances » (auxiliaire par freelance) |
| Remboursement avant libération | rien à rectifier côté freelance | avoir sur la facture d'acompte ; minoration de TVA à la restitution (CIBS L. 214-6 al. 3) |
| Charge pour le freelance | TVA due quand il a l'argent | TVA due avant d'avoir l'argent |

**Ce que fait le code aujourd'hui** : il imprime « acquittée le » à la date de la charge (`Payment.paidAt`,
`invoice-settlement.ts`), ce qui suppose Q-B, mais il n'émet aucune facture d'acompte, ce qui n'est permis qu'en Q-A.
**Il a tort dans les deux qualifications.** De plus, `paidAt` est l'heure de réception du webhook (L1-060 B3) et, pour
les paiements anciens, une date devinée (L1-050 H3) : une facture immuable porterait une date fausse.

**Règle à coder tout de suite, valable en Q-A et sans attendre la décision** : `paidOn` de la facture de mission = jour
de la libération (jour d'émission, à l'heure de Paris), comme la facture de commission. Elle supprime la dépendance à
`paidAt` pour les factures. Si l'expert-comptable retient Q-B, on ajoute la facture d'acompte à `payment.succeeded`
(travail de L3 ou L5), et l'acquittement de la facture définitive renvoie à elle.

**Pourquoi Q-A est défendable :**
- Code de commerce L441-9 I al. 5 : « Le règlement est réputé réalisé à la date à laquelle les fonds sont mis, par le
  client, à la disposition du bénéficiaire ou de son subrogé. » Le bénéficiaire est le freelance ; Proofseen n'est pas
  son subrogé. https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414397/
- BOI-TVA-BASE-20-20-20181107, intitulé du III-E : « Paiement par inscription de sommes au crédit d'un compte dont le
  redevable a la libre disposition » ; § 80 : l'inscription « au crédit d'un compte dont il avait la disposition devait
  être regardée comme un encaissement » (CE, 14 janvier 1981, n° 07632). A contrario, des fonds dont le freelance n'a pas
  la disposition ne sont pas encaissés par lui. § 50 : par virement, « l'encaissement est constitué par l'inscription au
  compte du fournisseur de la somme ».
- Même BOI, § 160 (notaires) : « Il est admis que le versement sur un compte de tiers d'une provision pour frais d'acte
  n'entraîne pas l'exigibilité de la taxe » ; elle devient exigible quand la somme est virée au compte de l'étude. § 140
  (collectivités) : quand un mandataire perçoit pour le compte d'autrui, l'exigibilité intervient « à celle du versement
  à la collectivité par le mandataire des sommes correspondantes ». Ces deux paragraphes visent des cas particuliers :
  ils éclairent, ils ne règlent pas le cas d'une marketplace (HYPOTHÈSE d'analogie).
  https://bofip.impots.gouv.fr/bofip/283-PGP.html/identifiant=BOI-TVA-BASE-20-20-20181107

**Pourquoi Q-B n'est pas exclue :**
- CGI 269-2-c : pour les prestations de services, la taxe est exigible « lors de l'encaissement des acomptes, du prix, de
  la rémunération » ; 269-2-a : en cas d'acompte, exigible « au moment de son encaissement, à concurrence du montant
  encaissé ». https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044983827
- CE, 9e et 10e ch. réunies, 24 février 2021, n° 429647 (mentionné aux tables) : la taxe devient exigible « dès
  l'encaissement, à concurrence du montant encaissé », à condition que « tous les éléments pertinents du fait générateur »
  soient connus et « que la réalisation de la prestation ne soit pas incertaine » (CJUE Firin C-107/13, Kollross
  C-660/16). Un contrat signé, objet et prix connus, remplit la première condition.
  https://www.legifrance.gouv.fr/ceta/id/CETATEXT000043205031
- Le libellé actuel du compte proposé par Camille, « fonds reçus pour le compte d'un freelance », **est un aveu de Q-B** :
  recevoir pour le compte de quelqu'un, c'est encaisser comme son mandataire. Le libellé du compte, les CGU et le
  parcours doivent dire la même chose.

**Les frais de service payés d'avance par l'entreprise (P1-bis) : acompte, sans discussion utile.** Ils sont la
rémunération d'E-KIGAI elle-même, inscrite sur le solde Stripe de sa propre plateforme : E-KIGAI en a la disposition
(§ 80 ci-dessus). C'est un acompte au sens du 269-2-a et du 289 I-1 c : **facture d'acompte E-KIGAI vers l'entreprise à
la charge, TVA collectée à la charge**, facture définitive à la libération qui rappelle l'acompte. L'écriture de Camille,
qui ne constate la TVA qu'à la libération, est à corriger (§2.4).

Ce qui ferait de cette question une légende plutôt qu'un risque : **demander un rescrit à la DGFiP** (LPF L80 B) sur la
qualification Q-A, avant le GO PAIEMENT LIVE. Décision du founder (coût, délai) ; délai de réponse et forme : NON
VÉRIFIÉ.

Tests à écrire (piste A) :
```
it("dates the mission invoice settlement on the release day, not the charge day")
it("never issues a mission invoice before release under the consignment model")
it("issues a down-payment invoice from E-KIGAI at charge when the company prepays the service fee")
it("final service-fee invoice references the down-payment invoice number and date")
it("refuses to render 'acquittée' with a date later than the issue date or earlier than the release")
```

### 2.2 (b) Numérotation et mentions d'un avoir sous mandat

**Règle produit.**
1. **Numéro** : dans **la série de l'émetteur de la facture d'origine** (`InvoiceSequence(issuer, year)`) : série du
   freelance pour un avoir de mission (préfixe `{référence}`), série `PS` pour un avoir de commission. Même compteur que
   les factures : chronologique, continu, sans trou, jamais réutilisé. Le type du document (facture ou avoir) se lit dans
   son titre et son code de type, pas dans une série à part. Raison : l'avoir est assimilé à une facture (ci-dessous) et
   le BOFiP n'admet de séries distinctes que si l'activité le justifie ; une série « avoirs » séparée est une pratique
   répandue, **non lue dans un texte officiel** (NON VÉRIFIÉ). La série unique est sûre dans tous les cas.
2. **Mentions** : toutes celles d'une facture (CGI 289 I-5 ; BOFiP DECLA-30-20-20-20 § 180 : les factures rectificatives
   « doivent comporter toutes les mentions obligatoires »), plus la **référence explicite à la facture initiale (numéro et
   date)** (§ 220), la mention « Avoir établi par E-KIGAI (Proofseen) au nom et pour le compte de {freelance} » (mention
   recommandée par le BOI-TVA-DECLA-30-20-10-30 § 210 : « facture établie par A au nom et pour le compte de B »), la
   franchise le cas échéant (§1.1), les montants HT, TVA et TTC négatifs ou présentés en déduction, et le motif.
3. **Pas de mention « Autofacturation »** sur les factures et avoirs de mission : 242 nonies A I 14° la réserve au cas où
   « l'acquéreur ou le preneur émet la facture au nom et pour le compte de l'assujetti ». Proofseen n'est pas l'acquéreur.
   **À l'inverse, l'autofacture de l'apporteur (P2, L3) doit la porter** : là, Proofseen est le preneur du service
   d'apport. Le code actuel a raison pour la mission (`cii.ts:9`, code 380) ; L3 devra utiliser le code de type
   d'autofacture et la mention.
4. **Le mandat doit couvrir les rectificatives.** BOI-TVA-DECLA-30-20-10-30 § 140 : « le mandat peut ne porter que sur
   les seules factures initiales, à l'exclusion des factures rectificatives ». Le mandat accepté aujourd'hui
   (`billing-fr.ts:21`) dit « mes factures de mission » : silence sur les avoirs. Sans clause, Proofseen n'a pas le
   pouvoir d'émettre l'avoir au nom du freelance.
5. **Acceptation de chaque avoir** par le freelance, comme chaque facture : § 150 « Toute facture émise au nom et pour le
   compte du fournisseur doit faire l'objet d'une acceptation par ce dernier » ; acceptation tacite possible si le mandat
   fixe un délai (§ 140, § 160). Au 01/01/2027, CIBS L. 216-35 : l'obligation est remplie « du fait de l'acceptation ».
6. **Calcul** : R4 et R5 de Camille confirmés (valeur absolue puis signe ; méthode du cumul). TVA de l'avoir calculée sur
   le HT de l'avoir, une fois. Côté client assujetti : il réduit sa TVA déduite (§ 260 : il « est tenu » d'« atténuer le
   montant de cette déduction »). Côté freelance en régime des encaissements : minoration de TVA à la restitution des fonds
   (L. 214-6 al. 3), donc à la reprise de virement, pas à l'émission de l'avoir.
7. **Format structuré** : avoir en code de type 381 (UNTDID 1001) avec référence à la facture d'origine dans le XML
   (`InvoiceReferencedDocument`, BT-25) : connaissance de la norme EN 16931, NON VÉRIFIÉE dans un texte officiel français
   pendant cette session ; à valider par la plateforme agréée.

Sources : https://bofip.impots.gouv.fr/bofip/142-PGP.html/identifiant=BOI-TVA-DECLA-30-20-20-20-20220119 ;
https://bofip.impots.gouv.fr/bofip/13244-PGP.html/identifiant=BOI-TVA-DECLA-30-20-10-30-20220629 ;
https://bofip.impots.gouv.fr/bofip/140-PGP.html/identifiant=BOI-TVA-DECLA-30-20-20-10-20131018 (§ 70 « un numéro
unique basé sur une séquence chronologique et continue » ; § 100 séries distinctes admises notamment pour la
« facturation pour compte de tiers » ; § 130 « le mandataire utilise une séquence de facturation chronologique et
continue distincte pour chacun de ses mandants » : la série par freelance du code est conforme).

Tests :
```
it("numbers a mission credit note in the freelancer's own series, next number, no gap")
it("refuses a credit note without the original invoice number and date")
it("refuses a mission credit note when the mandate does not cover corrective invoices")
it("never prints 'Autofacturation' on a mission invoice or credit note")
it("rounds credit note VAT on the absolute value, then applies the sign")
```

### 2.3 (c) TVA sur les frais Stripe facturés depuis l'Irlande

**Règle produit.** Les frais Stripe arrivent **sans TVA** ; E-KIGAI, preneur assujetti en France, **autoliquide** la TVA
sur la part taxable. Le grand livre enregistre chaque frais en HT, avec un indicateur par type de frais
(`reverseCharge: taxable | exempt | unknown`) ; tant que la part exonérée n'est pas confirmée par l'expert-comptable,
`unknown` est traité comme taxable (autoliquidation neutre en trésorerie pour une entreprise qui déduit toute sa TVA :
même montant en TVA due et en TVA déductible).

Faits lus :
- Stripe : « Stripe supplies payment processing and other services (such as Billing, Radar, and Tax) from our
  establishment in Ireland » et ne facture pas de TVA, sauf en Irlande, Norvège, Suisse, Liechtenstein et Émirats.
  https://support.stripe.com/questions/global-taxation-of-stripe-fees
- Stripe, factures depuis le 1er juillet 2025 : « VAT is not charged, being an intracommunity supply of services. You may
  need to self-assess any VAT due using the reverse charge mechanism. » ; facture PDF mensuelle, qui n'est pas une
  facture électronique. https://support.stripe.com/questions/what-tax-invoices-or-tax-documents-will-i-receive-for-fees-and-services-after-july-1-2025?locale=en-GB
- CGI 283-2 (en vigueur, abrogé au 01/01/2027) : pour les prestations du 1° de l'art. 259 fournies par un assujetti non
  établi en France, « la taxe doit être acquittée par le preneur ». https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051214570
  Au 01/01/2027 : CIBS L. 215-5 et, pour l'exigibilité, L. 214-7 (§1.3).

NON VÉRIFIÉ : (1) la part des frais Stripe qui serait une opération financière exonérée (paiements) et non une
prestation taxable ; jurisprudence européenne sur les frais de traitement des cartes non lue ; (2) les lignes exactes de
la déclaration CA3 ; (3) l'e-reporting des acquisitions de services intra-européens à partir du 1er septembre 2027.

Écriture, exemple de Camille (frais 209,35 EUR) :

| Événement | Débit | Crédit |
|---|---|---|
| Frais Stripe (charge, Connect, compte actif) | 6278 Autres frais et commissions sur prestations de services 209,35 | 5171 Stripe 209,35 |
| Autoliquidation, si taxable (20 %) | 44566 TVA sur autres biens et services 41,87 | 4452 TVA due intracommunautaire 41,87 |

### 2.4 (d) Plan de comptes et écritures de Camille (§2 et §4.3) : confirmé ou corrigé

Référence : plan de comptes PCG 2025 de l'ANC et règlement ANC n° 2014-03 en version du 1er janvier 2026, lus en PDF
le 2026-10-24.
https://www.anc.gouv.fr/files/anc/files/1_Normes_fran%C3%A7aises/Plans%20comptables/Plan-de-comptes-PCG-2025.pdf ;
https://www.anc.gouv.fr/files/anc/files/1_Normes_fran%C3%A7aises/Plans%20comptables/2026/PCG--1er-janvier-2026.pdf

Principe confirmé, PCG art. 621-11 : « Les opérations traitées par l'entité pour le compte de tiers en qualité de
mandataire sont comptabilisées dans un compte de tiers. Seule la rémunération de l'entité est comptabilisée dans le
résultat. » Donc : la facture de mission F1 ne passe pas dans le résultat de Proofseen (confirmé), seule la commission
(706) y passe. Attention à la seconde phrase du même article : « Les opérations traitées, pour le compte de tiers, au nom
de l'entité, sont inscrites selon leur nature dans les charges et les produits de l'entité. » Si Proofseen agissait en
son nom propre (commissionnaire), toute la mission deviendrait son chiffre d'affaires. Le mandat « au nom et pour le
compte » du freelance est ce qui l'évite : il doit rester écrit et réel.

| Compte proposé | Verdict | Libellé PCG lu | Raison et correction |
|---|---|---|---|
| 467F, 467P | **CORRIGÉ en 4681, 4682** | 467 « Divers comptes débiteurs et produits à recevoir » ; 468 « Divers comptes créditeurs et charges à payer » | Depuis le PCG 2025, 467 et 468 sont séparés. Art. 1214-46 : « Les opérations dont le solde peut être indifféremment soit débiteur, soit créditeur sont comptabilisées à des subdivisions ouvertes sous le compte 467 [...] ou le compte 468 ». Les fonds dus aux tiers sont créditeurs par construction (Camille : « aucun 467 d'un tiers n'est jamais débiteur ») : 4681 (freelances ou clients selon §2.1) et 4682 (sociétés de portage), un auxiliaire par tiers. Une créance sur un freelance (reprise de virement impossible) va en **4671** « Freelances débiteurs », jamais en solde débiteur de 4681. |
| 4191 | CONFIRMÉ, écriture corrigée | « Clients - Avances et acomptes reçus sur commandes » | Juste pour les frais de service payés d'avance (P1-bis). Mais la TVA est exigible à la charge (§2.1) : voir l'écriture corrigée ci-dessous. Art. 1214-41 : le 411 est crédité « du compte 4191 [...] pour solde de ce dernier ». |
| 6222 | CONFIRMÉ | « Commissions et courtages sur ventes » | Commission d'apporteur. Charge à payer en clôture : 6222 D / 4081 « Fournisseurs - Factures non parvenues » C (et 44586 D si TVA). |
| 401A | CONFIRMÉ (sous la forme 4011 + auxiliaire apporteur) | « Fournisseurs - Achats de biens et prestations de services » | Un auxiliaire par apporteur, aussi pour un particulier (relevé). Compteur DAS2 tiré du grand livre. |
| 512S (« 512x Stripe ») | **CORRIGÉ en 5171** (à valider) | 512 « Banques » ; 517 « Autres organismes financiers » | Art. 1215-51 : « Pour chaque compte bancaire dont elle est titulaire, l'entité utilise une subdivision distincte du compte 512 ». Stripe Technology Europe est un établissement de monnaie électronique, pas une banque : 517 décrit mieux le solde Stripe. Une subdivision de 512 est une pratique répandue et acceptable ; l'expert tranche. |
| 512B | CONFIRMÉ (5121) | « Comptes en euros » | Banque d'E-KIGAI. |
| (absent) | **AJOUTÉ : 580** | « Virements internes » | Art. 1215-58 : comptes de passage pour les virements de fonds d'un compte de trésorerie à un autre. Versement Stripe : `payout.created` 580 D / 5171 C ; `payout.paid` 5121 D / 580 C. Le rapprochement bancaire voit l'argent en transit. |
| 706 | CONFIRMÉ | « Prestations de services » | Commission et frais de service, activité principale (plutôt que 7082). |
| 627 | CONFIRMÉ, précisé en 6278 | « Autres frais et commissions sur prestations de services » | Frais Stripe, frais de litige de 20 EUR. |
| 44571 | CONFIRMÉ | « TVA collectée » | |
| 44566 | CONFIRMÉ | « TVA sur autres biens et services » | Plus 4452 « TVA due intracommunautaire » pour l'autoliquidation (§2.3). |
| 411 | CONFIRMÉ | « Clients » | Le freelance est client de Proofseen pour la commission (P1) : auxiliaire par freelance. |
| (absent) | **AJOUTÉ : 4458** | « Taxes sur le chiffre d'affaires à régulariser ou en attente » | TVA déjà collectée sur un acompte, soldée à la facture définitive. |
| (absent) | AJOUTÉ : 654, 709 | « Pertes sur créances irrécouvrables » ; « Rabais, remises et ristournes accordés » | Reprise sur freelance abandonnée ; réduction de commission par avoir (ou 706 D si annulation : l'expert choisit). |

Écritures corrigées (mission de 10 000,00 HT, TVA 20 %, commission 10 %, montants de Camille) :

| Événement | Débit | Crédit | Correction |
|---|---|---|---|
| P1 charge reçue | 5171 12 000,00 | 4681 12 000,00 | comptes |
| P1 libération et compensation | 4681 12 000,00 | 5171 10 800,00 ; 411 (freelance) 1 200,00 | comptes ; la TVA de la commission est exigible ici (encaissement par compensation) |
| P1 facture de commission F2 | 411 (freelance) 1 200,00 | 706 1 000,00 ; 44571 200,00 | confirmée |
| P1-bis charge reçue | 5171 13 200,00 ; 4458 200,00 | 4681 12 000,00 ; 4191 1 200,00 ; 44571 200,00 | **TVA des frais de service constatée à la charge**, avec la facture d'acompte |
| P1-bis libération | 4681 12 000,00 | 5171 12 000,00 | comptes |
| P1-bis facture définitive des frais | 411 (entreprise) 1 200,00 | 706 1 000,00 ; 4458 200,00 | la TVA déjà collectée solde 4458, pas une seconde fois 44571 |
| P1-bis imputation de l'acompte | 4191 1 200,00 | 411 (entreprise) 1 200,00 | art. 1214-41 |
| Remboursement total avant libération | 4681 (et 4191) | 5171 | si l'acompte de frais est rendu : avoir d'acompte et contre-passation 44571 / 4458 |
| Reprise de virement | 5171 | 4671 (si créance déjà constatée) ou 4681 | comptes |
| Litige perdu après libération, non repris | 4671 ; 6278 20,00 | 5171 | 654 si abandon |
| Frais Stripe | 6278 ; 44566 | 5171 ; 4452 | §2.3 |

Le reste du §4.3 (avoir de commission, pièce et virement de l'apporteur, compensation d'une reprise sur l'apporteur,
abonnements fournisseurs) est **confirmé**, sous réserve des renommages ci-dessus. Le rapprochement nocturne de Camille
(§4.4) devient : somme des 4681 et 4682 = somme des paiements `held` et `releasing` ; aucun 4681 débiteur ; tout solde
débiteur d'un tiers est en 4671 et ouvre une alerte.

---

## 3. Question 3 : « Facture acquittée le ... » ; indemnité de 40 EUR et pénalités sur une facture déjà payée

### 3.1 Règle produit, en tête (le backend en a besoin maintenant)

```
legalLines(doc) = [latePenalty(contract), RECOVERY_FEE, NO_DISCOUNT]   // on EVERY invoice, settled or not
acquittalMention(doc) is added on top when settled, never instead
latePenalty(contract) = contract.latePenaltyClause ?? LEGAL_DEFAULT_PENALTY
LEGAL_DEFAULT_PENALTY = "Pénalités de retard : taux d'intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage, exigibles le jour suivant la date de règlement."
RECOVERY_FEE = "Indemnité forfaitaire pour frais de recouvrement en cas de retard : 40 €."   // amount written, never a bare reference to D441-5
```

- **« Facture acquittée le JJ/MM/AAAA » est une pratique, pas une obligation** : aucun des textes lus (L441-9, L441-10,
  242 nonies A, BOFiP de facturation) ne l'exige. Elle est utile (preuve du règlement pour le client et son comptable) et
  sans risque **si la date est juste** (R2 : jour de la libération pour la mission). La garder.
- **Les pénalités de retard, l'indemnité de 40 EUR et l'escompte restent sur toutes les factures, acquittées ou non.**
  L441-9 I al. 5, cité mot pour mot : « La facture mentionne la date à laquelle le règlement doit intervenir. Elle précise
  les conditions d'escompte applicables en cas de paiement à une date antérieure à celle résultant de l'application des
  conditions générales de vente, le taux des pénalités exigibles le jour suivant la date de règlement inscrite sur la
  facture ainsi que le montant de l'indemnité forfaitaire pour frais de recouvrement due au créancier en cas de retard de
  paiement. » Le texte ne prévoit aucune exception pour une facture déjà réglée. Sanction (L441-9 II) : « amende
  administrative dont le montant ne peut excéder 75 000 € pour une personne physique et 375 000 € pour une personne
  morale », doublée en cas de réitération sous deux ans. Retirer une ligne ne rapporte rien ; la garder ne coûte rien.
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414397/
- **Le choix du backend de retirer les pénalités d'une facture acquittée est donc à annuler** (`render.ts`, `legalLines` ;
  `cii.ts`, note `PMD` remplacée par l'acquittement). Son choix de **garder** l'indemnité et l'escompte est **confirmé**.
- **Le taux imprimé doit être celui du contrat.** L441-10 II : « Sauf disposition contraire qui ne peut toutefois fixer
  un taux inférieur à trois fois le taux d'intérêt légal, ce taux est égal au taux d'intérêt appliqué par la Banque
  centrale européenne à son opération de refinancement la plus récente majoré de 10 points de pourcentage. »
  « Trois fois le taux d'intérêt légal » n'est donc juste que si le contrat le stipule. Le contrat de prestation d'Inès le
  stipule (`service-agreement/fr.yaml:161-162` et `:183-184`) ; **les contrats signés en deux clics avant le coffre ne
  stipulent rien** : leurs factures doivent imprimer le taux légal par défaut. Le taux de pénalités devient une condition
  figée du contrat, comme la commission (K3).
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414392
- 40 EUR : D441-5 : « Le montant de l'indemnité forfaitaire pour frais de recouvrement prévue au II de l'article L. 441-10
  est fixé à 40 euros. » https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043197457 . La fiche officielle
  F31808 (vérifiée le 11 août 2026) range ces mentions parmi celles de toutes les factures, sans distinguer le paiement
  comptant : https://entreprendre.service-public.gouv.fr/vosdroits/F31808 . La fiche DGCCRF sur economie.gouv.fr a
  répondu 403 ; je ne l'ai pas contournée.
- Libellé de la facture de commission (demande du backend) : « Facture acquittée le JJ/MM/AAAA par compensation avec le
  versement de la mission (facture n° {numéro F1}) ». « Compensation » est exact (la commission est retenue sur les sommes
  dues au freelance) ; la référence au numéro de F1 rend la compensation vérifiable.
- Facture structurée (CII) : pour une facture acquittée, le montant restant dû devrait valoir 0 et le montant déjà payé
  le TTC (EN 16931, BT-113 et BT-115, règle BR-CO-16), sinon le logiciel du client lit un reste à payer. Connaissance de
  la norme, **NON VÉRIFIÉE** dans cette session : à valider par la plateforme agréée et par veraPDF en L5.

Tests (rouge puis vert) :
```
it("prints the late penalty rate, the 40 EUR recovery fee and the discount terms on a settled invoice")
it("prints the contract's stipulated penalty rate, or the ECB plus 10 points default when none")
it("prints 'Facture acquittée le' only in addition to the legal lines, never instead")
it("CII of a settled invoice keeps the PMD note")
```

### 3.2 Le fuseau horaire (constat en passant, CHALLENGE L1-043)

`invoices.ts` numérote avec l'année de Paris (`parisYear`), mais `render.ts` (`timeZone: "UTC"`), `cii.ts`
(`toISOString`) et `invoice-settlement.ts` (`utcDay`) datent en UTC. Le 31/12/2026 à 23 h 30 UTC (1er janvier 2027,
0 h 30 à Paris), la facture reçoit le numéro `...-2027-0001` et la date imprimée « 31 décembre 2026 » : un numéro de la
série 2027 sur une facture datée 2026, dans la mauvaise période de TVA et le mauvais exercice. Règle : une seule horloge
légale, Europe/Paris, pour le numéro, la date d'émission, l'acquittement et l'échéance. Test :
`it("numbers and dates an invoice issued at 2026-12-31T23:30Z as 2027 on both")`.

### 3.3 Le mandat accepté ne suffit pas (RISK L1-045, pour Inès et L2.6)

Texte actuel (`billing-fr.ts:21`) : « J'accepte que Proofseen émette mes factures de mission en mon nom et pour mon compte
(mandat de facturation). » Il manque, au regard du BOI-TVA-DECLA-30-20-10-30 (en vigueur depuis le 29/06/2022) :
(1) l'identité du mandataire (E-KIGAI, pas la marque) ; (2) le champ : factures initiales **et rectificatives, avoirs et
factures d'acompte** (§ 140) ; (3) un **délai de contestation** qui permet l'acceptation tacite (§ 140, § 160), faute de
quoi chaque facture doit être acceptée expressément, et le produit n'a aucune étape d'acceptation ; (4) l'envoi du double
au freelance (§ 220) ; (5) la responsabilité du freelance, qui « conserve l'entière responsabilité de ses obligations en
matière de facturation » (§ 170). Au 01/01/2027, CIBS L. 216-35 : sans acceptation, l'obligation de facturer n'est
pas remplie. Table produit à créer (déjà proposée par la recherche L0 §4.5) : `billing_mandate` (version, date, délai de
contestation, champ, révocation) et un statut d'acceptation par facture.

---

## 4. Ce qui n'est pas vérifié

- Libellé de la mention de franchise sous le CIBS (non publié) ; table de concordance officielle (non consultée).
- Liste exacte des dispositions maintenues par l'art. 15 de 2025-1247 (tableau non lu en entier).
- Plafonds de franchise du CIBS (L. 233-9 à L. 233-13, non relus).
- Part exonérée des frais Stripe ; lignes CA3 ; e-reporting des acquisitions.
- Délai de tolérance actuel entre la réalisation et l'émission de la facture (BOFiP DECLA-30-20-10-40 non relu ; la
  version archivée de 2019 parlait de « quelques jours »). Si une libération est bloquée après la recette (litige, charge
  manquante), la facture de mission ne doit pas attendre indéfiniment le virement : point à trancher avec l'expert.
- Codes EN 16931 (BT-113, BT-115, BT-121, 381, BT-25) : connaissance de la norme, non relue.
- Sanctions fiscales du défaut de facture (CGI 1737) : montants non lus.
- Rescrit (LPF L80 B) : délai et forme non lus.
- Position de l'administration sur une marketplace qui conserve les fonds avant validation : **aucun texte lu ne la
  règle** ; Q-A repose sur L441-9 et sur l'analogie des § 80, 140 et 160 du BOI-TVA-BASE-20-20 (HYPOTHÈSE argumentée).
- Conservation (question d'Inès, L1-012) : L123-22 du Code de commerce lu : « Les documents comptables et les pièces
  justificatives sont conservés pendant dix ans. » https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006219327/
  Son HYPOTHÈSE de 10 ans pour les pièces qui justifient une écriture de Proofseen est donc **confirmée** sur le texte ;
  point de départ (clôture de l'exercice) : NON VÉRIFIÉ.

## 5. À faire valider par un expert-comptable inscrit à l'Ordre avant usage réel (point D6)

1. Qualification Q-A (consignation) ou Q-B (encaissement par mandataire) du paiement avant validation, et rédaction des
   CGU qui la rend vraie ; opportunité d'un rescrit.
2. Facture d'acompte des frais de service payés d'avance (P1-bis) et son écriture (4191, 4458, 44571).
3. Plan de comptes : 4681, 4682, 4671, 5171 contre 512, 580, 6278, 4452, 4458, 654 ou 709.
4. Régime des frais Stripe (taxable ou exonéré) et autoliquidation.
5. Série unique (factures et avoirs) par émetteur et mentions d'un avoir sous mandat.
6. Mention de franchise par date d'émission et bascule après le 30 juin 2028.
7. Mentions L441-9 sur facture acquittée et taux de pénalités par défaut des contrats sans stipulation.
8. Horloge légale Europe/Paris pour la numérotation et les dates.
9. Option de TVA d'E-KIGAI (encaissements ou débits) : non connue, conditionne la mention « Option pour le paiement de la
   taxe d'après les débits » obligatoire sur les factures électroniques d'E-KIGAI au 1er septembre 2027 (F31808).

---

## 6. Passation

De : tresor-comptable (Bertrand Lacombe) · Vers : Inès (L1-014), Camille (L0-010), backend L1.0, piste A, Chancelier ·
Mission : L1 · Vague : 1 · Date : 2026-10-24

**Livré** : ce fichier ; messages L1-040 à L1-046 dans le bus.

**Preuve** : chaque règle cite l'article et l'URL lue le 2026-10-24 ; citations littérales des pages Légifrance (CGI 269,
283, 289, 293 B, ann. II 242 nonies A ; CIBS L. 214-6, L. 214-7, L. 215-5, L. 216-30 à L. 216-35, L. 233-1, L. 233-3,
L. 233-18, L. 233-21 à L. 233-24 ; Code de commerce L123-22, L441-9, L441-10, D441-5 ; ordonnances 2025-1247 et
2026-671 ; CE n° 429647), des BOFiP (RES-TVA-000253, DECLA-40-10-20, BASE-20-20, DECLA-30-20-20-10, DECLA-30-20-20-20,
DECLA-30-20-10-30) et du PCG de l'ANC (PDF téléchargé, `pdftotext`, recherche des comptes 467, 468, 4191, 517, 580,
6222, 6278, art. 621-11, 1214-41, 1214-46, 1215-51, 1215-58). Grep du code : commande et résultats au §1.5.

**Pas fait** : aucun code (consigne) ; aucune modification de `sources.yaml` ni des gabarits d'Inès (proposition §1.4) ;
points du §4.

**Pour le receveur** : le backend corrige d'abord R1 et R2 (L1-042), puis R4 ; la piste A remplace `VAT_EXEMPT` par la
fonction datée ; Inès réécrit le mandat (§3.3) et ajoute les sources ; Camille reprend ses écritures (§2.4) ; le
Chancelier pose au founder la question du rescrit, une seule fois.

**Au-delà de la demande (question du serment)** : voir la réponse dans le bus (L1-046) et le compte rendu.
