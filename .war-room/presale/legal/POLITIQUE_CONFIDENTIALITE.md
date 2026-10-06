# PROJET — à valider par un juriste avant toute publication

# Politique de confidentialité — Proofseen

> Version 0.1 du 2026-09-18 · Rédigé par Legal & Trust (War Room) · **Ce n'est pas un avis juridique.**
> Sources : `foundations/CONFORMITE.md` §2 (registre T1-T10), §3, §4 ; `foundations/research/R3_CONFORMITE.md` §1 et §3 ;
> `foundations/CAHIER_DES_CHARGES.md` US-F00, US-F06, US-B01 à US-B03.
> Les éléments entre crochets sont des placeholders. Le Règlement général sur la protection des données (RGPD) est le Règl. (UE) 2016/679.

---

## 1. Qui est responsable de vos données

Le responsable de traitement est [RAISON SOCIALE], [FORME], [SIÈGE], RCS [RCS].

Contact pour vos données : **[DPO/CONTACT RGPD]**.

## 2. En bref

- Nous utilisons vos données pour **mesurer votre visibilité** et vous livrer ce que vous avez commandé.
- **Vos résultats sont à vous.** Nous ne les vendons pas. Nous ne les partageons avec personne.
- Nous ne vous demandons **jamais** vos identifiants de LinkedIn, Malt, GitHub ou autre.
- Quand une IA cite **d'autres professionnels**, leurs noms sont effacés **en mémoire, avant tout stockage**. Seuls les domaines des grandes
  plateformes (LinkedIn, GitHub, Malt…) sont comptés.
- Les réponses brutes des IA sont gardées **72 heures au plus**, sous forme pseudonymisée et chiffrée, puis supprimées.
- Si votre entreprise vous offre Proofseen, **elle ne voit jamais vos résultats individuels**.

## 3. Ce que nous faisons de vos données, et pourquoi

| # | Traitement | Qui est concerné | Base légale | Données | Durée de conservation |
|---|---|---|---|---|---|
| T1 | Gestion de votre compte et de la relation client | Clients (freelances, consultants, administrateurs B2B) | Contrat (art. 6(1)(b)) | Identité, e-mail, **URL vérifiées** (preuve de possession), consentements, facturation | Durée du contrat, puis suppression sous 30 jours (sauvegardes : 35 jours au plus). E-mails de prospection : 3 ans après le dernier contact, si vous avez accepté. Pièces comptables : 10 ans. |
| T2 | Construction et envoi des questions aux IA | Vous (indirectement) ; recruteurs éventuellement nommés dans une offre d'emploi | Contrat (art. 6(1)(b)) ; intérêt légitime (art. 6(1)(f)) pour les données résiduelles | Offre d'emploi **nettoyée** (e-mails, téléphones, noms de recruteurs et URL retirés). **Votre nom n'est jamais envoyé dans la question.** | Durée du contrat |
| T3 | Réception des réponses des IA qui citent d'autres personnes | Autres professionnels cités par les IA | Intérêt légitime (art. 6(1)(f)) | Noms **masqués en mémoire avant écriture** ; réponse brute **pseudonymisée** (noms remplacés par des jetons) et chiffrée | **72 heures au plus** |
| T4 | Détection de votre profil dans les réponses, score, recommandations | Vous | Contrat (art. 6(1)(b)) | Correspondances, métriques, rapports | Durée du contrat |
| T5 | Statistiques agrégées sur les sites cités | Personne : seuls les **domaines de plateforme** (liste fermée) sont gardés ; tout autre domaine devient « autre » | Intérêt légitime (art. 6(1)(f)) | Domaines de plateforme, fréquences | Sans limite (données anonymes) |
| T6 | Inscription de consultants via une licence B2B | Consultants | Contrat avec le consultant | Comme T1 à T4. L'entreprise ne reçoit que des statistiques de groupe. | Comme T1 à T4 |
| T7 | Entretiens avec des recruteurs (étude préalable) | Recruteurs interrogés | **Consentement**, recueilli par écrit avant l'entretien | Notes **pseudonymisées**. Aucun enregistrement audio sans accord séparé. | 12 mois |
| T8 | Contrôle anti-manipulation de vos pages | Vous | Contrat (art. 6(1)(b)) et intérêt légitime (art. 6(1)(f)) : prévention de la fraude | URL, motifs détectés, verdict | Durée du contrat |
| T9 | Pré-vente et facturation | Clients | Contrat et obligation légale | Paiements (via Stripe) | 10 ans (comptabilité) |
| T10 | Étalonnage manuel interne sur les applications grand public | Personnes affichées à l'écran | Intérêt légitime (art. 6(1)(f)) | **Uniquement « oui/non » et votre rang.** Aucune capture non caviardée n'est gardée. | Durée de l'expérience |

### 3.1 Le score est un profilage, pas une décision

Le calcul de votre score de visibilité (T4) est un **profilage** au sens de l'art. 4(4) du RGPD : il évalue un aspect lié à votre activité
professionnelle. **Aucune décision** n'est prise à votre sujet sur cette base. Le score vous est réservé. L'art. 22 du RGPD ne s'applique donc
pas a priori.

### 3.2 Preuve de possession de vos URL

Pour mesurer un profil, vous prouvez qu'il vous appartient : un code unique sur votre site (fichier, balise ou enregistrement DNS) ou dans un
champ public de votre profil. Nous vérifions **une fois, à la main**, par une visite normale, sans automatisation. Vous pouvez ensuite retirer
le code. Nous ne mesurons jamais le profil d'un tiers.

### 3.3 Offres B2B (entreprises de portage, ESN)

- Vous créez **vous-même** votre compte. Votre entreprise ne peut ni saisir ni importer votre identité.
- Votre entreprise ne voit **qu'un compteur global** et des **statistiques de groupe**, mises à jour une fois par mois, et seulement à partir de
  **10 consultants activés**. Jamais de liste nominative, de classement ou de filtre.
- Vous pouvez quitter la licence **sans prévenir votre entreprise**. Vos données sont alors détachées de l'organisation.

## 4. Qui reçoit vos données

Vos données ne sont **jamais vendues**. Elles sont accessibles à notre équipe, dans la limite de ce qui est nécessaire, et à nos
sous-traitants :

| Sous-traitant | Rôle | Données concernées | Localisation / garanties |
|---|---|---|---|
| **OpenAI** (entité EEE : OpenAI Ireland Ltd) | Modèle d'IA interrogé par API | Questions de recruteur (sans votre nom), réponses | Transfert possible vers les États-Unis — CCT |
| **Anthropic** (services UE : Anthropic Ireland Ltd) | Modèle d'IA interrogé par API | Idem | Idem — CCT |
| **Perplexity** (API Sonar) | Modèle d'IA interrogé par API | Idem | [À CONFIRMER : DPA non encore lu] |
| **Stripe** | Paiement | Données de paiement, montant, e-mail | [À CONFIRMER] |
| [Resend] | Envoi des e-mails | E-mail, contenu des messages | [À CONFIRMER] |
| [Clerk] | Authentification (à partir de la V1) | Identité, e-mail | [À CONFIRMER] |
| [Neon] | Base de données | Données de compte et rapports | [À CONFIRMER : région UE] |
| [Inngest] | Exécution des tâches de mesure | Données techniques des mesures | [À CONFIRMER] |
| [Vercel] / [HÉBERGEUR] | Hébergement du site | Données de navigation | [À CONFIRMER] |

> [À CONFIRMER : quels sous-traitants sont réellement utilisés dès la pré-vente. Retirer les autres de la version publiée.]

**Les fournisseurs d'IA n'entraînent pas leurs modèles sur ces données** selon leurs conditions API (OpenAI, Anthropic, Perplexity).

**Durée de conservation chez les fournisseurs d'IA.** Notre engagement de 72 heures porte sur **notre** stockage. Chaque fournisseur conserve
aussi les échanges de son côté, selon ses propres règles :

- OpenAI : jusqu'à 30 jours (contrôle des abus), sauf accord de zéro rétention ;
- Anthropic : [À CONFIRMER : 30 jours ou aucune rétention par défaut — sources contradictoires] ;
- Perplexity : aucune rétention des questions, selon sa documentation publique [À CONFIRMER à la lecture du DPA].

Nous avons demandé [ou : nous demanderons] la **zéro rétention** à OpenAI et à Anthropic. [À METTRE À JOUR selon la réponse.]

**Moteurs non utilisés.** Gemini et Copilot ne sont pas interrogés par API pour la mesure.

## 5. Transferts hors de l'Union européenne

Certains sous-traitants sont établis aux États-Unis ou y traitent des données.

- Ces transferts sont encadrés par les **clauses contractuelles types** (CCT) de la Commission européenne, intégrées à leurs accords de traitement.
- Nous ne nous appuyons pas sur le seul *Data Privacy Framework* : sa validité fait l'objet d'un pourvoi pendant (C-703/25 P).
- Nous réalisons une **analyse d'impact des transferts**.
- Quand un fournisseur propose une résidence des données en Europe, nous l'étudions.

Vous pouvez obtenir une copie des garanties en écrivant à [DPO/CONTACT RGPD].

## 6. Sécurité

- Chiffrement des réponses brutes, avec gestion des clés séparée.
- Purge automatique et journalisée à 72 heures.
- Accès limité, secrets protégés, limitation de débit.
- Aucune donnée n'est utilisée pour entraîner un modèle.

## 7. Vos droits

Vous pouvez à tout moment :

- **accéder** à vos données et en obtenir une copie ;
- les faire **rectifier** si elles sont inexactes ;
- les faire **effacer** ;
- demander la **limitation** de leur traitement ;
- les **récupérer** dans un format lisible par machine (portabilité) ;
- vous **opposer** à un traitement fondé sur notre intérêt légitime ;
- **retirer votre consentement** quand il est la base du traitement (T7, prospection), sans remettre en cause ce qui a été fait avant.

[Références des articles du RGPD pour chaque droit, et droit de définir des directives après décès prévu par la loi française : à confirmer par le juriste.]

**Comment faire** : écrivez à **[DPO/CONTACT RGPD]**. Nous pouvons vous demander de prouver votre identité si nous avons un doute raisonnable.
Nous répondons dans les délais légaux [un mois en principe — référence à confirmer par le juriste].

**Export et suppression (à partir de la V1)** : un export JSON (identité, offres, métriques, rapports) est disponible sous 72 heures ;
une suppression de compte efface vos données personnelles sous 30 jours. Les statistiques anonymes restent.

**Données dont nous ne pouvons plus savoir qu'elles vous concernent** : voir la [NOTICE « PERSONNES CITÉES PAR LES IA »] (art. 11 du RGPD).

## 8. Réclamation

Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la **CNIL** (Commission nationale de
l'informatique et des libertés), www.cnil.fr. [Référence juridique à confirmer par le juriste.]

## 9. Cookies et traceurs

[À COMPLÉTER : liste des cookies et traceurs réellement déposés par la page d'offre et le site. Si seuls des cookies strictement nécessaires
sont utilisés, le dire. Aucun traceur non essentiel ne doit être déposé sans accord préalable — régime à confirmer par le juriste.]

## 10. Modifications

Nous pouvons modifier cette politique. La date de mise à jour figure en haut. En cas de changement important, nous vous prévenons par e-mail.

---

## Points à trancher par le juriste

1. **Intérêt légitime pour les tiers (T3)** : la mise en balance tient-elle avec un masquage en mémoire et un brut pseudonymisé de 72 h ?
   La note de mise en balance doit-elle être publiée ou seulement tenue à disposition ?
2. **Transferts** : contenu minimal de l'analyse d'impact des transferts ; statut DPF d'OpenAI, d'Anthropic et de Perplexity ; effet d'une
   invalidation du DPF (C-703/25 P).
3. **Fournisseurs** : rétention par défaut d'Anthropic (30 j ou aucune) ; DPA et CGU API de Perplexity non lus ; formulation de la phrase
   « n'entraînent pas leurs modèles ».
4. **Profilage (T4)** : la mention « pas de décision au sens de l'art. 22 » est-elle suffisante ? Faut-il plus d'information sur la logique du score ?
5. **AIPD** : obligatoire avant la V1 ? Faut-il la mentionner dans la politique ? Consultation préalable de la CNIL (art. 36) ?
6. **B2B** : le scénario B (nous sommes responsables vis-à-vis du consultant, l'entreprise ne fait que payer) tient-il ? Seuil d'agrégation :
   le cahier des charges retient **10** consultants, le registre de `CONFORMITE.md` mentionne **k ≥ 5**. Harmoniser.
7. **T7 (recruteurs)** : faut-il traiter ce traitement dans la politique publique ou seulement dans le formulaire de consentement ?
   Base légale de la liste de contacts avant consentement.
8. **Durées** : 10 ans pour les pièces comptables et 3 ans pour la prospection — références légales à confirmer.
9. **Références des articles** pour chaque droit, délai de réponse, directives après décès, réclamation CNIL.
10. **Cookies** : régime applicable à la page d'offre.
