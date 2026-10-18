import Link from "next/link";
import type { FreelanceDashboard } from "@proofseen/db";
import { confirmAvailability, declareUnavailable } from "@/app/[lang]/app/profil/section-actions";
import type { Lang } from "@/i18n";
import type { InsightsDictionary } from "@/i18n/market/insights-fr";
import { day } from "@/lib/format";
import { availabilityCheckDue } from "@/lib/freelance-stage";
import { HOME_RETURN_FIELD, HOME_RETURN_VALUE } from "@/lib/home-notice";

interface AvailabilityCheckProps {
  readonly lang: Lang;
  readonly d: InsightsDictionary;
  readonly board: FreelanceDashboard;
  readonly now: Date;
}

/**
 * "Is your availability still right?" on the home (C23), once a published profile has gone 14 days without a
 * confirmation: still available, or no longer available, in one click each. Plain forms, the profile page's actions.
 */
export function AvailabilityCheck({ lang, d, board, now }: AvailabilityCheckProps) {
  const profile = board.profile;
  if (profile === null || !availabilityCheckDue(board, now)) return null;
  const a = d.stage.availability;
  const form = (action: (formData: FormData) => Promise<void>, label: string, primary: boolean) => (
    <form action={action}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name={HOME_RETURN_FIELD} value={HOME_RETURN_VALUE} />
      <button type="submit" className={primary ? "btn btn-primary" : "btn"}>
        {label}
      </button>
    </form>
  );
  return (
    <section className="panel" aria-labelledby="availability-check-title">
      <h2 id="availability-check-title">{a.title}</h2>
      <p className="measure">{a.lead(day(profile.availabilityAt, lang))}</p>
      <div className="empty-actions">
        {form(confirmAvailability, profile.availability === "available" ? a.stillAvailable : a.stillRight, true)}
        {form(declareUnavailable, a.notAvailable, false)}
        <Link className="btn btn-quiet" href={`/${lang}/app/profil#availability`}>
          {a.edit}
        </Link>
      </div>
    </section>
  );
}
