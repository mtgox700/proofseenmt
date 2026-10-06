import { IdentitySchema, type EngineAnswer } from "@proofseen/core";

export const identity = IdentitySchema.parse({
  id: "ayoub",
  displayName: "Ayoub Hammoudi",
  nameVariants: ["Ayoub Hammoudi", "A. Hammoudi"],
  city: "Paris",
  stack: ["TypeScript", "Next.js", "LLM"],
  ownedUrls: [
    { url: "https://ayoub-hammoudi.dev/", proofMethod: "well_known_file", verifiedAt: "2026-09-25T10:00:00Z" },
    { url: "https://github.com/Ayoubhm07", proofMethod: "profile_token", verifiedAt: "2026-09-25T10:05:00Z" },
    { url: "https://www.linkedin.com/in/ayoub-hammoudi-3251851b8", proofMethod: "profile_token", verifiedAt: null },
  ],
});

/** Fictitious third parties used only in tests. */
export const THIRD_PARTY_NAMES = ["Camille Laurent", "Julien Martin", "Sarah O'Connor", "Hugo Bernard"] as const;

export const answerText = [
  "Voici 5 profils freelances pour cette mission :",
  "1. Camille Laurent — Senior React à Lyon (https://www.linkedin.com/in/camille-laurent-dev)",
  "2. Julien Martin — Full stack Node.js (https://github.com/julienmartin)",
  "3. Ayoub Hammoudi — Full Stack TypeScript et LLM à Paris (https://ayoub-hammoudi.dev/)",
  "4. Sarah O'Connor — Tech lead, voir https://sarah-oconnor.io/about",
  "5. Profil trouvé sur https://www.malt.fr/profile/hugobernard",
  "Hugo Bernard est aussi disponible.",
].join("\n");

export const answer: EngineAnswer = {
  engine: "anthropic",
  model: "claude-haiku-4-5",
  text: answerText,
  citations: [
    { url: "https://ayoub-hammoudi.dev/", title: "Ayoub" },
    { url: "https://www.linkedin.com/in/camille-laurent-dev" },
    { url: "https://sarah-oconnor.io/about" },
  ],
  searchResults: [{ url: "https://github.com/Ayoubhm07" }, { url: "https://www.malt.fr/profile/hugobernard" }],
  usage: { inputTokens: 1200, outputTokens: 300, searches: 2 },
  costUsd: 0.02,
};

/** What an honest extractor returns for answerText (names exactly as written, URLs as written). */
export const extractorJson = JSON.stringify({
  candidates: [
    { name: "Camille Laurent", urls: ["https://www.linkedin.com/in/camille-laurent-dev"] },
    { name: "Julien Martin", urls: ["https://github.com/julienmartin"] },
    { name: "Ayoub Hammoudi", urls: ["https://ayoub-hammoudi.dev/"] },
    { name: "Sarah O'Connor", urls: ["https://sarah-oconnor.io/about"] },
    { name: "Hugo Bernard", urls: ["https://www.malt.fr/profile/hugobernard"] },
  ],
});
