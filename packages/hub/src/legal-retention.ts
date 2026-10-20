import { escapeHtml as e } from "./html";
import type { Lang } from "./market-shell";

/*
 * Les durées de conservation, telles que le code les applique (relevé du 2026-10-20) : `packages/db/src/retention.ts`
 * (purge lancée toutes les 5 minutes par la tâche planifiée des notifications), purges des statistiques d'audience, des
 * publications, des fichiers orphelins, et le script de sauvegarde du serveur. Une durée changée dans le code doit
 * l'être ici.
 */

interface Row {
  readonly fr: readonly [string, string, string];
  readonly en: readonly [string, string, string];
}

const ROWS: readonly Row[] = [
  {
    fr: ["Compte, profil, compétences, expériences, photos, portfolio, CV", "Contrat", "Jusqu'à l'effacement du compte. Un nouveau CV remplace les anciens, sauf ceux joints à une candidature qui n'a pas été retirée."],
    en: ["Account, profile, skills, experience, photos, portfolio, CVs", "Contract", "Until the account is erased. A new CV replaces the older ones, except those attached to an application that was not withdrawn."],
  },
  {
    fr: ["Identité de facturation, SIRET, attestation de vigilance URSSAF", "Obligation légale ; intérêt légitime (lutte contre la fraude)", "Avec le profil ; le SIRET est revérifié tous les 30 jours et n'est jamais publié."],
    en: ["Billing identity, SIRET, URSSAF compliance certificate", "Legal obligation; legitimate interest (fraud prevention)", "With the profile; the SIRET is re-checked every 30 days and never published."],
  },
  {
    fr: ["Missions, candidatures, alertes de missions", "Contrat ; consentement pour les alertes", "Jusqu'à leur suppression ou celle du compte."],
    en: ["Missions, applications, mission alerts", "Contract; consent for alerts", "Until they or the account are deleted."],
  },
  {
    fr: ["Messagerie et pièces jointes", "Contrat", "Prise de contact restée sans réponse : supprimée 1 an après le dernier message. Contact refusé : messages supprimés 1 an après le refus, le refus lui-même gardé pour empêcher un nouveau contact. Pièce jointe jamais envoyée : 24 heures. Sinon, jusqu'à l'effacement du compte."],
    en: ["Messages and attachments", "Contract", "Contact request left unanswered: deleted 1 year after the last message. Declined contact: messages deleted 1 year after the refusal, the refusal itself kept to prevent a new contact. Attachment never sent: 24 hours. Otherwise, until the account is erased."],
  },
  {
    fr: ["Publications et commentaires de la communauté", "Contrat", "Publication supprimée : vidée tout de suite, effacée 30 jours après avec ses commentaires et réactions. Commentaire supprimé : texte effacé tout de suite."],
    en: ["Community posts and comments", "Contract", "Deleted post: emptied at once, erased 30 days later with its comments and reactions. Deleted comment: text erased at once."],
  },
  {
    fr: ["Invitations (adresse invitée, mot personnel)", "Intérêt légitime de la personne qui invite", "Valable 14 jours ; une invitation jamais acceptée est supprimée 30 jours après son échéance."],
    en: ["Invitations (invited address, personal note)", "Legitimate interest of the person inviting", "Valid 14 days; an invitation never accepted is deleted 30 days after it expires."],
  },
  {
    fr: ["Demandes de confirmation d'une mission (adresse du client)", "Intérêt légitime (vérifier un fait)", "Valable 30 jours ; supprimée 90 jours après la réponse ou l'échéance."],
    en: ["Mission confirmation requests (client's address)", "Legitimate interest (verifying a fact)", "Valid 30 days; deleted 90 days after the answer or expiry."],
  },
  {
    fr: ["Audience (empreinte du jour d'un visiteur)", "Intérêt légitime (statistiques sans traceur)", "Empreinte effacée à la fin de la journée ; compteurs gardés 13 mois."],
    en: ["Audience (a visitor's daily fingerprint)", "Legitimate interest (statistics without tracking)", "Fingerprint erased at the end of the day; counters kept 13 months."],
  },
  {
    fr: ["E-mails de notification", "Contrat", "90 jours après leur création une fois envoyés ; 1 an au plus sinon."],
    en: ["Notification e-mails", "Contract", "90 days after creation once sent; 1 year at most otherwise."],
  },
  {
    fr: ["Notifications dans l'application", "Contrat", "Lues : 90 jours après lecture. Non lues : 1 an."],
    en: ["In-app notifications", "Contract", "Read: 90 days after reading. Unread: 1 year."],
  },
  {
    fr: ["Abonnements aux notifications push", "Consentement", "Jusqu'au désabonnement, ou 90 jours sans notification reçue ; file d'envoi : 24 heures."],
    en: ["Push notification subscriptions", "Consent", "Until you unsubscribe, or 90 days without a delivered notification; sending queue: 24 hours."],
  },
  {
    fr: ["Mesures de visibilité IA", "Contrat", "Résultats gardés avec le profil ; demande de mesure terminée : 1 an ; réponses brutes des moteurs : jamais enregistrées."],
    en: ["AI visibility measurements", "Contract", "Results kept with the profile; finished measurement request: 1 year; raw engine answers: never recorded."],
  },
  {
    fr: ["Retours de la bêta et contestations d'une suspension", "Intérêt légitime", "1 an."],
    en: ["Beta feedback and appeals against a suspension", "Legitimate interest", "1 year."],
  },
  {
    fr: ["Journal des décisions de modération", "Intérêt légitime (sécurité, preuve)", "5 ans, sans modification possible."],
    en: ["Log of moderation decisions", "Legitimate interest (security, evidence)", "5 years, cannot be altered."],
  },
  {
    fr: ["Trace d'un compte suspendu puis effacé (empreinte de l'e-mail, motif, date)", "Intérêt légitime (empêcher un contournement)", "3 ans."],
    en: ["Trace of a suspended account later erased (fingerprint of the e-mail, reason, date)", "Legitimate interest (preventing evasion)", "3 years."],
  },
  {
    fr: ["Limitation de débit (empreinte de l'adresse IP ou du compte, jamais l'adresse)", "Intérêt légitime (sécurité)", "1 jour."],
    en: ["Rate limiting (fingerprint of the IP address or account, never the address)", "Legitimate interest (security)", "1 day."],
  },
  {
    fr: ["Demandes d'audit sans compte", "Consentement", "3 ans après la demande."],
    en: ["Audit requests without an account", "Consent", "3 years after the request."],
  },
  {
    fr: ["Devis, contrats et factures", "Contrat ; obligation légale (comptabilité)", "Conservés, et détachés du compte à son effacement."],
    en: ["Quotes, contracts and invoices", "Contract; legal obligation (accounting)", "Kept, and detached from the account when it is erased."],
  },
  {
    fr: ["Sauvegardes de la base", "Intérêt légitime (reprise après incident)", "Une copie par nuit, sur le serveur de l'hébergeur IONOS, lisible par le seul administrateur du serveur, supprimée après 14 jours."],
    en: ["Database backups", "Legitimate interest (incident recovery)", "One copy a night, on the IONOS hosting server, readable only by the server administrator, deleted after 14 days."],
  },
];

export const retentionTable = (lang: Lang): string => {
  const head = lang === "fr" ? ["Données", "Base légale", "Durée"] : ["Data", "Legal basis", "Duration"];
  return (
    `<div class="table"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>` +
    ROWS.map((r) => {
      const [what, basis, how] = r[lang];
      return `<tr><th scope="row">${e(what)}</th><td>${e(basis)}</td><td>${e(how)}</td></tr>`;
    }).join("") +
    "</tbody></table></div>"
  );
};
