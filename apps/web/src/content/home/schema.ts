import { z } from "zod";

/*
 * The copy of the home page v2 (STORYBOARD_V2.md, twelve sections), typed and checked once at load. A missing line,
 * an empty string or a list of the wrong length fails the build instead of rendering a hole. Each list carries the
 * length the layout was drawn for: nine steps for the journey, six verified facts, three points under the headline.
 */

const text = z.string().trim().min(1);
const titled = z.object({ title: text, text });
const photo = z.object({ alt: text });

const HeroSchema = z.object({
  kicker: text,
  title: text,
  lead: text,
  primary: text,
  secondary: text,
  follow: text,
  /** The last point is the only one about verification: it alone carries the green dot. */
  points: z.tuple([text, text, text]),
  card: z.object({ label: text, title: text, meta: text, facts: z.tuple([text, text, text]), foot: text }),
  freelance: photo.extend({ label: text }),
  company: photo.extend({ label: text }),
});

const FreelanceSchema = z.object({
  kicker: text,
  title: text,
  lead: text,
  link: text,
  profile: titled.extend({ sections: z.array(text).length(6) }),
  photo: titled.extend({ alt: text }),
  availability: titled.extend({ pill: text }),
  matches: titled.extend({ mission: text, reason: text }),
  application: titled.extend({ steps: z.tuple([text, text, text]) }),
  mobile: titled.extend({ notice: text, from: text }),
  messages: titled.extend({ bubbles: z.tuple([text, text]), file: text, read: text }),
  sample: text,
});

const JourneySchema = z.object({
  kicker: text,
  title: text,
  lead: text,
  steps: z.array(titled).length(9),
  testMode: text,
  other: titled,
  stage: z.object({
    label: text,
    freelance: text,
    company: text,
    sample: text,
    mission: text,
    skills: z.array(text).min(2).max(4),
    meta: text,
    /** What the card says at each step, from the publication (1) to the verification (9). */
    states: z.array(text).length(9),
    rail: text,
    counter: text,
    quote: text,
    escrow: text,
    billing: text,
    stack: text,
    otherButton: text,
    backButton: text,
    declared: text,
    signedLink: text,
    confirmed: text,
  }),
});

const CompanySchema = z.object({
  phrase: titled.extend({ label: text, sentence: text, chips: z.array(text).min(3).max(6), sample: text }),
  facts: titled.extend({ items: z.tuple([text, text, text]), reference: text }),
  board: titled.extend({ columns: z.tuple([text, text, text]) }),
  escrow: titled.extend({ label: text }),
  invoicing: titled.extend({ mention: text }),
  team: titled.extend({ approvals: text }),
  api: titled.extend({ request: text, key: text }),
});

export const HomeCopySchema = z.object({
  hero: HeroSchema,
  capabilities: z.object({ label: text, items: z.array(text).length(14) }),
  freelance: FreelanceSchema,
  verified: z.object({ kicker: text, title: text, lead: text, rows: z.array(z.object({ fact: text, by: text })).length(6), foot: text, link: text, photo }),
  journey: JourneySchema,
  cover: z.object({ kicker: text, title: text, lead: text, primary: text, secondary: text, photo }),
  company: CompanySchema,
  manifesto: z.object({ kicker: text, statement: text, columns: z.tuple([titled, titled, titled]), link: text }),
  ai: z.object({ kicker: text, title: text, lead: text, fact: text, source: text, condition: text, link: text }),
  resources: z.object({ kicker: text, title: text, barometer: titled.extend({ link: text }), simulator: titled.extend({ link: text }), blog: titled.extend({ link: text }) }),
  faq: z.object({ title: text, write: text, items: z.array(z.object({ q: text, a: text })).length(6) }),
  doors: z.object({ label: text, freelance: titled.extend({ cta: text }), company: titled.extend({ cta: text }) }),
});

export type HomeCopy = z.infer<typeof HomeCopySchema>;
