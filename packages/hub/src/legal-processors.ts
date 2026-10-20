import { escapeHtml as e } from "./html";
import type { Lang } from "./market-shell";

/*
 * Les prestataires qui reçoivent des données de l'application en production, relevés dans le code le 2026-10-20 (appels
 * `fetch`, SDK, configuration du déploiement). Un test d'`apps/web` cherche ces services dans le code et échoue si l'un
 * d'eux n'est plus cité par la politique de confidentialité : la page ne peut pas dériver en silence.
 */

interface Text {
  readonly fr: string;
  readonly en: string;
}

export interface Processor {
  readonly name: string;
  readonly role: Text;
  readonly data: Text;
  readonly where: Text;
}

const US: Text = { fr: "États-Unis", en: "United States" };

export const PROCESSORS: readonly Processor[] = [
  {
    name: "IONOS",
    role: { fr: "Serveur de l'application, fichiers déposés, sauvegardes de la base", en: "Application server, uploaded files, database backups" },
    data: { fr: "Toutes les données traitées par l'application ; fichiers (photos, CV, pièces jointes) ; copies nocturnes de la base", en: "All data processed by the application; files (photos, CVs, attachments); nightly database copies" },
    where: { fr: "Serveur de l'hébergeur IONOS", en: "IONOS hosting server" },
  },
  {
    name: "Railway",
    role: { fr: "Base de données", en: "Database" },
    data: { fr: "Comptes, profils, missions, messages, contrats, notifications et autres données de l'application (pas le contenu des fichiers)", en: "Accounts, profiles, missions, messages, contracts, notifications and other application data (not file contents)" },
    where: { fr: "Railway Corporation, société établie aux États-Unis", en: "Railway Corporation, a company based in the United States" },
  },
  {
    name: "Clerk",
    role: { fr: "Connexion et sessions", en: "Sign-in and sessions" },
    data: { fr: "Adresse e-mail, prénom et nom s'ils sont renseignés, sessions ; envoi des codes de connexion", en: "E-mail address, first and last name if given, sessions; sending of sign-in codes" },
    where: US,
  },
  {
    name: "Resend",
    role: { fr: "Envoi des e-mails", en: "E-mail delivery" },
    data: { fr: "Adresse du destinataire, objet et contenu de l'e-mail (jamais le texte d'un message de la messagerie)", en: "Recipient address, subject and content of the e-mail (never the text of a chat message)" },
    where: { fr: "Société établie aux États-Unis ; domaine d'envoi configuré dans la région Irlande", en: "Company based in the United States; sending domain set up in the Ireland region" },
  },
  {
    name: "Anthropic",
    role: {
      fr: "Modèle d'IA : mesure de visibilité, repérage des noms dans les réponses, lecture d'un CV importé, traduction d'une recherche en filtres",
      en: "AI model: visibility measurement, spotting names in answers, reading an imported CV, turning a search sentence into filters",
    },
    data: {
      fr: "Question de mesure sans votre nom ; réponses des moteurs ; texte du CV que vous importez ; phrase de recherche que vous tapez",
      en: "Measurement question without your name; engine answers; text of the CV you import; search sentence you type",
    },
    where: US,
  },
  {
    name: "OpenAI",
    role: { fr: "Moteur d'IA interrogé pour la mesure de visibilité", en: "AI engine queried for the visibility measurement" },
    data: { fr: "Question de mesure construite sans votre nom, ni adresse, ni e-mail", en: "Measurement question built without your name, address or e-mail" },
    where: US,
  },
  {
    name: "Perplexity",
    role: { fr: "Moteur d'IA interrogé pour la mesure de visibilité", en: "AI engine queried for the visibility measurement" },
    data: { fr: "Question de mesure construite sans votre nom, ni adresse, ni e-mail", en: "Measurement question built without your name, address or e-mail" },
    where: US,
  },
  {
    name: "Web Push (Google, Mozilla, Apple, Microsoft)",
    role: { fr: "Acheminement des notifications sur votre appareil, si vous les activez", en: "Delivering notifications to your device, if you turn them on" },
    data: {
      fr: "Adresse d'abonnement de l'appareil et notification chiffrée (une phrase et un lien, jamais le texte d'un message)",
      en: "Device subscription address and an encrypted notification (a sentence and a link, never the text of a message)",
    },
    where: { fr: "Selon l'éditeur de votre navigateur", en: "Depends on your browser's maker" },
  },
  {
    name: "API Recherche d'entreprises",
    role: { fr: "Contrôle d'un SIRET au répertoire officiel des entreprises", en: "Checking a SIRET number against the official French business register" },
    data: { fr: "Le seul numéro SIRET", en: "The SIRET number only" },
    where: { fr: "Service public de l'État français (recherche-entreprises.api.gouv.fr)", en: "French government public service (recherche-entreprises.api.gouv.fr)" },
  },
  {
    name: "IndexNow",
    role: { fr: "Signalement aux moteurs de recherche des pages publiques nouvelles ou modifiées", en: "Notifying search engines of new or changed public pages" },
    data: { fr: "Adresses de pages publiques (missions, profils publiés sous leur référence), jamais un nom ni un e-mail", en: "Addresses of public pages (missions, profiles published under their reference), never a name or an e-mail" },
    where: { fr: "Moteurs de recherche participants (dont Bing)", en: "Participating search engines (including Bing)" },
  },
];

export const processorTable = (lang: Lang): string => {
  const head = lang === "fr" ? ["Prestataire", "Rôle", "Données", "Où"] : ["Provider", "Role", "Data", "Where"];
  return (
    `<div class="table"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>` +
    PROCESSORS.map((p) => `<tr><th scope="row">${e(p.name)}</th><td>${e(p.role[lang])}</td><td>${e(p.data[lang])}</td><td>${e(p.where[lang])}</td></tr>`).join("") +
    "</tbody></table></div>"
  );
};
