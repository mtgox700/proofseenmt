import type { Dictionary } from "./types";

export const en: Dictionary = {
  meta: {
    title: "Proofseen — When a recruiter searches with AI, are you found?",
    description:
      "Proofseen measures whether a tech freelancer shows up when recruiters search for talent with ChatGPT, Claude or Perplexity, explains why, helps fix it honestly and measures again.",
  },
  nav: { method: "Method", offers: "Offers", companies: "Companies", charter: "Charter", otherLang: "Français", skip: "Skip to content" },
  hero: {
    eyebrow: "Know if you're seen.",
    title: "When a recruiter searches with AI, are you found?",
    lead: "We query OpenAI, Anthropic and Perplexity models with their web search, using recruiter-style prompts, many times over. Then we show you where you appear, why, and what to fix.",
    cta: "Explore the method",
    secondary: "See the offers",
    note: "No tricks. No guaranteed result. Measured through APIs: consumer apps may differ.",
  },
  problem: {
    kicker: "The shift",
    title: "Recruiting has a new search engine.",
    steps: [
      { title: "The recruiter asks the AI", text: "They paste their job description into an assistant and ask for profiles, or have it write the query they will run on Google, LinkedIn or GitHub." },
      { title: "The AI reads what is public", text: "It relies on what a search engine indexes and on sources it can cite: your site, GitHub, public profiles, articles." },
      { title: "You know nothing", text: "No platform tells you whether you are found, or why. Proofseen makes that moment measurable." },
    ],
  },
  method: {
    kicker: "The method",
    title: "Measure, explain, fix, prove.",
    steps: [
      { title: "Measure", text: "Recruiter-style prompts, sent several times to each engine, because an AI never answers the same way twice." },
      { title: "Explain", text: "A five-stage funnel shows where you drop out: indexed, retrieved, named, in the top 5, cited as a source." },
      { title: "Fix", text: "Honest, prioritised actions: a site AI can read, profiles rewritten with true facts, published evidence." },
      { title: "Prove", text: "The same measurement, repeated later, compared with control job descriptions to rule out engine drift." },
    ],
    preview: {
      caption: "Report preview",
      legend: "Illustrative example — fictitious data",
      stages: ["Indexed", "Retrieved", "Named", "Top 5", "Cited"],
      engines: ["Engine A", "Engine B", "Engine C"],
      score: "Probability of appearing in the top 5, with its range",
    },
  },
  proof: {
    kicker: "Proof, not promises",
    title: "A method you can check.",
    facts: [
      { value: "3", label: "engines queried through their official APIs" },
      { value: "×5", label: "draws per question in a full audit: a probability, not luck" },
      { value: "95%", label: "confidence interval shown next to every figure" },
      { value: "72 h", label: "maximum retention of encrypted raw answers" },
    ],
  },
  offers: {
    kicker: "Launch offers",
    title: "Start by knowing where you stand.",
    list: [
      { name: "Full audit", price: "€49", unit: "one-off", items: ["3 job descriptions of your choice", "Full report with ranges", "Map of cited sources", "Prioritised action plan"] },
      { name: "Done for you", price: "€490", unit: "one-off", items: ["Your site, readable by AI", "LinkedIn, GitHub and Malt copy: you publish it yourself", "List of evidence to obtain", "New measurement at 45 days"] },
    ],
    closed: "Opens after legal validation",
    legal: "14-day withdrawal right. Full refund if the service does not launch. No guaranteed result.",
  },
  companies: {
    kicker: "For companies",
    title: "Hire freelancers whose skills are proven.",
    text: "Verified profiles, missions documented with their sources, up-to-date availability. And a single contact for contract and invoicing.",
    points: ["Profile ownership verified", "Figures with their source", "Dated availability", "Simpler contract and invoicing"],
    cta: "Let's talk about your next mission",
  },
  charter: {
    kicker: "Honesty charter",
    title: "We measure. We don't manipulate.",
    items: [
      { title: "No AI manipulation", text: "No hidden text, no instructions aimed at AI, no content that changes depending on who looks." },
      { title: "Only what is true", text: "We refuse to generate a skill, an experience or a figure you don't have." },
      { title: "Your accounts stay yours", text: "We never post on your behalf and we collect nothing from LinkedIn or Malt." },
      { title: "Others are protected", text: "Names of other professionals cited by AI are erased before anything is stored." },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      { q: "Can you guarantee the top spot?", a: "No, and nobody honest can. We measure a probability with its range, help you fix what matters, then measure again." },
      { q: "Why ask the same question several times?", a: "Because an AI never gives exactly the same answer twice. One answer means nothing; a series of answers shows a trend." },
      { q: "Do you measure every AI?", a: "We measure through APIs the engines whose terms allow analysing their answers. Others are used only for internal calibration." },
      { q: "What about my privacy?", a: "You prove the measured profiles are yours. Raw answers are encrypted and deleted after 72 hours." },
    ],
  },
  footer: { line: "Proofseen — measuring your visibility in AI-assisted recruiting.", legal: "Legal notice and terms published at launch." },
};
