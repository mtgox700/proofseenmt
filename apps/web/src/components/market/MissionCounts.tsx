import Link from "next/link";
import type { Lang } from "@/i18n";
import type { MissionsSpaceDictionary } from "@/i18n/market/missions-space-fr";

interface MissionCountsProps {
  readonly lang: Lang;
  readonly s: MissionsSpaceDictionary;
  /** Invitations to apply not yet answered (no application, not set aside), on open missions. */
  readonly invitations: number;
  /** Saved missions still open. */
  readonly saved: number;
}

/** The freelancer's home: invitations waiting and saved missions, each a link to its list. Counts of rows, nothing more. */
export function MissionCounts({ lang, s, invitations, saved }: MissionCountsProps) {
  return (
    <section className="ws-block" aria-labelledby="mission-counts-title">
      <h2 id="mission-counts-title">{s.home.title}</h2>
      <ul className="plain-list">
        <li>
          <Link href={`/${lang}/app/missions`}>{s.home.invitations(invitations)}</Link>
        </li>
        <li>
          <Link href={`/${lang}/app/missions/enregistrees`}>{s.home.saved(saved)}</Link>
        </li>
      </ul>
    </section>
  );
}
