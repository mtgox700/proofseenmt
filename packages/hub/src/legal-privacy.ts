import type { LegalDocument } from "./legal-page";
import { PRIVACY_EN } from "./legal-privacy-en";
import { PRIVACY_FR } from "./legal-privacy-fr";
import type { Lang } from "./market-shell";

export const privacyPolicy = (lang: Lang): LegalDocument => (lang === "fr" ? PRIVACY_FR : PRIVACY_EN);
