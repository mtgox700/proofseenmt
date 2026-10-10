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
  // Les paquets du monorepo sont publiés en TypeScript source : Next les compile avec l'application.
  transpilePackages: ["@proofseen/access", "@proofseen/client-store", "@proofseen/workspace", "@proofseen/deliverable", "@proofseen/presale", "@proofseen/profiles", "@proofseen/stats", "@proofseen/core", "@proofseen/hub", "@proofseen/db", "@proofseen/engines", "@proofseen/notify", "@proofseen/payments", "@proofseen/invoicing"],
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
    ];
  },
};

export default config;
