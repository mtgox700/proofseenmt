import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanList } from "@/components/workspace/PlanList";
import { SourceMap } from "@/components/workspace/SourceMap";
import { loadDemoWorkspace } from "@/data/demo";
import { dictionary, isLang } from "@/i18n";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dictionary(lang).report.title } : {};
}

export default async function ReportPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const workspace = await loadDemoWorkspace();
  if (workspace === null) notFound();
  const { report } = workspace;
  const targets = report.jobDescriptions.filter((jd) => jd.role === "target").length;
  const controls = report.jobDescriptions.length - targets;

  return (
    <>
      <header>
        <h1>{t.report.title}</h1>
        <p className="muted measure">{t.report.lead}</p>
        {t.ws.reportLanguage === "" ? null : <p className="ws-note">{t.ws.reportLanguage}</p>}
      </header>

      <section className="ws-block" id="plan" aria-labelledby="plan-title">
        <h2 id="plan-title">{t.report.planTitle}</h2>
        <PlanList t={t} plan={report.plan} />
      </section>

      {report.plan.notActionable.length === 0 ? null : (
        <section className="ws-block" aria-labelledby="na-title">
          <h2 id="na-title">{t.report.notActionableTitle}</h2>
          <ul className="bullets" lang="fr">
            {report.plan.notActionable.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="ws-block" aria-labelledby="sources-title">
        <h2 id="sources-title">{t.report.sourcesTitle}</h2>
        <SourceMap lang={lang} t={t} counts={workspace.sourceCounts} />
      </section>

      <section className="ws-block" aria-labelledby="jobs-title">
        <h2 id="jobs-title">{t.report.jobsTitle}</h2>
        <p className="ws-note">{t.report.jobsLead}</p>
        <details className="jobs">
          <summary>
            <span className="num">{t.report.jobsSummary(targets, controls)}</span>
          </summary>
          <div className="table-scroll" tabIndex={0} role="region" aria-label={t.report.jobsTitle}>
            <table className="jobs-table">
              <thead>
                <tr>
                  <th scope="col">{t.report.jobCols.label}</th>
                  <th scope="col">{t.report.jobCols.origin}</th>
                  <th scope="col">{t.report.jobCols.role}</th>
                </tr>
              </thead>
              <tbody>
                {report.jobDescriptions.map((jd) => (
                  <tr key={jd.id}>
                    <th scope="row" lang="fr">
                      {jd.label}
                    </th>
                    <td>{t.report.origin[jd.provenance]}</td>
                    <td>
                      <span className={jd.role === "control" ? "tag tag-quiet" : "tag tag-proof"}>{t.report.role[jd.role]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="ws-block" aria-labelledby="limits-title">
        <h2 id="limits-title">{t.report.limitsTitle}</h2>
        <ul className="bullets">
          {t.report.limits.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {report.caveats.map((line) => (
            <li key={line} lang="fr">
              {line}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
