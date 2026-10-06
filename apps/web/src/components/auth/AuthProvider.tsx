import { ClerkProvider } from "@clerk/nextjs";
import { enUS, frFR } from "@clerk/localizations";
import type { Lang } from "@/i18n";
import { authConfigured } from "@/lib/auth-config";

/*
 * Clerk around the app, only when its keys exist. Its widgets are themed from the product tokens: Clerk computes
 * shades from colour values, so the values below mirror `:root` in styles/tokens.css (the one documented exception to
 * "no raw colour outside :root"). Change a token there, change it here.
 */
const appearance = {
  variables: {
    colorPrimary: "#3fcf9c",
    colorBackground: "#0e1626",
    colorInputBackground: "#070b14",
    colorInputText: "#edf1f7",
    colorText: "#edf1f7",
    colorTextSecondary: "#a3aec2",
    colorTextOnPrimaryBackground: "#06110c",
    colorNeutral: "#edf1f7",
    colorDanger: "#f97066",
    borderRadius: "6px",
    fontFamily: '"Inter Variable", system-ui, sans-serif',
  },
};

export function AuthProvider({ lang, children }: { readonly lang: Lang; readonly children: React.ReactNode }) {
  if (!authConfigured()) return <>{children}</>;
  return (
    <ClerkProvider localization={lang === "fr" ? frFR : enUS} appearance={appearance} signInUrl={`/${lang}/connexion`} signUpUrl={`/${lang}/creer-un-compte`}>
      {children}
    </ClerkProvider>
  );
}
