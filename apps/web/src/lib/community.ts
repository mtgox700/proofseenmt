import type { CommentResult, CreatePostResult, EditPostResult, SharePostResult } from "@proofseen/db";
import type { Lang } from "../i18n/types";

/*
 * Shared rules of the community screens (C22): where an action returns, which error code it reports, and the throttle
 * of each kind of write. Error codes are a closed list, so nothing a form sends ever lands in an address.
 */

export const COMMUNITY_RULES = {
  post: { windowMs: 60_000, max: 5 },
  comment: { windowMs: 60_000, max: 10 },
  react: { windowMs: 60_000, max: 60 },
  follow: { windowMs: 60_000, max: 20 },
} as const;

export const ERROR_CODES = ["text_contact", "text_html", "text_empty", "text_long", "link_invalid", "link_contact", "image", "limit", "speaker", "absent", "parent", "tooMany", "upload"] as const;

export type CommunityError = (typeof ERROR_CODES)[number];

export const isCommunityError = (value: string | undefined): value is CommunityError => value !== undefined && (ERROR_CODES as readonly string[]).includes(value);

type Outcome = CreatePostResult | SharePostResult | EditPostResult | CommentResult;

/** The error code of a refused write, or `null` when it went through. */
export const errorOf = (result: Outcome): CommunityError | null => {
  switch (result.kind) {
    case "created":
    case "edited":
      return null;
    case "text":
      return `text_${result.problem}`;
    case "link":
      return `link_${result.problem}`;
    default:
      return result.kind;
  }
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where a form returns: the feed (one of its tabs) or a post page. Anything else falls back to the feed. */
export type ReturnTo = { readonly to: "feed"; readonly tab: "following" | "discover" } | { readonly to: "post"; readonly id: string };

export const returnOf = (raw: FormDataEntryValue | null, postId: string | null): ReturnTo => {
  if (raw === "post" && postId !== null && UUID.test(postId)) return { to: "post", id: postId };
  return { to: "feed", tab: raw === "discover" ? "discover" : "following" };
};

/** The address to return to, with an optional flag (`?erreur=…` or `?ok=…`) and anchor. */
export const returnPath = (lang: Lang, back: ReturnTo, flag: { readonly key: "erreur" | "ok"; readonly value: string } | null = null, anchor = ""): string => {
  const base = back.to === "post" ? `/${lang}/app/fil/${back.id}` : `/${lang}/app/fil${back.tab === "discover" ? "?onglet=decouvrir" : ""}`;
  const query = flag === null ? "" : `${base.includes("?") ? "&" : "?"}${flag.key}=${encodeURIComponent(flag.value)}`;
  return `${base}${query}${anchor === "" ? "" : `#${anchor}`}`;
};

/** A text field of a form, trimmed; `""` when absent. */
export const textOf = (raw: FormDataEntryValue | null, max: number): string => (typeof raw === "string" ? raw.slice(0, max * 2).trim() : "");
