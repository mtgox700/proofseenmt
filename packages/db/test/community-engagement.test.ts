import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_COMMENTS_PER_DAY } from "../src/community-input";
import { gdpr } from "../src/gdpr";
import { peopleFollows } from "../src/people-follows";
import { postComments } from "../src/post-comments";
import { postFeed } from "../src/post-feed";
import { postReactions } from "../src/post-reactions";
import { postStats } from "../src/post-stats";
import { posts } from "../src/posts";
import { retention } from "../src/retention";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Ce qui vit autour d'une publication (C22) : réactions, commentaires à un niveau, partages, abonnements aux profils,
 * notifications regroupées, audience comptée sans pistage (empreinte du jour, auteur exclu, aucune adresse en base),
 * droits RGPD (export, effacement : « Compte supprimé ») et purge des publications supprimées.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-10-18T10:00:00Z");
const DAY = "2026-10-18";
const AS_PROFILE = { as: "profile" } as const;
const HASH_A = "AAAAAAAAAAAAAAAAAAAAAA";
const HASH_B = "BBBBBBBBBBBBBBBBBBBBBB";

const freelancer = async () => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId);
  const { reference, user } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { reference: true, user: { select: { clerkId: true } } } });
  return { userId, profileId, reference, clerkId: user.clerkId, actor: { userId } };
};

const publish = async (userId: string, body = "Comment j'ai réduit nos coûts cloud de moitié."): Promise<string> => {
  const result = await posts(t.db).create({ userId }, AS_PROFILE, { body }, NOW);
  if (result.kind !== "created") throw new Error(`publication refusée : ${result.kind}`);
  return result.id;
};

const unread = (userId: string, kind: "post_comment" | "post_reaction" | "post_share" | "new_follower") => t.db.appNotification.count({ where: { userId, kind, readAt: null } });

describe("réactions", () => {
  it("une par personne, changeable ; l'auteur est prévenu une fois par publication", async () => {
    const author = await freelancer();
    const id = await publish(author.userId);
    const [a, b] = [await createUser(t.db), await createUser(t.db)];
    expect(await postReactions(t.db).react({ userId: a }, id, "like")).toBe("reacted");
    expect(await postReactions(t.db).react({ userId: a }, id, "insightful")).toBe("changed");
    expect(await postReactions(t.db).react({ userId: b }, id, "celebrate")).toBe("reacted");
    expect(await postReactions(t.db).react(author.actor, id, "like")).toBe("reacted");
    expect(await unread(author.userId, "post_reaction")).toBe(1);
    const view = await postFeed(t.db).get({ userId: a }, id);
    expect(view?.counts.reactions).toEqual({ like: 1, insightful: 1, celebrate: 1, support: 0 });
    expect(view?.myReaction).toBe("insightful");
    expect(await postReactions(t.db).unreact({ userId: a }, id)).toBe(true);
    expect(await postReactions(t.db).react({ userId: a }, "pas-un-id", "like")).toBe("absent");
  });
});

describe("commentaires", () => {
  it("à un seul niveau, filtrés, notifiés, plafonnés", async () => {
    const author = await freelancer();
    const id = await publish(author.userId);
    const c = await freelancer();
    const first = await postComments(t.db).comment(c.actor, AS_PROFILE, id, "Très juste, merci.", null, NOW);
    if (first.kind !== "created") throw new Error("refusé");
    const reply = await postComments(t.db).comment(author.actor, AS_PROFILE, id, "Merci à vous !", first.id, NOW);
    if (reply.kind !== "created") throw new Error("réponse refusée");
    expect(await postComments(t.db).comment(c.actor, AS_PROFILE, id, "Réponse à une réponse", reply.id, NOW)).toEqual({ kind: "parent" });
    expect(await postComments(t.db).comment(c.actor, AS_PROFILE, id, "Mon mail : c@proton.me", null, NOW)).toEqual({ kind: "text", problem: "contact" });
    expect(await unread(author.userId, "post_comment")).toBe(1);
    expect(await unread(c.userId, "post_comment")).toBe(1);
    const thread = await postComments(t.db).list(null, id);
    expect(thread?.[0]?.replies.map((r) => r.body)).toEqual(["Merci à vous !"]);
    expect(thread?.[0]?.author?.name).toBe(c.reference);

    const busy = await freelancer();
    await t.db.postComment.createMany({ data: Array.from({ length: MAX_COMMENTS_PER_DAY }, () => ({ postId: id, authorUserId: busy.userId, profileId: busy.profileId, body: "x", createdAt: NOW })) });
    expect(await postComments(t.db).comment(busy.actor, AS_PROFILE, id, "Encore un", null, NOW)).toEqual({ kind: "limit" });
  });

  it("supprimé avec des réponses : reste vidé ; l'auteur de la publication peut supprimer un commentaire", async () => {
    const author = await freelancer();
    const id = await publish(author.userId);
    const c = await freelancer();
    const first = await postComments(t.db).comment(c.actor, AS_PROFILE, id, "Question technique", null, NOW);
    const lonely = await postComments(t.db).comment(c.actor, AS_PROFILE, id, "Hors sujet", null, NOW);
    if (first.kind !== "created" || lonely.kind !== "created") throw new Error("refusé");
    await postComments(t.db).comment(author.actor, AS_PROFILE, id, "Réponse", first.id, NOW);
    expect(await postComments(t.db).remove(c.actor, first.id, NOW)).toBe(true);
    expect(await postComments(t.db).remove(author.actor, lonely.id, NOW)).toBe(true);
    expect(await postComments(t.db).remove({ userId: await createUser(t.db) }, first.id, NOW)).toBe(false);
    const thread = await postComments(t.db).list(null, id);
    expect(thread?.map((x) => x.state)).toEqual(["deleted"]);
    expect(thread?.[0]?.body).toBe("");
  });
});

describe("partages et abonnements", () => {
  it("un partage reprend l'original, compte, et prévient son auteur", async () => {
    const author = await freelancer();
    const id = await publish(author.userId);
    const sharer = await freelancer();
    const shared = await posts(t.db).share(sharer.actor, AS_PROFILE, id, "À lire absolument", NOW);
    if (shared.kind !== "created") throw new Error("partage refusé");
    const again = await posts(t.db).share((await freelancer()).actor, AS_PROFILE, shared.id, "", NOW);
    if (again.kind !== "created") throw new Error("partage refusé");
    const view = await postFeed(t.db).get(null, again.id);
    expect(view?.shared).toMatchObject({ id });
    expect((await postFeed(t.db).get(null, id))?.counts.shares).toBe(2);
    expect(await unread(author.userId, "post_share")).toBe(1);
  });

  it("suivre un profil : ses publications dans le fil, une notification, ni soi-même ni un profil privé", async () => {
    const author = await freelancer();
    const id = await publish(author.userId);
    const reader = await freelancer();
    expect(await peopleFollows(t.db).follow(reader.actor, author.reference, NOW)).toBe("followed");
    expect(await peopleFollows(t.db).follow(reader.actor, author.reference, NOW)).toBe("already");
    expect(await peopleFollows(t.db).follow(author.actor, author.reference, NOW)).toBe("self");
    expect(await unread(author.userId, "new_follower")).toBe(1);
    expect((await postFeed(t.db).feed(reader.actor, "following", null)).items.map((p) => p.id)).toContain(id);
    const anonymous = await createUser(t.db);
    expect(await peopleFollows(t.db).follow({ userId: anonymous }, author.reference, NOW)).toBe("followed");
    const followers = await peopleFollows(t.db).followers(author.actor);
    expect(followers?.total).toBe(2);
    expect(followers?.shown.map((f) => f.reference)).toEqual([reader.reference]);
    expect((await peopleFollows(t.db).following(reader.actor)).profiles.map((p) => p.reference)).toEqual([author.reference]);
  });
});

describe("audience sans pistage", () => {
  it("un visiteur compte une fois par jour, l'auteur jamais, aucune adresse n'entre en base", async () => {
    const author = await freelancer();
    const id = await publish(author.userId);
    const stats = postStats(t.db);
    expect(await stats.record("impression", [id], { day: DAY, viewerHash: HASH_A, viewerClerkId: null })).toBe(1);
    expect(await stats.record("impression", [id], { day: DAY, viewerHash: HASH_A, viewerClerkId: null })).toBe(0);
    expect(await stats.record("view", [id], { day: DAY, viewerHash: HASH_A, viewerClerkId: null })).toBe(1);
    expect(await stats.record("view", [id], { day: DAY, viewerHash: HASH_B, viewerClerkId: author.clerkId })).toBe(0);
    expect(await stats.record("view", [id], { day: DAY, viewerHash: "203.0.113.7", viewerClerkId: null })).toBe(0);
    await expect(t.db.$executeRaw`INSERT INTO "PostStatSeen" ("day", "postId", "scope", "viewerHash") VALUES (${DAY}::date, ${id}::uuid, 'view', '203.0.113.7')`).rejects.toThrow();
    const view = await postFeed(t.db).get(author.actor, id);
    expect(view?.audience).toEqual({ impressions: 1, views: 1 });
    expect((await postFeed(t.db).get({ userId: await createUser(t.db) }, id))?.audience).toBeNull();
    expect(await postStats(t.db, { maxSightingsPerDay: 2 }).record("view", [id], { day: DAY, viewerHash: "CCCCCCCCCCCCCCCCCCCCCC", viewerClerkId: null })).toBe(0);
  });
});

describe("RGPD et conservation", () => {
  it("export : publications, commentaires, réactions ; effacement : « Compte supprimé »", async () => {
    const author = await freelancer();
    const id = await publish(author.userId);
    const leaver = await freelancer();
    const own = await publish(leaver.userId, "Ma propre publication");
    const comment = await postComments(t.db).comment(leaver.actor, AS_PROFILE, id, "Mon avis sur la question", null, NOW);
    if (comment.kind !== "created") throw new Error("refusé");
    await postReactions(t.db).react(leaver.actor, id, "support");
    const exported = await gdpr(t.db).exportUser(leaver.userId, NOW);
    expect(exported?.community).toMatchObject({ posts: [{ id: own }], comments: [{ id: comment.id, body: "Mon avis sur la question" }], reactions: [{ postId: id, kind: "support" }] });

    expect(await gdpr(t.db).eraseUser(leaver.userId)).toBe("erased");
    expect(await t.db.post.count({ where: { id: own } })).toBe(0);
    expect(await t.db.postReaction.count({ where: { postId: id } })).toBe(0);
    const thread = await postComments(t.db).list(null, id);
    expect(thread?.find((c) => c.id === comment.id)).toMatchObject({ state: "erased", author: null, body: "" });
    expect(await t.db.postComment.findUnique({ where: { id: comment.id }, select: { body: true, authorUserId: true } })).toEqual({ body: "", authorUserId: null });
  });

  it("une publication supprimée part pour de bon après 30 jours", async () => {
    const author = await freelancer();
    const id = await publish(author.userId);
    await posts(t.db).remove(author.actor, id, NOW);
    await retention(t.db).purge(new Date(NOW.getTime() + 10 * 86_400_000));
    expect(await t.db.post.count({ where: { id } })).toBe(1);
    const report = await retention(t.db).purge(new Date(NOW.getTime() + 31 * 86_400_000));
    expect(report.deletedPosts).toBeGreaterThanOrEqual(1);
    expect(await t.db.post.count({ where: { id } })).toBe(0);
  });
});
