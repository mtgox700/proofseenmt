/** When a message was sent, in Paris time: « 16 octobre, 09:42 », "16 October, 09:42". Server and browser share it. */
export const messageTime = (instant: Date, lang: "fr" | "en"): string =>
  new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(instant);
