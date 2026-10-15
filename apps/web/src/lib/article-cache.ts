/**
 * Shared-cache lifetime of the blog index and article pages: one minute fresh, five more served stale while revalidated.
 * An article taken offline (or corrected) disappears from shared caches within minutes, not within the hour.
 */
export const ARTICLE_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
