import type { SettingsDictionary } from "./settings-fr";

export const settingsEn: SettingsDictionary = {
  nav: "Settings",
  title: "Account settings",
  lead: "Your language, your e-mails, your sign-in and your data.",
  saved: { language: "E-mail language saved.", organisation: "Company switched: the workspace now acts for it." },
  errors: {
    invalid: "This choice is not available.",
    throttled: "Too many changes in a short time: try again in a few minutes.",
  },
  language: {
    title: "E-mail language",
    lead: "Proofseen writes to you in this language. The page language is switched at the top of the screen.",
    label: "Language",
    options: { fr: "Français", en: "English" },
    save: "Save",
  },
  notifications: {
    title: "E-mails and alerts",
    lead: "Choose the e-mails you receive and your mission alerts.",
    link: "Set e-mails and alerts",
  },
  account: {
    title: "Sign-in",
    lead: "E-mail address, password and open sessions, handled by our sign-in service.",
  },
  organisation: {
    title: "Company",
    lead: "You belong to several companies: choose the one you act for. The choice is kept on this device.",
    label: "You act for",
    save: "Switch company",
  },
  data: {
    title: "Your data",
    lead: "A JSON file with everything the database holds about you: profile, applications, messages, contracts, lists, preferences.",
    export: "Export my data",
  },
  erase: {
    title: "Delete my account",
    lead: "Your profile, messages, applications and sign-in account are erased. Contracts, payments and invoices remain, detached from you, for as long as the law requires.",
    blocked: "Deletion is refused while a contract is in progress or money is held: the other party would be left without recourse.",
    confirmLabel: (word: string) => `To confirm, type ${word}`,
    submit: "Delete my account for good",
    pending: "Deleting…",
    mismatch: (word: string) => `Type exactly ${word} to confirm.`,
    outcomes: {
      busy: "Deletion refused: a contract is in progress, or money is still held. Finish it (or wait for the payout), then try again.",
      throttled: "Too many attempts: try again in an hour.",
      signed_out: "Your session has expired: sign in again, then try again.",
      failed: "Deletion did not go through. Try again; if it happens again, write to us.",
    },
    done: "Your account is deleted.",
  },
};
