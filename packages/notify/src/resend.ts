import type { Transport } from "./deliver";

/*
 * Transport Resend (https://resend.com/docs/api-reference/emails/send-email). Configuré seulement si la clé et
 * l'adresse d'expédition existent : sans elles, aucun e-mail ne part, et la file attend.
 *
 * L'erreur rendue est un code court, jamais le corps de la réponse du fournisseur : il peut contenir l'adresse du
 * destinataire, et l'erreur est stockée en base.
 */

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;
const FROM = /^[^<>\r\n]{0,80}<[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}>$|^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;

export const resendTransport = (config: { readonly apiKey: string; readonly from: string }, fetchImpl: typeof fetch = fetch): Transport => {
  if (!config.apiKey.startsWith("re_")) throw new Error("clé Resend invalide");
  if (!FROM.test(config.from)) throw new Error("adresse d'expédition invalide");
  return {
    async send(to, email) {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from: config.from, to: [to], subject: email.subject, text: email.text, html: email.html, ...(email.headers === undefined ? {} : { headers: email.headers }) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return response.ok ? { ok: true } : { ok: false, error: `HTTP_${response.status}` };
    },
  };
};

/** Le transport configuré par l'environnement, ou `null` : sans configuration, rien n'est envoyé. */
export const transportFromEnv = (env: Readonly<Record<string, string | undefined>>): Transport | null => {
  const apiKey = (env.RESEND_API_KEY ?? "").trim();
  const from = (env.NOTIFY_FROM ?? "").trim();
  if (apiKey === "" || from === "") return null;
  return resendTransport({ apiKey, from });
};
