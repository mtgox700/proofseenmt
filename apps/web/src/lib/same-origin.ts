/** The host of a URL, or `null` when the value is missing or malformed. */
const hostOf = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || value.trim() === "") return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
};

/*
 * Cross-site request forgery: the Clerk session cookie is sent with any same-site request, so a write must prove it
 * comes from our own pages. Browsers always send `Origin` on a cross-origin POST; when it is present it must match.
 *
 * Behind the reverse proxy, `request.url` carries the server's internal address, not proofseen.com: the origin is also
 * accepted when it matches the configured public address or the `Host` header the browser sent. A page on another
 * site still never matches, since its browser sends its own origin.
 */
export const sameOrigin = (request: Request, publicUrl: string | undefined = process.env.PROOFSEEN_PUBLIC_URL): boolean => {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  const from = hostOf(origin);
  if (from === null) return false;
  const ours = [hostOf(request.url), hostOf(publicUrl), request.headers.get("host")?.trim().toLowerCase() ?? null];
  return ours.some((host) => host !== null && host !== "" && host === from);
};
