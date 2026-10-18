import type { AvailabilityStatus, LanguageLevelValue, WorkMode } from "@proofseen/db";
import { languageName } from "@proofseen/hub";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { availabilityDisplay } from "@/lib/availability-display";
import { date, day, money } from "@/lib/format";

/** The public facts a card shows, from a search result or a list line. Never a note, a score or a rank. */
export interface CardFacts {
  readonly reference: string;
  readonly slug: string | null;
  readonly displayName?: string;
  readonly headline: string | null;
  readonly city: string | null;
  readonly workMode: WorkMode | null;
  readonly dailyRateCents: number | null;
  readonly currency: string;
  readonly availability: AvailabilityStatus | null;
  readonly availableFrom: Date | null;
  /** Last confirmation of the availability; past 30 days the card reads "not confirmed" (C23). */
  readonly availabilityAt?: Date | null;
  readonly skills: readonly string[];
  readonly verifiedUrls?: number;
  readonly verifiedMissions?: number;
  readonly registryActive?: boolean;
  readonly vigilanceValid?: boolean;
  readonly updatedAt?: Date;
  /** Declared languages and levels, as on the public page. */
  readonly languages?: readonly { readonly code: string; readonly level: LanguageLevelValue }[];
}

interface FreelancerCardProps {
  readonly lang: Lang;
  readonly m: MarketDictionary;
  readonly facts: CardFacts;
  readonly headingId: string;
  /** Actions under the facts: add to a list, note, thumbs. */
  readonly children?: React.ReactNode;
  /** The instant the 30-day freshness rule is read at; the request time by default. */
  readonly now?: Date;
}

const availabilityText = (facts: CardFacts, m: MarketDictionary, lang: Lang, now: Date): string | null => {
  if (facts.availability === null) return null;
  const confirmedAt = facts.availabilityAt ?? null;
  if (confirmedAt !== null && availabilityDisplay(facts.availability, confirmedAt, now).shown === "unconfirmed") return m.discovery.card.unconfirmed;
  if (facts.availability === "available_from" && facts.availableFrom !== null) return m.search.card.availableFrom(date(facts.availableFrom.toISOString(), lang));
  return m.profile.availabilities[facts.availability];
};

/** One freelancer, by public facts: the name only for a named profile, the reference otherwise. */
export function FreelancerCard({ lang, m, facts, headingId, children, now = new Date() }: FreelancerCardProps) {
  const c = m.search.card;
  const title = facts.displayName ?? c.pseudonym(facts.reference);
  const availability = availabilityText(facts, m, lang, now);
  const verified = [
    ...(facts.verifiedUrls === undefined || facts.verifiedUrls === 0 ? [] : [c.proven(facts.verifiedUrls)]),
    ...(facts.verifiedMissions === undefined || facts.verifiedMissions === 0 ? [] : [c.missions(facts.verifiedMissions)]),
    ...(facts.registryActive === true ? [c.registry] : []),
    ...(facts.vigilanceValid === true ? [c.vigilance] : []),
  ];
  return (
    <article aria-labelledby={headingId}>
      <div className="profile-row-head">
        {/* The public profile is raw HTML from a route handler: a plain link, a full page load. */}
        <h3 id={headingId}>{facts.slug === null ? title : <a href={`/${lang}/profils/${facts.slug}`}>{title}</a>}</h3>
        {facts.city === null ? null : <span className="muted">{facts.city}</span>}
        <code className="small">{facts.reference}</code>
      </div>
      {facts.headline === null ? null : <p className="profile-headline">{facts.headline}</p>}
      {facts.skills.length === 0 ? null : (
        <ul className="skills">
          {facts.skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      )}
      {facts.workMode === null ? null : (
        <dl className="profile-facts">
          <div>
            <dt>{c.rate}</dt>
            <dd>{facts.dailyRateCents === null ? c.noRate : money(facts.dailyRateCents, facts.currency, lang)}</dd>
          </div>
          <div>
            <dt>{c.mode}</dt>
            <dd>{m.missions.workModes[facts.workMode]}</dd>
          </div>
          {availability === null ? null : (
            <div>
              <dt>{c.availability}</dt>
              <dd>{availability}</dd>
            </div>
          )}
          {facts.languages === undefined || facts.languages.length === 0 ? null : (
            <div>
              <dt>{c.languages}</dt>
              <dd>{facts.languages.map((l) => `${languageName(l.code, lang)} (${l.level === "native" ? m.profile.sections.languages.levels.native : l.level.toUpperCase()})`).join(" · ")}</dd>
            </div>
          )}
        </dl>
      )}
      {verified.length === 0 ? null : (
        <p className="tags">
          {verified.map((fact) => (
            <span key={fact} className="tag tag-proof">
              {fact}
            </span>
          ))}
        </p>
      )}
      {facts.updatedAt === undefined ? null : <p className="muted small">{c.updated(day(facts.updatedAt, lang))}</p>}
      {children}
    </article>
  );
}
