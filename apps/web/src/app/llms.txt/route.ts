import { articles, getDb, jobTitlePages, postFeed, skillPages } from "@proofseen/db";
import { llmsTxt, type LlmsArticle, type LlmsJobTitle, type LlmsPost, type LlmsSkill } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/*
 * /llms.txt (llmstxt.org): what the public pages are and where they live, for AI assistants. The skill pages, the
 * job-title pages and the articles listed are those that exist in the database; without it, or if it fails, the file
 * still answers with the fixed sections.
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

const existingJobTitles = async (): Promise<readonly LlmsJobTitle[]> => {
  if (!hasDatabase()) return [];
  try {
    return await jobTitlePages(getDb()).listForSitemap();
  } catch (error) {
    logError("llms.txt: job title pages not listed", error);
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

/** Recent public community posts (C22); none without a database or on failure. */
const RECENT_POSTS = 50;

const recentPosts = async (): Promise<readonly LlmsPost[]> => {
  if (!hasDatabase()) return [];
  try {
    return await postFeed(getDb()).listPublic(RECENT_POSTS);
  } catch (error) {
    logError("llms.txt: community posts not listed", error);
    return [];
  }
};

export async function GET(request: Request): Promise<Response> {
  const [skills, posts, titles, community] = await Promise.all([existingSkills(), publishedArticles(), existingJobTitles(), recentPosts()]);
  return new Response(llmsTxt(publicBaseUrl(request), skills, posts, titles, community), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600" },
  });
}
