# Format des gabarits de documents Proofseen (v1)

Inès Kader (Trésor, juriste), sprint L1, vague 1, piste T. Écrit le 2026-10-24 sur l'arbre `wt-l1`
(branche `sprint/l1-coffre`, base `origin/main` f9a5afd). Destinataire : piste A (`packages/documents`).

Ce document fixe **comment un gabarit est écrit, validé, rendu et comparé**. Les gabarits v1 sont dans
`templates/` à côté de ce fichier ; le contrat de prestation (`templates/service-agreement/`) est le gabarit pilote
complet demandé avant toute implémentation du rendu (L1, bloc a2a, vague 1).

Rien ici n'est un conseil juridique. Chaque gabarit porte la mention de relecture tant que le founder ne l'a pas fait
relire par un avocat inscrit au barreau (décision D6).

---

## 1. Principes (chacun est un test)

1. **Un gabarit est une donnée, jamais du code.** Aucun texte de clause dans un fichier `.ts`. Le moteur lit des
   fichiers YAML, les valide (zod, clés inconnues refusées), puis rend.
2. **Une variable a un type et une source.** Toute valeur affichée vient d'une colonne nommée, d'une règle datée,
   d'une saisie d'une partie identifiée, ou d'un calcul pur nommé. Rien n'est deviné, rien ne vient de l'horloge au
   moment du rendu (déterminisme de l'empreinte, piège L1).
3. **Trois sortes de clauses.** `locked` (toujours présente, jamais retirée), `optional` (les parties l'ajoutent ou la
   retirent, avec trace), `conditional` (présence décidée par les seules données, jamais par une personne).
4. **Chaque clause cite sa règle** quand il y en a une, par un identifiant du registre `templates/sources.yaml`
   (URL officielle, date de lecture, statut de lecture, date de fin de validité). Une clause de pure pratique
   contractuelle le dit (`sources: []` et `basis: practice`).
5. **Pas de logique dans le texte.** Aucun « si » dans une phrase : une différence de rédaction est une clause
   conditionnelle ou une variante (`variants`) choisie par une variable `enum`. C'est ce qui rend la comparaison
   clause par clause fiable et le texte lisible par un avocat.
6. **Une version publiée ne change plus.** Toute modification d'un fichier publié crée une nouvelle version. Une
   empreinte SHA-256 des fichiers de chaque version est tenue dans `templates/LOCK.json` (fichier à créer par la piste
   A au premier `publish`) ; un test échoue si un fichier publié ne correspond plus à son empreinte.
7. **Mention de relecture.** Tant que `review.status` n'est pas `reviewed`, le moteur insère lui-même, en tête du
   document, l'avertissement `reviewNotice` du fichier de langue, et sa ligne `reviewFooter` en pied de chaque page.
   Ce bloc n'est pas une clause de la liste : aucune partie ne peut le retirer, et il disparaît seulement quand le
   founder renseigne la relecture (`reviewedBy`, `reviewedOn`, `reviewedDigest`). Une relecture vaut pour une
   empreinte : si un fichier change, la relecture tombe et l'avertissement revient (test).
8. **Vocabulaire tenu.** Un test refuse dans tout texte de gabarit : le tiret cadratin, tout emoji, les mots
   « qualifiée » (signature), « séquestre », « garanti », « garantie de résultat », « arbitrage » appliqué à une
   décision de Proofseen, « employeur » appliqué à Proofseen ou au client. Raisons : §8.

---

## 2. Arborescence

```
.war-room/tresor/L1/templates/            (source de vérité juridique, relue par le Trésor)
  sources.yaml                            registre partagé des sources
  <template-id>/
    template.yaml                         structure : métadonnées, variables, clauses, signature, conservation, relecture
    fr.yaml                               texte français (titre, intitulés, corps, variantes)
    en.yaml                               texte anglais, seulement si `languages` le déclare
```

La piste A copie ces fichiers dans `packages/documents/templates/` au moment de l'implémentation (même arborescence),
ou les lit depuis ce dossier : c'est son choix d'architecte. Le Trésor reste propriétaire du contenu ; toute
modification passe par une entrée du bus à l'attention d'Inès.

Identifiants v1 :

| `id` | Document | Langues |
|---|---|---|
| `service-agreement` | Contrat de prestation de services (forfait et régie mensuelle) | fr, en |
| `quote` | Devis | fr |
| `acceptance-report` | Procès-verbal de recette | fr |
| `nda` | Accord de confidentialité | fr |
| `amendment` | Avenant au contrat de prestation | fr |

YAML 1.2, schéma « core » (aucune conversion implicite de dates ni de « yes/no ») ; toute chaîne qui pourrait être
lue comme un nombre ou une date est entre guillemets. Encodage UTF-8, fins de ligne LF.

---

## 3. `template.yaml`, champ par champ

```yaml
id: service-agreement            # kebab-case anglais, stable pour toujours
version: 1                       # entier ; une version publiée est immuable
status: draft                    # draft | published | retired
effectiveFrom: "2026-10-24"      # date à partir de laquelle le gabarit peut être rendu
documentType: contract           # contract | quote | acceptance_report | nda | amendment (type du coffre, L1.3)
languages: [fr, en]
prevailingLanguage: fr           # langue qui fait foi si plusieurs versions sont remises
attachTo: Contract               # objet du modèle de données auquel le document se rattache (Contract, Quote, ...)

variables:                       # dictionnaire : clé = chemin pointé de la variable
  contract.totalCents:
    type: money
    currency: contract.currency  # variable qui porte la devise
    required: true
    source: { kind: db, path: Contract.totalCents }
    frozenAt: contract_creation  # moment où la valeur est figée (contract_creation | signature | input | render_data)
    label: { fr: "Prix total hors taxes", en: "Total price excluding VAT" }

clauses:                         # liste ordonnée ; la numérotation des articles se calcule au rendu
  - id: parties
    kind: locked
    sources: [civ-1113]
  - id: non-solicitation
    kind: optional
    default: excluded            # included | excluded
    toggledBy: both              # seller | buyer | both : qui doit consentir pour l'ajouter ou la retirer
    sources: [civ-1231-5]
  - id: vigilance
    kind: conditional
    when: { var: computed.vigilanceRequired, eq: true }
    sources: [trav-l8222-1, trav-r8222-1, trav-d8222-5]
  - id: payment
    kind: locked
    variantBy: contract.billing  # la variante est choisie par une variable enum
    gates:                       # une variante bloquée par une décision du founder
      - { variant: monthly, decision: D8, error: decision_pending }
    sources: [com-l441-10, com-d441-5]

signature:
  level: simple                  # le seul niveau produit par Proofseen (jamais « qualifiée »)
  order: parallel                # parallel | sequential
  signatories:
    - { role: seller, rule: "le freelance titulaire du profil du contrat" }
    - { role: buyer, rule: "un propriétaire ou administrateur de l'organisation (contracts.ts, sign())" }

retention:                       # voir §7 ; la piste A en tire la purge
  active: until_contract_end
  archive: { years: 5, from: contract_end, sources: [civ-2224, com-l110-4] }
  accounting: { years: 10, from: fiscal_year_end, sources: [com-l123-22], status: HYPOTHESIS }
  onPartyErasure: archive        # archive | delete
  draftsOnPartyErasure: delete

review:
  status: draft                  # draft | reviewed
  reviewedBy: null               # nom de l'avocat et barreau, renseignés par le founder seulement
  reviewedOn: null
  reviewedDigest: null           # empreinte des fichiers relus
  points:                        # liste des points à faire relire, numérotés
    - id: R1
      clause: payment
      question: "..."
```

### 3.1 Types de variables et formatage (sans `Intl`)

Le formatage est **pur et écrit dans `packages/documents`**, sans `Intl` : les données ICU changent d'une version de
Node à l'autre et casseraient l'égalité d'empreinte entre deux rendus (L1.2). Règles :

| `type` | Valeur stockée | Rendu `fr` | Rendu `en` | Contraintes |
|---|---|---|---|---|
| `string` | texte d'une ligne | tel quel, échappé | idem | `maxLength` obligatoire ; `pattern` optionnel |
| `text` | texte multi-paragraphes | paragraphes séparés par une ligne vide | idem | `maxLength` ; filtrage des coordonnées (§3.3) |
| `enum` | une valeur de `values` | libellé `labels.fr[valeur]` | `labels.en[valeur]` | `values` obligatoires |
| `boolean` | `true` / `false` | sert aux conditions ; jamais affiché seul | | |
| `int` | entier | chiffres, espace fine insécable U+202F par milliers | virgule par milliers | `min`, `max` |
| `money` | entier de centimes, jamais négatif dans un gabarit v1 | `1 234,56 EUR` (U+202F milliers, virgule, U+00A0 avant le code ISO) | `EUR 1,234.56` | `currency` = chemin d'une variable ISO 4217, ou `{ literal: EUR }` pour un montant légal fixé en euros |
| `bp` | entier de points de base | `10 %`, `11,11 %` (U+00A0 avant `%`) | `10%`, `11.11%` | 0 à 10 000 |
| `date` | `AAAA-MM-JJ` | `24 octobre 2026` (table des mois en dur dans le moteur) | `24 October 2026` | |
| `datetime` | ISO 8601 en UTC | `24 octobre 2026 à 14:03:07 UTC` | `24 October 2026, 14:03:07 UTC` | toujours UTC, jamais l'heure locale du serveur |
| `party` | objet `LegalSnapshot` (`packages/db/src/billing.ts`) | bloc : raison sociale, adresse, SIRET, TVA (lignes absentes si nulles) | idem | |
| `list` | tableau de `string` | une puce par élément | idem | `maxItems`, `itemMaxLength` |

Arrondi : tout montant dérivé (TVA, commission) applique `applyBp` de `tresor/L0_FLUX_ARGENT.md` R3 (demi vers le haut,
sur la valeur absolue) et R6 (TVA une fois sur le total HT). Un gabarit n'additionne jamais deux montants lui-même :
il lit une variable `derived` dont la fonction est testée.

### 3.2 Sources d'une variable (`source.kind`)

| `kind` | Forme | Exemple | Règle |
|---|---|---|---|
| `db` | `{ kind: db, path: Model.colonne[.cleJson] }` | `Contract.sellerSnapshot.legalName` | lue dans la transaction qui crée la version du document ; le chemin est vérifié contre le schéma Prisma par un test |
| `derived` | `{ kind: derived, fn: nom, from: [variables] }` | `fn: vatOfTotal` | fonction pure de `packages/documents/src/derive.ts`, testée sur vecteurs fixes |
| `rule` | `{ kind: rule, file: chemin, symbol: nom }` | `contract-checks.ts`, `VIGILANCE_THRESHOLD_BY_CURRENCY` | le fichier de règles porte sa source et sa date (bloc commun, règle 6) |
| `platform` | `{ kind: platform, file: chemin, symbol: nom }` | `packages/hub/src/legal-facts.ts`, `PUBLISHER.siren` | identité de l'éditeur, version des CGU |
| `input` | `{ kind: input, editableBy: [seller, buyer], stage: draft }` | objet de la mission | saisie d'une partie identifiée, figée à la création de la version ; qui l'a saisie est journalisé |
| `document` | `{ kind: document, field: nom }` | `document.versionNumber`, `document.issuedOn` | métadonnées de la version du coffre ; `issuedOn` vient des données (date de création de la version), jamais de l'horloge du rendu |
| `pending` | `{ kind: pending, request: L1-0nn }` | champ que le modèle n'a pas encore | **le rendu échoue** avec `missing_variable` tant que la colonne n'existe pas ; la piste A remplace `pending` par `db` ou `input` en livrant la colonne |

### 3.3 Saisies libres et règle des coordonnées

Une variable `text` ou `list` saisie par une partie passe par `containsDirectContact`
(`packages/db/src/contact-detection.ts`) comme un message : avant un paiement, aucune coordonnée ne s'échange sur
Proofseen (CGU, section « Les échanges passent par la plateforme »). Les adresses légales des parties viennent des
seuls snapshots. Une saisie refusée renvoie `invalid_variable` avec le motif.

### 3.4 Conditions (`when`)

Langage minimal, évalué sur les variables résolues, sans effet de bord :

```yaml
when: { var: contract.billing, eq: monthly }
when: { all: [ { var: computed.vigilanceRequired, eq: true }, { var: contract.currency, eq: EUR } ] }
when: { any: [ ... ] }
when: { not: { var: input.processesPersonalData, eq: true } }
```

Opérateurs : `eq`, `neq`, `in` (liste), `gte`, `lte` (entiers et montants de même devise), `present` (la variable
facultative est renseignée), `all`, `any`, `not`. Une condition qui lit une variable obligatoire absente rend
`condition_unresolvable` (jamais « faux » par défaut : une clause de vigilance ne doit pas disparaître parce qu'une
donnée manque). Seul `present` lit une variable facultative.

### 3.6 Obligation conditionnelle, préremplissage, variables facultatives

- `requiredWhen` : la variable devient obligatoire si une condition est vraie, ou si une clause optionnelle est
  incluse : `requiredWhen: { var: input.ipRegime, in: [assignment, licence] }` ou
  `requiredWhen: { clause: insurance, included: true }`.
- `prefill` : source proposée à la saisie, que la partie confirme ou corrige (par exemple le mode de travail de la
  mission d'origine, `Contract.quote.conversation.application.jobPost.workMode`, nul pour un fil direct). La valeur
  retenue est une saisie (`input`), jamais la colonne elle-même.
- `default` : valeur proposée quand rien n'est saisi. Un défaut qui n'est pas une décision écrite porte
  `defaultStatus: HYPOTHESIS` et sa raison ; le rendu l'accepte, la clôture du sprint le liste.
- Une variable facultative (`required: false`) ne peut apparaître en placeholder que dans une clause dont la
  condition contient `present` sur elle, dans une clause qui la déclare dans `requires` (liste des variables
  facultatives que la clause exige quand elle est incluse), ou dans une variante qui la déclare dans `variantRequires`
  (`variantRequires: { fixed_dated: [contract.endsOn] }`) : la variante n'est choisie que si la variable est là, et
  le rendu renvoie `missing_variable` sinon (test au chargement et au rendu). Un texte ne montre jamais « null » ni
  un trou.
- `variantBy` accepte une variable `enum` ou `boolean` (variantes `true` et `false`).

### 3.5 Variantes et décisions du founder

Une clause peut avoir des variantes choisies par une variable `enum` (`variantBy`). Une variante peut être **bloquée
par une décision du founder** (`gates`) : tant que la décision n'est pas écrite dans `TEAM_MEMORY.md` et reportée dans
le gabarit (nouvelle version), le rendu de cette variante renvoie `decision_pending` avec le numéro de la décision.
Exemple v1 : la régie mensuelle (`contract.billing = monthly`) dépend de D8 (provision du mois, paiement sur CRA ou
provision unique, `PROMPTS_LEGENDS.md` tableau des décisions).

---

## 4. Fichier de texte (`fr.yaml`, `en.yaml`)

```yaml
language: fr
title: "Contrat de prestation de services"
subtitle: "Référence {{contract.reference}}"
clauses:
  parties:
    heading: "Les parties"
    body: |
      Le présent contrat est conclu entre :

      {{seller}}

      ci-après « le Prestataire »,
  payment:
    heading: "Prix et paiement"
    variants:
      fixed: |
        ...
      monthly: |
        ...
reviewNotice: |
  ...                            # avertissement de relecture (§1, principe 7), obligatoire
reviewFooter: "..."              # ligne de pied de page pendant la relecture, obligatoire
```

Règles du texte :
- Placeholders `{{chemin.de.variable}}` seulement ; aucune expression, aucun filtre. Le type de la variable décide du
  formatage (§3.1). Un placeholder `party` ou `list` est seul sur sa ligne et devient un bloc.
- Un placeholder qui ne correspond à aucune variable déclarée fait échouer le **chargement** du gabarit (test), pas
  le rendu.
- Paragraphes séparés par une ligne vide ; une ligne qui commence par `- ` est une puce. Aucun HTML, aucun Markdown
  d'emphase. Le moteur échappe tout.
- Chaque clause de `template.yaml` a son texte dans chaque langue déclarée, avec les mêmes variantes (test
  `language_missing`).
- L'intitulé (`heading`) est numéroté au rendu : « Article 7. Propriété intellectuelle ». La comparaison de versions
  se fait par `id` de clause, jamais par numéro.

---

## 5. Rendu : entrée, sortie, erreurs nommées

```ts
renderTemplate(input: {
  templateId: string; version: number; language: "fr" | "en";
  variables: Record<string, unknown>;          // déjà lues par la piste A selon les sources
  optionalClauses: Record<string, "included" | "excluded">;
}): Result<RenderedDocument, RenderError>
```

`RenderedDocument` contient : la liste ordonnée des clauses incluses (`id`, variante, numéro, texte résolu), les
variables résolues et formatées, et un **contenu canonique** (JSON aux clés triées : gabarit, version, empreinte du
gabarit, langue, variables brutes, clauses incluses) qui sert à la comparaison et peut servir à l'empreinte si
l'architecte le retient (L1.2).

Erreurs nommées (une par cas, toutes testées) :

| Erreur | Cas |
|---|---|
| `missing_variable` | variable `required` absente, ou source `pending` |
| `invalid_variable` | type, borne, motif ou filtrage des coordonnées refusé |
| `locked_clause_removed` | `optionalClauses` tente de retirer une clause `locked` ou `conditional` |
| `unknown_clause` | `optionalClauses` nomme une clause qui n'existe pas ou n'est pas `optional` |
| `condition_unresolvable` | une condition lit une variable absente |
| `decision_pending` | variante bloquée par une décision du founder |
| `source_expired` | une clause incluse cite une source dont `validUntil` est antérieure à `document.issuedOn` |
| `language_missing` | la langue demandée n'est pas déclarée ou un texte manque |
| `template_not_effective` | `document.issuedOn` antérieure à `effectiveFrom`, ou gabarit `retired` |

`source_expired` est la protection contre un article abrogé : les articles 289 et 293 B du CGI sont abrogés au
1er janvier 2027 par l'ordonnance n° 2025-1247 (lu sur Légifrance le 2026-10-24, `sources.yaml`). Un test de la piste A
échoue **60 jours avant** la date de fin de validité d'une source encore citée, pour laisser le temps de réécrire.

---

## 6. Ce que la version du coffre doit garder pour comparer

Pour chaque `DocumentVersion` (L1.3) : `templateId`, `templateVersion`, `templateDigest`, `language`, les variables
brutes figées (JSON), les clauses optionnelles et leur état, qui a saisi chaque variable `input`. Avec cela :
- la comparaison clause par clause (concept §D.3) est exacte, même pour une clause optionnelle retirée (« retirée ») ;
- la phrase « ce qui change pour chaque partie » se calcule depuis les variables et leurs libellés, sans modèle de
  langage (au-delà de L1) : « Le prix total HT passe de 500,00 EUR à 650,00 EUR ».

---

## 7. Conservation et effacement (lu par la piste A pour L1.3 et C6)

Chaque gabarit déclare son bloc `retention`. Règles communes v1 (détail sourcé : `a2a/L1/BUS.md`, ANSWER L1-012) :

| Document | Base active | Archivage intermédiaire | À l'effacement RGPD d'une partie |
|---|---|---|---|
| Brouillon jamais envoyé | jusqu'à l'envoi ou l'abandon | aucun | supprimé |
| Devis non accepté | tant que le fil est ouvert | aucun | supprimé avec le fil (comportement actuel) |
| Devis accepté, contrat, avenant, PV, NDA signés | jusqu'à la fin du contrat (ou du NDA) | 5 ans après la fin (Code civil 2224, Code de commerce L110-4) | conservés en archive, accès restreint (RGPD 17.3.e) |
| Document qui justifie une écriture de Proofseen (facture, contrat d'un paiement) | idem | 10 ans (Code de commerce L123-22) : **HYPOTHÈSE à valider par Bertrand** sur le point de départ et le périmètre | conservé (RGPD 17.3.b) |
| Dossier de preuve d'une signature | comme le document signé | comme le document signé | comme le document signé |
| Journal d'accès au coffre (qui a ouvert, téléchargé) | 6 mois à 1 an glissants (CNIL, recommandation journalisation, 2021) | aucun | supprimé à échéance |

---

## 8. Pourquoi ces mots sont interdits

- « qualifiée » : Proofseen produit une signature électronique simple ; seule la qualifiée est présumée fiable
  (Code civil 1367, décret n° 2017-1416, art. 1er) et la Cour de cassation casse une décision qui retient la fiabilité
  sans rechercher si la signature est qualifiée (Cass. civ. 3e, 5 mars 2026, n° 24-21.034, inédit, lu sur Légifrance).
- « séquestre » : Proofseen ne détient pas les fonds ; ils sont chez Stripe et versés à la validation
  (`research/LEGENDS_P2_REGLEMENTAIRE.md` §6). Libellé : « paiement sécurisé par Stripe, versé à la validation ».
- « arbitrage » : l'arbitrage est une procédure juridictionnelle qui suppose une clause compromissoire acceptée
  (Code civil 2061). Proofseen **exécute des règles de versement écrites**, elle ne juge pas le fond d'un litige.
- « garanti », « garantie de résultat » : aucune promesse de résultat (règle du founder, CLAUDE.md).
- « employeur » pour Proofseen ou le client : aucun lien de subordination (Code du travail L8221-6).

---

## 9. Exemple complet et minimal (toutes les fonctions du format)

Un gabarit d'exemple, non destiné à l'usage, qui montre chaque fonction en peu de lignes. La piste A peut en faire
la première fixture de `renderTemplate`.

`templates/example/template.yaml` (illustratif, non livré comme fichier) :

```yaml
id: example
version: 1
status: draft
effectiveFrom: "2026-10-24"
documentType: contract
languages: [fr]
prevailingLanguage: fr
attachTo: Contract

variables:
  seller:
    type: party
    required: true
    source: { kind: db, path: Contract.sellerSnapshot }
    frozenAt: contract_creation
    label: { fr: "Prestataire" }
  contract.billing:
    type: enum
    values: [fixed, monthly]
    labels: { fr: { fixed: "au forfait", monthly: "en régie mensuelle" } }
    required: true
    source: { kind: db, path: Contract.billing }
    frozenAt: contract_creation
    label: { fr: "Mode de facturation" }
  contract.totalCents:
    type: money
    currency: contract.currency
    required: true
    source: { kind: db, path: Contract.totalCents }
    frozenAt: contract_creation
    label: { fr: "Prix total HT" }
  contract.currency:
    type: string
    maxLength: 3
    pattern: "^[A-Z]{3}$"
    required: true
    source: { kind: db, path: Contract.currency }
    frozenAt: contract_creation
    label: { fr: "Devise" }
  computed.vigilanceRequired:
    type: boolean
    required: true
    source: { kind: derived, fn: vigilanceRequired, from: [contract.totalCents, contract.currency] }
    frozenAt: signature
    label: { fr: "Attestation de vigilance exigée" }
  input.scope:
    type: text
    maxLength: 4000
    required: true
    source: { kind: pending, request: L1-011 }
    frozenAt: input
    label: { fr: "Objet de la mission" }

clauses:
  - { id: parties, kind: locked, sources: [civ-1113] }
  - { id: scope, kind: locked, sources: [civ-1163] }
  - id: price
    kind: locked
    variantBy: contract.billing
    gates: [ { variant: monthly, decision: D8, error: decision_pending } ]
    sources: [com-l441-10]
  - id: vigilance
    kind: conditional
    when: { var: computed.vigilanceRequired, eq: true }
    sources: [trav-r8222-1, trav-d8222-5]
  - { id: reference, kind: optional, default: excluded, toggledBy: buyer, sources: [], basis: practice }

signature:
  level: simple
  order: parallel
  signatories:
    - { role: seller, rule: "le freelance titulaire du profil" }
    - { role: buyer, rule: "propriétaire ou administrateur" }

retention:
  active: until_contract_end
  archive: { years: 5, from: contract_end, sources: [civ-2224, com-l110-4] }
  onPartyErasure: archive
  draftsOnPartyErasure: delete

review:
  status: draft
  reviewedBy: null
  reviewedOn: null
  reviewedDigest: null
  points:
    - { id: R1, clause: price, question: "Exemple : la variante mensuelle est-elle complète ?" }
```

`templates/example/fr.yaml` :

```yaml
language: fr
title: "Exemple de contrat"
reviewNotice: |
  Document établi à partir d'un modèle Proofseen en cours de relecture par un avocat. Il ne constitue pas un conseil
  juridique. Relisez-le, et faites-le relire si besoin, avant de le signer.
reviewFooter: "Modèle Proofseen en cours de relecture par un avocat."
clauses:
  parties:
    heading: "Les parties"
    body: |
      {{seller}}
  scope:
    heading: "Objet"
    body: |
      {{input.scope}}
  price:
    heading: "Prix"
    variants:
      fixed: |
        Le prix est de {{contract.totalCents}} hors taxes, {{contract.billing}}.
      monthly: |
        Le prix est dû chaque mois sur relevé validé, dans la limite de {{contract.totalCents}} hors taxes.
  vigilance:
    heading: "Attestation de vigilance"
    body: |
      Le Prestataire remet son attestation de vigilance à la conclusion du contrat puis tous les six mois.
  reference:
    heading: "Référence"
    body: |
      Le Client autorise le Prestataire à le citer comme référence.
```

Rendus attendus (tests de la piste A) :
1. `input.scope` en `pending` : `missing_variable` (`input.scope`), même si tout le reste est présent.
2. `contract.billing = monthly` : `decision_pending` (D8).
3. `optionalClauses: { vigilance: "excluded" }` : `locked_clause_removed`.
4. `optionalClauses: { reference: "included" }` avec `fixed` et tout renseigné : cinq clauses rendues, numérotées 1 à
   5, avertissement de relecture en tête, ligne de relecture en pied de page.
6. Même entrée avec `review.status: reviewed` et une empreinte relue qui ne correspond plus aux fichiers :
   l'avertissement reste (la relecture est tombée).
5. Deux rendus des mêmes entrées : contenu canonique identique octet pour octet.
