/*
 * The state of a list lives in its address (LEGENDS_P2_CONCEPT §B.3, §B.7): sort, filters, page and the open inspector
 * are query parameters, so a view works without JavaScript, can be shared between operators, and the back button
 * walks it. These helpers build those addresses from the searchParams Next hands to a page; they never read a cookie
 * or a store.
 */

/** The shape of `searchParams` in a Next page, once awaited. */
export type SearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/** The page of a list resets whenever what it shows changes (sort, filter). */
export const PAGE_PARAM = "page";

/** The first value of a parameter, trimmed; null when absent or empty. */
export function param(params: SearchParams, name: string): string | null {
  const raw = params[name];
  const value = (Array.isArray(raw) ? raw[0] : raw) as string | undefined;
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/**
 * The address of the same view with some parameters changed: a string sets it, null removes it. Other parameters keep
 * their order; a repeated one keeps all its values. Empty values are dropped, so a cleared field leaves no `?q=`.
 */
export function hrefWith(path: string, params: SearchParams, changes: Readonly<Record<string, string | null>>): string {
  const query = new URLSearchParams();
  for (const [name, raw] of Object.entries(params)) {
    if (name in changes || raw === undefined) continue;
    for (const value of Array.isArray(raw) ? raw : [raw]) if (value !== "") query.append(name, value);
  }
  for (const [name, value] of Object.entries(changes)) if (value !== null && value !== "") query.set(name, value);
  const search = query.toString();
  return search === "" ? path : `${path}?${search}`;
}
