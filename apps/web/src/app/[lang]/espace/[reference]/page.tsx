import { checkAccess, MIN_SECRET_LENGTH } from "@proofseen/access";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { DossierPath } from "@/components/workspace/DossierPath";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getClientSource } from "@/data/client-source";
import { dictionary, isLang, type Dictionary } from "@/i18n";
import { date } from "@/lib/format";

interface PageProps {
  readonly params: Promise<{ lang: string; reference: string }>;
}

/** Per request, never cached: the answer depends on a private cookie and on the file as it is right now. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const ACCESS_COOKIE = "ps_access";

type Gate = { readonly kind: "closed" } | { readonly kind: "invalid" } | { readonly kind: "expired" } | { readonly kind: "ok"; readonly expiresAt: Date };

/** The secret is read here and only here; without it, no space opens (never an open door by default). */
const gate = (reference: string, token: string | undefined): Gate => {
  const secret = process.env.PROOFSEEN_ACCESS_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) return { kind: "closed" };
  if (token === undefined || token === "") return { kind: "invalid" };
  const check = checkAccess({ token, secret, now: new Date(), expected: reference });
  if (check.ok) return { kind: "ok", expiresAt: check.expiresAt };
  return check.reason === "expired" ? { kind: "expired" } : { kind: "invalid" };
};

function Shell({ lang, t, children }: { readonly lang: "fr" | "en"; readonly t: Dictionary; readonly children: React.ReactNode }) {
  return (
    <>
      <SiteHeader lang={lang} t={t} variant="app" />
      <main id="contenu" tabIndex={-1} className="wrap space">
        {children}
      </main>
      <SiteFooter lang={lang} t={t} />
    </>
  );
}

export default async function ClientSpacePage({ params }: PageProps) {
  const { lang, reference } = await params;
  if (!isLang(lang)) notFound();
  const t = dictionary(lang);
  const s = t.space;
  const access = gate(reference, (await cookies()).get(ACCESS_COOKIE)?.value);

  if (access.kind !== "ok") {
    const copy = access.kind === "closed" ? [s.closedTitle, s.closedText] : access.kind === "expired" ? [s.expiredTitle, s.expiredText] : [s.invalidTitle, s.invalidText];
    return (
      <Shell lang={lang} t={t}>
        <EmptyState title={copy[0] ?? ""} headingLevel={2}>
          <p>{copy[1]}</p>
        </EmptyState>
      </Shell>
    );
  }

  const view = await getClientSource().view(reference);
  if (view === null) {
    return (
      <Shell lang={lang} t={t}>
        <EmptyState title={s.missingTitle} headingLevel={2}>
          <p>{s.missingText}</p>
        </EmptyState>
      </Shell>
    );
  }

  const unreadable = view.action.kind === "unreadable";

  return (
    <Shell lang={lang} t={t}>
      <header className="space-head">
        <h1>{view.displayName === null ? s.helloAnon : s.hello(view.displayName)}</h1>
        <dl className="meta-strip">
          <div>
            <dt>{s.reference}</dt>
            <dd>
              <code>{view.reference}</code>
            </dd>
          </div>
          <div>
            <dt>{s.validUntil}</dt>
            <dd>{date(access.expiresAt.toISOString(), lang)}</dd>
          </div>
          {unreadable ? null : (
            <div>
              <dt>{s.steps.possession.title}</dt>
              <dd className="num">{s.urls(view.facts.verifiedUrls, view.facts.ownedUrls)}</dd>
            </div>
          )}
        </dl>
      </header>

      {unreadable ? (
        <EmptyState title={s.unreadableTitle} headingLevel={2}>
          <p>{s.unreadableText}</p>
        </EmptyState>
      ) : null}

      <section className="ws-block" aria-labelledby="path-title">
        <h2 id="path-title">{view.complete ? s.allDone : s.pathTitle}</h2>
        <DossierPath t={s} action={view.action} />
      </section>

      {view.reportFiles.length === 0 ? null : (
        <section className="ws-block" aria-labelledby="reports-title">
          <h2 id="reports-title">{s.reportsTitle}</h2>
          <ul className="bullets">
            {view.reportFiles.map((file) => (
              <li key={file}>
                <code>{file}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
