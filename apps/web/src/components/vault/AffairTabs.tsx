import "@/styles/vault.css";
import Link from "next/link";
import type { Lang } from "@/i18n/types";
import { vaultText } from "@/lib/vault/dictionary";

/*
 * The tabs of an affair, « L'affaire » and « Documents (n) », and those of the section Contracts, « Contrats » and
 * « Documents » (storyboard L1.6, §1.2). Links, never a role="tablist" (which needs a script): the open one is
 * aria-current="page", with a 2 px rule of the aura under it; 48 px targets. When the vault is closed the tabs are not
 * drawn at all: there is nothing behind them yet.
 */

interface Tab {
  readonly href: string;
  readonly label: string;
  readonly current: boolean;
}

function Tabs({ label, tabs }: { readonly label: string; readonly tabs: readonly Tab[] }) {
  return (
    <nav className="vault-tabs" aria-label={label}>
      <ul>
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link href={tab.href} aria-current={tab.current ? "page" : undefined}>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface AffairTabsProps {
  readonly lang: Lang;
  readonly contractId: string;
  readonly current: "affair" | "documents";
  /** How many documents the affair has; null when they could not be counted (the tab then says « Documents »). */
  readonly count: number | null;
  readonly open: boolean;
}

export function AffairTabs({ lang, contractId, current, count, open }: AffairTabsProps) {
  if (!open) return null;
  const t = vaultText(lang).tabs;
  const base = `/${lang}/app/contrats/${contractId}`;
  return (
    <Tabs
      label={t.affairLabel}
      tabs={[
        { href: base, label: t.affair, current: current === "affair" },
        { href: `${base}/documents`, label: count === null ? t.allDocuments : t.documents(count), current: current === "documents" },
      ]}
    />
  );
}

export function SectionTabs({ lang, current, open }: { readonly lang: Lang; readonly current: "contracts" | "documents"; readonly open: boolean }) {
  if (!open) return null;
  const t = vaultText(lang).tabs;
  return (
    <Tabs
      label={t.sectionLabel}
      tabs={[
        { href: `/${lang}/app/contrats`, label: t.contracts, current: current === "contracts" },
        { href: `/${lang}/app/documents`, label: t.allDocuments, current: current === "documents" },
      ]}
    />
  );
}
