import Link from "next/link";
import { notFound } from "next/navigation";
import { missions } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { MissionsDictionary } from "@/i18n/market/missions-fr";
import { money } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { applyToMission } from "../../actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string }>;
}

const MAX_NOTE = 5000;

const errorText = (code: string | undefined, m: MissionsDictionary): string | null => {
  if (code === undefined) return null;
  const errors: Readonly<Record<string, string>> = { ...m.apply.errors, trop: m.apply.errors.tooMany, invalide: m.apply.errors.invalid, entreprise: m.apply.companyNotAllowed };
  return errors[code] ?? m.apply.errors.invalid;
};

/** A freelancer applies to an open mission, reached from the mission's public page. */
export default async function ApplyPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang).missions;
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={marketDictionary(lang).notConfigured} />;
  const mission = await missions(market.db).findPublic(id);
  if (mission === null) notFound();
  const { erreur } = await searchParams;
  const error = errorText(erreur, m);
  const rate = m.apply.rate(
    mission.dailyRateMinCents === null ? null : money(mission.dailyRateMinCents, mission.currency, lang),
    mission.dailyRateMaxCents === null ? null : money(mission.dailyRateMaxCents, mission.currency, lang),
  );
  const needsProfile = erreur === "no_profile" || erreur === "profile_private";

  return (
    <>
      <p>
        <Link href={`/${lang}/missions/${mission.id}`}>← {mission.title}</Link>
      </p>
      <header className="app-head">
        <h1>
          {m.apply.title} · {mission.title}
        </h1>
        <p className="muted small">
          {mission.organisationName} · {m.workModes[mission.workMode]}
          {mission.city === null ? null : ` · ${mission.city}`}
          {mission.durationMonths === null ? null : ` · ${m.apply.months(mission.durationMonths)}`}
          {rate === null ? null : ` · ${rate}`}
        </p>
      </header>

      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
          {needsProfile ? (
            <>
              {" "}
              <Link href={`/${lang}/app/profil`}>{m.apply.profileLink}</Link>
            </>
          ) : null}
        </p>
      )}

      {market.person.role === "freelance" ? (
        <form action={applyToMission} className="panel">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="missionId" value={mission.id} />
          <p className="muted measure">{m.apply.lead}</p>
          <div className="field">
            <label htmlFor="coverNote">{m.apply.note}</label>
            <textarea id="coverNote" name="coverNote" required maxLength={MAX_NOTE} rows={7} aria-describedby="note-hint" />
            <p id="note-hint" className="field-hint">
              {m.apply.noteHint}
            </p>
          </div>
          <button type="submit" className="btn btn-primary">
            {m.apply.send}
          </button>
        </form>
      ) : (
        <p className="muted">{m.apply.companyNotAllowed}</p>
      )}
    </>
  );
}
