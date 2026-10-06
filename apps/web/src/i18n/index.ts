import { en } from "./en";
import { fr, type Dictionary } from "./fr";
import type { Lang } from "./types";

export type { Dictionary } from "./fr";
export { LANGS, isLang, type Lang } from "./types";

const DICTIONARIES: Readonly<Record<Lang, Dictionary>> = { fr, en };

export const dictionary = (lang: Lang): Dictionary => DICTIONARIES[lang];

/** Same path in the other language: the switch never drops the reader back on the home page. */
export const switchLang = (pathname: string, to: Lang): string => pathname.replace(/^\/(fr|en)(?=\/|$)/, `/${to}`);
