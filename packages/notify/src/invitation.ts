import type { Email, Lang } from "./templates";

/*
 * L'e-mail d'invitation (C23), envoyé à une adresse qui a peut-être déjà un compte : il est le même dans les deux cas
 * (« connectez-vous ou créez votre compte »), pour que rien ne dise à qui que ce soit si l'adresse est inscrite.
 *
 * Ouvrir le lien ne décide rien : la page demande de se connecter avec l'adresse invitée, puis d'accepter ou de
 * refuser. Le nom de l'expéditeur et son mot personnel viennent de lui : ils sont échappés, le mot a passé le filtre de
 * coordonnées, et le sujet ne garde aucun saut de ligne.
 */

export interface InvitationEmailInput {
  readonly lang: Lang;
  /** `freelance` : une entreprise invite un freelance dans son vivier ; `client` : un freelance invite une entreprise. */
  readonly kind: "freelance" | "client";
  readonly inviter: string;
  readonly message: string | null;
  readonly expiresAt: Date;
  /** Lien signé, à usage unique. */
  readonly link: string;
  readonly reminder: boolean;
}

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const e = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
const oneLine = (value: string): string => value.replace(/[\r\n\t]+/g, " ").trim();
const day = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "Europe/Paris" }).format(d);

const COPY = {
  fr: {
    subject: (who: string, reminder: boolean) => `${reminder ? "Rappel : " : ""}${who} vous invite sur Proofseen`,
    hello: "Bonjour,",
    ask: {
      freelance: (who: string) =>
        `${who} travaille déjà avec vous et vous invite à rejoindre son vivier de freelances sur Proofseen. En acceptant, votre profil entre dans son vivier privé : ses membres vous retrouvent parmi les freelances avec qui l'entreprise a déjà travaillé.`,
      client: (who: string) =>
        `${who}, freelance sur Proofseen, vous invite à y rejoindre son espace de travail avec votre entreprise : missions, devis, contrats et factures au même endroit. Accepter ne vous engage à rien.`,
    },
    note: "Son mot :",
    how: "Pour répondre, connectez-vous ou créez votre compte avec cette adresse e-mail : l'invitation ne s'accepte qu'avec elle.",
    open: "Voir l'invitation",
    expires: (date: string) => `Ce lien est personnel, ne sert qu'une fois et expire le ${date}.`,
    footer: (who: string) => `Vous recevez cet e-mail parce que ${who} a indiqué votre adresse. Si vous ne le connaissez pas, ignorez ce message : rien ne se passera.`,
  },
  en: {
    subject: (who: string, reminder: boolean) => `${reminder ? "Reminder: " : ""}${who} invites you to Proofseen`,
    hello: "Hello,",
    ask: {
      freelance: (who: string) =>
        `${who} already works with you and invites you to join its pool of freelancers on Proofseen. If you accept, your profile joins its private talent pool: its members find you among the freelancers the company has already worked with.`,
      client: (who: string) =>
        `${who}, a freelancer on Proofseen, invites you and your company to work together there: missions, quotes, contracts and invoices in one place. Accepting commits you to nothing.`,
    },
    note: "Their note:",
    how: "To answer, sign in or create your account with this e-mail address: the invitation can only be accepted with it.",
    open: "See the invitation",
    expires: (date: string) => `This link is personal, works once and expires on ${date}.`,
    footer: (who: string) => `You receive this e-mail because ${who} entered your address. If you do not know them, ignore this message: nothing will happen.`,
  },
} as const;

export const renderInvitation = (i: InvitationEmailInput): Email => {
  const c = COPY[i.lang];
  const who = oneLine(i.inviter).slice(0, 200);
  const note = i.message === null ? [] : i.message.split("\n").map((line) => line.trim());
  const expires = c.expires(day(i.expiresAt, i.lang));
  const text = [c.hello, "", c.ask[i.kind](who), ...(note.length === 0 ? [] : ["", c.note, ...note.map((line) => `> ${line}`)]), "", c.how, "", `${c.open} : ${i.link}`, expires, "", "—", c.footer(who)].join("\n");
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.6;color:#0e1626;max-width:560px">',
    `<p>${e(c.hello)}</p>`,
    `<p>${e(c.ask[i.kind](who))}</p>`,
    ...(note.length === 0 ? [] : [`<p>${e(c.note)}</p>`, `<blockquote style="margin:0 0 1em;padding-left:1em;border-left:3px solid #d5dbe5">${note.map(e).join("<br>")}</blockquote>`]),
    `<p>${e(c.how)}</p>`,
    `<p><a href="${e(i.link)}" style="color:#0b7a55">${e(c.open)}</a></p>`,
    `<p style="font-size:14px;color:#5b6577">${e(expires)}</p>`,
    `<p style="margin-top:2em;font-size:13px;color:#5b6577">${e(c.footer(who))}</p>`,
    "</div>",
  ].join("\n");
  return { subject: oneLine(c.subject(who, i.reminder)).slice(0, 200), text, html };
};
