import type { AuthorView } from "@proofseen/db";
import type { Lang } from "@/i18n";

interface AuthorLineProps {
  readonly lang: Lang;
  readonly author: AuthorView;
}

/** Who speaks: a published profile (its name, or its reference when pseudonymous) or a company, linked to its public page. */
export function AuthorLine({ lang, author }: AuthorLineProps) {
  const href = author.profileSlug !== null ? `/${lang}/profils/${author.profileSlug}` : author.companySlug !== null ? `/${lang}/entreprises/${author.companySlug}` : null;
  return href === null ? <strong>{author.name}</strong> : <a href={href}><strong>{author.name}</strong></a>;
}
