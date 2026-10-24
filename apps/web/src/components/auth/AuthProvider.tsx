import { ClerkProvider } from "@clerk/nextjs";
import { enUS, frFR } from "@clerk/localizations";
import { FONT_STACKS } from "@proofseen/brand";
import type { Lang } from "@/i18n";
import { clerkClientConfigured } from "@/lib/auth-config";

/*
 * Clerk around the app, only when its publishable key exists (see `clerkClientConfigured`). Its widgets take the brand
 * colours as CSS custom properties of @proofseen/brand, not as fixed values: the page's one theme (dark only since
 * BRAND_BOOK_V2) colours them, with no script, no extra request and no flash at hydration. Clerk passes `var(--…)` through where the browser mixes colours in CSS (`color-mix()` or
 * relative colours) and drops it otherwise, falling back to its own defaults (`removeInvalidValues`, clerk/javascript
 * packages/ui/src/customizables/parseVariables.ts). The names are those of Clerk's current `Variables`
 * (`colorForeground`, `colorInput`…): the older ones (`colorText`, `colorInputBackground`…) are no longer read.
 * The call to action is paper on ink, as everywhere: green is for what is verified, so no Clerk colour is green.
 */
export const CLERK_VARIABLES = {
  colorPrimary: "var(--ps-text)",
  colorPrimaryForeground: "var(--ps-bg)",
  colorBackground: "var(--ps-surface)",
  colorForeground: "var(--ps-text)",
  colorMutedForeground: "var(--ps-muted)",
  colorInput: "var(--ps-bg)",
  colorInputForeground: "var(--ps-text)",
  colorNeutral: "var(--ps-text)",
  colorBorder: "var(--ps-line-strong)",
  colorRing: "var(--ps-focus)",
  colorDanger: "var(--ps-danger)",
  colorWarning: "var(--ps-signal)",
  borderRadius: "4px",
  fontFamily: FONT_STACKS.text,
} as const;

const appearance = { variables: CLERK_VARIABLES };

export function AuthProvider({ lang, children }: { readonly lang: Lang; readonly children: React.ReactNode }) {
  if (!clerkClientConfigured()) return <>{children}</>;
  return (
    <ClerkProvider localization={lang === "fr" ? frFR : enUS} appearance={appearance} signInUrl={`/${lang}/connexion`} signUpUrl={`/${lang}/creer-un-compte`}>
      {children}
    </ClerkProvider>
  );
}
