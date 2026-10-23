import type { LiveCounts } from "@proofseen/db";
import type { Lang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import type { NavLink, NavSection } from "@/lib/workspace-nav";
import type { Role } from "@/lib/roles";

/*
 * The sections of each role, in the order of a file (CONNECTED_PLAN §2.5). What a role sees here is exactly what the
 * server lets it open: every address below is guarded by `pageMarket` or `requirePerson` with this role allowed
 * (held by apps/web/test/workspace-nav.test.ts, which reads the guard of each page). No role, no menu: the person
 * is on the way to the role choice and can open nothing else yet.
 */
export const sectionsFor = (lang: Lang, role: Role | null, counts: LiveCounts | null): readonly NavSection[] => {
  if (role === null) return [];
  const market = marketDictionary(lang);
  const d = market.workspaceNav;
  const base = `/${lang}/app`;
  const link = (path: string, label: string): NavLink => ({ href: `${base}${path}`, label });
  const section = (label: string, tabs: readonly NavLink[]): NavSection => {
    const [first] = tabs;
    if (first === undefined) throw new Error(`section ${label} sans page`);
    return { href: first.href, label, tabs: tabs.length > 1 ? tabs : [], ...(tabs.length > 1 ? { tabsLabel: d.tabsLabel(label) } : {}) };
  };
  const home: NavSection = { href: base, label: d.sections.home, tabs: [], exact: true };
  const messages: NavSection = {
    href: `${base}/messages`,
    label: d.sections.messages,
    tabs: [],
    live: { which: "messages", initial: counts?.messages ?? 0, label: market.live.unreadLabel },
  };
  const contracts = section(d.sections.contracts, [link("/contrats", d.sections.contracts)]);
  const network = section(d.sections.network, [link("/fil", d.tabs.feed), link("/entreprises", d.tabs.companies), link("/invitations", d.tabs.invitations), link("/abonnements", d.tabs.following)]);
  const account = section(d.sections.account, [link("/alertes", d.tabs.alerts), link("/reglages", d.tabs.settings)]);

  if (role === "operator") {
    return [
      home,
      section(d.sections.backOffice, [link("/operateur", d.sections.backOffice)]),
      messages,
      section(d.sections.articles, [link("/articles", d.sections.articles)]),
      { href: `/${lang}/freelances`, label: d.sections.directory, tabs: [] },
    ];
  }
  if (role === "company") {
    return [
      home,
      section(d.sections.search, [link("/recherche", d.tabs.search), link("/listes", d.tabs.lists)]),
      section(d.sections.missions, [link("/missions", d.sections.missions)]),
      section(d.sections.confirmations, [link("/confirmations", d.sections.confirmations)]),
      messages,
      contracts,
      section(d.sections.money, [link("/factures", d.tabs.invoices), link("/facturation", d.tabs.billing)]),
      section(d.sections.team, [link("/equipe", d.sections.team)]),
      network,
      account,
    ];
  }
  return [
    home,
    section(d.sections.profile, [link("/profil", d.sections.profile)]),
    section(d.sections.proofs, [link("/preuves", d.sections.proofs)]),
    section(d.sections.visibility, [link("/visibilite", d.sections.visibility)]),
    section(d.sections.missions, [
      link("/missions", d.tabs.applications),
      link("/missions/pour-vous", d.tabs.forYou),
      link("/missions/enregistrees", d.tabs.saved),
      // The public board, as the former menu had it: the only tab that leaves the space.
      { href: `/${lang}/missions`, label: d.tabs.board },
    ]),
    messages,
    contracts,
    section(d.sections.money, [link("/factures", d.tabs.invoices), link("/facturation", d.tabs.billingAndPayout)]),
    network,
    account,
  ];
};
