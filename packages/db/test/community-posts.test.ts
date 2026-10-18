import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Operator } from "../src/back-office";
import { MAX_POSTS_PER_DAY } from "../src/community-input";
import { communityModeration } from "../src/community-moderation";
import { postComments } from "../src/post-comments";
import { postFeed } from "../src/post-feed";
import { postReactions } from "../src/post-reactions";
import { posts } from "../src/posts";
import { storedFiles } from "../src/stored-files";
import { userDesk } from "../src/user-desk";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Publications de la communauté (C22) : qui peut publier et au nom de qui, filtre des coordonnées, plafond quotidien,
 * contrôle d'accès dans les requêtes (publique, membres, la sienne), modération et suspension honorées par chaque chemin
 * public, image visible selon la publication.
 */

let t: TestDatabase;
let operator: Operator;

beforeAll(async () => {
  t = await openTestDatabase();
  operator = { role: "operator", userId: await createUser(t.db) };
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-10-18T10:00:00Z");
const AS_PROFILE = { as: "profile" } as const;

const freelancer = async (visibility: "pseudonymous" | "named" | "private" = "pseudonymous") => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId, visibility === "private" ? "private" : "pseudonymous");
  if (visibility === "named") await t.db.freelanceProfile.update({ where: { id: profileId }, data: { visibility: "named" } });
  const { reference } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { reference: true } });
  return { userId, profileId, reference, actor: { userId } };
};

const publish = async (userId: string, body = "Retour d'expérience sur une migration Postgres.", extra: { visibility?: "public" | "members" } = {}): Promise<string> => {
  const result = await posts(t.db).create({ userId }, AS_PROFILE, { body, ...extra }, NOW);
  if (result.kind !== "created") throw new Error(`publication refusée : ${result.kind}`);
  return result.id;
};

describe("publier", () => {
  it("au nom de son profil publié, jamais d'un profil privé", async () => {
    const f = await freelancer();
    expect((await posts(t.db).create(f.actor, AS_PROFILE, { body: "Bonjour la communauté" }, NOW)).kind).toBe("created");
    const hidden = await freelancer("private");
    expect(await posts(t.db).create(hidden.actor, AS_PROFILE, { body: "Bonjour" }, NOW)).toEqual({ kind: "speaker" });
  });

  it("au nom d'une entreprise dont on est membre, jamais d'une autre", async () => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    expect((await posts(t.db).create({ userId: owner }, { as: "organisation", organisationId: org }, { body: "Nous recrutons des freelances data." }, NOW)).kind).toBe("created");
    const stranger = await createUser(t.db);
    expect(await posts(t.db).create({ userId: stranger }, { as: "organisation", organisationId: org }, { body: "Usurpation" }, NOW)).toEqual({ kind: "speaker" });
  });

  it("refuse les coordonnées, le HTML brut et les liens de contact", async () => {
    const f = await freelancer();
    const create = (body: string, linkUrl?: string) => posts(t.db).create(f.actor, AS_PROFILE, { body, linkUrl }, NOW);
    expect(await create("Écrivez-moi : jean.dupont@gmail.com")).toEqual({ kind: "text", problem: "contact" });
    expect(await create("Appelez le 06 12 34 56 78")).toEqual({ kind: "text", problem: "contact" });
    expect(await create("Retrouvez-moi sur WhatsApp")).toEqual({ kind: "text", problem: "contact" });
    expect(await create("Un <script>alert(1)</script> piégé")).toEqual({ kind: "text", problem: "html" });
    expect(await create("Mon article", "https://www.linkedin.com/in/jean")).toEqual({ kind: "link", problem: "contact" });
    expect(await create("Mon article", "http://exemple.dev/billet")).toEqual({ kind: "link", problem: "invalid" });
    expect(await create("Mon article", "https://exemple.dev/billet")).toMatchObject({ kind: "created" });
    expect(await create("   ")).toEqual({ kind: "text", problem: "empty" });
  });

  it("plafonne les publications d'une personne sur 24 heures", async () => {
    const f = await freelancer();
    await t.db.post.createMany({ data: Array.from({ length: MAX_POSTS_PER_DAY }, () => ({ authorUserId: f.userId, profileId: f.profileId, body: "x", createdAt: new Date(NOW.getTime() - 3_600_000) })) });
    expect(await posts(t.db).create(f.actor, AS_PROFILE, { body: "Une de trop" }, NOW)).toEqual({ kind: "limit" });
    expect((await posts(t.db).create(f.actor, AS_PROFILE, { body: "Le lendemain" }, new Date(NOW.getTime() + 86_400_000))).kind).toBe("created");
  });
});

describe("lire, modifier, supprimer", () => {
  it("une publication réservée aux membres ne se lit pas en public", async () => {
    const f = await freelancer();
    const id = await publish(f.userId, "Réservé aux membres", { visibility: "members" });
    expect(await postFeed(t.db).get(null, id)).toBeNull();
    const reader = await createUser(t.db);
    expect((await postFeed(t.db).get({ userId: reader }, id))?.body).toBe("Réservé aux membres");
    expect((await postFeed(t.db).feed({ userId: reader }, "discover", null)).items.map((p) => p.id)).not.toContain(id);
  });

  it("seuls l'auteur et les administrateurs de l'entreprise modifient ou suppriment", async () => {
    const f = await freelancer();
    const id = await publish(f.userId);
    const other = await createUser(t.db);
    expect(await posts(t.db).edit({ userId: other }, id, { body: "Piraté" }, NOW)).toEqual({ kind: "absent" });
    expect((await posts(t.db).remove({ userId: other }, id, NOW)).removed).toBe(false);
    expect(await posts(t.db).edit(f.actor, id, { body: "Corrigé" }, NOW)).toEqual({ kind: "edited" });
    expect(await posts(t.db).edit(f.actor, id, { body: "Mon numéro 0612345678" }, NOW)).toEqual({ kind: "text", problem: "contact" });

    const owner = await createUser(t.db);
    const member = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    await t.db.membership.create({ data: { organisationId: org, userId: member, role: "member" } });
    const writer = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: org, userId: writer, role: "member" } });
    const created = await posts(t.db).create({ userId: writer }, { as: "organisation", organisationId: org }, { body: "Notre équipe s'agrandit." }, NOW);
    if (created.kind !== "created") throw new Error("non publiée");
    expect((await posts(t.db).remove({ userId: member }, created.id, NOW)).removed).toBe(false);
    expect((await posts(t.db).remove({ userId: owner }, created.id, NOW)).removed).toBe(true);
    expect(await postFeed(t.db).get({ userId: writer }, created.id)).toBeNull();
  });

  it("le fil est rangé par date seulement, et pagine", async () => {
    const f = await freelancer();
    const reader = await createUser(t.db);
    await t.db.profileFollow.create({ data: { userId: reader, profileId: f.profileId } });
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const r = await posts(t.db).create(f.actor, AS_PROFILE, { body: `Billet ${i}` }, new Date(NOW.getTime() + i * 1000));
      if (r.kind === "created") ids.push(r.id);
    }
    const page = await postFeed(t.db).feed({ userId: reader }, "following", null);
    expect(page.items.map((p) => p.id).slice(0, 3)).toEqual([...ids].reverse());
    expect(await postFeed(t.db).feed({ userId: reader }, "following", "illisible")).toMatchObject({ items: expect.any(Array) });
  });
});

describe("la modération et la suspension sortent la publication de chaque chemin public", () => {
  it("publication masquée : absente du public, du fil, des pages, du sitemap ; l'auteur la voit avec le motif", async () => {
    const f = await freelancer();
    const id = await publish(f.userId, "Contenu à masquer");
    const reader = await createUser(t.db);
    expect(await communityModeration(t.db, operator).hide("post", id, "Contenu trompeur", NOW)).toBe("done");
    expect(await communityModeration(t.db, operator).hide("post", id, "Contenu trompeur", NOW)).toBe("unchanged");
    expect(await postFeed(t.db).get(null, id)).toBeNull();
    expect(await postFeed(t.db).get({ userId: reader }, id)).toBeNull();
    expect((await postFeed(t.db).feed({ userId: reader }, "discover", null)).items.map((p) => p.id)).not.toContain(id);
    expect((await postFeed(t.db).recentFor({ reference: f.reference })).map((p) => p.id)).not.toContain(id);
    expect((await postFeed(t.db).listPublic()).map((p) => p.id)).not.toContain(id);
    expect(await postComments(t.db).list(null, id)).toBeNull();
    expect((await posts(t.db).share({ userId: reader }, AS_PROFILE, id, "", NOW)).kind).not.toBe("created");
    expect((await postFeed(t.db).get(f.actor, id))?.moderationReason).toBe("Contenu trompeur");
    expect(await t.db.operatorAction.count({ where: { targetId: id, action: "post_hidden" } })).toBe(1);
    expect(await t.db.notification.count({ where: { userId: f.userId, kind: "account_notice" } })).toBe(1);
    expect(await communityModeration(t.db, operator).restore("post", id, "Vérifié", NOW)).toBe("done");
    expect(await postFeed(t.db).get(null, id)).not.toBeNull();
  });

  it("auteur suspendu, profil masqué ou repassé en privé, entreprise masquée : plus rien de public", async () => {
    const suspended = await freelancer();
    const a = await publish(suspended.userId);
    await userDesk(t.db, operator).suspend(suspended.userId, "Fraude avérée", NOW);
    expect(await postFeed(t.db).get(null, a)).toBeNull();

    const privateAgain = await freelancer();
    const b = await publish(privateAgain.userId);
    await t.db.freelanceProfile.update({ where: { id: privateAgain.profileId }, data: { visibility: "private" } });
    expect(await postFeed(t.db).get(null, b)).toBeNull();

    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    const created = await posts(t.db).create({ userId: owner }, { as: "organisation", organisationId: org }, { body: "Offre de mission" }, NOW);
    if (created.kind !== "created") throw new Error("non publiée");
    await t.db.organisation.update({ where: { id: org }, data: { suspendedAt: NOW, suspensionReason: "Entreprise fictive" } });
    expect(await postFeed(t.db).get(null, created.id)).toBeNull();
    expect((await postFeed(t.db).listPublic()).map((p) => p.id)).not.toContain(created.id);
  });

  it("commentaire masqué : absent pour les autres, visible par son auteur avec le motif", async () => {
    const f = await freelancer();
    const id = await publish(f.userId);
    const commenter = await freelancer();
    const c = await postComments(t.db).comment(commenter.actor, AS_PROFILE, id, "Commentaire limite", null, NOW);
    if (c.kind !== "created") throw new Error("commentaire refusé");
    expect(await communityModeration(t.db, operator).hide("comment", c.id, "Propos injurieux", NOW)).toBe("done");
    expect((await postComments(t.db).list(null, id))?.map((x) => x.id)).not.toContain(c.id);
    expect((await postComments(t.db).list(commenter.actor, id))?.find((x) => x.id === c.id)).toMatchObject({ state: "moderated", moderationReason: "Propos injurieux" });
    expect((await postFeed(t.db).get(null, id))?.counts.comments).toBe(0);
  });
});

describe("image d'une publication", () => {
  const image = async (owner: string): Promise<string> => {
    const id = randomUUID();
    expect(await storedFiles(t.db).record({ userId: owner }, { id, kind: "post_image", contentType: "image/webp", size: 1000, sha256: "c".repeat(64), width: 800, height: 600 })).toBe("recorded");
    return id;
  };

  it("publique sous un profil nominatif, réservée aux connectés pour les membres, refusée sous un pseudonyme", async () => {
    const named = await freelancer("named");
    const file = await image(named.userId);
    const created = await posts(t.db).create(named.actor, AS_PROFILE, { body: "Mon schéma d'architecture", imageFileId: file }, NOW);
    expect(created.kind).toBe("created");
    expect((await storedFiles(t.db).readable(file, null))?.audience).toBe("public");

    const membersFile = await image(named.userId);
    await posts(t.db).create(named.actor, AS_PROFILE, { body: "Pour les membres", imageFileId: membersFile, visibility: "members" }, NOW);
    expect(await storedFiles(t.db).readable(membersFile, null)).toBeNull();
    expect((await storedFiles(t.db).readable(membersFile, { userId: await createUser(t.db) }))?.audience).toBe("member");

    const pseudo = await freelancer();
    const hiddenFile = await image(pseudo.userId);
    expect(await posts(t.db).create(pseudo.actor, AS_PROFILE, { body: "Avec image", imageFileId: hiddenFile }, NOW)).toEqual({ kind: "image" });
    // L'image d'un autre compte n'est jamais reprise.
    expect(await posts(t.db).create(named.actor, AS_PROFILE, { body: "Image volée", imageFileId: hiddenFile }, NOW)).toEqual({ kind: "image" });
  });

  it("supprimer la publication rend le fichier à effacer et le retire de la base", async () => {
    const named = await freelancer("named");
    const file = await image(named.userId);
    const created = await posts(t.db).create(named.actor, AS_PROFILE, { body: "Éphémère", imageFileId: file }, NOW);
    if (created.kind !== "created") throw new Error("non publiée");
    expect(await posts(t.db).remove(named.actor, created.id, NOW)).toEqual({ removed: true, fileIds: [file] });
    expect(await t.db.storedFile.count({ where: { id: file } })).toBe(0);
  });
});

describe("relecture sécurité C22 : qui garde la main sur une publication", () => {
  it("une personne qui a quitté l'entreprise ne modifie ni ne supprime plus ce qu'elle a écrit en son nom", async () => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    const writer = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId: org, userId: writer, role: "member" } });
    const created = await posts(t.db).create({ userId: writer }, { as: "organisation", organisationId: org }, { body: "Nous recrutons." }, NOW);
    if (created.kind !== "created") throw new Error("non publiée");
    const comment = await postComments(t.db).comment({ userId: writer }, { as: "organisation", organisationId: org }, created.id, "Écrivez-nous ici.", null, NOW);
    if (comment.kind !== "created") throw new Error("commentaire refusé");
    expect(await posts(t.db).edit({ userId: writer }, created.id, { body: "Encore membre" }, NOW)).toEqual({ kind: "edited" });

    await t.db.membership.deleteMany({ where: { organisationId: org, userId: writer } });
    expect(await posts(t.db).edit({ userId: writer }, created.id, { body: "Lien piégé" }, NOW)).toEqual({ kind: "absent" });
    expect((await posts(t.db).remove({ userId: writer }, created.id, NOW)).removed).toBe(false);
    expect(await postComments(t.db).edit({ userId: writer }, comment.id, "Réécrit", NOW)).toBe("absent");
    expect(await postComments(t.db).remove({ userId: writer }, comment.id, NOW)).toBe(false);
    expect((await t.db.post.findUniqueOrThrow({ where: { id: created.id }, select: { body: true } })).body).toBe("Encore membre");
    expect((await posts(t.db).remove({ userId: owner }, created.id, NOW)).removed).toBe(true);
  });

  it("une publication masquée ne se réécrit pas, ne s'aime pas et ne se commente pas, même par son auteur", async () => {
    const f = await freelancer();
    const id = await publish(f.userId, "À masquer");
    expect(await communityModeration(t.db, operator).hide("post", id, "Contenu trompeur", NOW)).toBe("done");
    expect(await posts(t.db).edit(f.actor, id, { body: "Réécrit avant la remise en ligne" }, NOW)).toEqual({ kind: "absent" });
    expect(await postReactions(t.db).react(f.actor, id, "like")).toBe("absent");
    expect((await postComments(t.db).comment(f.actor, AS_PROFILE, id, "Je me réponds", null, NOW)).kind).not.toBe("created");
    expect((await t.db.post.findUniqueOrThrow({ where: { id }, select: { body: true } })).body).toBe("À masquer");
  });

  it("un membre simple ne lit pas la publication masquée d'un collègue ; l'administrateur, si", async () => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    const writer = await createUser(t.db);
    const colleague = await createUser(t.db);
    await t.db.membership.createMany({ data: [{ organisationId: org, userId: writer, role: "member" }, { organisationId: org, userId: colleague, role: "member" }] });
    const created = await posts(t.db).create({ userId: writer }, { as: "organisation", organisationId: org }, { body: "Annonce" }, NOW);
    if (created.kind !== "created") throw new Error("non publiée");
    await communityModeration(t.db, operator).hide("post", created.id, "Annonce trompeuse", NOW);
    expect(await postFeed(t.db).get({ userId: colleague }, created.id)).toBeNull();
    expect(await postFeed(t.db).get({ userId: owner }, created.id)).not.toBeNull();
    expect(await postFeed(t.db).get({ userId: writer }, created.id)).not.toBeNull();
  });

  it("le journal de l'opérateur ne garde aucun extrait du texte masqué", async () => {
    const f = await freelancer();
    const id = await publish(f.userId, "Texte personnel à ne pas garder");
    await communityModeration(t.db, operator).hide("post", id, "Contenu trompeur", NOW);
    const entry = await t.db.operatorAction.findFirstOrThrow({ where: { targetId: id, action: "post_hidden" }, select: { metadata: true } });
    expect(JSON.stringify(entry.metadata ?? {})).not.toContain("personnel");
  });

  it("une entreprise suspendue ne fait plus réagir ses membres à ses publications", async () => {
    const owner = await createUser(t.db);
    const org = await createOrganisation(t.db, owner);
    const created = await posts(t.db).create({ userId: owner }, { as: "organisation", organisationId: org }, { body: "Offre" }, NOW);
    if (created.kind !== "created") throw new Error("non publiée");
    await t.db.organisation.update({ where: { id: org }, data: { suspendedAt: NOW, suspensionReason: "Entreprise fictive" } });
    expect(await postReactions(t.db).react({ userId: owner }, created.id, "like")).toBe("absent");
  });
});
