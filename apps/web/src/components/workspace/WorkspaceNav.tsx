"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  readonly href: string;
  readonly label: string;
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
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
