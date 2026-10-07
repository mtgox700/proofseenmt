import { notFound } from "next/navigation";
import { missions } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { MissionForm } from "@/components/market/MissionForm";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { currentOrganisation, pageMarket } from "@/lib/market";
import { updateMission } from "../../actions";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
  readonly searchParams: Promise<{ erreur?: string }>;
}

/** Edits a draft or an open mission without applicants; the repository refuses the rest. */
export default async function EditMissionPage({ params, searchParams }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const m = marketDictionary(lang).missions;
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={marketDictionary(lang).notConfigured} />;
  const organisation = await currentOrganisation(market);
  const mission = organisation === null ? undefined : (await missions(market.db).listForOrganisation(market.actor, organisation.id))?.find((item) => item.id === id);
  if (mission === undefined || mission.status === "closed") notFound();
  const { erreur } = await searchParams;
  const error = erreur === undefined ? null : erreur === "trop" ? m.form.errors.tooMany : m.form.errors.invalid;
  return (
    <>
      <header className="app-head">
        <h1>{m.form.editTitle}</h1>
      </header>
      <MissionForm lang={lang} m={m} action={updateMission} mission={mission} error={error} cancelHref={`/${lang}/app/missions/${mission.id}`} />
    </>
  );
}
