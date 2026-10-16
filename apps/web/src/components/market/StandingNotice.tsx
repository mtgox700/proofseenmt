import { accountNotices } from "@proofseen/db";
import type { Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import type { Market } from "@/lib/market";
import { AppealForm } from "./AppealForm";

type Topic = "profile" | "mission" | "company" | "organisation" | "vigilance";

interface Props {
  readonly lang: Lang;
  readonly market: Market;
  /** Which decisions this page is about: the profile page shows the profile's, the missions page the missions'… */
  readonly topics: readonly Topic[];
}

/**
 * What an operator decided about the person's own content, with the reason and a way to contest it. Read with the
 * person's own account: their profile, their companies' missions and page, never anyone else's. Renders nothing when
 * there is nothing to say.
 */
export async function StandingNotice({ lang, market, topics }: Props) {
  const standing = await accountNotices(market.db).standing(market.actor);
  const notices = standing.notices.filter((n) => topics.includes(n.target));
  const vigilance = topics.includes("vigilance") ? standing.vigilanceRejection : null;
  if (notices.length === 0 && vigilance === null) return null;
  const s = marketDictionary(lang).standing;
  return (
    <section className="panel" aria-labelledby="standing-title">
      <h2 id="standing-title">{s.noticeTitle}</h2>
      <ul className="plain-list">
        {notices.map((n) => (
          <li key={`${n.target}-${n.id}`}>
            <p>
              <strong>{s.targets[n.target]}</strong>
              {n.target === "mission" || n.target === "organisation" ? ` · ${n.label}` : null} <span className="muted small">{s.since(day(n.moderatedAt, lang))}</span>
            </p>
            <p>
              {s.reason} : {n.reason}
            </p>
          </li>
        ))}
        {vigilance === null ? null : (
          <li>
            <p>
              <strong>{s.vigilanceRejected}</strong> <span className="muted small">{s.since(day(vigilance.at, lang))}</span>
            </p>
            <p>
              {s.reason} : {vigilance.reason}
            </p>
          </li>
        )}
      </ul>
      <AppealForm s={s} id="standing-appeal" />
    </section>
  );
}
