import { notFound, redirect } from "next/navigation";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { MissionForm } from "@/components/market/MissionForm";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { createMission } from "../actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<{ erreur?: string }>;
}

/** A new mission, saved as a draft: publishing is a separate, deliberate step on its page. */
export default async function NewMissionPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang).missions;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={marketDictionary(lang).notConfigured} />;
  if ((await currentOrganisation(market)) === null) redirect(`/${lang}/app`);
  const { erreur } = await searchParams;
  const error = erreur === undefined ? null : erreur === "trop" ? m.form.errors.tooMany : m.form.errors.invalid;
  return (
    <>
      <header className="app-head">
        <h1>{m.form.newTitle}</h1>
      </header>
      <MissionForm lang={lang} m={m} action={createMission} error={error} cancelHref={`/${lang}/app/missions`} />
    </>
  );
}
