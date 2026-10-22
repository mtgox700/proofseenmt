import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // Handled in the middleware: the pages of the former static site keep their indexed address, which ends with a slash.
  skipTrailingSlashRedirect: true,
  // Production output lives apart from the dev server: a `next dev` and a `next build` sharing one folder corrupt
  // each other (seen 2026-10-01, a build stuck for over an hour). NEXT_DIST_DIR lets a second worker isolate its own.
  distDir: process.env.NEXT_DIST_DIR ?? (process.env.NODE_ENV === "production" ? ".next-prod" : ".next"),
  // The dev badge would end up in the product screenshots shown on the landing.
  devIndicators: false,
  reactStrictMode: true,
  // Profile uploads (photo, portfolio image, CV of 5 MB at most) and message attachments (three of 5 MB at most, C15)
  // arrive through server actions, whose default body cap is 1 MB. Each file is checked again, by size and content,
  // before anything is stored.
  // globalNotFound: an address outside /fr and /en has no root layout to render in; src/app/global-not-found.tsx
  // answers it with the 404 of the brand instead of the default page of Next.
  experimental: { serverActions: { bodySizeLimit: "16mb" }, globalNotFound: true },
  // PDF text extraction (CV import) runs the PDF.js build shipped by unpdf as is, outside the server bundle.
  serverExternalPackages: ["unpdf"],
  // Les paquets du monorepo sont publiés en TypeScript source : Next les compile avec l'application.
  transpilePackages: ["@proofseen/access", "@proofseen/brand", "@proofseen/client-store", "@proofseen/workspace", "@proofseen/deliverable", "@proofseen/presale", "@proofseen/profiles", "@proofseen/stats", "@proofseen/core", "@proofseen/hub", "@proofseen/db", "@proofseen/engines", "@proofseen/notify", "@proofseen/payments", "@proofseen/invoicing", "@proofseen/measure", "@proofseen/extract"],
  async redirects() {
    return [
      { source: "/", destination: "/fr", permanent: false },
      // The barometer has two public pages and no index: its natural address leads to the first one, the day rates,
      // which the sitemaps, llms.txt and the blog already list. The address itself is in no sitemap.
      { source: "/:lang(fr|en)/barometre", destination: "/:lang/barometre/tjm", permanent: true },
      { source: "/barometre", destination: "/fr/barometre/tjm", permanent: true },
    ];
  },
  // Browsers and crawlers ask for /favicon.ico on their own: the brand icon answers, from its single copy.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/brand/favicon.ico" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // The signed confirmation link carries its token in the address: the headers say what the page's <meta> says,
      // even to a reader that does not parse the HTML.
      {
        source: "/:lang(fr|en)/confirmer-mission/:id*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      // The brand fonts carry their version in their name (ps-display-v1.woff2): a new cut is a new file.
      { source: "/fonts/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // The service worker of the installable app (C20): scope "/" allowed explicitly, and always revalidated so a new
      // version is picked up at the next visit instead of whenever a cache decides.
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

export default config;
