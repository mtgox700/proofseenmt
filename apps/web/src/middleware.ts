import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfigured } from "@/lib/auth-config";

/*
 * Two jobs, in this order:
 *
 * 1. Client space links arrive as /<lang>/espace/<reference>?t=<token>. The token must not stay in the address bar: it
 *    would end up in the history, in server logs and in screenshots. It is moved into an httpOnly cookie scoped to
 *    that one space, and the browser is sent to the clean address. Nothing is verified here: the page verifies (Node
 *    runtime, constant-time comparison), so a forged token gains nothing by passing through.
 * 2. Clerk, for the connected app, only when its keys are configured. Without them the public site runs unchanged.
 */

export const ACCESS_COOKIE = "ps_access";
const MAX_TOKEN_LENGTH = 200;
const SPACE = /^\/(fr|en)\/espace\/[^/]+$/;

const spaceLink = (request: NextRequest): NextResponse | null => {
  if (!SPACE.test(request.nextUrl.pathname)) return null;
  const token = request.nextUrl.searchParams.get("t");
  if (token === null) return null;
  const clean = request.nextUrl.clone();
  clean.searchParams.delete("t");
  const response = NextResponse.redirect(clean, 303);
  if (token.length > 0 && token.length <= MAX_TOKEN_LENGTH) {
    response.cookies.set(ACCESS_COOKIE, token, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      // Lax, not Strict: the link is opened from a mail client, and after a cross-site navigation Chrome withholds
      // Strict cookies on the redirect that follows, so the very first visit would read « lien invalide ».
      sameSite: "lax",
      path: request.nextUrl.pathname,
      // Never longer than a token lives (30 days): the cookie holds the signed token itself, re-checked against the
      // reference of the URL on every request, so it can neither outlive its expiry nor open another file.
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
};

const withClerk = clerkMiddleware((_auth, request) => spaceLink(request) ?? NextResponse.next());

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (authConfigured()) return withClerk(request, event);
  return spaceLink(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
