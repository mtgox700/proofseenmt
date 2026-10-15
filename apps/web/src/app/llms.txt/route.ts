import { articles, getDb, skillPages } from "@proofseen/db";
import { llmsTxt, type LlmsArticle, type LlmsSkill } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/*
 * /llms.txt (llmstxt.org): what the public pages are and where they live, for AI assistants. The skill pages and the
 * articles listed are those that exist in the database; without it, or if it fails, the file still answers with the
 * fixed sections.
 */

export const runtime = "nodejs";

const existingSkills = async (): Promise<readonly LlmsSkill[]> => {
  if (!hasDatabase()) return [];
  try {
    return await skillPages(getDb()).listForSitemap();
  } catch (error) {
    logError("llms.txt: skill pages not listed", error);
    return [];
  }
};

const publishedArticles = async (): Promise<readonly LlmsArticle[]> => {
  if (!hasDatabase()) return [];
  try {
    return await articles(getDb()).listPublished();
  } catch (error) {
    logError("llms.txt: articles not listed", error);
    return [];
  }
};

export async function GET(request: Request): Promise<Response> {
  const [skills, posts] = await Promise.all([existingSkills(), publishedArticles()]);
  return new Response(llmsTxt(publicBaseUrl(request), skills, posts), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600" },
  });
}
