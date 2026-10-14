import type { ChecklistDictionary } from "./checklist-fr";

export const checklistEn: ChecklistDictionary = {
  title: "What AI engines can read about you",
  lead: "Each line is a fact AI engines read on your public page. It is not a grade: the list only says what is missing and where to add it.",
  allDone: "Every fact is in place.",
  missing: (count: number) => (count > 1 ? `${count} facts missing` : "1 fact missing"),
  seeAll: "See the full list",
  groups: { page: "On your page", proof: "What proves it" },
  done: "Done",
  todo: "Missing",
  fix: "Add it",
  items: {
    published: {
      label: "Profile published",
      why: "A private page does not exist for the engines: nothing below is read until it is published.",
    },
    headline: {
      label: "Headline",
      why: "It is the sentence an AI compares with a recruiter's question: your trade and your speciality.",
    },
    summary: {
      label: (min: number) => `Summary of at least ${min} characters`,
      why: "The summary gives engines something to describe your work with; too short, the page is judged empty and is not indexed.",
    },
    skills: {
      label: (min: number) => `At least ${min} skills`,
      why: "Skills are the words questions contain: without them, your page answers none.",
    },
    city: {
      label: "City",
      why: "Many requests name a city: without one, the page cannot answer them.",
    },
    workMode: {
      label: "Work mode",
      why: "On site, hybrid or remote: an AI uses it to keep or drop a page.",
    },
    dailyRate: {
      label: "Daily rate",
      why: "A stated rate lets the page answer requests that set a budget.",
    },
    availability: {
      label: "Availability up to date",
      why: "A date in the past tells engines something false; up to date, it answers \"available when?\".",
    },
    provenAddress: {
      label: "At least one proven address",
      why: "A citation only counts as yours when it links to an address you have proven you own.",
    },
    siret: {
      label: "SIRET checked in the registry",
      why: "A business found active in the official registry is a verifiable fact shown on your profile.",
    },
    vigilance: {
      label: "URSSAF certificate checked",
      why: "A valid vigilance certificate is shown as a dated fact on your profile.",
    },
  },
  notes: {
    too_short: "The summary is too short.",
    too_few: "Not enough skills yet.",
    date_passed: "The availability date has passed.",
    awaiting_check: "SIRET entered, registry check pending.",
    registry_problem: "The registry does not confirm this SIRET for your legal name.",
    expired: "The certificate has expired: declare the new one.",
    awaiting_operator: "Certificate declared, waiting for the team to check it.",
  },
};
