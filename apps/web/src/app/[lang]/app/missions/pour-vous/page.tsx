import Link from "next/link";
import { notFound } from "next/navigation";
import { matching, type MatchCriterion } from "@proofseen/db";
import { EmptyState } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { ConsideredNote, MissionSuggestionList } from "@/components/market/MissionsForYou";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { MatchingDictionary } from "@/i18n/market/matching-fr";
import { FOR_YOU_CRITERIA, matchOptionsFromQuery, queryOf } from "@/lib/matching";
import { pageMarket } from "@/lib/market";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

/** Suggestions shown on the full page. */
const PAGE_LIMIT = 30;

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function CriteriaBoxes({ m, name, legend, checked, hint }: { readonly m: MatchingDictionary; readonly name: "c" | "r"; readonly legend: string; readonly checked: ReadonlySet<MatchCriterion>; readonly hint?: string }) {
  return (
    <fieldset className="fieldset" aria-describedby={hint === undefined ? undefined : `for-you-${name}-hint`}>
      <legend>{legend}</legend>
      {hint === undefined ? null : (
        <p id={`for-you-${name}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {FOR_YOU_CRITERIA.map((criterion) => (
        <div key={criterion} className="field field-inline">
          <input id={`for-you-${name}-${criterion}`} name={name} value={criterion} type="checkbox" defaultChecked={checked.has(criterion)} />
          <label htmlFor={`for-you-${name}-${criterion}`}>{m.criteria[criterion]}</label>
        </div>
      ))}
    </fieldset>
  );
}

function CriteriaForm({ lang, m, counted, required }: { readonly lang: Lang; readonly m: MatchingDictionary; readonly counted: ReadonlySet<MatchCriterion>; readonly required: ReadonlySet<MatchCriterion> }) {
  const f = m.filters;
  return (
    <form className="filters" method="get" action={`/${lang}/app/missions/pour-vous`} aria-label={f.title}>
      <input type="hidden" name="f" value="1" />
      <CriteriaBoxes m={m} name="c" legend={f.counted} checked={counted} />
      <CriteriaBoxes m={m} name="r" legend={f.required} checked={required} hint={f.requiredHint} />
      <div className="filters-actions">
        <button type="submit" className="btn btn-primary">
          {f.apply}
        </button>
        <Link className="btn btn-quiet" href={`/${lang}/app/missions/pour-vous`}>
          {f.reset}
        </Link>
      </div>
    </form>
  );
}

/** "Missions for you": open missions matched on facts, each with its reasons; the freelancer picks the criteria. */
export default async function MissionsForYouPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const m = dict.matching;
  const market = await pageMarket(lang, ["freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const options = matchOptionsFromQuery(queryOf(await searchParams), FOR_YOU_CRITERIA, PAGE_LIMIT);
  const suggestions = await matching(market.db).missionsForProfile(market.actor, options);
  const counted = new Set<MatchCriterion>(options.counted ?? FOR_YOU_CRITERIA);
  const required = new Set<MatchCriterion>(options.required ?? []);

  return (
    <>
      <p>
        <Link href={`/${lang}/app/missions`}>← {dict.missions.mine.title}</Link>
      </p>
      <header className="app-head">
        <h1>{m.forYou.title}</h1>
        <p className="muted measure">{m.forYou.lead}</p>
      </header>
      <CriteriaForm lang={lang} m={m} counted={counted} required={required} />
      {suggestions === null ? (
        <EmptyState title={m.forYou.title} headingLevel={2}>
          <p>{m.forYou.noProfile}</p>
          <p className="empty-actions">
            <Link className="btn btn-primary" href={`/${lang}/app/profil`}>
              {dict.profile.homeCreate}
            </Link>
          </p>
        </EmptyState>
      ) : suggestions.items.length === 0 ? (
        <EmptyState title={m.forYou.empty} headingLevel={2}>
          <ConsideredNote lang={lang} suggestions={suggestions} />
        </EmptyState>
      ) : (
        <section className="ws-block" aria-labelledby="for-you-list">
          <h2 id="for-you-list" className="sr-only">
            {m.forYou.title}
          </h2>
          <p className="muted small">{m.forYou.rule}</p>
          <ConsideredNote lang={lang} suggestions={suggestions} />
          <MissionSuggestionList lang={lang} suggestions={suggestions} />
        </section>
      )}
    </>
  );
}
