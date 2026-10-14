import type { MarketDictionary } from "./fr";

import { accountEn } from "./account-en";
import { billingEn } from "./billing-en";
import { dealsEn } from "./deals-en";
import { missionsEn } from "./missions-en";
import { profileEn } from "./profile-en";
import { proofsEn } from "./proofs-en";
import { searchEn } from "./search-en";
import { teamEn } from "./team-en";
import { visibilityEn } from "./visibility-en";

export const marketEn: MarketDictionary = {
  account: accountEn,
  billing: billingEn,
  deals: dealsEn,
  missions: missionsEn,
  profile: profileEn,
  proofs: proofsEn,
  search: searchEn,
  team: teamEn,
  visibility: visibilityEn,
  nav: {
    messages: "Messages",
    missions: "Missions",
    company: "Company",
  },
  notConfigured: "The database is not configured on this server: this space cannot be shown.",
  company: {
    createTitle: "Create your company",
    createLead: "Its name appears on your public missions and in your conversations. The SIRET can wait: it is required before the first contract.",
    name: "Company name",
    nameHint: "As freelancers should see it. No email address or phone number.",
    kind: "Type of company",
    siret: "SIRET (optional)",
    siretHint: "14 digits. It will be checked against the official register.",
    create: "Create the company",
    kinds: {
      startup: "Start-up",
      scaleup: "Scale-up",
      grand_groupe: "Large group",
      eti: "Mid-sized company",
      pme: "SME",
      secteur_public: "Public sector",
      editeur_logiciel: "Software vendor",
      esn: "IT services firm",
      association: "Non-profit",
    },
    roles: { owner: "Owner", admin: "Administrator", member: "Member" },
    errors: {
      invalid: "Check the name (at least 2 characters, no contact details) and the SIRET (14 digits).",
      tooMany: "Too many creations in a short time: try again later.",
      siret: "This SIRET already belongs to a registered company. If it is yours, ask its owner to add you.",
    },
  },
  inbox: {
    title: "Messages",
    lead: "Every conversation goes through Proofseen. The freelancer is shown by their reference until the contract; they accept or decline each contact.",
    empty: "No conversation yet.",
    emptyCompany: "Open a public profile and write to the freelancer, or publish a mission: applications open a conversation.",
    emptyFreelance: "When a company writes to you, or when you apply to a mission, the conversation appears here.",
    you: "You",
    about: "Mission",
    direct: "Direct contact",
    status: { pending: "Pending", accepted: "Accepted", declined: "Declined", closed: "Closed" },
  },
  thread: {
    back: "All messages",
    older: "Older messages",
    waitingCompany: "Your message was delivered. The freelancer accepts or declines; you can write again if they accept.",
    decideLead: "This company would like to talk with you. If you accept, you can discuss the mission; your legal identity is only shared at the contract.",
    accept: "Accept the conversation",
    decline: "Decline",
    declined: "This conversation was declined.",
    closed: "This conversation is closed.",
    reply: "Your message",
    replyHint: "No contact details before a secured payment: they would be refused.",
    send: "Send",
    close: "Close the conversation",
    closeHint: "Final: no message can be sent afterwards.",
    contactBlocked: "Message refused: it contains contact details. They are exchanged once the mission is paid into escrow.",
    tooMany: "Too many messages in a short time: try again in a minute.",
    invalid: "The message is empty or too long.",
    notAllowed: "This message cannot be sent in the conversation's current state.",
    flagged: "Contact details hidden by Proofseen",
  },
  contact: {
    title: (reference: string) => `Write to ${reference}`,
    lead: "Describe the mission: goal, duration, start, budget. The freelancer accepts or declines; you will be notified.",
    body: "Your message",
    send: "Send",
    noOrganisation: "Create your company first: it is the company that writes to the freelancer.",
    notCompany: "Only a company account can write to a freelancer.",
    existing: "You already have a conversation with this freelancer: your message was not sent, here is the conversation.",
    limit: "Daily contact limit reached, or this freelancer has too many pending requests. Try again later.",
    contactBlocked: "A first message cannot contain contact details: describe the mission, the rest follows on Proofseen.",
    invalid: "The message is empty or too long.",
    tooMany: "Too many messages in a short time: try again in a minute.",
  },
};
