import type { ProofsDictionary } from "./proofs-fr";

export const proofsEn: ProofsDictionary = {
  nav: "Proven addresses",
  title: "Proven addresses",
  lead: "A citation by an AI engine only counts when it leads to an address you have proven you own. Declare your sites, then publish one of the three proofs: we read it now, then every thirty days.",
  listTitle: "Your addresses",
  empty: "No address declared yet.",
  status: {
    proven: (date: string, method: string) => `Proven on ${date} · ${method}`,
    waiting: "Waiting for proof",
    manual: "Cannot be checked automatically",
  },
  methods: {
    well_known_file: "verification file",
    meta_tag: "meta tag",
    dns_txt: "DNS TXT record",
    profile_token: "manual check",
  },
  failing: (since: string, until: string) =>
    `The proof has not been readable since ${since}. Restore it before ${until}, or the address goes back to waiting.`,
  manualNote:
    "LinkedIn and Malt: Proofseen sends them no automated request. The link is kept as a declared link; it does not count as a proven address.",
  ways: {
    summary: "Prove this address: any one of the three methods is enough",
    copyHint: "One click selects the whole value, ready to copy.",
    wellKnownTitle: "File at the root of the site",
    wellKnownScope: "proves the whole domain",
    wellKnown: (url: string) => `Publish a text file at ${url} containing exactly this line:`,
    metaTitle: "Meta tag in the page",
    metaScope: "proves this page only",
    meta: (page: string) => `Add this tag to the <head> of ${page}:`,
    dnsTitle: "DNS TXT record",
    dnsScope: "proves the whole domain",
    dns: (host: string) => `Add a TXT record on ${host} (name "@") whose value is:`,
    dnsDelay: "A DNS change can take a few hours to propagate.",
  },
  verify: "Check now",
  remove: "Remove",
  removeLabel: (url: string) => `Remove ${url}`,
  verifyLabel: (url: string) => `Check ${url} now`,
  addTitle: "Add an address",
  addLabel: "Address of the page or site",
  addHint: (max: number) =>
    `Over https, on a public domain name: your site, your repository, a profile page. LinkedIn and Malt are accepted as declared links. ${max} addresses at most.`,
  add: "Add",
  unavailable: "Proof checking is not configured on this server: your addresses are kept, and the instructions will appear once it is.",
  saved: "Saved.",
  proven: "Proof found: the address is now proven.",
  errors: {
    tooMany: "Too many requests in a short time: try again in a few minutes.",
    invalid: "Address refused: it must be an https address on a public domain name, without port or credentials.",
    duplicate: "This address is already in your list.",
    limit: (max: number) => `You have reached ${max} addresses: remove one to add another.`,
    noProfile: "Create your profile first: proven addresses belong to it.",
    notFound: "This address is not in your list.",
    absent:
      "No proof found yet. Check that the value is copied exactly, that the page is public over https, or give DNS time to propagate.",
    elsewhere: "This address is already proven by another profile. If it is yours, write to us: we will check by hand.",
    manual: "This platform cannot be checked automatically: no request is sent to it.",
    unavailable: "Checking is not available on this server for now.",
  },
  profileLink: "Create my profile",
};
