"use client";

import { usePathname } from "next/navigation";
import { switchLang, type Lang } from "@/i18n";

interface LangSwitchProps {
  readonly to: Lang;
  readonly label: string;
  readonly title: string;
}

/** Keeps the reader on the same page when switching language. */
export function LangSwitch({ to, label, title }: LangSwitchProps) {
  const pathname = usePathname();
  return (
    <a className="lang" href={switchLang(pathname, to)} hrefLang={to} lang={to} title={title}>
      {label}
    </a>
  );
}
