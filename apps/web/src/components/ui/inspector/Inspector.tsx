import "@/styles/ui.css";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Lang } from "@/i18n/types";
import { InspectorKeys } from "./InspectorKeys";

/*
 * Inspector (LEGENDS_P2_CONCEPT §B.4, §B.7): the detail of one item beside its list, drawn by the server from
 * `?voir=<id>` (inspector-url.ts). A complementary landmark named by its h2; a close link to the same view without
 * `voir`; the island InspectorKeys only moves the focus and maps Escape to that link. On a phone it takes the width
 * of the screen, under the list (ui.css). It never opens without the address changing.
 */

const WORDS = {
  fr: { close: "Fermer", closeWhat: "le panneau de détail" },
  en: { close: "Close", closeWhat: "the detail panel" },
} as const satisfies Record<Lang, Record<string, string>>;

export interface InspectorProps {
  readonly lang: Lang;
  /** Unique on the page, usually derived from the inspected id. */
  readonly id: string;
  /** What is inspected, a reference first (« Attestation de FR-7H2XK »), never an e-mail address. */
  readonly title: string;
  /** A short line under the title: the queue, the state in words. */
  readonly meta?: ReactNode;
  /** The view without the inspector (closeInspectorHref). */
  readonly closeHref: string;
  /** The facts, the timeline, the documents. */
  readonly children: ReactNode;
  /**
   * The decisions, each with its reason field, under the title. A decision that undoes or refuses wears `ui-danger`
   * and opens its reason field before it acts (a <details> works without script).
   */
  readonly actions?: ReactNode;
}

export function Inspector({ lang, id, title, meta, closeHref, children, actions }: InspectorProps) {
  if (title.trim() === "") throw new Error("an inspector needs a title");
  const titleId = `${id}-title`;
  const closeId = `${id}-close`;
  return (
    <aside className="ui-inspector" aria-labelledby={titleId}>
      <header className="ui-inspector-head">
        <h2 id={titleId} tabIndex={-1}>
          {title}
        </h2>
        <Link id={closeId} className="ui-inspector-close" href={closeHref} scroll={false}>
          {WORDS[lang].close}
          <span className="sr-only">{` ${WORDS[lang].closeWhat}`}</span>
        </Link>
        {meta === undefined ? null : <div className="ui-inspector-meta">{meta}</div>}
      </header>
      {/* The decisions come first, under the title: they are why the panel is open (L1-091 K10). */}
      {actions === undefined ? null : <div className="ui-inspector-actions">{actions}</div>}
      <div className="ui-inspector-body">{children}</div>
      <InspectorKeys titleId={titleId} closeId={closeId} />
    </aside>
  );
}
