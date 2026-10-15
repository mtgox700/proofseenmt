import { notFound } from "next/navigation";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { Outcome } from "@/components/operator/OperatorParts";
import { UserSearch } from "@/components/operator/UserSearch";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { operatorPage } from "@/lib/operator";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ etat?: string }>;
}

/** Find an account by e-mail address or profile reference. */
export default async function UsersPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const context = await operatorPage();
  const m = marketDictionary(lang);
  if (context === "unconfigured") return <MarketUnavailable text={m.notConfigured} />;
  const o = m.operator;
  const { etat } = await searchParams;

  return (
    <>
      <header className="app-head">
        <h1>{o.users.title}</h1>
        <p className="muted measure">{o.users.lead}</p>
      </header>
      <Outcome flag={etat} o={o} />
      <UserSearch lang={lang} u={o.users} tooMany={o.common.tooMany} />
    </>
  );
}
