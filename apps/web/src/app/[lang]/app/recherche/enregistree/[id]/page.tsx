import { notFound, redirect } from "next/navigation";
import { savedSearches } from "@proofseen/db";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { searchHref, searchQuery } from "@/lib/freelancer-search";
import { pageMarket } from "@/lib/market";

/** Depends on who is signed in: rendered per request, never frozen at build. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; id: string }>;
}

/**
 * A saved search opened from its alert e-mail: the search of one of the person's companies, replayed from its canonical
 * address. Any other id, or a search of another company, answers as absent.
 */
export default async function SavedSearchPage({ params }: PageProps) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const market = await pageMarket(lang, ["company"]);
  if (market === "unconfigured") return <MarketUnavailable text={marketDictionary(lang).notConfigured} />;
  const query = await savedSearches(market.db).query(market.actor, id);
  if (query === null) redirect(searchHref(lang, searchQuery(new URLSearchParams()), { enregistree: "absent" }));
  redirect(searchHref(lang, searchQuery(new URLSearchParams(query))));
}
