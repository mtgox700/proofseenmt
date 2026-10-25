import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { contractView, documents } from "@proofseen/db";
import { vaultOpen } from "@/app/api/documents/vault";
import { EmptyState } from "@/components/EmptyState";
import { MarketUnavailable } from "@/components/market/MarketUnavailable";
import { machineDate } from "@/components/ui/when";
import { ChangeSummary } from "@/components/vault/ChangeSummary";
import { ClauseDiff, SameClauses, type ClauseView } from "@/components/vault/ClauseDiff";
import { CompareHead } from "@/components/vault/CompareHead";
import { DiffLegend } from "@/components/vault/DiffLegend";
import { DownloadLink } from "@/components/vault/DownloadLink";
import { VersionPicker } from "@/components/vault/VersionPicker";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { logError } from "@/lib/log";
import { pageMarket } from "@/lib/market";
import { groupIdentical } from "@/lib/vault/compare";
import { vaultText } from "@/lib/vault/dictionary";
import { loadComparison } from "@/lib/vault/load-compare";
import { readCompare } from "@/lib/vault/versions";
import "@/styles/app-affaire.css";

/**
 * E5, what changed between two versions (storyboard L1.6, §4 E5): « En bref », the count and the legend, then clause by
 * clause, aligned by clause id. Lisible sans couleur, sans script; three views by a GET form. A reversed pair is sent
 * to the older one first (307), so that « added » always means « appeared in the newer one ».
 */
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ lang: string; documentId: string }>;
  readonly searchParams: Promise<{ de?: string; a?: string; vue?: string }>;
}

const VIEWS = ["texte", "cote", "complete"] as const;
type View = (typeof VIEWS)[number];

export default async function ComparePage({ params, searchParams }: PageProps) {
  const { lang, documentId } = await params;
  if (!isLang(lang)) notFound();
  const dict = marketDictionary(lang);
  const market = await pageMarket(lang);
  if (market === "unconfigured") return <MarketUnavailable text={dict.notConfigured} />;
  const t = vaultText(lang);
  const c = t.compare;
  if (!vaultOpen(process.env)) return <EmptyState title={t.states.closed.title}>{<p>{t.states.closed.body}</p>}</EmptyState>;
  const repo = documents(market.db);
  const document = await repo.find(market.actor, documentId);
  if (document === null || document.latest === null) notFound();
  const { de, a, vue } = await searchParams;
  const view: View = VIEWS.find((v) => v === vue) ?? "texte";
  const self = `/${lang}/app/documents/${document.id}`;
  const asked = readCompare(de ?? null, a ?? null, document.latest.number);
  if (asked.kind === "unknown") notFound();
  if (asked.kind === "redirect") redirect(`${self}/comparer?de=${asked.from}&a=${asked.to}${view === "texte" ? "" : `&vue=${view}`}`);
  const numbers = document.versions.map((v) => v.number);
  const back = (
    <p>
      <Link className="back-link" href={self}>
        <span aria-hidden="true">←&nbsp;</span>
        {t.card.types[document.type]}
      </Link>
    </p>
  );
  if (asked.kind === "single" || asked.kind === "same") {
    return (
      <div className="vault-page vault-compare">
        {back}
        <EmptyState title={asked.kind === "single" ? c.single : c.same}>
          {asked.kind === "same" ? <VersionPicker lang={lang} id="pick" documentId={document.id} numbers={numbers} from={Math.max(1, document.latest.number - 1)} to={document.latest.number} /> : undefined}
        </EmptyState>
      </div>
    );
  }
  const loaded = await loadComparison({ repo, actor: market.actor, document, from: asked.from, to: asked.to, lang, t });
  const older = document.versions.find((v) => v.number === asked.from);
  const newer = document.versions.find((v) => v.number === asked.to);
  if (older === undefined || newer === undefined) notFound();
  if (loaded.kind === "unavailable") {
    logError(`vault: comparison unavailable (${loaded.code})`);
    return (
      <div className="vault-page vault-compare">
        {back}
        <CompareHead lang={lang} type={document.type} older={older} newer={newer} />
        <div className="vault-status">
          <p>{c.unavailable}</p>
          <ul className="vault-actions">
            {[older, newer].map((version) => (
              <li key={version.number}>
                <DownloadLink documentId={document.id} type={document.type} number={version.number} label={c.downloadVersion(version.number)} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  // The person's role in the contract's words: the company is the Client, the freelancer the Provider.
  const contract = document.affair.kind === "contract" ? await contractView(market.db).find(market.actor, document.affair.id) : null;
  const role = contract?.side === "company" ? "client" : "provider";
  const docText = vaultText(document.lang);
  const v: ClauseView = { lang, article: docText.document.article, addedOn: machineDate(newer.createdAt, "minute"), removedOn: machineDate(older.createdAt, "minute"), view };
  const changes = loaded.comparison.clauses.filter((diff) => diff.kind !== "identical");
  const nextOf = (id: string) => {
    const index = changes.findIndex((diff) => diff.clause.id === id);
    const next = changes[index + 1];
    return next === undefined ? null : { id: next.clause.id, number: next.clause.number, heading: next.clause.heading };
  };
  const groupsOfClauses = groupIdentical(loaded.comparison.clauses);

  return (
    <div className="vault-page vault-compare">
      {back}
      <CompareHead lang={lang} type={document.type} older={older} newer={newer} />
      {loaded.comparison.counts.total === 0 && loaded.explanation.changes.length === 0 ? (
        <p className="vault-status">{c.nothing(older.number, newer.number)}</p>
      ) : (
        <>
          <ChangeSummary lang={lang} changes={loaded.explanation.changes} attributionOf={loaded.attributionOf} role={role} />
          <DiffLegend lang={lang} clauses={loaded.comparison.clauses} />
        </>
      )}
      <form className="vault-views" method="get" action={`${self}/comparer`}>
        <input type="hidden" name="de" value={older.number} />
        <input type="hidden" name="a" value={newer.number} />
        <label htmlFor="vue">
          {c.views.label}
          <select id="vue" name="vue" defaultValue={view}>
            <option value="texte">{c.views.text}</option>
            <option value="cote">{c.views.side}</option>
            <option value="complete">{c.views.full}</option>
          </select>
        </label>
        <button type="submit" className="btn">
          {c.views.submit}
        </button>
      </form>
      <section className="vault-diffs" aria-labelledby="par-clause">
        <h2 id="par-clause">
          {c.byClause}
        </h2>
        {groupsOfClauses.map((group, index) =>
          group.kind === "identical" ? (
            <SameClauses key={`same-${index}`} v={v} group={group} />
          ) : (
            <ClauseDiff key={group.diff.clause.id} v={v} diff={group.diff} byModel={loaded.explanation.byModel.has(group.diff.clause.id)} next={nextOf(group.diff.clause.id)} />
          ),
        )}
      </section>
    </div>
  );
}
