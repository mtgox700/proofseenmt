import { escapeHtml as e } from "./html";
import { HOSTS, PUBLISHER } from "./legal-facts";
import type { LegalDocument } from "./legal-page";
import type { Lang } from "./market-shell";

/*
 * Mentions légales (LCEN, art. 6 III et 1-1). L'éditeur est repris des mentions de Spar-X, décision du founder ; les
 * hébergeurs sont cités d'après leurs propres pages légales (`legal-facts.ts`).
 */

const mail = (address: string): string => `<a href="mailto:${address}">${address}</a>`;

const hosts = (lang: Lang): string =>
  HOSTS.map(
    (h) =>
      `<h3>${e(h.name)}</h3><p class="muted">${e(h.role[lang])}</p><p>${h.lines.map(e).join("<br>")}</p>` +
      `<p class="muted">${lang === "fr" ? "Source :" : "Source:"} <a href="${h.source}">${h.source}</a></p>`,
  ).join("");

const publisher = (lang: Lang): string => {
  const rows: readonly (readonly [string, string])[] =
    lang === "fr"
      ? [
          ["Dénomination", `${PUBLISHER.name} (marque ${PUBLISHER.brand})`],
          ["Forme", PUBLISHER.form.fr],
          ["Siège social", PUBLISHER.address],
          ["Immatriculation", `${PUBLISHER.registry.fr} · SIREN ${PUBLISHER.siren}`],
          ["TVA intracommunautaire", PUBLISHER.vat],
          ["Code APE", PUBLISHER.ape],
        ]
      : [
          ["Company", `${PUBLISHER.name} (brand ${PUBLISHER.brand})`],
          ["Legal form", PUBLISHER.form.en],
          ["Registered office", PUBLISHER.address],
          ["Registration", `${PUBLISHER.registry.en} · SIREN ${PUBLISHER.siren}`],
          ["EU VAT number", PUBLISHER.vat],
          ["APE code", PUBLISHER.ape],
        ];
  return `<dl>${rows.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join("")}</dl>`;
};

const FR: LegalDocument = {
  title: "Mentions légales",
  description: "Éditeur, directeur de la publication, hébergeurs et contacts du site Proofseen.",
  lead: "Qui édite Proofseen, qui l'héberge, et comment nous joindre.",
  sections: [
    {
      id: "editeur",
      title: "Éditeur du site",
      body: [`<p>Le site proofseen.com et l'application Proofseen sont édités par :</p>`, publisher("fr")],
    },
    { id: "directeur", title: "Directeur de la publication", body: [`<p>${e(PUBLISHER.director.fr)}.</p>`] },
    {
      id: "hebergeurs",
      title: "Hébergeurs",
      body: [`<p>L'application tourne sur un serveur d'IONOS ; sa base de données est hébergée par Railway.</p>`, hosts("fr")],
    },
    {
      id: "contact",
      title: "Contact",
      body: [
        "<ul>",
        `<li>Questions générales : ${mail(PUBLISHER.contactEmail)}</li>`,
        `<li>Données personnelles : ${mail(PUBLISHER.dataEmail)}, ou par courrier : ${e(PUBLISHER.dataPostal)}</li>`,
        `<li>Réclamation relative à vos données : la CNIL, <a href="https://www.cnil.fr">www.cnil.fr</a></li>`,
        "</ul>",
      ],
    },
    {
      id: "propriete",
      title: "Propriété intellectuelle",
      body: [
        "<p>Les textes, la mise en page, les éléments graphiques et le nom Proofseen sont la propriété de l'éditeur, sauf mention contraire. Toute reproduction sans autorisation est interdite.</p>",
        "<p>Les contenus publiés par les utilisateurs (profils, missions, publications, messages) restent les leurs ; les <a href=\"/fr/conditions\">conditions d'utilisation</a> disent ce qu'ils nous autorisent à en faire pour faire fonctionner le service.</p>",
      ],
    },
    {
      id: "marques",
      title: "Marques citées",
      body: [
        "<p>ChatGPT, Claude, Perplexity, Gemini, Copilot, LinkedIn, Malt et GitHub sont des marques de leurs propriétaires respectifs. Proofseen n'est affilié à aucun d'entre eux, ni approuvé par eux. Ces noms sont cités seulement pour décrire ce que nous mesurons ou les sites que nos utilisateurs déclarent.</p>",
      ],
    },
    {
      id: "litiges",
      title: "Règlement des litiges",
      body: [
        "<p>La plateforme européenne de règlement en ligne des litiges a été fermée le 20 juillet 2025 (règlement (UE) 2024/3228) : ce site n'y renvoie donc pas.</p>",
      ],
    },
  ],
};

const EN: LegalDocument = {
  title: "Legal notice",
  description: "Publisher, publication director, hosts and contacts of the Proofseen website.",
  lead: "Who publishes Proofseen, who hosts it, and how to reach us.",
  sections: [
    {
      id: "editeur",
      title: "Publisher",
      body: [`<p>The proofseen.com website and the Proofseen application are published by:</p>`, publisher("en")],
    },
    { id: "directeur", title: "Publication director", body: [`<p>${e(PUBLISHER.director.en)}.</p>`] },
    {
      id: "hebergeurs",
      title: "Hosts",
      body: [`<p>The application runs on an IONOS server; its database is hosted by Railway.</p>`, hosts("en")],
    },
    {
      id: "contact",
      title: "Contact",
      body: [
        "<ul>",
        `<li>General questions: ${mail(PUBLISHER.contactEmail)}</li>`,
        `<li>Personal data: ${mail(PUBLISHER.dataEmail)}, or by post: ${e(PUBLISHER.dataPostal)}</li>`,
        `<li>Complaints about your data: the French data protection authority (CNIL), <a href="https://www.cnil.fr">www.cnil.fr</a></li>`,
        "</ul>",
      ],
    },
    {
      id: "propriete",
      title: "Intellectual property",
      body: [
        "<p>The texts, layout, graphic elements and the Proofseen name belong to the publisher unless stated otherwise. Any reproduction without permission is prohibited.</p>",
        "<p>Content published by users (profiles, missions, posts, messages) remains theirs; the <a href=\"/en/conditions\">terms of use</a> say what they allow us to do with it to run the service.</p>",
      ],
    },
    {
      id: "marques",
      title: "Trademarks mentioned",
      body: [
        "<p>ChatGPT, Claude, Perplexity, Gemini, Copilot, LinkedIn, Malt and GitHub are trademarks of their respective owners. Proofseen is not affiliated with or endorsed by any of them. These names are mentioned only to describe what we measure or the sites our users declare.</p>",
      ],
    },
    {
      id: "litiges",
      title: "Dispute resolution",
      body: ["<p>The European online dispute resolution platform closed on 20 July 2025 (Regulation (EU) 2024/3228), so this site does not link to it.</p>"],
    },
  ],
};

export const legalNotice = (lang: Lang): LegalDocument => (lang === "fr" ? FR : EN);
