import { describe, expect, it } from "vitest";
import { renderDigest } from "../src/digest";

const THREAD = "0198f0aa-1234-7abc-8def-0123456789ab";

describe("résumé quotidien des messages non lus", () => {
  it("dit combien et qui, renvoie sur les fils, et donne le moyen d'arrêter", () => {
    const email = renderDigest({ to: { lang: "fr", displayName: "Camille" }, unread: 3, threads: [{ conversationId: THREAD, counterpart: "Acme", unread: 3 }] }, "https://proofseen.com/");
    expect(email.subject).toBe("3 messages non lus sur Proofseen");
    expect(email.text).toContain("Acme : 3 non lus");
    expect(email.text).toContain(`https://proofseen.com/fr/app/messages/${THREAD}`);
    expect(email.text).toContain("https://proofseen.com/fr/app/notifications");
  });

  it("échappe le nom de l'entreprise et le garde sur une ligne", () => {
    const email = renderDigest({ to: { lang: "en", displayName: "Sam" }, unread: 1, threads: [{ conversationId: "pas-un-uuid", counterpart: "<b>Evil</b>\r\nBcc: x@y.z", unread: 1 }] }, "https://proofseen.com");
    expect(email.subject).toBe("1 unread message on Proofseen");
    expect(email.html).not.toContain("<b>Evil</b>");
    expect(email.html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
    expect(email.text).not.toContain("\r\nBcc");
    // Not a thread id: the link falls back to the inbox instead of carrying it.
    expect(email.text).toContain("1 unread : https://proofseen.com/en/app/messages\n");
    expect(email.text).not.toContain("pas-un-uuid");
  });
});
