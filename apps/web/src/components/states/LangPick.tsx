"use client";

import { useParams } from "next/navigation";
import { isLang, type Lang } from "../../i18n/types";

/*
 * The boundaries Next renders between pages (not found, loading, error) receive no route params, yet they sit under
 * the [lang] segment. The router knows the language: read it here, on the server render as in the browser, so the
 * HTML already speaks the reader's language and stays readable without JavaScript.
 */

/** The language of the current address; French when the address carries none (the site's default). */
export const useLang = (): Lang => {
  const params = useParams<{ lang?: string | string[] }>();
  const value = params?.lang;
  return typeof value === "string" && isLang(value) ? value : "fr";
};

interface LangPickProps {
  readonly fr: React.ReactNode;
  readonly en: React.ReactNode;
}

/**
 * Both versions are rendered on the server (they are small); only the reader's one reaches the HTML. Keep what goes
 * through here light: the other version still travels in the React payload.
 */
export function LangPick({ fr, en }: LangPickProps) {
  return useLang() === "en" ? en : fr;
}
