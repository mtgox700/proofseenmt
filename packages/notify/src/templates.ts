/*
 * Les e-mails de notification, en français et en anglais.
 *
 * Règle de contenu : un e-mail dit **qu'il se passe quelque chose** et renvoie sur Proofseen ; il ne recopie jamais le
 * texte d'un message ni le nom de l'autre partie avant son accord. La conversation, et la commission, restent sur la
 * plateforme ; et un e-mail transféré ne fait pas fuir une correspondance privée.
 */

export type Lang = "fr" | "en";

export type NotificationKind = "contact_received" | "application_received" | "message_received" | "application_status" | "mission_match" | "contract_update";

export interface NotificationInput {
  readonly kind: NotificationKind;
  readonly payload: Readonly<Record<string, string | number | readonly string[]>>;
  readonly to: { readonly lang: Lang; readonly displayName: string };
}

export interface Email {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
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
      }[status] ?? (fr ? "Votre contrat a changé" : "Your contract has changed");
      const line = {
        to_sign: fr ? "Relisez le contrat et signez-le pour démarrer la mission." : "Review the contract and sign it to start the mission.",
        active: fr ? "Les deux parties ont signé : la mission peut démarrer." : "Both parties signed: the mission can start.",
        completed: fr ? "L'entreprise a validé la prestation." : "The company approved the work.",
      }[status] ?? (fr ? "Consultez votre contrat sur Proofseen." : "See your contract on Proofseen.");
      return { subject, lines: [line], links: [{ label: COPY[lang].open, href: app }] };
    }
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
