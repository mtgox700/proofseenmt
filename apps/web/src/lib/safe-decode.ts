/**
 * A path segment decoded, or `null` when its escape is malformed ("%", "%zz"): such an address is a page that does not
 * exist (404), not a server error (`decodeURIComponent` throws a URIError on it).
 */
export const safeDecode = (raw: string): string | null => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
};
