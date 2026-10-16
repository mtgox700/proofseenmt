import { isLang, LANGS, type Lang } from "@/i18n";
import { webAppManifest } from "@/lib/pwa/manifest";

/*
 * /fr/app.webmanifest and /en/app.webmanifest: the manifest of the installable app (C20), linked from the connected
 * space only. The same for everyone, built at compile time.
 */

export const dynamic = "force-static";

export const generateStaticParams = (): { lang: Lang }[] => LANGS.map((lang) => ({ lang }));

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  const { lang } = await context.params;
  if (!isLang(lang)) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(webAppManifest(lang)), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
