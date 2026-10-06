export type Lang = "fr" | "en";
export const LANGS: readonly Lang[] = ["fr", "en"];
export const isLang = (value: string): value is Lang => (LANGS as readonly string[]).includes(value);
