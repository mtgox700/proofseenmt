import type { VersionSummary } from "@proofseen/db";
import type { Lang } from "@/i18n/types";
import { vaultText } from "./dictionary";
import { authorLabel } from "./versions";

/*
 * The errors of the vault's actions, said on the page they come back to (storyboard L1.6, §4 E7): the action redirects
 * with `?erreur={clé}` (the convention of contrats/actions.ts), the key is turned into words here; an unknown key gets
 * the generic sentence of a 400, never the key itself.
 */

export const ERROR_KEYS = ["invalide", "version", "etat", "plus-recente", "trop", "moteur", "serveur"] as const;
export type VaultErrorKey = (typeof ERROR_KEYS)[number];

export interface VaultError {
  readonly text: string;
  readonly link: { readonly href: string; readonly label: string } | null;
}

const capital = (text: string): string => text.charAt(0).toLocaleUpperCase("fr") + text.slice(1);

/** The words of `?erreur=`; for « une version plus récente existe », who filed it and the link to what changed. */
export function vaultErrorText(lang: Lang, key: string | undefined, latestParam: string | undefined, document: { readonly documentId: string; readonly latest: VersionSummary | null } | null): VaultError | null {
  if (key === undefined || key === "") return null;
  const t = vaultText(lang);
  const e = t.errors;
  switch (key) {
    case "version":
      return { text: e.version, link: null };
    case "etat":
      return { text: e.state, link: null };
    case "trop":
      return { text: e.tooMany, link: null };
    case "moteur":
      return { text: e.engine, link: null };
    case "serveur":
      return { text: e.server, link: null };
    case "plus-recente": {
      const latest = document?.latest ?? null;
      const asked = Number(latestParam);
      if (document === null || latest === null || latest.number !== asked) return { text: e.invalid, link: null };
      const link = latest.number > 1 ? { href: `/${lang}/app/documents/${document.documentId}/comparer?de=${latest.number - 1}&a=${latest.number}`, label: e.staleLink(latest.number - 1, latest.number) } : { href: `/${lang}/app/documents/${document.documentId}`, label: t.card.read };
      return { text: e.stale(capital(authorLabel(latest, t.who)), latest.number), link };
    }
    default:
      return { text: e.invalid, link: null };
  }
}
