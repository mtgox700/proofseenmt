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
    lead: "We ask OpenAI, Anthropic and Perplexity models your recruiters' questions, dozens of times. You see where you appear, why, and what to fix.",
    cta: "Explore the method",
    secondary: "See the offers",
    note: "No tricks. No guaranteed result. Measured through APIs: consumer apps may differ.",
    sim: {
      label: "A measurement, live",
      tag: "Simulation · fictitious data",
      engine: "Engine A · web search",
      recruiter: "Recruiter",
      prompt: "I'm looking for a freelance fullstack TypeScript developer, available in October, Paris or remote. Give me the 5 best profiles.",
      answer: "Top 5 proposed by the AI",
      you: "You",
      outside: "You: outside the top 5 in this answer",
      run: "Answer",
      tally: "Each dot is one answer. Green: you are in the top 5.",
      estimate: "In the top 5",
      summary: "Fictitious simulation: across {n} answers, you appear {hits} times in the top 5, i.e. {p}% (confidence interval {lo} to {hi}%).",
    },
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
  study: {
    kicker: "Measured on ourselves first",
    title: "780 AI answers. Our founder appears in none of them.",
    lead:
      "Before selling anything, we ran the method on our own founder, with a protocol frozen beforehand: 13 real job ads, 4 recruiter phrasings, 3 engines, 5 draws per question.",
    facts: [
      { value: "780", label: "AI answers analysed, for $15.79 of measurement cost" },
      { value: "0%", label: "citations: confidence interval [0%; 1.9%] on every engine" },
      { value: "39%", label: "of citations go to Malt, 26.5% to LinkedIn — almost never to a personal site" },
      { value: "90.8%", label: "of Anthropic's answers consult no source at all: being seen depends on the engine" },
      { value: "20/20", label: "agreement between our API measurements and the consumer apps" },
    ],
    sources: "Wave J0, 23-24 September 2026. Manifest frozen before measuring, fingerprint 1bc9f85f. Raw answers deleted after analysis.",
    limits:
      "These figures describe one profile, those ads, those engines, on that date. They do not predict your results. We publish them because a vendor who never measures itself proves nothing.",
  },
  deliverable: {
    kicker: "The deliverable",
    title: "What you get, and nothing more",
    lead:
      "A dated, quantified, reproducible report. Every action in it comes from a number in your own measurement: we do not recite best practices.",
    contents: [
      "The exact stage where your profile drops out: not found, found but not named, named but outside the top five, or cited with no link back to you.",
      "For each engine, the raw count and the range the real rate sits in — never a bare percentage.",
      "The source map: the platforms the AIs actually read for this kind of ad, with their share.",
      "At most eight ranked actions, each with its reason, where to apply it, the estimated effort and the number that justifies it.",
      "What you cannot act on: when an engine refuses to name people, we say so instead of selling you a fix.",
      "The model queried, the date, and the fingerprint of the protocol frozen before measuring.",
    ],
    sample: {
      caption: "An excerpt from the report on our own measurement. We show no client report: we do not have one yet.",
      blocking: "The blocking stage: are your pages known to the engines?",
      action: {
        rank: "1",
        title: "Make your pages readable without JavaScript",
        why:
          "AI crawlers do not run JavaScript: on a page built in the browser, they read nothing. There is therefore no text to retrieve further down the funnel.",
        effort: "medium",
        evidence: "0 pages indexed out of 1 declared, checked on 24 September 2026",
      },
      labels: { why: "Why", effort: "Effort", evidence: "What shows it" },
    },
    note:
      "No rank, no appearance, no contact and no assignment are promised. The report counts what was observed; it does not predict what comes next.",
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
  order: {
    meta: {
      title: "Order — Proofseen",
      description:
        "Pre-order the Proofseen audit: scope, latest delivery date, 14-day right of withdrawal and full refund conditions.",
    },
    kicker: "Order",
    title: "What you are buying, and what you can undo",
    lead: "Everything that binds you is on this page, before payment. Nothing is deferred to a link you would open afterwards.",
    back: "Back to home",
    items: [
      {
        name: "Full audit",
        price: "€49",
        scope: "A measurement of your visibility in AI answers, and the plan to fix it.",
        includes: [
          "3 job ads you choose, plus 1 control ad chosen by us.",
          "For each ad: 4 recruiter phrasings × 3 engines × 5 draws.",
          "A dated report: the stage where your profile drops out, with its raw count and range, for each engine.",
          "The map of the sources AIs actually cite for this kind of ad.",
          "At most 8 ranked actions, each with its reason, where to apply it, the effort and the number that justifies it.",
        ],
        excludes: [
          "Nothing is published on your behalf.",
          "We never tell you the names of the people cited in your place.",
          "Gemini and Copilot are not covered.",
        ],
        cta: "Pre-order the audit — €49",
      },
      {
        name: "Done for you",
        price: "€490",
        scope: "The audit, then the pages and copy to fix it, and a second measurement to see what moved.",
        includes: [
          "The full audit, as a baseline measurement.",
          "Your profile pages, readable by search engines and AIs, written from your real assignments.",
          "Rewritten copy for your LinkedIn, Malt and GitHub profiles, in a file.",
          "The list of third-party evidence to obtain, tailored to your profile.",
          "A second measurement 45 days after delivery, using the same protocol.",
        ],
        excludes: [
          "You approve every fact before publication, and you publish on the platforms yourself.",
          "We never write a skill, an experience or a figure you do not have.",
          "No automation is ever run against LinkedIn or Malt.",
        ],
        cta: "Pre-order done for you — €490",
      },
    ],
    terms: {
      title: "What we commit to",
      delivery: "Delivered by {date} at the latest.",
      withdrawal:
        "You may withdraw within {days} days of your order, without giving a reason and at no cost. We refund you in full within 14 days at most, using the payment method you used.",
      refundTitle: "Full refund",
      refunds: [
        { when: "We decide not to launch the service on {gate}", then: "Full refund, within 14 days at most." },
        { when: "Nothing has been delivered to you by {delivery}", then: "Full and automatic refund, with nothing to do on your side." },
        {
          when: "An AI provider does not allow us this use before your delivery",
          then: "We tell you before running your audit. You choose: an audit on the remaining engines, or a full refund.",
        },
        {
          when: "Your profile contains manipulation aimed at AIs (hidden text, instructions)",
          then: "We refuse to measure, and you are refunded in full.",
        },
      ],
      neverTitle: "What we will never ask you for",
      never:
        "Your usernames, passwords or access codes, for LinkedIn, Malt, GitHub, your host or your registrar. We never log into your accounts and we never publish on your behalf.",
      noPromiseTitle: "What we do not promise",
      noPromise: [
        "No rank, no appearance, no contact and no assignment is promised.",
        "We never show you who appears in your place.",
        "We observe AI answers and we count them. We do not know how they work internally and we do not claim to.",
      ],
      accept:
        "By ordering, you accept the pre-sale terms, including the latest delivery date and the refund conditions above.",
    },
    closed: "Orders closed",
    closedWhy:
      "No payment is taken until the terms of sale have been validated by a lawyer. This page describes what will be offered when orders open.",
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
