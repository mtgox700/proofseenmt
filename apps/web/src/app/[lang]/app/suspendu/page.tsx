import { notFound, redirect } from "next/navigation";
import { getDb } from "@proofseen/db";
import { accountUsers } from "@/data/accounts";
import { AppealForm } from "@/components/market/AppealForm";
import { hasDatabase } from "@/data/intake-sink";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { day } from "@/lib/format";
import { session } from "@/lib/session";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
}

/**
 * Where a suspended account lands (C19): the reason, the date, and a way to contest. It reads the session itself and
 * never goes through the market context, which would send it back here.
 */
export default async function SuspendedPage({ params }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const state = await session();
  if (state.kind === "signed-out") redirect(`/${lang}/connexion`);
  if (state.kind !== "signed-in" || !hasDatabase() || state.person.email === "") redirect(`/${lang}/app`);
  const { suspension } = await accountUsers(getDb()).ensure({ clerkId: state.person.id, email: state.person.email, displayName: state.person.name });
  if (suspension === null) redirect(`/${lang}/app`);
  const s = marketDictionary(lang).standing;

  return (
    <>
      <header className="app-head">
        <h1>{s.suspendedTitle}</h1>
        <p className="muted measure">{s.suspendedLead}</p>
      </header>
      <section className="panel" aria-labelledby="suspension-reason">
        <h2 id="suspension-reason">{s.reason}</h2>
        <p>{suspension.reason}</p>
        <p className="muted small">{s.since(day(suspension.at, lang))}</p>
        <AppealForm s={s} id="suspension-appeal" />
      </section>
      <p>
        {/* A suspension never takes away the person's GDPR rights: their own export stays one click away. */}
        <a href="/api/me" download>
          {s.exportData}
        </a>
      </p>
    </>
  );
}
