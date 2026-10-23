/*
 * The menu of the connected space as data: sections, each with the pages it holds as tabs. Pure and free of any
 * dictionary, so the client part of the menu ships only this (the labels arrive already resolved, as props).
 */

export interface NavLink {
  readonly href: string;
  readonly label: string;
  /** A live counter after the label (unread messages, C15). */
  readonly live?: { readonly which: "messages" | "notifications"; readonly initial: number; readonly label: string };
}

export interface NavSection extends NavLink {
  /** The pages of the section, in order; the section's own link is the first of them. Empty for a single page. */
  readonly tabs: readonly NavLink[];
  /** Name of the row of tabs for assistive technologies, e.g. « Argent, pages de la section ». */
  readonly tabsLabel?: string;
  /** The home of the space owns its address only, not every page below it. */
  readonly exact?: boolean;
}

export interface NavPlace {
  readonly section: NavSection | null;
  readonly tab: NavLink | null;
}

const owns = (href: string, pathname: string): boolean => pathname === href || pathname.startsWith(`${href}/`);

/** The longest address of `links` that `pathname` sits under, or null. */
const deepest = <T extends NavLink>(links: readonly T[], pathname: string): T | null =>
  links.filter((link) => owns(link.href, pathname)).sort((a, b) => b.href.length - a.href.length)[0] ?? null;

/**
 * Where a page sits in the menu: the section that holds it (by its deepest address, tabs included) and the tab it
 * opens. A page outside every section (notifications, the role choice) marks nothing.
 */
export const locate = (sections: readonly NavSection[], pathname: string | null): NavPlace => {
  if (pathname === null) return { section: null, tab: null };
  const candidates = sections.flatMap((section) =>
    [section, ...section.tabs]
      .filter((link) => (section.exact === true && link === section ? pathname === link.href : owns(link.href, pathname)))
      .map((link) => ({ section, length: link.href.length })),
  );
  const section = candidates.sort((a, b) => b.length - a.length)[0]?.section ?? null;
  return { section, tab: section === null ? null : deepest(section.tabs, pathname) };
};
