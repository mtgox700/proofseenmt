import "@/styles/operator.css";
import { notFound } from "next/navigation";
import { OperatorNav } from "@/components/operator/OperatorParts";
import { isLang } from "@/i18n";
import { marketDictionary } from "@/i18n/market";
import { operatorOnly } from "@/lib/operator-access";
import { session } from "@/lib/session";

interface LayoutProps {
  readonly children: React.ReactNode;
  readonly params: Promise<{ lang: string }>;
}

/** Rendered per request: who may see it depends on the session. */
export const dynamic = "force-dynamic";

/**
 * The back-office frame. It checks the role itself before drawing anything: a non-operator must not even see the
 * section links around the 404. Each page and each action checks again on its own.
 */
export default async function OperatorLayout({ children, params }: LayoutProps) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  operatorOnly(await session());
  const o = marketDictionary(lang).operator;
  return (
    <div className="op">
      <OperatorNav lang={lang} o={o} />
      {children}
    </div>
  );
}
