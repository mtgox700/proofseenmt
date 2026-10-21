import { SiteHeader } from "@/components/SiteHeader";
import { dictionary, type Lang } from "@/i18n";
import { LangPick } from "./LangPick";
import { PageSkeleton } from "./Skeleton";

/*
 * The pages opened from a signed link (a client space, a mission to confirm) read the database before they render.
 * Meanwhile: the same header as the page, at its real size, and the empty register below, so nothing moves when the
 * page arrives.
 */
function Frame({ lang }: { readonly lang: Lang }) {
  return (
    <>
      <SiteHeader lang={lang} t={dictionary(lang)} variant="app" />
      <main id="contenu" tabIndex={-1} className="wrap space">
        <PageSkeleton rows={3} />
      </main>
    </>
  );
}

export function SignedLinkLoading() {
  return <LangPick fr={<Frame lang="fr" />} en={<Frame lang="en" />} />;
}
