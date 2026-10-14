import { notFound } from "next/navigation";
import { measurements, MEASUREMENT_WINDOW_DAYS, MEASUREMENTS_PER_WINDOW, visibility, type Eligibility, type MeasurementView, type WaveView } from "@proofseen/db";
import { configuredEngines, measurementsEnabled } from "@proofseen/measure";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang, type Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { VisibilityDictionary } from "@/i18n/market/visibility-fr";
import { count, day } from "@/lib/format";
import { pageMarket } from "@/lib/market";
import { requestMeasurement } from "./actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string; demande?: string }>;
}

const engineLabel = (engine: string, v: VisibilityDictionary): string => (engine in v.engines ? v.engines[engine as keyof typeof v.engines] : engine);

/** Why a measurement cannot be requested now, in the person's words; `null` when it can. */
const refusalText = (eligibility: Eligibility, v: VisibilityDictionary, lang: Lang): string | null => {
  if (eligibility.kind === "allowed") return null;
  if (eligibility.reason === "monthly_limit") return v.refusals.monthly_limit(day(eligibility.availableAt ?? new Date(), lang));
  return v.refusals[eligibility.reason];
};

function RequestPanel({ lang, v, eligibility, engines }: { readonly lang: Lang; readonly v: VisibilityDictionary; readonly eligibility: Eligibility; readonly engines: readonly string[] }) {
  const refusal = refusalText(eligibility, v, lang);
  return (
    <section className="panel" aria-labelledby="measure-request">
      <h2 id="measure-request">{v.request.title}</h2>
      <p className="muted measure">{v.request.lead(MEASUREMENTS_PER_WINDOW, MEASUREMENT_WINDOW_DAYS)}</p>
      <p className="muted measure">{engines.length === 0 ? v.noEngine : v.enginesNow(engines.map((e) => engineLabel(e, v)).join(", "))}</p>
      {refusal === null ? (
        <form action={requestMeasurement}>
          <input type="hidden" name="lang" value={lang} />
          {eligibility.kind === "allowed" ? <p className="field-hint">{v.request.remaining(eligibility.remaining)}</p> : null}
          <button type="submit" className="btn btn-primary">
            {v.request.button}
          </button>
        </form>
      ) : (
        <p className="form-error" role="status">
          {refusal}
          {eligibility.kind === "refused" && eligibility.reason === "no_proven_url" ? (
            <>
              {" "}
              <a href={`/${lang}/app/preuves`}>{v.request.prove}</a>
            </>
          ) : null}
        </p>
      )}
    </section>
  );
}

function Requests({ lang, v, rows }: { readonly lang: Lang; readonly v: VisibilityDictionary; readonly rows: readonly MeasurementView[] }) {
  const r = v.requests;
  return (
    <section className="panel" aria-labelledby="measure-requests">
      <h2 id="measure-requests">{r.title}</h2>
      {rows.length === 0 ? (
        <p className="muted">{r.empty}</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="measure-requests">
          <table className="ops">
            <thead>
              <tr>
                <th scope="col">{r.asked}</th>
                <th scope="col">{r.status}</th>
                <th scope="col">{r.engines}</th>
                <th scope="col">{r.note}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{day(row.createdAt, lang)}</th>
                  <td>
                    <span className="tag tag-quiet">{r.statuses[row.status]}</span>
                  </td>
                  <td>{row.engines.map((e) => engineLabel(e, v)).join(", ")}</td>
                  <td>{row.errorCode === null ? "" : (r.codes[row.errorCode] ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Waves({ lang, v, waves }: { readonly lang: Lang; readonly v: VisibilityDictionary; readonly waves: readonly WaveView[] }) {
  const w = v.waves;
  return (
    <section className="panel" aria-labelledby="measure-waves">
      <h2 id="measure-waves">{w.title}</h2>
      <p className="muted measure">{w.note}</p>
      {waves.length === 0 ? (
        <p className="muted">{w.empty}</p>
      ) : (
        waves.map((wave) => (
          <div key={wave.waveId} className="table-scroll" tabIndex={0} role="region" aria-label={w.measuredOn(day(wave.measuredAt, lang))}>
            <table className="ops">
              <caption>{w.measuredOn(day(wave.measuredAt, lang))}</caption>
              <thead>
                <tr>
                  <th scope="col">{w.engine}</th>
                  <th scope="col" className="num-col">{w.draws}</th>
                  <th scope="col" className="num-col">{w.retrieved}</th>
                  <th scope="col" className="num-col">{w.named}</th>
                  <th scope="col" className="num-col">{w.top5}</th>
                  <th scope="col" className="num-col">{w.cited}</th>
                </tr>
              </thead>
              <tbody>
                {wave.engines.map((result) => (
                  <tr key={result.engine}>
                    <th scope="row">{engineLabel(result.engine, v)}</th>
                    <td className="num num-col">{count(result.draws, lang)}</td>
                    <td className="num num-col">{count(result.retrieved, lang)}</td>
                    <td className="num num-col">{count(result.named, lang)}</td>
                    <td className="num num-col">{count(result.top5, lang)}</td>
                    <td className="num num-col">{count(result.cited, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  );
}

/** The freelancer's AI visibility: request a measurement, follow it, read the measured funnel per engine. */
export default async function VisibilityPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang);
  const market = await pageMarket(lang, ["freelance"]);
  if (market === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const v = m.visibility;
  const now = new Date();
  const [eligibility, requests, waves] = await Promise.all([
    measurements(market.db).eligibility(market.actor, now),
    measurements(market.db).listMine(market.actor),
    visibility(market.db).mine(market.actor),
  ]);
  const { erreur, demande } = await searchParams;

  return (
    <>
      <header className="app-head">
        <h1>{v.title}</h1>
        <p className="muted measure">{v.lead}</p>
      </header>
      {erreur === "trop" ? (
        <p className="form-error" role="alert">
          {v.request.tooMany}
        </p>
      ) : demande === "ok" ? (
        <p className="form-ok" role="status">
          {v.request.queued}
        </p>
      ) : null}
      <RequestPanel lang={lang} v={v} eligibility={eligibility} engines={measurementsEnabled(process.env) ? configuredEngines(process.env) : []} />
      <Requests lang={lang} v={v} rows={requests} />
      <Waves lang={lang} v={v} waves={waves} />
    </>
  );
}
