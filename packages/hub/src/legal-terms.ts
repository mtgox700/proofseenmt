import type { LegalDocument } from "./legal-page";
import { TERMS_EN } from "./legal-terms-en";
import { TERMS_FR } from "./legal-terms-fr";
import type { Lang } from "./market-shell";

export const termsOfUse = (lang: Lang): LegalDocument => (lang === "fr" ? TERMS_FR : TERMS_EN);
