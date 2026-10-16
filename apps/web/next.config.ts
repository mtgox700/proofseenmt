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
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
  // PDF text extraction (CV import) runs the PDF.js build shipped by unpdf as is, outside the server bundle.
  serverExternalPackages: ["unpdf"],
  // Les paquets du monorepo sont publiés en TypeScript source : Next les compile avec l'application.
  transpilePackages: ["@proofseen/access", "@proofseen/client-store", "@proofseen/workspace", "@proofseen/deliverable", "@proofseen/presale", "@proofseen/profiles", "@proofseen/stats", "@proofseen/core", "@proofseen/hub", "@proofseen/db", "@proofseen/engines", "@proofseen/notify", "@proofseen/payments", "@proofseen/invoicing", "@proofseen/measure", "@proofseen/extract"],
  async redirects() {
    return [{ source: "/", destination: "/fr", permanent: false }];
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
