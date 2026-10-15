import type { StandingDictionary } from "./standing-fr";

export const standingEn: StandingDictionary = {
  noticeTitle: "Proofseen decision",
  targets: { profile: "Your public profile is hidden", mission: "A mission is hidden", company: "The company's public page is hidden" },
  since: (d: string) => `since ${d}`,
  reason: "Reason",
  vigilanceRejected: "Your URSSAF vigilance certificate could not be verified: declare a new one.",
  appealTitle: "Contest or ask for details",
  appealHint: "Your message reaches the Proofseen team with your account. No contact details: we answer by e-mail.",
  appealLabel: "Your message",
  appealSend: "Send",
  appealSent: "Message sent. The Proofseen team will answer by e-mail.",
  appealError: "Message too short or too long (5 to 2,000 characters).",
  appealTooMany: "Too many messages in a short time: try again later.",
  suspendedTitle: "Your account is suspended",
  exportData: "Download my data (GDPR)",
  suspendedLead: "A Proofseen operator suspended your account: your space is no longer available and your public content is hidden.",
};
