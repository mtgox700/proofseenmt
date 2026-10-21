import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LangPick } from "@/components/states/LangPick";
import { NotFoundView } from "@/components/states/NotFoundView";
import { dictionary, type Lang } from "@/i18n";

/*
 * The 404 for a notFound() called by a page of the segment (an unknown workspace, an invalid language). Unknown
 * addresses get app/global-not-found.tsx, rendered on the server. Next passes no params here: both languages are
 * rendered and the router picks the reader's one. The status stays 404: Next sets it for any notFound().
 */
function Page({ lang }: { readonly lang: Lang }) {
  const t = dictionary(lang);
  return (
    <>
      <SiteHeader lang={lang} t={t} variant="site" />
      <main id="contenu" tabIndex={-1} className="wrap state-page">
        <NotFoundView lang={lang} />
      </main>
      <SiteFooter t={t} />
    </>
  );
}

export default function NotFound() {
  return <LangPick fr={<Page lang="fr" />} en={<Page lang="en" />} />;
}
