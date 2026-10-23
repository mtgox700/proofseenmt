import type { MyConfirmationRequest, OwnedUrlRecord, ProfileFacts, PublicProfilePage, VerifiedMissionRecord } from "@proofseen/db";
import { factLines, PROOF_LABELS, proofTally, type ProofRegister } from "@proofseen/hub";
import type { Lang } from "@/i18n/types";

/*
 * The freelancer's register in the connected space (CONNECTED_PLAN §2.1, lot 2): what the public page shows as verified,
 * written with the very sentences and counts of that page (packages/hub/src/profile-proofs.ts), so the two never say
 * different things. Pure functions over rows already read from the database: nothing here is invented, and a fact
 * without a date in the database is shown without one.
 */

type Labels = (typeof PROOF_LABELS)[Lang];

/** The day the public page writes: a long date read in UTC, as `profile-proofs.ts` does. */
export const publicDay = (instant: Date, lang: Lang): string =>
  new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(instant);

/** The register the public page builds from its row (packages/hub/src/profile-page.ts). */
export const registerOf = (page: PublicProfilePage): ProofRegister => ({
  named: page.visibility === "named",
  missions: page.missions,
  provenUrls: page.provenUrls,
  provenUrlCount: page.provenUrlCount,
  provenAddresses: page.provenAddresses,
  facts: page.facts,
});

/**
 * Where the person's facts stand in public. `unpublished`: no profile, or a private one; `hidden`: published, but the
 * public page is not served (moderated profile, suspended account); `published`: the tally of the public rail.
 */
export type PublicStanding =
  | { readonly kind: "unpublished" }
  | { readonly kind: "hidden" }
  | { readonly kind: "published"; readonly slug: string; readonly tally: string; readonly verified: boolean };

export const publicStanding = (profile: ProfileFacts | null, page: PublicProfilePage | null, lang: Lang): PublicStanding => {
  if (profile === null || profile.visibility === "private" || profile.slug === null) return { kind: "unpublished" };
  if (page === null) return { kind: "hidden" };
  const tally = proofTally(registerOf(page), lang);
  return { kind: "published", slug: page.slug, tally, verified: tally !== PROOF_LABELS[lang].tallyNone };
};

export interface TraceRow {
  readonly label: string;
  readonly value: string;
}

/** A verified mission as its seal says it: the claim, then the dated sentence and its trace. */
export interface MissionSeal {
  readonly id: string;
  readonly role: string;
  /** The client as published: its name only when it allowed it, else its kind. */
  readonly client: string;
  readonly months: string;
  readonly summary: string;
  readonly text: string;
  readonly date: Date;
  readonly trace: readonly TraceRow[];
}

/*
 * Two origins only make a mission verified: the client's confirmation, or a payment on Proofseen. A row of another kind
 * (none is written today) keeps its dated sentence but no source: no screen claims a check that does not exist.
 */
const missionTrace = (m: VerifiedMissionRecord, l: Labels): TraceRow[] => {
  if (m.evidenceKind !== "client_confirmation" && m.evidenceKind !== "paid_on_platform") return [];
  const contact = m.confirmedBy === "contact";
  return [
    { label: l.source, value: l.missionSource(m.evidenceKind, "") },
    { label: l.by, value: l.missionBy(m.evidenceKind, contact) },
  ];
};

export const missionSeal = (m: VerifiedMissionRecord, lang: Lang): MissionSeal => {
  const l = PROOF_LABELS[lang];
  return {
    id: `m:${m.id}`,
    role: m.role,
    client: m.clientName === null || m.clientName === "" ? (l.clientKinds[m.clientKind] ?? m.clientKind) : m.clientName,
    months: l.months(m.durationMonths),
    summary: m.summary.trim(),
    text: l.verifiedOn(m.evidenceKind, publicDay(m.verifiedAt, lang), m.confirmedBy === "contact"),
    date: m.verifiedAt,
    trace: missionTrace(m, l),
  };
};

/** A proven address: the address, the dated sentence of the public page, and its trace (method, reader, last read). */
export interface AddressSeal {
  readonly id: string;
  readonly url: string;
  readonly text: string;
  readonly date: Date;
  readonly trace: readonly TraceRow[];
}

export const addressSeals = (records: readonly OwnedUrlRecord[], lang: Lang): AddressSeal[] => {
  const l = PROOF_LABELS[lang];
  return records.flatMap((r) =>
    r.verifiedAt === null
      ? []
      : [
          {
            id: `u:${r.id}`,
            url: r.url,
            text: l.proven(publicDay(r.verifiedAt, lang)),
            date: r.verifiedAt,
            trace: [
              { label: l.source, value: l.methods[r.proofMethod] ?? r.proofMethod },
              { label: l.by, value: l.addressBy(r.proofMethod) },
              ...(r.checkedAt === null ? [] : [{ label: l.lastRead, value: publicDay(r.checkedAt, lang) }]),
            ],
          },
        ],
  );
};

/** The other verified facts of the public page (company register, identity, URSSAF, paying clients), with their trace. */
export interface FactView {
  readonly text: string;
  readonly trace: readonly TraceRow[];
}

export const factViews = (page: PublicProfilePage | null, lang: Lang): FactView[] => {
  if (page === null) return [];
  const l = PROOF_LABELS[lang];
  return factLines(page.facts, lang).map((f) => ({
    text: f.text,
    trace: [
      { label: l.source, value: f.source },
      { label: l.by, value: f.by },
      ...(f.date === null ? [] : [{ label: l.date, value: publicDay(f.date, lang) }]),
    ],
  }));
};

/** The requests still waiting for a client, the nearest deadline first: the "on trial" state of the register. */
export const waitingRequests = (requests: readonly MyConfirmationRequest[]): MyConfirmationRequest[] =>
  requests.filter((r) => r.state === "pending").toSorted((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());

/** Pending first (nearest deadline first), then the closed ones as the database ordered them. */
export const requestsInOrder = (requests: readonly MyConfirmationRequest[]): MyConfirmationRequest[] => [
  ...waitingRequests(requests),
  ...requests.filter((r) => r.state !== "pending"),
];
