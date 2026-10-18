import type { ProfileCard } from "@proofseen/db";
import { languageName } from "@proofseen/hub";
import type { Lang } from "@/i18n";
import type { MarketDictionary } from "@/i18n/market";
import { availabilityDisplay } from "@/lib/availability-display";
import { day, money } from "@/lib/format";
import { Avatar } from "./Avatar";

interface ProfileResultCardProps {
  readonly lang: Lang;
  readonly m: MarketDictionary;
  readonly card: ProfileCard;
  /** Actions at the foot of the card: contact, add to a list. */
  readonly children?: React.ReactNode;
  /** The instant the 30-day freshness rule is read at; the request time by default. */
  readonly now?: Date;
}

const MAX_SKILLS = 6;

/**
 * The availability the freelancer declared, with the day they last confirmed it. Past 30 days without a confirmation it
 * reads "not confirmed" (the database rule, `shownAvailability`), never "available"; the profile itself stays listed.
 */
function Availability({ lang, m, card, now = new Date() }: Omit<ProfileResultCardProps, "children">) {
  const c = m.discovery.card;
  const { shown, tone } = availabilityDisplay(card.availability, card.availabilityAt, now);
  const text =
    shown === "unconfirmed"
      ? c.unconfirmed
      : shown === "available"
        ? c.available
        : shown === "available_from" && card.availableFrom !== null
          ? c.from(day(card.availableFrom, lang))
          : c.unavailable;
  const when = day(card.availabilityAt, lang);
  return (
    <p className="avail">
      <span className={`badge ${tone}`}>
        <i aria-hidden="true" />
        {text}
      </span>
      <span className="pc-ref">{shown === "unconfirmed" ? c.lastConfirmed(when) : c.confirmed(when)}</span>
    </p>
  );
}

/** The verified facts, each named: the count shown on the card is exactly these. */
const verifiedBadges = (card: ProfileCard, m: MarketDictionary): readonly string[] => {
  const c = m.discovery.card;
  return [
    ...(card.verifiedMissions === 0 ? [] : [c.missions(card.verifiedMissions)]),
    ...(card.verifiedUrls === 0 ? [] : [c.proven(card.verifiedUrls)]),
    ...(card.registryActive ? [c.registry] : []),
    ...(card.vigilanceValid ? [c.vigilance] : []),
  ];
};

/**
 * One freelancer in the company search, by public facts only: name and photo for a named profile, the reference and a
 * monogram otherwise. The number of verified facts is a count of named facts listed right under it, never a score.
 */
export function ProfileResultCard({ lang, m, card, children, now }: ProfileResultCardProps) {
  const c = m.discovery.card;
  const title = card.displayName ?? m.search.card.pseudonym(card.reference);
  const headingId = `card-${card.id}`;
  const skills = card.skills.slice(0, MAX_SKILLS);
  const badges = verifiedBadges(card, m);
  const levels = m.profile.sections.languages.levels;
  return (
    <article className="pcard" aria-labelledby={headingId}>
      <div className="pc-head">
        <Avatar seed={card.reference} name={card.displayName ?? null} photoFileId={card.photoFileId} alt={card.displayName === undefined ? "" : c.photo(card.displayName)} />
        <div className="pc-id">
          {/* The public profile is raw HTML from a route handler: a plain link, a full page load. */}
          <h3 className="pc-name" id={headingId}>
            {card.slug === null ? title : <a href={`/${lang}/profils/${card.slug}`}>{title}</a>}
          </h3>
          <p className="pc-ref">
            {card.reference}
            {card.city === null ? null : ` · ${card.city}`}
          </p>
        </div>
      </div>
      <Availability lang={lang} m={m} card={card} {...(now === undefined ? {} : { now })} />
      {card.headline === null ? null : <p className="pc-headline">{card.headline}</p>}
      <p className="pc-meta">
        <span>{m.missions.workModes[card.workMode]}</span>
        {card.dailyRateCents === null ? (
          <span>{c.noRate}</span>
        ) : (
          <span>
            <b>{money(card.dailyRateCents, card.currency, lang)}</b> {c.perDay}
          </span>
        )}
        {card.hasPortfolio ? <span>{c.portfolio}</span> : null}
        {card.identityVerified ? <span>{c.identity}</span> : null}
      </p>
      {skills.length === 0 ? null : (
        <ul className="skills">
          {skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
          {card.skills.length > skills.length ? <li className="plus">{c.more(card.skills.length - skills.length)}</li> : null}
        </ul>
      )}
      <div className="pc-proof">
        <p className={`pc-count${card.verifiedFacts === 0 ? " none" : ""}`}>{c.facts(card.verifiedFacts)}</p>
        {badges.length === 0 ? null : (
          <ul className="pc-badges">
            {badges.map((badge) => (
              <li key={badge}>{badge}</li>
            ))}
          </ul>
        )}
      </div>
      {card.languages.length === 0 ? null : (
        <p className="pc-meta pc-langs">{card.languages.map((l) => `${languageName(l.code, lang)} (${l.level === "native" ? levels.native : l.level.toUpperCase()})`).join(" · ")}</p>
      )}
      <div className="pc-actions">
        {card.slug === null ? null : (
          <a className="btn btn-quiet" href={`/${lang}/profils/${card.slug}`}>
            {c.view}
          </a>
        )}
        {children}
      </div>
    </article>
  );
}
