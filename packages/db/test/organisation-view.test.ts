import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { organisationView } from "../src/organisation-view";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

describe("membres d'une entreprise", () => {
  it("chaque membre voit l'équipe ; seuls les administrateurs voient les adresses", async () => {
    const owner = await createUser(t.db);
    const organisationId = await createOrganisation(t.db, owner);
    const member = await createUser(t.db);
    const admin = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId, userId: member, role: "member" } });
    await t.db.membership.create({ data: { organisationId, userId: admin, role: "admin" } });

    const seenByOwner = await organisationView(t.db).members({ userId: owner }, organisationId);
    expect(seenByOwner?.map((m) => m.role)).toEqual(["owner", "admin", "member"]);
    expect(seenByOwner?.every((m) => m.email !== null)).toBe(true);
    expect(seenByOwner?.find((m) => m.userId === owner)?.isMe).toBe(true);

    const seenByMember = await organisationView(t.db).members({ userId: member }, organisationId);
    expect(seenByMember).toHaveLength(3);
    expect(seenByMember?.every((m) => m.email === null)).toBe(true);
  });

  it("un tiers ne voit rien", async () => {
    const organisationId = await createOrganisation(t.db, await createUser(t.db));
    expect(await organisationView(t.db).members({ userId: await createUser(t.db) }, organisationId)).toBeNull();
    expect(await organisationView(t.db).members({ userId: await createUser(t.db) }, "pas-un-uuid")).toBeNull();
    expect(await organisationView(t.db).approvalLevels({ userId: await createUser(t.db) }, organisationId)).toBeNull();
  });

  it("dit la règle de validation à ses membres", async () => {
    const owner = await createUser(t.db);
    const organisationId = await createOrganisation(t.db, owner);
    expect(await organisationView(t.db).approvalLevels({ userId: owner }, organisationId)).toBe(1);
  });
});
