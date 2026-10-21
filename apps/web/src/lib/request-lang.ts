import type { Lang } from "../i18n/types";

/*
 * The language of a request, read from its address by the middleware and handed to the server render in a request
 * header. Only the 404 of an unknown address needs it: Next renders that page outside any route, without params, and
 * the address is the only place the reader's language is written.
 */

export const LANG_HEADER = "x-ps-lang";

/** "fr" or "en" when the path starts with that segment, "none" otherwise (a stray path at the root). */
export const langOfPath = (pathname: string): Lang | "none" => {
  const match = /^\/(fr|en)(?:\/|$)/.exec(pathname);
  return match === null ? "none" : (match[1] as Lang);
};

/** What the page reads back. Anything else (a header sent by the client on a path the middleware skips) is "none". */
export const readLangHeader = (value: string | null): Lang | "none" => (value === "fr" || value === "en" ? value : "none");
