/*
 * L'e-mail d'une décision d'opérateur (C19) : ce qui a été décidé, le motif tel que l'opérateur l'a écrit, et le chemin
 * pour en parler. Jamais le nom de l'opérateur. Le motif est un texte libre : il est échappé au rendu comme tout le reste.
 */

type Lang = "fr" | "en";

interface NoticeBody {
  readonly subject: string;
  readonly lines: readonly string[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
}

const COPY: Readonly<Record<Lang, Readonly<Record<string, { readonly subject: string; readonly line: (what: string) => string }>>>> = {
  fr: {
    profile_hidden: { subject: "Votre profil public est masqué", line: () => "Un opérateur de Proofseen a masqué votre profil public : il n'apparaît plus dans l'annuaire, la recherche ni les moteurs." },
    profile_restored: { subject: "Votre profil public est de nouveau visible", line: () => "Le masque posé sur votre profil public est levé." },
    mission_hidden: { subject: "Une mission de votre entreprise est masquée", line: (what) => `Un opérateur de Proofseen a masqué la mission « ${what} » : elle n'est plus publique.` },
    mission_restored: { subject: "Une mission de votre entreprise est de nouveau visible", line: (what) => `Le masque posé sur la mission « ${what} » est levé.` },
    company_page_hidden: { subject: "La page publique de votre entreprise est masquée", line: () => "Un opérateur de Proofseen a masqué la page publique de votre entreprise." },
    company_page_restored: { subject: "La page publique de votre entreprise est de nouveau visible", line: () => "Le masque posé sur la page publique de votre entreprise est levé." },
    organisation_hidden: {
      subject: "Votre entreprise est masquée sur Proofseen",
      line: () => "Un opérateur de Proofseen a masqué votre entreprise : sa page publique et toutes ses missions ne sont plus publiques, et ses clés d'API sont refusées.",
    },
    organisation_restored: { subject: "Votre entreprise est de nouveau visible sur Proofseen", line: () => "Le masque posé sur votre entreprise est levé : sa page, ses missions et ses clés d'API reprennent." },
    contact_closed: { subject: "Une prise de contact a été fermée", line: () => "Un opérateur de Proofseen a fermé une conversation que votre entreprise avait ouverte." },
    vigilance_rejected: { subject: "Votre attestation de vigilance n'a pas pu être vérifiée", line: () => "Un opérateur de Proofseen n'a pas pu vérifier votre attestation de vigilance URSSAF. Déclarez-en une nouvelle depuis votre espace." },
    proof_revoked: { subject: "La preuve d'une de vos adresses est retirée", line: (what) => `Un opérateur de Proofseen a retiré la preuve de possession de l'adresse ${what}. Elle reste déclarée sur votre profil.` },
    account_suspended: { subject: "Votre compte Proofseen est suspendu", line: () => "Un opérateur de Proofseen a suspendu votre compte : vous ne pouvez plus utiliser votre espace, et vos contenus publics sont masqués." },
    account_restored: { subject: "Votre compte Proofseen est rétabli", line: () => "La suspension de votre compte est levée : votre espace est de nouveau accessible." },
    post_hidden: { subject: "Une de vos publications est masquée", line: (what) => `Un opérateur de Proofseen a masqué votre publication « ${what} » : elle n'est plus visible, sauf pour vous.` },
    post_restored: { subject: "Une de vos publications est de nouveau visible", line: (what) => `Le masque posé sur votre publication « ${what} » est levé.` },
    comment_hidden: { subject: "Un de vos commentaires est masqué", line: (what) => `Un opérateur de Proofseen a masqué votre commentaire « ${what} » : il n'est plus visible, sauf pour vous.` },
    comment_restored: { subject: "Un de vos commentaires est de nouveau visible", line: (what) => `Le masque posé sur votre commentaire « ${what} » est levé.` },
  },
  en: {
    profile_hidden: { subject: "Your public profile is hidden", line: () => "A Proofseen operator hid your public profile: it no longer appears in the directory, in search or to engines." },
    profile_restored: { subject: "Your public profile is visible again", line: () => "The hold on your public profile was lifted." },
    mission_hidden: { subject: "A mission of your company is hidden", line: (what) => `A Proofseen operator hid the mission "${what}": it is no longer public.` },
    mission_restored: { subject: "A mission of your company is visible again", line: (what) => `The hold on the mission "${what}" was lifted.` },
    company_page_hidden: { subject: "Your company's public page is hidden", line: () => "A Proofseen operator hid your company's public page." },
    company_page_restored: { subject: "Your company's public page is visible again", line: () => "The hold on your company's public page was lifted." },
    organisation_hidden: {
      subject: "Your company is hidden on Proofseen",
      line: () => "A Proofseen operator hid your company: its public page and all its missions are no longer public, and its API keys are refused.",
    },
    organisation_restored: { subject: "Your company is visible again on Proofseen", line: () => "The hold on your company was lifted: its page, missions and API keys work again." },
    contact_closed: { subject: "A first contact was closed", line: () => "A Proofseen operator closed a conversation your company had opened." },
    vigilance_rejected: { subject: "Your vigilance certificate could not be verified", line: () => "A Proofseen operator could not verify your URSSAF vigilance certificate. Declare a new one from your space." },
    proof_revoked: { subject: "The proof of one of your addresses was withdrawn", line: (what) => `A Proofseen operator withdrew the ownership proof of ${what}. It stays declared on your profile.` },
    account_suspended: { subject: "Your Proofseen account is suspended", line: () => "A Proofseen operator suspended your account: you can no longer use your space, and your public content is hidden." },
    account_restored: { subject: "Your Proofseen account is restored", line: () => "The suspension of your account was lifted: your space is available again." },
    post_hidden: { subject: "One of your posts is hidden", line: (what) => `A Proofseen operator hid your post "${what}": nobody but you can see it.` },
    post_restored: { subject: "One of your posts is visible again", line: (what) => `The hold on your post "${what}" was lifted.` },
    comment_hidden: { subject: "One of your comments is hidden", line: (what) => `A Proofseen operator hid your comment "${what}": nobody but you can see it.` },
    comment_restored: { subject: "One of your comments is visible again", line: (what) => `The hold on your comment "${what}" was lifted.` },
  },
};

const FALLBACK = { fr: { subject: "Une décision concerne votre compte", line: () => "Un opérateur de Proofseen a pris une décision qui concerne votre compte." }, en: { subject: "A decision concerns your account", line: () => "A Proofseen operator made a decision that concerns your account." } };

export const accountNoticeBody = (lang: Lang, payload: { readonly notice: string; readonly reason: string; readonly subject: string }, app: string, openLabel: string): NoticeBody => {
  const copy = COPY[lang][payload.notice] ?? FALLBACK[lang];
  const fr = lang === "fr";
  const reason = payload.reason.trim();
  return {
    subject: copy.subject,
    lines: [
      copy.line(payload.subject),
      ...(reason === "" ? [] : [fr ? `Motif : ${reason}` : `Reason: ${reason}`]),
      fr
        ? "Pour contester cette décision ou demander des précisions, répondez depuis votre espace : le formulaire de contestation y figure à côté de la décision."
        : "To contest this decision or ask for details, reply from your space: the appeal form sits next to the decision.",
    ],
    links: [{ label: openLabel, href: app }],
  };
};
