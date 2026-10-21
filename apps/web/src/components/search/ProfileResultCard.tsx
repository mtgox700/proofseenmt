import type { ProfileCard } from "@proofseen/db";
import { profileCardBody } from "@proofseen/hub";
import type { Lang } from "@/i18n";
import { profileCardView } from "@/lib/profile-card-view";

interface ProfileResultCardProps {
  readonly lang: Lang;
  readonly card: ProfileCard;
  /** Actions at the foot of the card: contact, add to a list. */
  readonly children?: React.ReactNode;
  /** The instant the 30-day freshness rule is read at; the request time by default. */
  readonly now?: Date;
}

/**
 * One freelancer in the company search, on the one profile card of the marketplace: the body is the markup the public
 * directory renders (@proofseen/hub, every value escaped there), on the shared CSS (@proofseen/brand/profile-card.css).
 * Public facts only, verified ones on a green square, no score. The search adds its actions under the card's link layer.
 */
export function ProfileResultCard({ lang, card, children, now = new Date() }: ProfileResultCardProps) {
  const headingId = `card-${card.id}`;
  return (
    <article className="fiche-card" aria-labelledby={headingId}>
      <div className="fc-body" dangerouslySetInnerHTML={{ __html: profileCardBody(profileCardView(card, now), lang, headingId) }} />
      {children === undefined ? null : <div className="fc-actions">{children}</div>}
    </article>
  );
}
