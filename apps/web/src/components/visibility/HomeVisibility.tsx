import { visibility, type ProfileFacts } from "@proofseen/db";
import { checklistFor } from "@/data/profile-checklist";
import type { Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { Market } from "@/lib/market";
import { latestCitations } from "@/lib/visibility-view";
import { ChecklistSummary } from "./ProfileChecklist";
import { VisibilityTile } from "./VisibilityTile";

/** The freelancer's home block: what the engines cited at the latest measurement, and how many profile facts are missing. */
export async function HomeVisibility({ lang, market, profile }: { readonly lang: Lang; readonly market: Market; readonly profile: ProfileFacts | null }) {
  const v = marketDictionary(lang).visibility;
  const [waves, checklist] = await Promise.all([visibility(market.db).mine(market.actor, 1), checklistFor(market, lang, profile, new Date())]);
  return (
    <section className="ws-block" aria-labelledby="home-visibility">
      <h2 id="home-visibility">{v.title}</h2>
      <div className="tiles">
        <VisibilityTile lang={lang} v={v} latest={latestCitations(waves)} />
        <ChecklistSummary lang={lang} c={v.checklist} checklist={checklist} />
      </div>
    </section>
  );
}
