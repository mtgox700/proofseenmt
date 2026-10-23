import type { Lang } from "@/i18n";
import { homeEn } from "./en";
import { homeFr } from "./fr";
import { HomeCopySchema, type HomeCopy } from "./schema";

export type { HomeCopy } from "./schema";
export { fill } from "./fill";

/* Parsed once, when the page module loads: a hole in the copy fails the build, never the visitor. */
const COPY: Readonly<Record<Lang, HomeCopy>> = { fr: HomeCopySchema.parse(homeFr), en: HomeCopySchema.parse(homeEn) };

export const homeCopy = (lang: Lang): HomeCopy => COPY[lang];
