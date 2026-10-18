"use server";

import { redirect } from "next/navigation";
import { COMMENT_BODY_MAX, POST_BODY_MAX, POST_LINK_MAX, postComments, postReactions, posts, SHARE_COMMENT_MAX, storedFiles } from "@proofseen/db";
import { speakerOf } from "@/data/community";
import { throttled } from "@/data/throttle";
import { deleteStored, saveUpload } from "@/data/uploads";
import { COMMUNITY_RULES, errorOf, returnOf, returnPath, textOf, type ReturnTo } from "@/lib/community";
import { actionMarket, langOf, uuidOf } from "@/lib/market";

/*
 * Server actions of the community feed (C22). Every write re-reads the person from the session, is throttled per
 * person, and lets the repository check access inside its own query; the form never says who is speaking. Each one
 * answers with a redirect, so the feed works without JavaScript.
 */

const back = (formData: FormData, postId: string | null): ReturnTo => returnOf(formData.get("back"), postId);

function fail(lang: "fr" | "en", to: ReturnTo, code: string): never {
  redirect(returnPath(lang, to, { key: "erreur", value: code }));
}

export async function createPost(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const to = back(formData, null);
  const market = await actionMarket(lang);
  if (await throttled("community-post", market.actor.userId, COMMUNITY_RULES.post, new Date())) fail(lang, to, "tooMany");
  const speaker = await speakerOf(market);
  if (speaker === null) fail(lang, to, "speaker");
  const upload = formData.get("image");
  let imageFileId: string | null = null;
  if (upload !== null && typeof upload !== "string" && upload.size > 0) {
    if (!speaker.mayShowImage) fail(lang, to, "image");
    const saved = await saveUpload(market.db, market.actor, "post_image", upload);
    if (saved.kind !== "stored") fail(lang, to, "upload");
    imageFileId = saved.id;
  }
  const visibility = formData.get("visibility") === "members" ? "members" : "public";
  const result = await posts(market.db).create(
    market.actor,
    speaker.choice,
    { body: textOf(formData.get("body"), POST_BODY_MAX), linkUrl: textOf(formData.get("linkUrl"), POST_LINK_MAX), imageFileId, visibility },
    new Date(),
  );
  const error = errorOf(result);
  if (error !== null) {
    // The image was stored for this post only: a refused post does not leave it behind.
    if (imageFileId !== null && (await storedFiles(market.db).remove(market.actor, imageFileId)) !== null) await deleteStored([imageFileId]);
    fail(lang, to, error);
  }
  redirect(returnPath(lang, to, { key: "ok", value: "publie" }));
}

export async function sharePost(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const postId = uuidOf(formData.get("postId"));
  const to = back(formData, postId);
  const market = await actionMarket(lang);
  if (await throttled("community-post", market.actor.userId, COMMUNITY_RULES.post, new Date())) fail(lang, to, "tooMany");
  const speaker = await speakerOf(market);
  if (speaker === null) fail(lang, to, "speaker");
  if (postId === null) fail(lang, to, "absent");
  const result = await posts(market.db).share(market.actor, speaker.choice, postId, textOf(formData.get("comment"), SHARE_COMMENT_MAX), new Date());
  const error = errorOf(result);
  if (error !== null) fail(lang, to, error);
  redirect(returnPath(lang, { to: "feed", tab: "following" }, { key: "ok", value: "partage" }));
}

export async function editPost(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const postId = uuidOf(formData.get("postId"));
  const to = back(formData, postId);
  const market = await actionMarket(lang);
  if (await throttled("community-post", market.actor.userId, COMMUNITY_RULES.post, new Date())) fail(lang, to, "tooMany");
  const result = await posts(market.db).edit(market.actor, postId ?? "", { body: textOf(formData.get("body"), POST_BODY_MAX), linkUrl: textOf(formData.get("linkUrl"), POST_LINK_MAX) }, new Date());
  const error = errorOf(result);
  if (error !== null) fail(lang, to, error);
  redirect(returnPath(lang, to, { key: "ok", value: "modifie" }));
}

export async function deletePost(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const postId = uuidOf(formData.get("postId"));
  const market = await actionMarket(lang);
  const to: ReturnTo = { to: "feed", tab: "following" };
  if (await throttled("community-post", market.actor.userId, COMMUNITY_RULES.post, new Date())) fail(lang, to, "tooMany");
  const removed = await posts(market.db).remove(market.actor, postId ?? "", new Date());
  await deleteStored(removed.fileIds);
  if (!removed.removed) fail(lang, to, "absent");
  redirect(returnPath(lang, to, { key: "ok", value: "supprime" }));
}

export async function reactToPost(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const postId = uuidOf(formData.get("postId"));
  const to = back(formData, postId);
  const market = await actionMarket(lang);
  if (await throttled("community-react", market.actor.userId, COMMUNITY_RULES.react, new Date())) fail(lang, to, "tooMany");
  const kind = formData.get("kind");
  const reactions = postReactions(market.db);
  if (kind === "none") await reactions.unreact(market.actor, postId ?? "");
  else if (kind === "like" || kind === "insightful" || kind === "celebrate" || kind === "support") {
    if ((await reactions.react(market.actor, postId ?? "", kind)) === "absent") fail(lang, to, "absent");
  }
  redirect(returnPath(lang, to, null, postId === null ? "" : `p-${postId}`));
}

export async function commentOnPost(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const postId = uuidOf(formData.get("postId"));
  const to: ReturnTo = postId === null ? { to: "feed", tab: "following" } : { to: "post", id: postId };
  const market = await actionMarket(lang);
  if (await throttled("community-comment", market.actor.userId, COMMUNITY_RULES.comment, new Date())) fail(lang, to, "tooMany");
  const speaker = await speakerOf(market);
  if (speaker === null) fail(lang, to, "speaker");
  const parentId = uuidOf(formData.get("parentId"));
  const result = await postComments(market.db).comment(market.actor, speaker.choice, postId ?? "", textOf(formData.get("body"), COMMENT_BODY_MAX), parentId, new Date());
  const error = errorOf(result);
  if (error !== null) fail(lang, to, error);
  redirect(returnPath(lang, to, null, result.kind === "created" ? `c-${result.id}` : ""));
}

export async function editComment(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const postId = uuidOf(formData.get("postId"));
  const to: ReturnTo = postId === null ? { to: "feed", tab: "following" } : { to: "post", id: postId };
  const market = await actionMarket(lang);
  if (await throttled("community-comment", market.actor.userId, COMMUNITY_RULES.comment, new Date())) fail(lang, to, "tooMany");
  const commentId = uuidOf(formData.get("commentId"));
  const result = await postComments(market.db).edit(market.actor, commentId ?? "", textOf(formData.get("body"), COMMENT_BODY_MAX), new Date());
  if (result === "absent") fail(lang, to, "absent");
  if (typeof result === "object") fail(lang, to, `text_${result.problem}`);
  redirect(returnPath(lang, to, null, commentId === null ? "" : `c-${commentId}`));
}

export async function deleteComment(formData: FormData): Promise<void> {
  const lang = langOf(formData.get("lang"));
  const postId = uuidOf(formData.get("postId"));
  const to: ReturnTo = postId === null ? { to: "feed", tab: "following" } : { to: "post", id: postId };
  const market = await actionMarket(lang);
  if (await throttled("community-comment", market.actor.userId, COMMUNITY_RULES.comment, new Date())) fail(lang, to, "tooMany");
  if (!(await postComments(market.db).remove(market.actor, uuidOf(formData.get("commentId")) ?? "", new Date()))) fail(lang, to, "absent");
  redirect(returnPath(lang, to));
}
