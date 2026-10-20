import { HOSTS, PUBLISHER } from "./legal-facts";
import type { LegalDocument } from "./legal-page";

/* Terms of use, in English: the same rules as `legal-terms-fr.ts`, section for section. */

const CONTACT = `<a href="mailto:${PUBLISHER.contactEmail}">${PUBLISHER.contactEmail}</a>`;

export const TERMS_EN: LegalDocument = {
  title: "Terms of use",
  description: "The rules of the Proofseen marketplace: accounts, profiles, missions, messaging, community, invitations, reviews, moderation and liability.",
  lead: "The rules of Proofseen, as the platform applies them today.",
  sections: [
    {
      id: "objet",
      title: "Purpose and acceptance",
      body: [
        `<p>Proofseen connects freelancers and companies: verifiable profiles, missions, applications, messaging, community. The service is published by ${PUBLISHER.name} (SIREN ${PUBLISHER.siren}) and hosted by ${HOSTS.map((h) => h.name).join(" and ")}; see the <a href="/en/mentions-legales">legal notice</a>.</p>`,
        "<p>By creating an account, you accept these terms. The offers sold on the Order page have their own terms of sale, shown on that page.</p>",
      ],
    },
    {
      id: "compte",
      title: "Account and roles",
      body: [
        "<ul>",
        "<li>You sign in with a code sent to your e-mail address. Keep access to that address and do not share your account.</li>",
        "<li>On first sign-in, you choose a role: freelancer or company. You cannot change it yourself; if you chose wrongly, write to us.</li>",
        "<li>In a company, each member is an owner, an admin or a member. Only owners and admins accept a quote, create and sign a contract, send e-mail invitations and manage billing, API keys and the public page. Any member can publish and close a mission.</li>",
        "<li>Proofseen operators, appointed by the publisher, moderate the platform (see <a href=\"#moderation\">Moderation</a>).</li>",
        "</ul>",
      ],
    },
    {
      id: "faits",
      title: "Accuracy and verified facts",
      body: [
        "<p>Everything you publish must be accurate: identity, skills, experience, missions, degrees, rate, availability. Do not invent clients, figures or testimonials.</p>",
        "<p>On Proofseen, \"verified\" has a precise meaning, and only this one:</p>",
        "<ul>",
        "<li><strong>Proven web address</strong>: you placed a code on your site (file, tag or DNS record) or in a public field of your profile; the proof is re-checked every 30 days. An address that is only declared does not count.</li>",
        "<li><strong>Confirmed mission</strong>: your client confirmed it, from their registered company or through a single-use link received by e-mail. Nobody confirms their own mission.</li>",
        "<li><strong>Active company</strong>: the SIRET was checked against the official French business register, every 30 days; it must be active and match the declared company name.</li>",
        "<li><strong>URSSAF certificate</strong>: a compliance certificate checked by hand by an operator on the URSSAF website; it is valid for 6 months.</li>",
        "<li><strong>Availability</strong>: it is dated; after 30 days without confirmation it shows as \"unconfirmed\".</li>",
        "</ul>",
      ],
    },
    {
      id: "missions",
      title: "Missions, applications and contact",
      body: [
        "<ul>",
        "<li>A mission describes a real need; it can no longer be edited once it has applications, and it stays open until the company closes it.</li>",
        "<li>A freelancer applies once per mission, with a published profile. The company moves the application along (shortlisted, declined, hired).</li>",
        "<li>A company can contact a published profile directly (50 new contacts per day per company); the freelancer accepts or declines. Attachments are possible only after acceptance.</li>",
        "</ul>",
      ],
    },
    {
      id: "coordonnees",
      title: "Exchanges go through the platform",
      body: [
        "<p>Contact details (e-mail address, phone, link, messaging handle) are not exchanged on Proofseen before a payment is held in escrow. A filter spots them, disguised ones included: a public text, an application or a message that contains them is refused. As payment is not open yet, this applies to every message today.</p>",
        "<p>Getting around this filter is prohibited. A recent first contact may be reviewed by an operator, who can close it with a reason.</p>",
      ],
    },
    {
      id: "communaute",
      title: "Community",
      body: [
        "<p>You post under your published profile or on behalf of a company you belong to, publicly or for signed-in members only. Limits: 3,000 characters per post, 1,500 per comment, 10 posts and 100 comments per 24 hours, https links. No contact details, no HTML. Stay courteous and factual: no unlawful, hateful, misleading or disguised advertising content.</p>",
      ],
    },
    {
      id: "invitations",
      title: "Invitations",
      body: [
        "<ul>",
        "<li>A company invites into its private pool freelancers it already works with; a freelancer invites a client company.</li>",
        "<li>Only invite people you know. Limits: 20 invitations per day per sender, 50 per day per company, 3 per address over 14 days.</li>",
        "<li>An invitation is valid for 14 days; a single reminder is possible. To accept it, you must be signed in with the invited, verified address.</li>",
        "<li>No reward and no money is attached to an invitation.</li>",
        "</ul>",
      ],
    },
    {
      id: "avis",
      title: "Reviews",
      body: [
        "<p>Only a member of the client company can review the freelancer, once per contract, after a mission completed and paid on the platform. A review (a rating from 1 to 5 and a text) is shown as written with its date; it cannot be edited, is never averaged and is not used for ranking. As payment is not open yet, no review can exist yet.</p>",
      ],
    },
    {
      id: "contrats",
      title: "Quotes, contracts and payment",
      body: [
        "<p>Today, a freelancer can send a quote; the company accepts it; a contract is created and signed by both parties. To sign, the freelancer enters their SIRET and accepts the invoicing mandate.</p>",
        "<p><strong>Payment on the platform is not open yet.</strong> No payment, no commission and no escrow are therefore in place: a contract cannot yet be approved or completed on Proofseen, and no invoice is issued there. Proofseen takes nothing from missions today. Before payment opens, these terms will be updated with its rules and fees, which you will see before committing.</p>",
      ],
    },
    {
      id: "classement",
      title: "No ranking of people, no promise",
      body: [
        "<p>Proofseen neither rates nor ranks people: search filters on facts and sorts by the criterion you choose; suggestions show what matches and what is missing. Choosing whom to work with is up to you.</p>",
        "<p>We promise no result: no mission, no contact, no rank in an AI or a search engine. A visibility measurement describes what engines answered at a given time.</p>",
      ],
    },
    {
      id: "interdits",
      title: "Prohibited uses",
      body: [
        "<ul>",
        "<li>publishing false or exaggerated information, impersonating someone, creating fake accounts;</li>",
        "<li>getting around the contact-details filter or taking users off the platform;</li>",
        "<li>extracting data from Proofseen by automated means, or reselling profile data;</li>",
        "<li>hiding text or instructions aimed at AI in your pages, or showing robots different content from visitors;</li>",
        "<li>harassing, discriminating, publishing unlawful content or sending unwanted solicitations;</li>",
        "<li>trying to get around a suspension, the limits or the security of the service.</li>",
        "</ul>",
      ],
    },
    {
      id: "moderation",
      title: "Moderation, suspension and appeal",
      body: [
        "<p>An operator can hide a profile, a mission, a company page, a post or a comment, close a contact request, or suspend an account or a company. Each decision carries a written reason, is sent to you by e-mail and is recorded in a log kept for 5 years. Hiding deletes nothing.</p>",
        "<p>A suspended account can no longer reach its space and its public content is hidden; it can still download its data. You can contest a decision from the page that shows it; an operator reviews the appeal.</p>",
        `<p>To report content or behaviour: ${CONTACT}.</p>`,
      ],
    },
    {
      id: "contenus",
      title: "Your content",
      body: [
        "<p>You remain the owner of what you publish. You allow Proofseen to host, display and reproduce it on the platform and its public pages, for as long as it is published, to run the service. You warrant that you hold the rights to what you publish.</p>",
      ],
    },
    {
      id: "responsabilite",
      title: "Liability",
      body: [
        "<p>Proofseen provides a matchmaking service; mission contracts are concluded between the freelancer and the company, who remain responsible for their commitments. We do what is needed to keep the service available and safe, but cannot guarantee uninterrupted availability. Each user is responsible for what they publish and how they use the service.</p>",
      ],
    },
    {
      id: "fin",
      title: "Ending your use",
      body: [
        "<p>You can erase your account at any time from your settings, except while a contract is in progress or a payment is under way. We can suspend an account that breaches these terms, following the procedure above. What remains after erasure is described in the <a href=\"/en/confidentialite#droits\">privacy policy</a>.</p>",
      ],
    },
    {
      id: "modifications",
      title: "Changes",
      body: ["<p>These terms follow the platform. The version date is at the top of the page; an important change is announced to you before it applies.</p>"],
    },
    {
      id: "droit",
      title: "Governing law and contact",
      body: [`<p>These terms are governed by French law. For any question or complaint, write first to ${CONTACT}: we look for an amicable solution before any other step.</p>`],
    },
  ],
};
