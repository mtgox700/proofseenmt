import Link from "next/link";
import { notFound } from "next/navigation";
import { missions, savedMissions } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary, type MarketDictionary } from "@/i18n/market";
import { money } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { ANSWER_FIELDS } from "@/lib/mission-form";
import { applyToMission } from "../../actions";
import { saveMission, unsaveMission } from "../../space-actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string; enregistrement?: string }>;
}

const MAX_NOTE = 5000;
const MAX_ANSWER = 2000;

const errorText = (code: string | undefined, dict: MarketDictionary): string | null => {
  if (code === undefined) return null;
  const m = dict.missions;
  const errors: Readonly<Record<string, string>> = {
    ...m.apply.errors,
    trop: m.apply.errors.tooMany,
    invalide: m.apply.errors.invalid,
    entreprise: m.apply.companyNotAllowed,
    answers_required: dict.missionsSpace.apply.answersRequired,
  };
  return errors[code] ?? m.apply.errors.invalid;
};

function SaveButton({ lang, dict, missionId, saved, notice }: { readonly lang: Lang; readonly dict: MarketDictionary; readonly missionId: string; readonly saved: boolean; readonly notice: string | undefined }) {
  const a = dict.missionsSpace.apply;
  const message = notice === "saved" || notice === "already" ? a.saved : notice === "limit" ? a.savedLimit : notice === "trop" ? dict.missions.apply.errors.tooMany : null;
  return (
    <>
      {message === null ? null : (
        <p className={notice === "saved" || notice === "already" ? "form-ok" : "form-error"} role="status">
          {message}
        </p>
      )}
      <form action={saved ? unsaveMission : saveMission}>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="missionId" value={missionId} />
        <button type="submit" className="btn btn-quiet">
          {saved ? a.unsave : a.save}
        </button>
      </form>
    </>
  );
}

/** A freelancer applies to an open mission, reached from the mission's public page; or saves it for later. */
export default async function ApplyPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const m = dict.missions;
  const s = dict.missionsSpace;
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const mission = await missions(market.db).findPublic(id);
  if (mission === null) notFound();
  const freelance = market.person.role === "freelance";
  const saved = freelance ? await savedMissions(market.db).isSaved(market.actor, mission.id) : false;
  const { erreur, enregistrement } = await searchParams;
  const error = errorText(erreur, dict);
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

      {freelance ? (
        <>
          <SaveButton lang={lang} dict={dict} missionId={mission.id} saved={saved} notice={enregistrement} />
          <form action={applyToMission} className="panel">
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="missionId" value={mission.id} />
            <p className="muted measure">{m.apply.lead}</p>
            <p className="muted measure small">{s.apply.profileAttached}</p>
            <div className="field">
              <label htmlFor="coverNote">{m.apply.note}</label>
              <textarea id="coverNote" name="coverNote" required maxLength={MAX_NOTE} rows={7} aria-describedby="note-hint" />
              <p id="note-hint" className="field-hint">
                {m.apply.noteHint}
              </p>
            </div>
            {mission.questions.length === 0 ? null : (
              <fieldset className="fieldset" aria-describedby="answers-hint">
                <legend>{s.apply.questions}</legend>
                <p id="answers-hint" className="field-hint">
                  {s.apply.answersHint}
                </p>
                {mission.questions.map((question, i) => {
                  const name = ANSWER_FIELDS[i] ?? `answer${i + 1}`;
                  return (
                    <div key={name} className="field">
                      <label htmlFor={name}>{question}</label>
                      <textarea id={name} name={name} required maxLength={MAX_ANSWER} rows={4} />
                    </div>
                  );
                })}
              </fieldset>
            )}
            <button type="submit" className="btn btn-primary">
              {m.apply.send}
            </button>
          </form>
        </>
      ) : (
        <p className="muted">{m.apply.companyNotAllowed}</p>
      )}
    </>
  );
}
