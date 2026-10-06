import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { ComparisonView } from "@/components/workspace/ComparisonView";
import { loadDemoWorkspace } from "@/data/demo";
import { dictionary, isLang } from "@/i18n";
import { date } from "@/lib/format";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dictionary(lang).evolution.title } : {};
}

export default async function EvolutionPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const workspace = await loadDemoWorkspace();
  if (workspace === null) notFound();

  return (
    <>
      <header>
        <h1>{t.evolution.title}</h1>
      </header>

      {workspace.remeasures.length === 0 ? (
        <EmptyState title={t.evolution.emptyTitle}>
          <p>{t.evolution.emptyText(date(workspace.report.wave.measuredAt, lang))}</p>
        </EmptyState>
      ) : (
        workspace.remeasures.map((remeasure) => (
          <section key={remeasure.waveId} className="ws-block" aria-labelledby={`wave-${remeasure.waveId}`}>
            <h2 id={`wave-${remeasure.waveId}`}>
              <code>{workspace.report.wave.id}</code> / <code>{remeasure.waveId}</code> · {date(remeasure.measuredAt, lang)}
            </h2>
            <ComparisonView lang={lang} t={t} comparison={remeasure.comparison} />
          </section>
        ))
      )}

      <section className="ws-block" aria-labelledby="rules-title">
        <h2 id="rules-title">{t.evolution.rulesTitle}</h2>
        <dl className="rules-list">
          {t.evolution.rules.map((rule) => (
            <div key={rule.term}>
              <dt>{rule.term}</dt>
              <dd className="muted">{rule.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
