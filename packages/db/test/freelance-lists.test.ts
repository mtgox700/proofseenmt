import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freelanceLists, MAX_ITEMS_PER_LIST, MAX_LISTS_PER_ORGANISATION } from "../src/freelance-lists";
import { gdpr } from "../src/gdpr";
import { searchProfiles } from "../src/profile-search";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, verifiedVigilance, type TestDatabase } from "./support/database";

/*
 * Listes de freelances d'une entreprise : partagées entre collègues, fermées aux autres entreprises, plafonnées, et
 * vidées d'un freelance qui efface son compte.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const company = async () => {
  const owner = await createUser(t.db);
  const colleague = await createUser(t.db);
  const organisationId = await createOrganisation(t.db, owner);
  await t.db.membership.create({ data: { organisationId, userId: colleague, role: "member" } });
  return { owner, colleague, organisationId };
};

const freelancer = async (visibility: "pseudonymous" | "private" = "pseudonymous") => {
  const userId = await createUser(t.db);
  return { userId, profileId: await createProfile(t.db, userId, visibility) };
};

const newList = async (userId: string, organisationId: string, name = "Favoris"): Promise<string> => {
  const created = await freelanceLists(t.db).create({ userId }, organisationId, name);
  if (created.kind !== "created") throw new Error(`liste non créée : ${created.kind}`);
  return created.id;
};

describe("listes partagées entre collègues", () => {
  it("une liste créée par un membre est vue, remplie et annotée par ses collègues", async () => {
    const { owner, colleague, organisationId } = await company();
    const listId = await newList(colleague, organisationId, "Mission data");
    const { profileId } = await freelancer();

    expect(await freelanceLists(t.db).addItem({ userId: owner }, listId, profileId)).toBe("added");
    expect(await freelanceLists(t.db).addItem({ userId: colleague }, listId, profileId)).toBe("already");

    const lists = await freelanceLists(t.db).lists({ userId: owner }, organisationId);
    expect(lists?.map((l) => [l.name, l.itemCount, l.removable])).toEqual([["Mission data", 1, true]]);
    expect((await freelanceLists(t.db).lists({ userId: colleague }, organisationId))?.[0]?.removable).toBe(true);

    const detail = await freelanceLists(t.db).detail({ userId: colleague }, listId);
    const itemId = detail?.items[0]?.itemId ?? "";
    expect(await freelanceLists(t.db).setNote({ userId: colleague }, itemId, "  Vu en entretien, très clair.  ")).toBe("saved");
    expect((await freelanceLists(t.db).detail({ userId: owner }, listId))?.items[0]?.note).toBe("Vu en entretien, très clair.");
    expect(await freelanceLists(t.db).setNote({ userId: owner }, itemId, "")).toBe("saved");
    expect((await freelanceLists(t.db).detail({ userId: owner }, listId))?.items[0]?.note).toBeNull();
    expect(await freelanceLists(t.db).setNote({ userId: owner }, itemId, "x".repeat(2001))).toBe("invalid");
  });

  it("compte les pouces de chaque membre sur la ligne, un seul par membre, et retire le sien", async () => {
    const { owner, colleague, organisationId } = await company();
    const listId = await newList(owner, organisationId);
    const { profileId } = await freelancer();
    await freelanceLists(t.db).addItem({ userId: owner }, listId, profileId);
    const itemId = (await freelanceLists(t.db).detail({ userId: owner }, listId))?.items[0]?.itemId ?? "";

    await freelanceLists(t.db).react({ userId: owner }, itemId, "up");
    await freelanceLists(t.db).react({ userId: owner }, itemId, "up");
    await freelanceLists(t.db).react({ userId: colleague }, itemId, "down");
    let item = (await freelanceLists(t.db).detail({ userId: owner }, listId))?.items[0];
    expect([item?.ups, item?.downs, item?.myReaction]).toEqual([1, 1, "up"]);

    await freelanceLists(t.db).react({ userId: colleague }, itemId, "up");
    await freelanceLists(t.db).react({ userId: owner }, itemId, null);
    item = (await freelanceLists(t.db).detail({ userId: colleague }, listId))?.items[0];
    expect([item?.ups, item?.downs, item?.myReaction]).toEqual([1, 0, "up"]);
  });

  it("seuls le créateur et les administrateurs suppriment une liste", async () => {
    const { owner, colleague, organisationId } = await company();
    const listId = await newList(owner, organisationId);
    expect((await freelanceLists(t.db).lists({ userId: colleague }, organisationId))?.[0]?.removable).toBe(false);
    expect(await freelanceLists(t.db).remove({ userId: colleague }, listId)).toBe(false);
    expect(await freelanceLists(t.db).remove({ userId: owner }, listId)).toBe(true);
    expect(await freelanceLists(t.db).detail({ userId: owner }, listId)).toBeNull();
  });
});

describe("contrôle d'accès dans chaque requête", () => {
  it("la liste d'une autre entreprise est absente, en lecture comme en écriture", async () => {
    const mine = await company();
    const theirs = await company();
    const listId = await newList(mine.owner, mine.organisationId);
    const { profileId } = await freelancer();
    await freelanceLists(t.db).addItem({ userId: mine.owner }, listId, profileId);
    const itemId = (await freelanceLists(t.db).detail({ userId: mine.owner }, listId))?.items[0]?.itemId ?? "";
    const outsider = { userId: theirs.owner };

    expect(await freelanceLists(t.db).detail(outsider, listId)).toBeNull();
    expect(await freelanceLists(t.db).lists(outsider, mine.organisationId)).toBeNull();
    expect(await freelanceLists(t.db).create(outsider, mine.organisationId, "Intrus")).toEqual({ kind: "absent" });
    expect(await freelanceLists(t.db).addItem(outsider, listId, profileId)).toBe("absent");
    expect(await freelanceLists(t.db).setNote(outsider, itemId, "lu")).toBe("absent");
    expect(await freelanceLists(t.db).react(outsider, itemId, "down")).toBe("absent");
    expect(await freelanceLists(t.db).removeItem(outsider, itemId)).toBe(false);
    expect(await freelanceLists(t.db).remove(outsider, listId)).toBe(false);

    const item = (await freelanceLists(t.db).detail({ userId: mine.owner }, listId))?.items[0];
    expect([item?.note, item?.downs]).toEqual([null, 0]);
  });

  it("refuse un identifiant mal formé et un profil privé", async () => {
    const { owner, organisationId } = await company();
    const listId = await newList(owner, organisationId);
    const hidden = await freelancer("private");
    expect(await freelanceLists(t.db).addItem({ userId: owner }, listId, hidden.profileId)).toBe("absent");
    expect(await freelanceLists(t.db).addItem({ userId: owner }, "pas-un-id", hidden.profileId)).toBe("absent");
    expect(await freelanceLists(t.db).detail({ userId: owner }, "' OR 1=1 --")).toBeNull();
    expect(await freelanceLists(t.db).create({ userId: owner }, organisationId, "   ")).toEqual({ kind: "invalid" });
  });

  it("un profil retiré depuis reste par sa seule référence, sans ses faits", async () => {
    const { owner, organisationId } = await company();
    const listId = await newList(owner, organisationId);
    const { profileId } = await freelancer();
    await freelanceLists(t.db).addItem({ userId: owner }, listId, profileId);
    await t.db.freelanceProfile.update({ where: { id: profileId }, data: { visibility: "private" } });
    const item = (await freelanceLists(t.db).detail({ userId: owner }, listId))?.items[0];
    expect(item?.published).toBe(false);
    expect(item?.card).toBeNull();
    expect(item?.reference).toMatch(/^FR-/);
  });
});

describe("une seule carte de freelance (refonte de l'espace connecté, lot 5)", () => {
  it("une ligne de liste porte la carte de la recherche : mêmes faits vérifiés, mise à jour, disponibilité et langues", async () => {
    const { owner, organisationId } = await company();
    const listId = await newList(owner, organisationId);
    const proven = await freelancer();
    await t.db.ownedUrl.create({ data: { profileId: proven.profileId, url: "https://liste.example/", urlKey: "https://liste.example", proofMethod: "meta_tag", verifiedAt: new Date() } });
    await verifiedVigilance(t.db, proven.profileId);
    await t.db.profileLanguage.create({ data: { profileId: proven.profileId, code: "en", level: "c1" } });
    await freelanceLists(t.db).addItem({ userId: owner }, listId, proven.profileId);

    const now = new Date();
    const item = (await freelanceLists(t.db).detail({ userId: owner }, listId, now))?.items[0];
    const searched = (await searchProfiles(t.db, { pageSize: 50 }, now)).items.find((card) => card.id === proven.profileId);
    expect(searched).toBeDefined();
    expect(item?.card).toEqual(searched);
    expect([item?.card?.verifiedUrls, item?.card?.vigilanceValid, item?.card?.languages]).toEqual([1, true, [{ code: "en", level: "c1" }]]);
    expect(item?.card?.updatedAt).toBeInstanceOf(Date);
    expect(item?.card?.availabilityAt).toBeInstanceOf(Date);
  });

  it("garde l'ordre d'ajout, jamais un ordre par faits vérifiés (AI Act)", async () => {
    const { owner, organisationId } = await company();
    const listId = await newList(owner, organisationId);
    const proven = await freelancer();
    const plain = await freelancer();
    await t.db.ownedUrl.create({ data: { profileId: proven.profileId, url: "https://ordre.example/", urlKey: "https://ordre.example", proofMethod: "meta_tag", verifiedAt: new Date() } });
    await freelanceLists(t.db).addItem({ userId: owner }, listId, proven.profileId);
    await freelanceLists(t.db).addItem({ userId: owner }, listId, plain.profileId);
    const items = (await freelanceLists(t.db).detail({ userId: owner }, listId))?.items ?? [];
    // Le plus récent d'abord : le profil sans fait vérifié, ajouté en dernier, reste en tête.
    expect(items.map((i) => i.profileId)).toEqual([plain.profileId, proven.profileId]);
    expect(items.map((i) => i.card?.verifiedUrls)).toEqual([0, 1]);
  });
});

describe("profil retiré du public par un opérateur (revue vague 3, L9)", () => {
  it("un profil masqué, ou dont le compte est suspendu, se lit comme non publié", async () => {
    const { owner, organisationId } = await company();
    const listId = await newList(owner, organisationId);
    const hidden = await freelancer();
    const suspended = await freelancer();
    await freelanceLists(t.db).addItem({ userId: owner }, listId, hidden.profileId);
    await freelanceLists(t.db).addItem({ userId: owner }, listId, suspended.profileId);
    await t.db.freelanceProfile.update({ where: { id: hidden.profileId }, data: { moderatedAt: new Date(), moderationReason: "Contenu trompeur" } });
    await t.db.user.update({ where: { id: suspended.userId }, data: { suspendedAt: new Date(), suspensionReason: "Fraude avérée" } });
    const items = (await freelanceLists(t.db).detail({ userId: owner }, listId))?.items ?? [];
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.published).toBe(false);
      expect(item.card).toBeNull();
    }
  });
});

describe("plafonds", () => {
  it(`au plus ${MAX_LISTS_PER_ORGANISATION} listes par entreprise`, async () => {
    const { owner, organisationId } = await company();
    await t.db.freelanceList.createMany({ data: Array.from({ length: MAX_LISTS_PER_ORGANISATION }, (_, i) => ({ organisationId, name: `Liste ${i}`, createdByUserId: owner })) });
    expect(await freelanceLists(t.db).create({ userId: owner }, organisationId, "Une de trop")).toEqual({ kind: "limit" });
  });

  it(`au plus ${MAX_ITEMS_PER_LIST} freelances par liste`, async () => {
    const { owner, organisationId } = await company();
    const listId = await newList(owner, organisationId);
    const users = await Promise.all(Array.from({ length: MAX_ITEMS_PER_LIST }, (_, i) => t.db.user.create({ data: { clerkId: `cap_${i}_${listId}`, email: `cap${i}.${listId}@test.fr`, displayName: "Cap" }, select: { id: true } })));
    const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    await t.db.freelanceProfile.createMany({
      data: users.map((u, i) => ({ userId: u.id, reference: `FR-CP${ALPHABET[Math.floor(i / 31) % 31]}${ALPHABET[i % 31]}Z`, workMode: "remote" as const })),
    });
    const profileIds = (await t.db.freelanceProfile.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true } })).map((p) => p.id);
    await t.db.freelanceListItem.createMany({ data: profileIds.map((profileId) => ({ listId, profileId })) });
    const { profileId } = await freelancer();
    expect(await freelanceLists(t.db).addItem({ userId: owner }, listId, profileId)).toBe("limit");
  }, 120_000);
});

describe("RGPD", () => {
  it("un freelance qui efface son compte disparaît des listes ; le membre effacé laisse la liste à l'entreprise", async () => {
    const { owner, colleague, organisationId } = await company();
    const listId = await newList(colleague, organisationId);
    const leaving = await freelancer();
    const staying = await freelancer();
    await freelanceLists(t.db).addItem({ userId: colleague }, listId, leaving.profileId);
    await freelanceLists(t.db).addItem({ userId: colleague }, listId, staying.profileId);
    const items = (await freelanceLists(t.db).detail({ userId: owner }, listId))?.items ?? [];
    for (const item of items) await freelanceLists(t.db).react({ userId: colleague }, item.itemId, "up");

    const exported = await gdpr(t.db).exportUser(colleague, new Date());
    expect(exported?.freelanceLists).toMatchObject({ created: [{ id: listId }], itemsAdded: [{ listId }, { listId }], reactions: [{ reaction: "up" }, { reaction: "up" }] });

    expect(await gdpr(t.db).eraseUser(leaving.userId)).toBe("erased");
    expect((await freelanceLists(t.db).detail({ userId: owner }, listId))?.items.map((i) => i.profileId)).toEqual([staying.profileId]);

    expect(await gdpr(t.db).eraseUser(colleague)).toBe("erased");
    const after = await freelanceLists(t.db).detail({ userId: owner }, listId);
    expect(after?.items[0]?.ups).toBe(0);
    expect(after?.items[0]?.addedByName).toBeNull();
    expect((await freelanceLists(t.db).lists({ userId: owner }, organisationId))?.[0]?.createdByName).toBeNull();
  });
});
