import type { Lang } from "../types";
import { marketEn } from "./en";
import { marketFr, type MarketDictionary } from "./fr";

export type { MarketDictionary } from "./fr";

const DICTIONARIES: Readonly<Record<Lang, MarketDictionary>> = { fr: marketFr, en: marketEn };

export const marketDictionary = (lang: Lang): MarketDictionary => DICTIONARIES[lang];
