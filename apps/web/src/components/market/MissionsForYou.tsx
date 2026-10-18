import Link from "next/link";
import { matching, type MatchOptions, type SuggestedMission, type Suggestions } from "@proofseen/db";
import { NextSteps } from "@/components/NextSteps";
import type { Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day, money } from "@/lib/format";
import { pageMarket, type Market } from "@/lib/market";
import { nextSteps } from "@/lib/next-steps";
import { MatchReasons } from "./MatchReasons";

const rateOf = (item: SuggestedMission, lang: Lang): string | null =>
  marketDictionary(lang).missions.apply.rate(
    item.dailyRateMinCents === null ? null : money(item.dailyRateMinCents, item.currency, lang),
    item.dailyRateMaxCents === null ? null : money(item.dailyRateMaxCents, item.currency, lang),
  );

/** The rows of "Missions for you": the mission, its facts, and why it is suggested. */
export function MissionSuggestionList({ lang, suggestions }: { readonly lang: Lang; readonly suggestions: Suggestions<SuggestedMission> }) {
  const dict = marketDictionary(lang);
  const f = dict.matching.forYou;
  return (
    <ul className="threads">
      {suggestions.items.map(({ item, matched, missing }) => (
        <li key={item.id} className="thread-row">
          <span className="thread-who">
            <Link href={`/${lang}/missions/${item.id}`}>
              <strong>{item.title}</strong>
            </Link>
            <span className="muted small"> · {item.organisationName}</span>
          </span>
          <span className="thread-date muted small">{day(item.publishedAt, lang)}</span>
          <span className="thread-last muted small">
            {dict.missions.workModes[item.workMode]}
            {item.city === null ? null : ` · ${item.city}`}
            {rateOf(item, lang) === null ? null : ` · ${rateOf(item, lang) ?? ""}`}
          </span>
          <MatchReasons lang={lang} m={dict.matching} matched={matched} missing={missing} rate="budget" />
          <span className="row-actions">
            <Link className="btn" href={`/${lang}/app/missions/${item.id}/postuler`}>
              {f.apply}
            </Link>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The count and the cap of the comparison, said plainly. */
export function ConsideredNote({ lang, suggestions }: { readonly lang: Lang; readonly suggestions: Suggestions<SuggestedMission> }) {
  const f = marketDictionary(lang).matching.forYou;
  return <p className="muted small">{suggestions.capped ? f.capped(suggestions.considered) : f.considered(suggestions.considered)}</p>;
}

/** A short "Missions for you" block (home, missions space): the first suggestions and a link to the full page. */
export async function MissionsForYou({ lang, market, options }: { readonly lang: Lang; readonly market: Market; readonly options?: MatchOptions }) {
  const f = marketDictionary(lang).matching.forYou;
  const suggestions = await matching(market.db).missionsForProfile(market.actor, options ?? { limit: 3 });
  return (
    <section className="panel" aria-labelledby="for-you-title">
      <h2 id="for-you-title">{f.title}</h2>
      {suggestions === null ? (
        <p className="muted">{f.noProfile}</p>
      ) : suggestions.items.length === 0 ? (
        <>
          <p className="muted">{f.empty}</p>
          <NextSteps n={marketDictionary(lang).nextSteps} steps={nextSteps(lang, "missions_for_you", "freelance")} />
        </>
      ) : (
        <>
          <p className="muted small">{f.rule}</p>
          <MissionSuggestionList lang={lang} suggestions={suggestions} />
        </>
      )}
      <p className="small">
        <Link href={`/${lang}/app/missions/pour-vous`}>{f.seeAll}</Link>
      </p>
    </section>
  );
}

/** The same block for a page that has no market context of its own (the freelancer home). */
export async function FreelanceMissionsForYou({ lang }: { readonly lang: Lang }) {
  const market = await pageMarket(lang, ["freelance"]);
  return market === "unconfigured" ? null : <MissionsForYou lang={lang} market={market} />;
}
