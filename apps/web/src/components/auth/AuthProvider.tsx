import { ClerkProvider } from "@clerk/nextjs";
import { enUS, frFR } from "@clerk/localizations";
import { FONT_STACKS, PALETTE } from "@proofseen/brand";
import type { Lang } from "@/i18n";
import { clerkClientConfigured } from "@/lib/auth-config";

/*
 * Clerk around the app, only when its publishable key exists (see `clerkClientConfigured`). Its widgets are themed from
 * the brand palette (@proofseen/brand): Clerk computes shades from colour values, so it receives the values themselves,
 * in the dark theme of the brand. The call to action is paper on ink, as everywhere: green is for what is verified.
 */
const ink = PALETTE.dark;
const appearance = {
  variables: {
    colorPrimary: ink.text,
    colorBackground: ink.surface,
    colorInputBackground: ink.bg,
    colorInputText: ink.text,
    colorText: ink.text,
    colorTextSecondary: ink.muted,
    colorTextOnPrimaryBackground: ink.bg,
    colorNeutral: ink.text,
    colorDanger: ink.danger,
    borderRadius: "4px",
    fontFamily: FONT_STACKS.text,
  },
};

export function AuthProvider({ lang, children }: { readonly lang: Lang; readonly children: React.ReactNode }) {
  if (!clerkClientConfigured()) return <>{children}</>;
  return (
    <ClerkProvider localization={lang === "fr" ? frFR : enUS} appearance={appearance} signInUrl={`/${lang}/connexion`} signUpUrl={`/${lang}/creer-un-compte`}>
      {children}
    </ClerkProvider>
  );
}
