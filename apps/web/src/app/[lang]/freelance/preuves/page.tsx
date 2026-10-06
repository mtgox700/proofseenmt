import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dictionary, isLang } from "@/i18n";
import { InView } from "@/components/motion/InView";
import { ProgressRing } from "@/components/workspace/ProgressRing";
import { loadDemoWorkspace } from "@/data/demo";
import { date } from "@/lib/format";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

const SURFACE_KEYS = ["readableWithoutJs", "robotsTxt", "sitemap", "structuredData"] as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { title: dictionary(lang).proofs.title } : {};
}

export default async function ProofsPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const workspace = await loadDemoWorkspace();
  if (workspace === null) notFound();
  const verified = workspace.possession.filter((proof) => proof.verifiedAt !== null);
  const waiting = workspace.possession.filter((proof) => proof.verifiedAt === null);
  const missing = SURFACE_KEYS.filter((key) => !workspace.surface[key]).length;

  return (
    <>
      <header>
        <h1>{t.proofs.title}</h1>
        <InView className="rings">
          <ProgressRing done={verified.length} total={workspace.possession.length} label={t.proofs.possessionTitle} tone="proof" />
          <ProgressRing done={SURFACE_KEYS.length - missing} total={SURFACE_KEYS.length} label={t.proofs.surfaceTitle} tone="signal" />
        </InView>
      </header>

      <section className="ws-block" aria-labelledby="possession-title">
        <h2 id="possession-title">{t.proofs.possessionTitle}</h2>
        <p className="ws-note">{t.proofs.possessionLead}</p>
        <ul className="checklist">
          {[...waiting, ...verified].map((proof) => (
            <li key={`${proof.host}-${proof.method}`} data-state={proof.verifiedAt === null ? "waiting" : "done"}>
              <span className={proof.verifiedAt === null ? "tag tag-signal" : "tag tag-proof"}>
                {proof.verifiedAt === null ? t.proofs.waiting : t.proofs.done}
              </span>
              <div>
                <p>
                  <code className="checklist-host">{proof.host}</code>
                  {proof.verifiedAt === null ? null : <span className="muted"> {t.proofs.verifiedOn(date(proof.verifiedAt, lang))}</span>}
                </p>
                <p className="muted small">{t.proofs.methods[proof.method] ?? proof.method}</p>
              </div>
            </li>
          ))}
        </ul>
        {waiting.length === 0 ? <p className="ws-note">{t.proofs.noneWaiting}</p> : null}
      </section>

      <section className="ws-block" aria-labelledby="surface-title">
        <h2 id="surface-title">{t.proofs.surfaceTitle}</h2>
        <p className="ws-note">{t.proofs.surfaceLead}</p>
        <p className="num">{t.proofs.summary(missing, SURFACE_KEYS.length)}</p>
        <ul className="checklist">
          {SURFACE_KEYS.map((key) => {
            const ok = workspace.surface[key];
            return (
              <li key={key} data-state={ok ? "done" : "waiting"}>
                <span className={ok ? "tag tag-proof" : "tag tag-signal"}>{ok ? t.proofs.inPlace : t.proofs.toDo}</span>
                <div>
                  <p>{t.proofs.surfaceItems[key]}</p>
                </div>
              </li>
            );
          })}
        </ul>
        {workspace.surface.verifiedPlatforms.length === 0 ? null : (
          <p className="ws-note">
            {t.proofs.platformsTitle}{" "}
            {workspace.surface.verifiedPlatforms.map((domain, i) => (
              <span key={domain}>
                {i > 0 ? ", " : ""}
                <code>{domain}</code>
              </span>
            ))}
          </p>
        )}
      </section>
    </>
  );
}
