"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveCount } from "@/components/live/LiveCount";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  /** A live counter after the label (unread messages, C15). */
  readonly live?: { readonly which: "messages" | "notifications"; readonly initial: number; readonly label: string };
}

interface WorkspaceNavProps {
  readonly items: readonly NavItem[];
  readonly label: string;
}

/** Section navigation. No transition on purpose: it is used dozens of times a day, and data should not wait on motion. */
export function WorkspaceNav({ items, label }: WorkspaceNavProps) {
  const pathname = usePathname();
  const deepest = items.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav className="ws-nav" aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={item.href === deepest?.href ? "page" : undefined}>
              {item.label}
              {item.live === undefined ? null : <LiveCount which={item.live.which} initial={item.live.initial} label={item.live.label} />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
