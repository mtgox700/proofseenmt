import { SIGNATURE_DELIMITER } from "./signature";
import type { Email, Lang } from "./templates";

/*
 * L'e-mail envoyé au contact d'un client, sans compte Proofseen, pour qu'il confirme ou refuse une mission déclarée
 * par un freelance. Il dit qui demande, quoi, et jusqu'à quand ; le lien ouvre une page qui montre la mission et deux
 * boutons. Ouvrir le lien ne décide rien : seul un clic sur la page le fait (un antivirus de messagerie qui suit les
 * liens ne confirme donc jamais à la place du contact).
 *
 * Aucune coordonnée du freelance : il est désigné par son nom affiché (ou sa référence), et le contact répond sur
 * Proofseen. Les champs viennent de la déclaration du freelance : ils sont échappés, et le sujet ne garde aucun saut
 * de ligne.
 */

export interface ConfirmationRequestInput {
  readonly lang: Lang;
  readonly freelancer: string;
  readonly role: string;
  readonly clientName: string;
  readonly startedOn: Date;
  readonly endedOn: Date;
  readonly expiresAt: Date;
  /** Lien signé, à usage unique. */
  readonly link: string;
}

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const e = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
const oneLine = (value: string): string => value.replace(/[\r\n\t]+/g, " ").trim();

const month = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
const day = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(d);

const COPY = {
  fr: {
    subject: (who: string) => `${who} vous demande de confirmer une mission`,
    hello: "Bonjour,",
    ask: (who: string, client: string) => `${who}, freelance inscrit sur Proofseen, indique avoir réalisé la mission suivante pour ${client} et vous demande de la confirmer :`,
    role: "Rôle",
    period: "Période",
    from: (start: string, end: string) => (start === end ? start : `de ${start} à ${end}`),
    effect:
      "Si vous confirmez, la mission apparaîtra sur son profil public comme « confirmée par le client », datée. Le nom de votre entreprise n'y figurera que si vous l'autorisez. Si vous refusez, ou si vous ne répondez pas, rien n'est publié.",
    open: "Voir la mission et répondre",
    expires: (date: string) => `Ce lien est personnel, ne sert qu'une fois et expire le ${date}.`,
    footer: (client: string) => `Vous recevez cet e-mail parce qu'un freelance a indiqué votre adresse comme contact chez ${client}. Si vous ne le connaissez pas, ignorez ce message : rien ne sera publié.`,
  },
  en: {
    subject: (who: string) => `${who} asks you to confirm a mission`,
    hello: "Hello,",
    ask: (who: string, client: string) => `${who}, a freelancer on Proofseen, says they completed the following mission for ${client} and asks you to confirm it:`,
    role: "Role",
    period: "Period",
    from: (start: string, end: string) => (start === end ? start : `from ${start} to ${end}`),
    effect:
      "If you confirm, the mission will appear on their public profile as \"confirmed by the client\", dated. Your company's name will only appear if you allow it. If you decline, or do not answer, nothing is published.",
    open: "See the mission and answer",
    expires: (date: string) => `This link is personal, works once and expires on ${date}.`,
    footer: (client: string) => `You receive this e-mail because a freelancer gave your address as their contact at ${client}. If you do not know them, ignore this message: nothing will be published.`,
  },
} as const;

export const renderConfirmationRequest = (i: ConfirmationRequestInput): Email => {
  const c = COPY[i.lang];
  const who = oneLine(i.freelancer);
  const client = oneLine(i.clientName);
  const period = c.from(month(i.startedOn, i.lang), month(i.endedOn, i.lang));
  const facts = [`${c.role} : ${oneLine(i.role)}`, `${c.period} : ${period}`];
  const text = [c.hello, "", c.ask(who, client), "", ...facts, "", c.effect, "", `${c.open} : ${i.link}`, c.expires(day(i.expiresAt, i.lang)), "", SIGNATURE_DELIMITER, c.footer(client)].join("\n");
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.6;color:#0e1626;max-width:560px">',
    `<p>${e(c.hello)}</p>`,
    `<p>${e(c.ask(who, client))}</p>`,
    `<ul>${facts.map((f) => `<li>${e(f)}</li>`).join("")}</ul>`,
    `<p>${e(c.effect)}</p>`,
    `<p><a href="${e(i.link)}" style="color:#0b7a55">${e(c.open)}</a></p>`,
    `<p style="font-size:14px;color:#5b6577">${e(c.expires(day(i.expiresAt, i.lang)))}</p>`,
    `<p style="margin-top:2em;font-size:13px;color:#5b6577">${e(c.footer(client))}</p>`,
    "</div>",
  ].join("\n");
  return { subject: oneLine(c.subject(who)).slice(0, 200), text, html };
};
