import type { Metadata } from "next";
import { ICONS, SHARE_CARD } from "@proofseen/brand";
import type { Lang } from "../i18n/types";

/*
 * What the React pages announce about themselves, from the brand package: the icons, and the share card of their
 * language (og:image, twitter:card). The HTML hub announces the same through packages/hub/src/head.ts.
 */

/** The production address, used when PROOFSEEN_PUBLIC_URL is not set (a build without the production environment). */
export const DEFAULT_SITE_ORIGIN = "https://proofseen.com";

/** Absolute base of the metadata URLs: share cards must be announced with their full address. */
export const siteOrigin = (configured: string | undefined = process.env.PROOFSEEN_PUBLIC_URL): string => {
  const value = (configured ?? "").trim();
  if (value === "") return DEFAULT_SITE_ORIGIN;
  try {
    return new URL(value).origin;
  } catch {
    // A malformed setting must not break every page: the production address is the safe answer.
    return DEFAULT_SITE_ORIGIN;
  }
};

export const BRAND_ICONS: NonNullable<Metadata["icons"]> = {
  icon: [
    { url: ICONS.ico, sizes: "48x48" },
    { url: ICONS.svg, type: "image/svg+xml" },
  ],
  apple: [{ url: ICONS.apple, sizes: "180x180" }],
};

const LOCALE: Readonly<Record<Lang, string>> = { fr: "fr_FR", en: "en_GB" };

interface ShareInput {
  readonly title: string;
  readonly description: string;
  /** Path of the page, when it is the page that is shared (not every page under a layout). */
  readonly path?: string;
}

export const shareMetadata = (lang: Lang, { title, description, path }: ShareInput): Pick<Metadata, "openGraph" | "twitter"> => {
  const card = SHARE_CARD[lang];
  return {
    openGraph: {
      type: "website",
      siteName: "Proofseen",
      locale: LOCALE[lang],
      title,
      description,
      ...(path === undefined ? {} : { url: path }),
      images: [{ url: card.src, width: SHARE_CARD.width, height: SHARE_CARD.height, alt: card.alt }],
    },
    twitter: { card: "summary_large_image", title, description, images: [{ url: card.src, alt: card.alt }] },
  };
};
