import { HOSTS, PUBLISHER } from "./legal-facts";
import type { LegalDocument } from "./legal-page";
import { processorTable } from "./legal-processors";
import { retentionTable } from "./legal-retention";

/* Privacy policy, in English: the same facts as `legal-privacy-fr.ts`, section for section. */

const DATA_MAIL = `<a href="mailto:${PUBLISHER.dataEmail}">${PUBLISHER.dataEmail}</a>`;

export const PRIVACY_EN: LegalDocument = {
  title: "Privacy policy",
  description: "What data Proofseen processes, why, for how long, with which providers, and how to exercise your rights.",
  lead: "What Proofseen does with your data, written from what the software actually does.",
  sections: [
    {
      id: "responsable",
      title: "Who is responsible",
      body: [
        `<p>The data controller is ${PUBLISHER.name}, ${PUBLISHER.form.en} (brand ${PUBLISHER.brand}), ${PUBLISHER.address}, ${PUBLISHER.registry.en}, SIREN ${PUBLISHER.siren}. Details are in the <a href="/en/mentions-legales">legal notice</a>.</p>`,
        `<p>For any question about your data: ${DATA_MAIL}, or by post: ${PUBLISHER.dataPostal}.</p>`,
      ],
    },
    {
      id: "en-bref",
      title: "In short",
      body: [
        "<ul>",
        "<li>We sell no data and show no advertising.</li>",
        "<li>No audience analytics tool and no advertising tracker: only cookies the service needs to work are set.</li>",
        "<li>Your profile is public only if you publish it, and you can publish it under a reference (FR-XXXXX) rather than your name.</li>",
        "<li>Contact details are not exchanged outside the platform: a filter spots them in messages and public texts.</li>",
        "<li>No score is computed about a person; matches between missions and profiles rest on facts you can see.</li>",
        "<li>You can download all your data and erase your account from your settings.</li>",
        "</ul>",
      ],
    },
    {
      id: "donnees",
      title: "What we process, feature by feature",
      body: [
        "<h3>Account and sign-in</h3>",
        "<p>Sign-in goes through Clerk, with a code sent to your e-mail address. Our database keeps your Clerk identifier, your primary e-mail address, your display name (first and last name, or the e-mail address if none), your role (freelancer or company) and the language of your e-mails. No password is stored on our side.</p>",
        "<h3>Freelancer profile</h3>",
        "<p>Headline, summary, city, work mode, daily rate, availability and the date it was last confirmed, skills, languages, experience, education, certifications, photo, portfolio, CV, the web addresses you declare and those you prove you own, missions confirmed by your clients. The profile stays private until you publish it. A web address is checked only by visiting your own site; LinkedIn and Malt are never fetched automatically.</p>",
        "<p>To invoice and reassure your clients: billing identity (company name, SIRET, VAT number, address) and URSSAF compliance certificate. The SIRET is checked against the French government's public Recherche d'entreprises API; it is never published.</p>",
        "<h3>Companies</h3>",
        "<p>Company name and page, members and their role, published missions, freelancer pools, lists, saved searches, API keys created by the company.</p>",
        "<h3>Missions and applications</h3>",
        "<p>Mission listing, application, answers to the company's questions, attached CV, application status.</p>",
        "<h3>Messages and attachments</h3>",
        "<p>Messages exchanged, conversation state (pending, accepted, declined), attachments (JPEG, PNG, WebP or PDF, 5 MB at most each, 3 per message). Images are re-encoded to strip their metadata (including GPS position); a PDF with active content is refused. A filter spots contact details (e-mail, phone, link, messaging handle): it blocks the message, or flags it when a payment is under way between the two parties; we keep only a flag, never the extracted detail. A recent first contact may be reviewed by an operator.</p>",
        "<h3>Community</h3>",
        "<p>Posts, comments, reactions and shares, under a published profile or a company; a profile published under a reference never shows the account name. A post is public or limited to signed-in members, as you choose.</p>",
        "<h3>Invitations</h3>",
        "<p>When you invite someone, we keep the invited address, your personal note (run through the contact-details filter) and the state of the invitation. The link is kept only as a fingerprint. To accept, the person must be signed in with a verified address that is the invited address.</p>",
        "<h3>Mission confirmation by a client</h3>",
        "<p>For a past mission to show as confirmed, you give us your client's e-mail address; we write to them once, and they confirm or not.</p>",
        "<h3>Audience, without tracking</h3>",
        "<p>To tell you how often your profile was viewed or appeared in a search, we count visits without cookies. The IP address and browser are used to compute a daily fingerprint (HMAC with a key that changes every day); neither the IP address nor the browser is recorded, and the fingerprint is erased at the end of the day. Robots, prefetches and your own visits are not counted. Only daily totals remain; only you see those of your profile, and a company sees only the total number of searches by its team.</p>",
        "<h3>Notifications, e-mails and push notifications</h3>",
        "<p>E-mails are sent through Resend; the daily digest is optional and never contains the text of a message. If you turn on push notifications, we keep your device's subscription address and a short label such as \"Chrome · Android\" (never your full browser string). A notification contains only a sentence and a link.</p>",
        "<h3>AI visibility measurement</h3>",
        "<p>If you ask for one, we put recruiter questions to AI engines (OpenAI, Anthropic, Perplexity), built from your headline, skills, city and work mode. Your name, web addresses and e-mail are never in them: a check removes anything that would identify you, and the measurement is refused if nothing is left. Answers are analysed in memory; only the results (are you cited, where) are recorded. See also <a href=\"#personnes-citees\">people cited by AI</a>.</p>",
        "<h3>CV import and plain-language search</h3>",
        "<p>If you import a PDF CV to prefill your profile, its text (24,000 characters at most, contact details included) is sent to Anthropic to draw up a draft; you accept each item one by one and nothing is published automatically. If a company describes its search in a sentence, only that sentence is sent to Anthropic to suggest filters, which the company can edit; the model sees no profile.</p>",
        "<h3>Moderation and security</h3>",
        "<p>Operator decisions (hiding a profile or a post, suspending an account) with their reason, appeals, beta feedback, rate limiting by a fingerprint of the IP address or account. Server logs record an event and its date, never the text of a message or an e-mail address.</p>",
        "<h3>Payments</h3>",
        "<p>Payment on the platform is not open yet. When it opens, it will go through Stripe, which will receive the data needed for payment and payout; this policy will be updated first.</p>",
      ],
    },
    {
      id: "conservation",
      title: "Legal bases and retention periods",
      body: [
        "<p>The periods below are applied automatically by the application, which purges expired data several times an hour.</p>",
        retentionTable("en"),
        "<p>The database is backed up every night on the IONOS hosting server and the copies are deleted after 14 days. After an account is erased, its data may therefore remain in these copies for at most 14 days; they are never restored except to recover from an incident.</p>",
      ],
    },
    {
      id: "destinataires",
      title: "Who receives your data",
      body: [
        "<p>Your data is accessible to our team as far as needed, and to the providers below, each for its role. What you publish is visible to everyone; your billing identity is shown to a company only when a contract with it is signed.</p>",
        processorTable("en"),
        `<p>Hosts: ${HOSTS.map((h) => h.name).join(" and ")} (see the <a href="/en/mentions-legales#hebergeurs">legal notice</a>).</p>`,
        `<p>Several of these providers are based in the United States. These transfers rely on the safeguards set out in their data processing agreements (European Commission standard contractual clauses or the EU–US Data Privacy Framework, depending on the provider). You can ask for details at ${DATA_MAIL}.</p>`,
      ],
    },
    {
      id: "personnes-citees",
      title: "People cited by AI",
      body: [
        "<p>The answers of AI engines queried for a measurement may cite other professionals. If that is your case, here is what we do with your name.</p>",
        "<ul>",
        "<li>We never search for your name and build no profile about you.</li>",
        "<li>To spot who is cited, the answer is sent to Anthropic, then analysed in memory. In the application, answers are never recorded: only results without names come out.</li>",
        "<li>For measurements our team runs with its internal tool, names are replaced by tokens before anything is written, the answer is encrypted, it carries a 72-hour expiry, and the tool deletes it as soon as it is run again after that expiry.</li>",
        "<li>We never show our users who appears in their place, and we do not reuse what AI says about you.</li>",
        "</ul>",
        "<p>Legal basis: our legitimate interest in measuring, for a user, whether they are cited. As we do not know your contact details, we inform you through this page rather than individually (Article 14(5) GDPR). You can object, or ask for access or erasure, at " +
          DATA_MAIL +
          "; beyond the analysis we generally hold nothing that could identify you, and we will tell you so.</p>",
      ],
    },
    {
      id: "ia-act",
      title: "No rating of people",
      body: [
        "<p>Proofseen computes, stores and displays no score, rank or overall rating of a person, and reviews are not averaged. Search filters on facts (skills, city, work mode, availability, rate) and sorts by a criterion you choose.</p>",
        "<p>Suggestions between missions and profiles compare facts one by one (shared skills, city, work mode, rate, availability, languages, proven address, confirmed missions, company active in the register, valid URSSAF certificate). They are ordered by the number of criteria met among those you count, then by shared skills and by date; each suggestion shows what matches and what is missing. No AI takes part in this matching, and no decision is made in your place.</p>",
      ],
    },
    {
      id: "cookies",
      title: "Cookies and storage",
      body: [
        "<p>Only cookies the service needs are set; they do not require your consent.</p>",
        "<ul>",
        "<li><strong>Clerk</strong>: sign-in session cookies, set by our provider when you sign in.</li>",
        "<li><strong>ps_org</strong>: the company you act for, if you belong to several; 1 year.</li>",
        "<li><strong>ps_access</strong>: access to a client space opened from a link, limited to that space; 30 days.</li>",
        "</ul>",
        "<p>The language comes from the page address (/fr or /en), not from a cookie. No analytics, no advertising, no font or image loaded from a third party. In the signed-in space, the application installs a service worker that caches the offline page and the site's technical files, never your data.</p>",
      ],
    },
    {
      id: "droits",
      title: "Your rights and how to exercise them",
      body: [
        "<p>You can access your data, have it corrected or erased, ask for restriction or portability, object to processing based on our legitimate interest, and withdraw your consent where it is the basis.</p>",
        "<ul>",
        "<li><strong>Download your data</strong>: in the application, Settings, \"Export my data\" gives you a JSON file of everything the database holds about you (file contents are not included, only their description), with the list of what would remain after erasure.</li>",
        "<li><strong>Erase your account</strong>: in Settings, \"Delete my account\", with a confirmation. Erasure deletes your Clerk account and your data on our side. It is refused while a contract is in progress or a payment is under way. What remains, detached from you: quotes, contracts and invoices (accounting duty), messages written on behalf of a company, comments emptied and shown as \"Deleted account\", the moderation log (5 years) and, for a suspended account, a 3-year trace. Backups delete themselves after 14 days.</li>",
        `<li><strong>Correct</strong>: most information can be edited from your profile or settings. For the rest, or if your account is suspended, write to ${DATA_MAIL}.</li>`,
        "</ul>",
        "<p>We may ask you to prove your identity if we have reasonable doubt. We answer within one month.</p>",
      ],
    },
    {
      id: "securite",
      title: "Security",
      body: [
        "<p>Encrypted connections, files stored on the server under a random name and served according to each person's rights (an attachment, to the parties of the conversation only), fingerprints instead of invitation links and IP addresses, rate limiting, a moderation log that can be neither altered nor deleted before 5 years, and no data used by us to train an AI model.</p>",
      ],
    },
    {
      id: "reclamation",
      title: "Complaints",
      body: [`<p>If you believe your rights are not respected, write to us first at ${DATA_MAIL}. You can also contact the French data protection authority (CNIL): <a href="https://www.cnil.fr">www.cnil.fr</a>.</p>`],
    },
    {
      id: "modifications",
      title: "Changes",
      body: ["<p>This policy follows the software: when a feature changes, it changes. The version date is at the top of the page; an important change is announced in the application or by e-mail.</p>"],
    },
  ],
};
