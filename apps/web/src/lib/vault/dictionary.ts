import type { Lang } from "@/i18n/types";
import { vaultEn } from "@/i18n/market/vault-en";
import { vaultFr, type VaultDictionary } from "@/i18n/market/vault-fr";

/** The texts of the vault in the language of the page. */
export const vaultText = (lang: Lang): VaultDictionary => (lang === "fr" ? vaultFr : vaultEn);
