/*
 * Les e-mails de notification, en français et en anglais.
 *
 * Règle de contenu : un e-mail dit **qu'il se passe quelque chose** et renvoie sur Proofseen ; il ne recopie jamais le
 * texte d'un message ni le nom de l'autre partie avant son accord. La conversation, et la commission, restent sur la
 * plateforme ; et un e-mail transféré ne fait pas fuir une correspondance privée.
 */

import { accountNoticeBody } from "./account-notice";

export type Lang = "fr" | "en";

export type NotificationKind = "contact_received" | "application_received" | "message_received" | "application_status" | "mission_match" | "contract_update" | "vigilance_expiring" | "mission_confirmation" | "application_read" | "mission_invitation" | "company_mission" | "account_notice" | "profile_match" | "availability_reminder";

export interface NotificationInput {
  readonly kind: NotificationKind;
  readonly payload: Readonly<Record<string, string | number | readonly string[]>>;
  readonly to: { readonly lang: Lang; readonly displayName: string };
}

export interface Email {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  /** En-têtes ajoutés à l'e-mail, comme `List-Unsubscribe` d'un résumé (revue vague 3, L12). */
  readonly headers?: Readonly<Record<string, string>>;
}

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const e = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

const STATUS: Readonly<Record<Lang, Readonly<Record<string, string>>>> = {
  fr: { shortlisted: "retenue pour la suite", declined: "déclinée", hired: "acceptée : l'entreprise vous retient" },
  en: { shortlisted: "shortlisted", declined: "declined", hired: "accepted: the company is hiring you" },
};

const COPY = {
  fr: {
    hello: (name: string) => `Bonjour ${name},`,
    open: "Ouvrir sur Proofseen",
    footer: "Vous recevez cet e-mail parce que vous avez un compte Proofseen.",
    manage: "Choisir les e-mails que vous recevez",
  },
  en: {
    hello: (name: string) => `Hello ${name},`,
    open: "Open on Proofseen",
    footer: "You receive this e-mail because you have a Proofseen account.",
    manage: "Choose which e-mails you receive",
  },
} as const;

interface Body {
  readonly subject: string;
  readonly lines: readonly string[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
}

const text = (value: string | number | readonly string[] | undefined): string => (typeof value === "string" ? value : "");
const list = (value: string | number | readonly string[] | undefined): readonly string[] => (Array.isArray(value) ? value : []);

const body = (n: NotificationInput, base: string): Body => {
  const lang = n.to.lang;
  const app = `${base}/${lang}/app`;
  const fr = lang === "fr";
  switch (n.kind) {
    case "contact_received":
      return {
        subject: fr ? "Une entreprise souhaite vous contacter" : "A company would like to contact you",
        lines: [
          fr
            ? "Une entreprise vous a écrit sur Proofseen. Lisez son message, puis acceptez ou déclinez le contact : tant que vous n'avez pas accepté, elle ne peut plus vous écrire et ne sait pas qui vous êtes."
            : "A company wrote to you on Proofseen. Read its message, then accept or decline: until you accept, it cannot write again and does not know who you are.",
        ],
        links: [{ label: COPY[lang].open, href: `${app}/messages/${text(n.payload.conversationId)}` }],
      };
    case "message_received":
      return {
        subject: fr ? "Nouveau message sur Proofseen" : "New message on Proofseen",
        lines: [fr ? "Vous avez un nouveau message dans une conversation." : "You have a new message in a conversation."],
        links: [{ label: COPY[lang].open, href: `${app}/messages/${text(n.payload.conversationId)}` }],
      };
    case "application_received":
      return {
        subject: fr ? "Nouvelle candidature à votre mission" : "New application to your mission",
        lines: [fr ? "Un freelance a postulé à l'une de vos missions." : "A freelancer applied to one of your missions."],
        links: [{ label: COPY[lang].open, href: app }],
      };
    case "application_status": {
      const status = STATUS[lang][text(n.payload.status)] ?? text(n.payload.status);
      return {
        subject: fr ? "Votre candidature avance" : "Your application has moved",
        lines: [fr ? `Votre candidature a été ${status}.` : `Your application was ${status}.`],
        links: [{ label: COPY[lang].open, href: app }],
      };
    }
    case "contract_update": {
      const status = text(n.payload.status);
      const subject = {
        to_sign: fr ? "Un contrat attend votre signature" : "A contract is waiting for your signature",
        active: fr ? "Votre contrat est signé" : "Your contract is signed",
        completed: fr ? "Prestation validée" : "Work approved",
        validation_due: fr ? "Une prestation attend sa validation" : "Work is waiting for approval",
        second_approval_needed: fr ? "Une prestation attend une seconde validation" : "Work is waiting for a second approval",
        timesheet_submitted: fr ? "Un relevé mensuel attend votre validation" : "A monthly timesheet is waiting for your approval",
        timesheet_approved: fr ? "Votre relevé mensuel est validé" : "Your monthly timesheet was approved",
        timesheet_rejected: fr ? "Votre relevé mensuel est à corriger" : "Your monthly timesheet needs a correction",
      }[status] ?? (fr ? "Votre contrat a changé" : "Your contract has changed");
      const line = {
        to_sign: fr ? "Relisez le contrat et signez-le pour démarrer la mission." : "Review the contract and sign it to start the mission.",
        active: fr ? "Les deux parties ont signé : la mission peut démarrer." : "Both parties signed: the mission can start.",
        completed: fr ? "L'entreprise a validé la prestation." : "The company approved the work.",
        validation_due: fr
          ? "La fin prévue de la mission est passée depuis plus de deux semaines et la prestation n'est pas validée. Validez-la, ou signalez ce qui ne va pas : l'équipe Proofseen examine le dossier."
          : "The planned end of the mission passed more than two weeks ago and the work is not approved. Approve it, or report what is wrong: the Proofseen team is reviewing the case.",
        second_approval_needed: fr ? "Un administrateur a validé la prestation ; votre entreprise exige une seconde validation avant le versement au freelance." : "An administrator approved the work; your company requires a second approval before the freelancer is paid.",
        timesheet_submitted: fr ? `Le freelance a déposé son relevé de ${text(n.payload.month)}. Validez-le ou refusez-le avec une explication.` : `The freelancer submitted the timesheet for ${text(n.payload.month)}. Approve it or send it back with an explanation.`,
        timesheet_approved: fr ? `L'entreprise a validé votre relevé de ${text(n.payload.month)}.` : `The company approved your timesheet for ${text(n.payload.month)}.`,
        timesheet_rejected: fr ? `L'entreprise demande une correction de votre relevé de ${text(n.payload.month)} : corrigez-le et redéposez-le.` : `The company asks for a correction of your timesheet for ${text(n.payload.month)}: fix it and submit it again.`,
      }[status] ?? (fr ? "Consultez votre contrat sur Proofseen." : "See your contract on Proofseen.");
      return { subject, lines: [line], links: [{ label: COPY[lang].open, href: app }] };
    }
    case "vigilance_expiring": {
      const expiresOn = text(n.payload.expiresOn);
      return {
        subject: fr ? "Votre attestation de vigilance URSSAF expire bientôt" : "Your URSSAF vigilance certificate expires soon",
        lines: [
          fr
            ? `Elle expire le ${expiresOn}. Sans attestation à jour, aucun nouveau contrat d'au moins 5 000 € HT ne peut être signé : téléchargez la nouvelle sur urssaf.fr et déclarez-la sur Proofseen.`
            : `It expires on ${expiresOn}. Without a valid certificate, no new contract of 5,000 € excl. VAT or more can be signed: download the new one from urssaf.fr and declare it on Proofseen.`,
        ],
        links: [{ label: COPY[lang].open, href: app }],
      };
    }
    case "mission_confirmation": {
      const status = text(n.payload.status);
      if (status === "requested") {
        return {
          subject: fr ? "Un freelance demande la confirmation d'une mission" : "A freelancer asks you to confirm a mission",
          lines: [
            fr
              ? "Un freelance indique avoir réalisé une mission pour votre entreprise et vous demande de la confirmer. Rien n'est publié sans votre confirmation ; sans réponse, la demande expire au bout de trente jours."
              : "A freelancer says they completed a mission for your company and asks you to confirm it. Nothing is published without your confirmation; without an answer, the request expires after thirty days.",
          ],
          links: [{ label: COPY[lang].open, href: `${app}/confirmations` }],
        };
      }
      const confirmed = status === "confirmed";
      return {
        subject: confirmed ? (fr ? "Votre mission est confirmée par le client" : "Your mission was confirmed by the client") : fr ? "Le client n'a pas confirmé votre mission" : "The client did not confirm your mission",
        lines: [
          confirmed
            ? fr
              ? "Le client a confirmé la mission : elle apparaît maintenant sur votre profil public, datée, comme mission vérifiée."
              : "The client confirmed the mission: it now appears on your public profile, dated, as a verified mission."
            : fr
              ? "Le client a refusé de confirmer la mission. Rien n'est publié."
              : "The client declined to confirm the mission. Nothing is published.",
        ],
        links: [{ label: COPY[lang].open, href: `${app}/preuves` }],
      };
    }
    case "application_read":
      // Le freelance apprend que sa candidature a été ouverte, et quand : jamais par qui.
      return {
        subject: fr ? "Votre candidature a été lue" : "Your application was read",
        lines: [
          fr
            ? "L'entreprise a ouvert votre candidature. Vous verrez sa décision dans vos candidatures dès qu'elle la prendra."
            : "The company opened your application. You will see its decision in your applications as soon as it makes it.",
        ],
        links: [{ label: COPY[lang].open, href: `${app}/missions` }],
      };
    case "mission_invitation":
      return {
        subject: fr ? "Une entreprise vous invite à postuler" : "A company invites you to apply",
        lines: [
          fr
            ? "Une entreprise a vu votre profil et vous invite à postuler à l'une de ses missions. Vous décidez : postuler, ou écarter l'invitation."
            : "A company saw your profile and invites you to apply to one of its missions. You decide: apply, or set the invitation aside.",
        ],
        links: [
          { label: fr ? "Voir la mission" : "See the mission", href: `${base}/${lang}/missions/${text(n.payload.missionId)}` },
          { label: COPY[lang].open, href: `${app}/missions` },
        ],
      };
    case "company_mission":
      return {
        subject: fr ? "Une entreprise que vous suivez publie une mission" : "A company you follow posted a mission",
        lines: [fr ? "Une entreprise que vous suivez vient de publier une mission." : "A company you follow just posted a mission."],
        links: [{ label: fr ? "Voir la mission" : "See the mission", href: `${base}/${lang}/missions/${text(n.payload.missionId)}` }],
      };
    case "account_notice":
      return accountNoticeBody(lang, { notice: text(n.payload.notice), reason: text(n.payload.reason), subject: text(n.payload.subject) }, app, COPY[lang].open);
    case "mission_match": {
      const ids = list(n.payload.missionIds);
      return {
        subject: fr
          ? `${ids.length} nouvelle${ids.length > 1 ? "s" : ""} mission${ids.length > 1 ? "s" : ""} pour votre alerte`
          : `${ids.length} new mission${ids.length > 1 ? "s" : ""} for your alert`,
        lines: [fr ? "Des missions correspondant à votre alerte viennent d'être publiées." : "Missions matching your alert were just published."],
        links: ids.map((id, i) => ({ label: `Mission ${i + 1}`, href: `${base}/${lang}/missions/${id}` })),
      };
    }
    case "profile_match": {
      // Des adresses de profils publiés et celle de la recherche : jamais un nom, ni le nom donné à la recherche.
      const slugs = list(n.payload.slugs).filter((slug) => /^[a-z0-9-]{3,60}$/.test(slug));
      const search = text(n.payload.savedSearchId);
      return {
        subject: fr
          ? `${slugs.length} nouveau${slugs.length > 1 ? "x" : ""} profil${slugs.length > 1 ? "s" : ""} pour votre recherche enregistrée`
          : `${slugs.length} new profile${slugs.length > 1 ? "s" : ""} for your saved search`,
        lines: [fr ? "Des profils publiés répondent désormais à l'une de vos recherches enregistrées." : "Published profiles now match one of your saved searches."],
        links: [
          ...slugs.map((slug, i) => ({ label: fr ? `Profil ${i + 1}` : `Profile ${i + 1}`, href: `${base}/${lang}/profils/${slug}` })),
          ...(/^[0-9a-f-]{36}$/.test(search) ? [{ label: fr ? "Ouvrir la recherche" : "Open the search", href: `${app}/recherche/enregistree/${search}` }] : []),
        ],
      };
    }
    case "availability_reminder": {
      // Le lien mène à l'espace connecté, jamais à une confirmation en un clic depuis l'e-mail : un lien suivi par un
      // antivirus de messagerie confirmerait à la place de la personne une disponibilité qu'elle n'a pas redite.
      return {
        subject: fr ? "Votre disponibilité est-elle toujours à jour ?" : "Is your availability still up to date?",
        lines: [
          fr
            ? "Vous n'avez pas confirmé votre disponibilité depuis deux semaines. Dites en un clic si vous êtes toujours disponible ou non : passé 30 jours sans confirmation, votre profil reste visible, mais votre disponibilité s'affiche « non confirmée »."
            : "You have not confirmed your availability for two weeks. Say in one click whether you are still available: after 30 days without a confirmation, your profile stays visible, but your availability shows as \"not confirmed\".",
        ],
        links: [{ label: fr ? "Confirmer ma disponibilité" : "Confirm my availability", href: `${app}/profil#disponibilite` }],
      };
    }
  }
};

export const renderEmail = (n: NotificationInput, baseUrl: string): Email => {
  const base = baseUrl.replace(/\/$/, "");
  const copy = COPY[n.to.lang];
  const b = body(n, base);
  const manage = `${base}/${n.to.lang}/app`;
  const textBody = [copy.hello(n.to.displayName), "", ...b.lines, "", ...b.links.map((l) => `${l.label} : ${l.href}`), "", "—", copy.footer, `${copy.manage} : ${manage}`].join("\n");
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.6;color:#0e1626;max-width:560px">',
    `<p>${e(copy.hello(n.to.displayName))}</p>`,
    ...b.lines.map((line) => `<p>${e(line)}</p>`),
    ...b.links.map((l) => `<p><a href="${e(l.href)}" style="color:#0b7a55">${e(l.label)}</a></p>`),
    `<p style="margin-top:2em;font-size:13px;color:#5b6577">${e(copy.footer)} <a href="${e(manage)}" style="color:#5b6577">${e(copy.manage)}</a></p>`,
    "</div>",
  ].join("\n");
  return { subject: b.subject, text: textBody, html };
};
