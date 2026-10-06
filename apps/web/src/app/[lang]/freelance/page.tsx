import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerField, type FieldPoint } from "@/components/landing/AnswerField";
import { CountUp } from "@/components/motion/CountUp";
import { InView } from "@/components/motion/InView";
import { FunnelMatrix } from "@/components/workspace/FunnelMatrix";
import { getSource } from "@/data/file-source";
import { loadDemoWorkspace } from "@/data/demo";
import { dictionary, isLang } from "@/i18n";
import { count, date, percent, range, usd } from "@/lib/format";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dictionary(lang).ws.nav.overview } : {};
}

export default async function OverviewPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const [workspace, answers] = await Promise.all([loadDemoWorkspace(), getSource().answers()]);
  if (workspace === null) notFound();
  const { report } = workspace;
  // The field shows the answers of the wave this report was built from, and only that one.
  const ownWave = answers.waveId === report.wave.id;
  const points: FieldPoint[] = ownWave ? answers.answers.map((a) => ({ ...a })) : [];
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const blocking = report.plan.blockingStage;
  const blockingQuestion = t.method.stages.find((stage) => stage.code === blocking)?.question;
  const control = report.controlRetrieval;

  return (
    <>
      <header>
        <h1>{t.overview.title}</h1>
        <dl className="meta-strip">
          <div>
            <dt>{t.overview.measuredOn}</dt>
            <dd>{date(report.wave.measuredAt, lang)}</dd>
          </div>
          <div>
            <dt>{t.overview.wave}</dt>
            <dd>
              <code>{report.wave.id}</code>
            </dd>
          </div>
          <div>
            <dt>{t.overview.answers}</dt>
            <dd>
              <CountUp display={count(report.wave.draws, lang)} to={report.wave.draws} locale={locale} />
            </dd>
          </div>
          <div>
            <dt>{t.overview.cost}</dt>
            <dd className="num">{usd(workspace.costUsd, lang)}</dd>
          </div>
          <div>
            <dt>{t.overview.digest}</dt>
            <dd>
              <code>{report.wave.manifestDigest}</code>
            </dd>
          </div>
        </dl>
      </header>

      {blocking === null ? (
        <p className="callout callout-clear">{t.overview.noBlocking}</p>
      ) : (
        <section className="callout" aria-labelledby="blocking-title">
          <p id="blocking-title" className="callout-label">
            <span className="tag tag-signal">{t.overview.blockingLabel}</span>
          </p>
          <p className="callout-stage">
            <span className="num">{blocking}</span> {blockingQuestion}
          </p>
          {blocking === "E1" && report.indexation !== null ? (
            <p className="num">
              {t.overview.indexation(report.indexation.pagesIndexed, report.indexation.pagesDeclared, date(report.indexation.checkedAt, lang))}
            </p>
          ) : null}
          <p className="muted">{t.overview.blockingHelp}</p>
          <p>
            <Link href={`/${lang}/freelance/rapport#plan`}>{t.overview.next}</Link>
          </p>
        </section>
      )}

      {points.length === 0 ? null : (
        <section className="ws-block ws-field" aria-label={t.field.title}>
          <AnswerField t={t.field} title={t.field.titleClient.replace("{n}", count(points.length, lang))} engines={answers.engines.map((engine) => t.ws.engines[engine] ?? engine)} offers={answers.offers} points={points} />
        </section>
      )}

      <section className="ws-block" aria-labelledby="funnel-title">
        <h2 id="funnel-title">{t.overview.funnelTitle}</h2>
        <p className="ws-note">{t.overview.funnelCaption}</p>
        <InView className="funnel-reveal" threshold={0.15}>
          <FunnelMatrix lang={lang} t={t} report={report} />
        </InView>
      </section>

      <section className="ws-block" aria-labelledby="control-title">
        <h2 id="control-title">{t.overview.controlTitle}</h2>
        <p className="measure">
          {control === null
            ? t.overview.controlNone
            : control.p === 0
              ? t.overview.controlZero(range(control, lang))
              : t.overview.controlSome(percent(control.p, lang), range(control, lang))}
        </p>
      </section>

      <section className="ws-block" aria-labelledby="models-title">
        <h2 id="models-title">{t.overview.modelsTitle}</h2>
        <dl className="models">
          {Object.entries(report.wave.models)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([engine, model]) => (
              <div key={engine}>
                <dt>{t.ws.engines[engine] ?? engine}</dt>
                <dd>
                  <code>{model}</code>
                </dd>
              </div>
            ))}
        </dl>
      </section>
    </>
  );
}
