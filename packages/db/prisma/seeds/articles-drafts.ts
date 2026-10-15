import type { ArticleInput } from "../../src/article-input";

/*
 * Trois guides, en BROUILLON : à relire par le founder, puis à publier depuis le bureau de rédaction
 * (/fr/app/articles). Rien ici n'est publié automatiquement.
 *
 * Chaque chiffre et chaque règle viennent d'une fiche officielle lue le 2026-10-15 (Entreprendre Service-Public,
 * entreprendre.service-public.gouv.fr — l'ancienne adresse .fr y redirige). La date « Vérifié le » de chaque fiche est
 * notée à côté de sa source. Ce qui n'a pas pu être vérifié n'a pas été écrit. Aucun exemple chiffré inventé.
 *
 * Les seuils et taux changent : relire les fiches avant de publier, et mettre à jour l'article à chaque changement.
 */

const SP = "https://entreprendre.service-public.gouv.fr/vosdroits";

const SOURCES = {
  micro: { title: "Micro-entrepreneur : ce qu'il faut savoir (Service-Public, vérifié le 21 février 2026)", url: `${SP}/F37398` },
  microSocial: { title: "Régime micro-social (Service-Public, vérifié le 21 février 2026)", url: `${SP}/F37353` },
  microTax: { title: "Régime fiscal de la micro-entreprise (Service-Public, vérifié le 13 mai 2026)", url: `${SP}/F23267` },
  becomeMicro: { title: "Comment devenir micro-entrepreneur ? (Service-Public, vérifié le 15 septembre 2025)", url: `${SP}/F23961` },
  ei: { title: "Entrepreneur individuel (EI) : ce qu'il faut savoir (Service-Public, vérifié le 21 février 2026)", url: `${SP}/F37396` },
  capital: { title: "Constituer et déposer le capital social d'une société (Service-Public, vérifié le 20 octobre 2025)", url: `${SP}/F32333` },
  sasuSocial: { title: "Cotisations sociales d'une SASU : ce qu'il faut savoir (Service-Public, vérifié le 21 février 2026)", url: `${SP}/F36240` },
  eurlSocial: { title: "Cotisations sociales d'une EURL : ce qu'il faut savoir (Service-Public, vérifié le 21 février 2026)", url: `${SP}/F36239` },
  vat: { title: "Franchise en base de TVA (Service-Public, vérifié le 1er janvier 2026)", url: `${SP}/F21746` },
  invoice: { title: "Mentions obligatoires sur une facture (Service-Public, vérifié le 11 août 2026)", url: `${SP}/F31808` },
  payment: { title: "Délais de paiement entre professionnels et pénalités de retard (Service-Public, vérifié le 7 août 2026)", url: `${SP}/F23211` },
} as const;

const AUTHOR = "Équipe Proofseen";

const STATUS: ArticleInput = {
  lang: "fr",
  slug: "micro-entreprise-eurl-ou-sasu-quel-statut-pour-un-freelance-tech",
  title: "Micro-entreprise, EURL ou SASU : quel statut pour un freelance tech ?",
  description: "Ce qui change vraiment entre la micro-entreprise, l'EURL et la SASU : régime social, impôt, capital, plafonds. D'après les fiches officielles de Service-Public.",
  category: "guide",
  audience: "freelance",
  authorName: AUTHOR,
  body: `Trois formes reviennent le plus souvent quand un freelance tech démarre : l'entreprise individuelle au régime de la micro-entreprise, l'EURL et la SASU. Elles diffèrent surtout par le régime social du dirigeant, la façon dont les bénéfices sont imposés et les formalités. Ce guide résume ce que disent les fiches officielles de Service-Public ; il ne remplace pas l'avis d'un expert-comptable.

## La micro-entreprise

La micro-entreprise n'est pas une société : c'est un régime fiscal et social simplifié de l'entreprise individuelle. Vous exercez en nom propre, sans capital à constituer.

- **Plafond de chiffre d'affaires** : 83 600 € pour les prestations de services (seuil applicable aux revenus 2026). Au-delà, l'entreprise relève d'un régime réel d'imposition.
- **Cotisations sociales** : un pourcentage du chiffre d'affaires réellement encaissé. En 2026 : 21,2 % pour les prestations de services relevant des BIC, 25,6 % pour les professions libérales non réglementées, 23,2 % pour les professions libérales relevant de la Cipav. Sans chiffre d'affaires, aucune cotisation n'est due.
- **Impôt** : les bénéfices sont soumis à l'impôt sur le revenu, après un abattement forfaitaire pour frais de 50 % pour les prestations de services BIC et de 34 % pour les professions libérales (BNC). Sur option, et sous condition de revenu fiscal de référence, le versement libératoire est de 1,7 % du chiffre d'affaires pour les prestations BIC et de 2,2 % pour les BNC.
- **Patrimoine** : le patrimoine personnel est en principe séparé du patrimoine professionnel, et la résidence principale est protégée automatiquement. Le fisc et les organismes sociaux peuvent toutefois se faire payer sur le patrimoine personnel en cas de fraude ou de manquements graves.

Le point à surveiller : les frais réels ne sont pas déduits. Si votre activité engage beaucoup de frais (matériel, sous-traitance, déplacements), l'abattement forfaitaire peut être moins favorable qu'un régime réel. La catégorie de votre activité (BIC, profession libérale, Cipav) détermine le taux : vérifiez-la auprès de l'Urssaf.

## L'EURL

L'EURL est une société à un seul associé, dirigée par un gérant.

- **Capital** : libre. Un capital de 1 € est possible, mais déconseillé. Au moins 20 % des apports en argent sont versés à la création, le solde dans les 5 ans qui suivent l'immatriculation.
- **Impôt** : impôt sur le revenu par défaut, avec option possible pour l'impôt sur les sociétés.
- **Régime social** : le gérant associé est travailleur non salarié ; un gérant qui n'est pas associé est assimilé salarié.

## La SASU

La SASU est une société par actions simplifiée à un seul associé, dirigée par un président.

- **Capital** : libre, 1 € possible mais déconseillé. Au moins 50 % des apports en argent sont versés à la création, le solde dans les 5 ans qui suivent l'immatriculation.
- **Impôt** : impôt sur les sociétés par défaut, avec option possible pour l'impôt sur le revenu.
- **Régime social** : le président est assimilé salarié et relève du régime général. Ses cotisations sont celles d'un salarié cadre, sans l'assurance chômage : le dirigeant n'y a pas droit, mais il peut souscrire une assurance chômage facultative.

## L'entreprise individuelle au régime réel

Sans créer de société, un entrepreneur individuel peut quitter le régime de la micro-entreprise, ou y être obligé au-delà des plafonds. Il est alors imposé sur son bénéfice réel. Service-Public indique que ses cotisations représentent environ 45 % du revenu d'activité. Il peut aussi opter pour l'impôt sur les sociétés.

## La TVA

La franchise en base de TVA dispense de facturer la TVA tant que le chiffre d'affaires de prestations de services ne dépasse pas 37 500 € sur l'année précédente, ou 41 250 € sur l'année en cours (seuil majoré). Les factures portent alors la mention « TVA non applicable - article 293 B du CGI ».

## Comment choisir

Quelques questions à se poser, sans réponse universelle :

- **Votre chiffre d'affaires prévu dépasse-t-il le plafond de la micro-entreprise ?** Si oui, elle n'est pas une solution durable.
- **Avez-vous beaucoup de frais ?** Le régime réel (entreprise individuelle au réel, EURL, SASU) déduit les frais réels ; la micro-entreprise applique un abattement forfaitaire.
- **Quelle protection sociale voulez-vous ?** Le président de SASU relève du régime général ; le gérant associé d'EURL et l'entrepreneur individuel relèvent du régime des travailleurs non salariés.
- **Quel niveau de formalités acceptez-vous ?** Une société demande des statuts, un dépôt de capital et une comptabilité complète.

Faites chiffrer votre situation par un expert-comptable ou avec les simulateurs de l'Urssaf avant de décider.`,
  sources: [SOURCES.micro, SOURCES.microSocial, SOURCES.microTax, SOURCES.becomeMicro, SOURCES.ei, SOURCES.capital, SOURCES.eurlSocial, SOURCES.sasuSocial, SOURCES.vat],
};

const DAY_RATE: ArticleInput = {
  lang: "fr",
  slug: "comment-fixer-son-tjm",
  title: "Comment fixer son TJM",
  description: "Une méthode pour poser son taux journalier : jours réellement facturés, frais, cotisations selon le statut, TVA, puis confrontation au marché.",
  category: "guide",
  audience: "freelance",
  authorName: AUTHOR,
  body: `Le TJM (taux journalier moyen) est le prix d'une journée de travail facturée. Il doit couvrir, sur l'année, ce que votre activité coûte et ce que vous voulez en tirer, réparti sur les seules journées que vous facturerez réellement.

Une façon simple de le poser :

**TJM = (revenu annuel visé + frais professionnels + cotisations et impôts) ÷ nombre de jours facturés dans l'année**

## Compter les jours réellement facturés

Une année ne se facture pas en entier. Retirez des jours ouvrés les congés, les jours fériés, la formation, la prospection, l'administratif, les périodes entre deux missions et les éventuels arrêts. Les semaines sans mission comptent : elles ne rapportent rien, mais les frais et le revenu visé courent toujours.

## Lister les frais

Matériel, logiciels, assurance professionnelle, expert-comptable, banque, espace de travail, déplacements, formation : notez-les sur une année.

## Ajouter les cotisations et l'impôt selon le statut

- **Micro-entreprise** : les cotisations sont un pourcentage du chiffre d'affaires encaissé. En 2026 : 21,2 % pour les prestations de services BIC, 25,6 % pour les professions libérales non réglementées, 23,2 % pour celles qui relèvent de la Cipav. Elles portent sur le chiffre d'affaires, frais compris : à TJM égal, plus vos frais sont élevés, moins il vous reste.
- **Entrepreneur individuel au régime réel** : Service-Public indique des cotisations d'environ 45 % du revenu d'activité.
- **Président de SASU** : il est assimilé salarié ; ses cotisations sont celles d'un salarié cadre, sans l'assurance chômage.

Vérifiez aussi le plafond de la micro-entreprise : 83 600 € de chiffre d'affaires pour les prestations de services. Un TJM multiplié par vos jours facturés qui le dépasse fait changer de régime.

## Vérifier la TVA

Sous 37 500 € de chiffre d'affaires de prestations de services sur l'année précédente, la franchise en base dispense de facturer la TVA. Au-delà, la TVA s'ajoute au TJM : annoncez toujours votre TJM hors taxes.

## Confronter le calcul au marché

Le calcul donne un plancher : en dessous, l'activité ne couvre pas ses coûts. Le prix accepté dépend aussi de la rareté de vos compétences, de votre expérience, de la durée de la mission, du lieu et du mode de travail. Préférez les données publiées avec leur effectif et leur méthode aux moyennes sans source.

## Écrire les conditions

Un TJM se lit avec ses conditions : durée d'une journée, frais de déplacement inclus ou non, délai de paiement. Entre professionnels, le délai de paiement est en principe de 30 jours ; un délai différent doit être écrit dans le contrat ou les conditions générales, et peut être fixé à 45 jours fin de mois ou à 60 jours à compter de la date d'émission de la facture.`,
  sources: [SOURCES.microSocial, SOURCES.micro, SOURCES.ei, SOURCES.sasuSocial, SOURCES.vat, SOURCES.payment],
};

const INVOICE: ArticleInput = {
  lang: "fr",
  slug: "facturer-une-mission-freelance-mentions-obligatoires",
  title: "Facturer une mission freelance : les mentions obligatoires",
  description: "La liste des mentions qu'une facture entre professionnels doit porter, les délais de paiement, les pénalités, et ce que change la facturation électronique.",
  category: "guide",
  audience: "freelance",
  authorName: AUTHOR,
  body: `Une facture entre professionnels doit porter une liste de mentions fixée par la réglementation. Ce guide reprend la fiche officielle de Service-Public ; relisez-la avant d'émettre vos premières factures, car les règles évoluent avec la facturation électronique.

## Les mentions de toute facture

- **Les dates** : date d'émission de la facture et date de la prestation (ou du versement d'un acompte).
- **Un numéro unique**, pris dans une séquence chronologique et continue.
- **Votre identité** : en entreprise individuelle, nom, prénom, mention « Entrepreneur individuel » ou « EI », adresse et Siren ; en société, dénomination, Siren, siège social, forme juridique et capital social.
- **L'identité du client** : son nom ou sa dénomination sociale.
- **Votre numéro de TVA intracommunautaire**, sauf pour une facture dont le total hors taxes ne dépasse pas 150 €.
- **La désignation de la prestation** : quantité, prix unitaire hors taxes et taux de TVA.
- **Les totaux** hors taxes et toutes taxes comprises, avec les réductions éventuelles.
- **La date de règlement** et les conditions d'escompte, ou la mention « Escompte pour paiement anticipé : néant ».
- **Le taux des pénalités de retard.**
- **La mention de l'indemnité forfaitaire de 40 €** pour frais de recouvrement, réclamable à un client professionnel.
- **Le numéro de bon de commande**, quand le client en a établi un.

## Les mentions particulières

- **Franchise en base de TVA** (prestations de services sous 37 500 € de chiffre d'affaires sur l'année précédente) : « TVA non applicable - article 293 B du CGI ».
- **Autoliquidation** : quand le client est redevable de la TVA, la mention « Auto-liquidation ».

## Délais et pénalités

En principe, le délai de paiement entre professionnels est de 30 jours. Un délai différent doit être écrit dans le contrat ou les conditions générales ; il peut être fixé à 45 jours fin de mois ou à 60 jours à compter de la date d'émission de la facture. Les pénalités de retard ne peuvent pas être inférieures à 3 fois le taux de l'intérêt légal. L'indemnité forfaitaire de 40 € est due une seule fois par facture impayée, même en cas de paiement partiel.

## La facturation électronique

Service-Public indique que de nouvelles mentions deviennent obligatoires à compter du 1er septembre 2026 pour les grandes entreprises et les ETI, et à partir du 1er septembre 2027 pour les PME et les micro-entreprises :

- le Siren du client, quand c'est une entreprise ;
- l'adresse de livraison, si elle diffère de celle du client ;
- la nature des opérations : livraisons de biens, prestations de services, ou les deux ;
- le cas échéant, l'option pour le paiement de la taxe d'après les débits.

## Pour une mission au temps passé

Pour une mission facturée au TJM, la quantité est le nombre de jours réalisés sur la période, et le prix unitaire est le TJM hors taxes. Joindre le relevé des jours validés par le client rend la facture plus simple à vérifier.`,
  sources: [SOURCES.invoice, SOURCES.payment, SOURCES.vat],
};

export const ARTICLE_DRAFTS: readonly ArticleInput[] = [STATUS, DAY_RATE, INVOICE];
