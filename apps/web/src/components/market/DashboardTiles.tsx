import type { CompanyDashboard, FreelanceDashboard } from "@proofseen/db";
import type { Lang } from "@/i18n";
import type { AccountDictionary } from "@/i18n/market/account-fr";
import { money } from "@/lib/format";

type Board = AccountDictionary["dashboard"];

const n = (value: number | undefined): number => value ?? 0;

function Tile({ label, value, foot, index }: { readonly label: string; readonly value: string; readonly foot: string | null; readonly index: number }) {
  return (
    <div className="tile" style={{ "--i": index } as React.CSSProperties}>
      <span className="tile-label">{label}</span>
      <b className="tile-value num">{value}</b>
      {foot === null ? null : <span className="tile-foot muted">{foot}</span>}
    </div>
  );
}

function Section({ b, children }: { readonly b: Board; readonly children: React.ReactNode }) {
  return (
    <section className="ws-block" aria-labelledby="board-title">
      <h2 id="board-title">{b.title}</h2>
      <p className="muted small">{b.lead}</p>
      <div className="tiles">{children}</div>
    </section>
  );
}

/** The freelancer's figures: applications, contracts, money actually paid out or held, invoices, reviews. */
export function FreelanceTiles({ lang, b, board }: { readonly lang: Lang; readonly b: Board; readonly board: FreelanceDashboard }) {
  const applications = Object.values(board.applications).reduce((sum, count) => sum + (count ?? 0), 0);
  const ongoing = n(board.applications.submitted) + n(board.applications.shortlisted);
  const contracts = Object.values(board.contracts).reduce((sum, count) => sum + (count ?? 0), 0);
  return (
    <Section b={b}>
      <Tile index={0} label={b.applications} value={String(applications)} foot={b.applicationsFoot(ongoing)} />
      <Tile index={1} label={b.contracts} value={String(contracts)} foot={b.contractsFoot(n(board.contracts.active), n(board.contracts.pending_signatures))} />
      <Tile
        index={2}
        label={b.received}
        value={board.money === null ? "—" : money(board.money.receivedCents, board.money.currency, lang)}
        foot={board.money === null ? b.noMoney : `${money(board.money.heldCents, board.money.currency, lang)} ${b.held}`}
      />
      <Tile index={3} label={b.invoices} value={String(board.invoices)} foot={null} />
      <Tile index={4} label={b.reviews} value={String(board.reviews)} foot={null} />
    </Section>
  );
}

/** The company's figures: missions, applications to review, contracts, money paid or held, invoices. */
export function CompanyTiles({ lang, b, board }: { readonly lang: Lang; readonly b: Board; readonly board: CompanyDashboard }) {
  const missions = Object.values(board.missions).reduce((sum, count) => sum + (count ?? 0), 0);
  const contracts = Object.values(board.contracts).reduce((sum, count) => sum + (count ?? 0), 0);
  return (
    <Section b={b}>
      <Tile index={0} label={b.missions} value={String(missions)} foot={b.missionsFoot(n(board.missions.open), n(board.missions.draft))} />
      <Tile index={1} label={b.openApplications} value={String(board.openApplications)} foot={null} />
      <Tile index={2} label={b.contracts} value={String(contracts)} foot={b.contractsFoot(n(board.contracts.active), n(board.contracts.pending_signatures))} />
      <Tile
        index={3}
        label={b.paid}
        value={board.spend === null ? "—" : money(board.spend.paidCents, board.spend.currency, lang)}
        foot={board.spend === null ? b.noMoney : `${money(board.spend.heldCents, board.spend.currency, lang)} ${b.held}`}
      />
      <Tile index={4} label={b.invoices} value={String(board.invoices)} foot={null} />
    </Section>
  );
}
