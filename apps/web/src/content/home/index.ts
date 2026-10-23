import type { Lang } from "@/i18n";
import { homeEn } from "./en";
import { homeFr } from "./fr";
import { HomeCopySchema, type HomeCopy } from "./schema";

export type { HomeCopy } from "./schema";

/* Parsed once, when the page module loads: a hole in the copy fails the build, never the visitor. */
const COPY: Readonly<Record<Lang, HomeCopy>> = { fr: HomeCopySchema.parse(homeFr), en: HomeCopySchema.parse(homeEn) };

export const homeCopy = (lang: Lang): HomeCopy => COPY[lang];

/** Fills `{name}` placeholders of a line of copy. */
export const fill = (template: string, values: Readonly<Record<string, string | number>>): string =>
  Object.entries(values).reduce((line, [key, value]) => line.replaceAll(`{${key}}`, String(value)), template);
