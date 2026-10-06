/*
 * The public address of the site, as engines must see it. Configured (`PROOFSEEN_PUBLIC_URL`) in production so a page
 * served behind a proxy or a preview URL never declares the wrong canonical; the request's own origin otherwise.
 */
export const publicBaseUrl = (request: Request): string => {
  const configured = (process.env.PROOFSEEN_PUBLIC_URL ?? "").trim();
  if (configured !== "") {
    try {
      return new URL(configured).origin;
    } catch {
      // A malformed setting must not break every page: fall through to the request origin.
    }
  }
  return new URL(request.url).origin;
};
