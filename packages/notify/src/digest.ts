import { SIGNATURE_DELIMITER } from "./signature";
import type { Email, Lang } from "./templates";

/*
 * Résumé quotidien des messages non lus (C15), en français et en anglais.
 *
 * Même règle que les autres e-mails : il dit combien de messages attendent et dans quels fils, jamais ce qu'ils
 * disent. L'autre partie est nommée comme dans la messagerie : l'entreprise par son nom, le freelance par sa référence
 * publique. La personne a demandé ce résumé ; le lien pour l'arrêter est dans chaque envoi.
 */

export interface DigestInput {
  readonly to: { readonly lang: Lang; readonly displayName: string };
  readonly unread: number;
  readonly threads: readonly { readonly conversationId: string; readonly counterpart: string; readonly unread: number }[];
}

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const e = (value: string): string => value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un nom d'entreprise passe dans l'objet et le texte brut : jamais de retour à la ligne, jamais plus de 80 caractères. */
const oneLine = (value: string): string => value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 80);

const COPY = {
  fr: {
    subject: (n: number) => `${n} message${n > 1 ? "s" : ""} non lu${n > 1 ? "s" : ""} sur Proofseen`,
    hello: (name: string) => `Bonjour ${name},`,
    lead: (n: number) => `${n} message${n > 1 ? "s vous attendent" : " vous attend"} sur Proofseen :`,
    thread: (who: string, n: number) => `${who} : ${n} non lu${n > 1 ? "s" : ""}`,
    open: "Lire mes messages",
    footer: "Vous recevez ce résumé parce que vous l'avez demandé. Une fois par jour au plus.",
    stop: "Arrêter le résumé quotidien",
  },
  en: {
    subject: (n: number) => `${n} unread message${n > 1 ? "s" : ""} on Proofseen`,
    hello: (name: string) => `Hello ${name},`,
    lead: (n: number) => `${n} message${n > 1 ? "s are" : " is"} waiting for you on Proofseen:`,
    thread: (who: string, n: number) => `${who}: ${n} unread`,
    open: "Read my messages",
    footer: "You receive this summary because you asked for it. Once a day at most.",
    stop: "Stop the daily summary",
  },
} as const;

export const renderDigest = (input: DigestInput, baseUrl: string): Email => {
  const base = baseUrl.replace(/\/$/, "");
  const lang = input.to.lang;
  const copy = COPY[lang];
  const inbox = `${base}/${lang}/app/messages`;
  const stop = `${base}/${lang}/app/notifications`;
  const threads = input.threads.map((t) => ({ label: copy.thread(oneLine(t.counterpart), t.unread), href: UUID.test(t.conversationId) ? `${inbox}/${t.conversationId}` : inbox }));
  const text = [copy.hello(input.to.displayName), "", copy.lead(input.unread), ...threads.map((t) => `- ${t.label} : ${t.href}`), "", `${copy.open} : ${inbox}`, "", SIGNATURE_DELIMITER, copy.footer, `${copy.stop} : ${stop}`].join("\n");
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.6;color:#0e1626;max-width:560px">',
    `<p>${e(copy.hello(input.to.displayName))}</p>`,
    `<p>${e(copy.lead(input.unread))}</p>`,
    "<ul>",
    ...threads.map((t) => `<li><a href="${e(t.href)}" style="color:#0b7a55">${e(t.label)}</a></li>`),
    "</ul>",
    `<p><a href="${e(inbox)}" style="color:#0b7a55">${e(copy.open)}</a></p>`,
    `<p style="margin-top:2em;font-size:13px;color:#5b6577">${e(copy.footer)} <a href="${e(stop)}" style="color:#5b6577">${e(copy.stop)}</a></p>`,
    "</div>",
  ].join("\n");
  return { subject: copy.subject(input.unread), text, html };
};
