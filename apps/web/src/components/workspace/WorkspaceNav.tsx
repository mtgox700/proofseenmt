"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { LiveCount } from "@/components/live/LiveCount";
import { locate, type NavLink, type NavSection } from "@/lib/workspace-nav";

interface WorkspaceNavProps {
  readonly sections: readonly NavSection[];
  readonly label: string;
}

/** `page` on the link of the page itself, `true` on the link of the section or tab the page sits in. */
const currentOf = (link: NavLink, marked: NavLink | null, pathname: string | null): "page" | "true" | undefined =>
  link !== marked ? undefined : link.href === pathname ? "page" : "true";

/*
 * On a phone a line of links scrolls sideways, and the current one may sit past its right edge. Once mounted, and
 * after each navigation, the line is moved so that the current link shows; at once, without motion. Without
 * JavaScript the line starts at its first link, and the tabs of the section stay in view below it.
 */
const showCurrent = (line: HTMLUListElement | null): void => {
  const item = line?.querySelector<HTMLElement>("[aria-current]")?.parentElement;
  if (line === null || item === null || item === undefined || line.scrollWidth <= line.clientWidth) return;
  const fade = Number.parseFloat(getComputedStyle(line).paddingRight) || 0;
  if (item.offsetLeft < line.scrollLeft || item.offsetLeft + item.offsetWidth > line.scrollLeft + line.clientWidth - fade) line.scrollLeft = item.offsetLeft;
};

function Item({ link, current }: { readonly link: NavLink; readonly current: "page" | "true" | undefined }) {
  return (
    <li>
      <Link href={link.href} aria-current={current}>
        {link.label}
        {link.live === undefined ? null : <LiveCount which={link.live.which} initial={link.live.initial} label={link.live.label} />}
      </Link>
    </li>
  );
}

/*
 * The menu of sections, then the tabs of the current section. No transition on purpose: it is used dozens of times a
 * day, and data should not wait on motion. Two landmarks, placed by the grid of the shell: on a phone each is one line
 * that scrolls sideways; from 64rem the sections stand in a column and the tabs above the page.
 */
export function WorkspaceNav({ sections, label }: WorkspaceNavProps) {
  const pathname = usePathname();
  const { section, tab } = locate(sections, pathname);
  const tabs = section?.tabs ?? [];
  const sectionLine = useRef<HTMLUListElement>(null);
  const tabLine = useRef<HTMLUListElement>(null);
  useEffect(() => {
    showCurrent(sectionLine.current);
    showCurrent(tabLine.current);
  }, [pathname]);
  return (
    <>
      <nav className="ws-nav" aria-label={label}>
        <ul ref={sectionLine}>
          {sections.map((item) => (
            <Item key={item.href} link={item} current={currentOf(item, section, pathname)} />
          ))}
        </ul>
      </nav>
      {section === null || tabs.length === 0 ? null : (
        <nav className="ws-tabs" aria-label={section.tabsLabel ?? section.label}>
          <ul ref={tabLine}>
            {tabs.map((item) => (
              <Item key={item.href} link={item} current={currentOf(item, tab, pathname)} />
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
