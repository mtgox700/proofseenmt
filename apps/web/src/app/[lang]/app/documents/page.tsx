import { notFound } from "next/navigation";
import { contractView, DOCUMENT_TYPES, documents, type DocumentSummary, type MinePage } from "@proofseen/db";
import { vaultOpen } from "@/app/api/documents/vault";
import { EmptyState } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { param, type SearchParams } from "@/components/ui/url";
import { AllDocumentsTable, SORT_KEY } from "@/components/vault/AllDocumentsTable";
import { SectionTabs } from "@/components/vault/AffairTabs";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { logError } from "@/lib/log";
import { pageMarket } from "@/lib/market";
import { vaultText } from "@/lib/vault/dictionary";

/** E6, « Tous mes documents » (storyboard L1.6, §4 E6): the documents of every affair of the person, filtered by the address. */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string }>;
  readonly searchParams: Promise<SearchParams>;
}

const PAGE = /^[1-9][0-9]{0,3}$/;

export default async function AllDocumentsPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const t = vaultText(lang);
  const open = vaultOpen(process.env);
  const query = await searchParams;
  const path = `/${lang}/app/documents`;
  const head = (
    <>
      <SectionTabs lang={lang} current="documents" open={open} />
      <header className="app-head">
        <h1>{t.all.title}</h1>
        <p className="vault-lead">{t.all.lead}</p>
      </header>
    </>
  );
  if (!open)
    return (
      <div className="vault-page">
        {head}
        <EmptyState title={t.states.closed.title}>{<p>{t.states.closed.body}</p>}</EmptyState>
      </div>
    );
  const typeParam = param(query, "sorte");
  const type = DOCUMENT_TYPES.find((value) => value === typeParam);
  const byParam = param(query, "par");
  const by = byParam === "vous" ? "you" : byParam === "autre" ? "other" : undefined;
  const pageParam = param(query, "page");
  const page = pageParam !== null && PAGE.test(pageParam) ? Number(pageParam) : 1;
  const ascending = param(query, "tri") === SORT_KEY;
  const repo = documents(market.db);
  let found: MinePage | null = null;
  let all: readonly DocumentSummary[] = [];
  let failed = false;
  try {
    [found, all] = await Promise.all([
      repo.listMine(market.actor, { ...(type === undefined ? {} : { type }), ...(by === undefined ? {} : { by }), sort: ascending ? "oldest" : "recent", page }),
      repo.listMine(market.actor, {}).then((first) => first?.items ?? []),
    ]);
  } catch (error) {
    logError("vault: all documents could not be read", error);
    failed = true;
  }
  if (!failed && found === null) notFound();
  // The kinds offered are those the person has (first page, unfiltered), and the one chosen.
  const types = DOCUMENT_TYPES.filter((value) => value === type || all.some((doc) => doc.type === value));
  const names = new Map((await contractView(market.db).list(market.actor)).map((contract) => [contract.id, contract.counterpart]));
  return (
    <div className="vault-page">
      {head}
      <AllDocumentsTable
        lang={lang}
        path={path}
        params={query}
        items={found?.items ?? []}
        affairName={(doc) => (doc.affair.kind === "contract" ? (names.get(doc.affair.id) ?? null) : null)}
        types={types}
        sort={{ key: SORT_KEY, direction: ascending ? "ascending" : "descending" }}
        total={found?.total ?? 0}
        page={found?.page ?? 1}
        pages={found?.pages ?? 1}
        pageSize={found?.pageSize ?? 50}
        filtered={type !== undefined || by !== undefined}
        error={failed}
      />
    </div>
  );
}
