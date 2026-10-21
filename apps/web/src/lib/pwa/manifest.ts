import { ICONS, THEME_COLOR } from "@proofseen/brand";
import { pwaEn } from "../../i18n/market/pwa-en";
import { pwaFr, type PwaDictionary } from "../../i18n/market/pwa-fr";
import type { Lang } from "../../i18n/types";

/*
 * The web app manifest of the connected space (C20), one per language so the installed app opens in the person's
 * language. Linked from the connected-space layout only: the public pages (profiles, missions, skills, blog) are raw
 * HTML for search engines and never reference it.
 */

/** The page background of the brand (dark, the brand theme): the manifest is read by the operating system, outside CSS. */
export const PWA_BACKGROUND = THEME_COLOR.dark;

/** The brand icons (packages/brand, public/brand/), and the monochrome notification badge drawn from the same poincon. */
export const PWA_ICONS = {
  any192: ICONS.any192,
  any512: ICONS.any512,
  maskable192: ICONS.maskable192,
  maskable512: ICONS.maskable512,
  badge: "/icons/badge-96.png",
} as const;

export const manifestPath = (lang: Lang): string => `/${lang}/app.webmanifest`;

export interface ManifestIcon {
  readonly src: string;
  readonly sizes: string;
  readonly type: "image/png";
  readonly purpose: "any" | "maskable";
}

export interface ManifestShortcut {
  readonly name: string;
  readonly url: string;
  readonly icons: readonly ManifestIcon[];
}

export interface WebAppManifest {
  readonly id: string;
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly lang: Lang;
  readonly dir: "ltr";
  readonly start_url: string;
  readonly scope: string;
  readonly display: "standalone";
  readonly theme_color: string;
  readonly background_color: string;
  readonly categories: readonly string[];
  readonly prefer_related_applications: false;
  readonly icons: readonly ManifestIcon[];
  readonly shortcuts: readonly ManifestShortcut[];
}

const TEXTS: Readonly<Record<Lang, PwaDictionary>> = { fr: pwaFr, en: pwaEn };

const icon = (src: string, size: number, purpose: ManifestIcon["purpose"]): ManifestIcon => ({ src, sizes: `${size}x${size}`, type: "image/png", purpose });

export const webAppManifest = (lang: Lang): WebAppManifest => {
  const t = TEXTS[lang].manifest;
  const app = `/${lang}/app`;
  const shortcutIcons = [icon(PWA_ICONS.any192, 192, "any")];
  return {
    // One identity for both languages: installing in French then opening in English is the same app.
    id: "/app",
    name: "Proofseen",
    short_name: "Proofseen",
    description: t.description,
    lang,
    dir: "ltr",
    start_url: app,
    scope: "/",
    display: "standalone",
    theme_color: PWA_BACKGROUND,
    background_color: PWA_BACKGROUND,
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    icons: [
      icon(PWA_ICONS.any192, 192, "any"),
      icon(PWA_ICONS.any512, 512, "any"),
      icon(PWA_ICONS.maskable192, 192, "maskable"),
      icon(PWA_ICONS.maskable512, 512, "maskable"),
    ],
    shortcuts: [
      { name: t.shortcuts.messages, url: `${app}/messages`, icons: shortcutIcons },
      { name: t.shortcuts.missions, url: `${app}/missions`, icons: shortcutIcons },
      { name: t.shortcuts.notifications, url: `${app}/notifications`, icons: shortcutIcons },
    ],
  };
};
