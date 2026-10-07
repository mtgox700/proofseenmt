import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inbox, INBOX_LIMIT } from "../src/inbox";
import { messaging } from "../src/messaging";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-11-20T10:00:00Z");

const referenceOf = async (profileId: string): Promise<string> => (await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { reference: true } })).reference;

/** Une entreprise qui écrit à un freelance publié. */
const contact = async (body = "Bonjour, une mission data de 3 mois ?") => {
  const owner = await createUser(t.db);
  const organisationId = await createOrganisation(t.db, owner);
  const freelanceUser = await createUser(t.db);
  const profileId = await createProfile(t.db, freelanceUser);
  const opened = await messaging(t.db).contact({ userId: owner }, organisationId, profileId, body);
  if (opened.kind !== "opened") throw new Error(opened.kind);
  return { owner, organisationId, freelanceUser, profileId, conversationId: opened.conversation.id };
};

describe("boîte de réception", () => {
  it("chaque côté voit l'autre : l'entreprise par son nom, le freelance par sa référence, jamais par son nom", async () => {
    const c = await contact();
    const [company] = await inbox(t.db).threads({ userId: c.owner });
    expect(company).toMatchObject({ id: c.conversationId, side: "company", status: "pending", counterpart: { kind: "profile", reference: await referenceOf(c.profileId), headline: "Dev" } });
    expect(company?.lastMessage).toEqual({ preview: "Bonjour, une mission data de 3 mois ?", mine: true });

    const [freelance] = await inbox(t.db).threads({ userId: c.freelanceUser });
    expect(freelance).toMatchObject({ side: "freelance", counterpart: { kind: "organisation", name: "Acme" } });
    expect(freelance?.lastMessage?.mine).toBe(false);
    expect(JSON.stringify(company)).not.toMatch(/User \d+/);
  });

  it("le freelance décide d'un contact en attente ; on n'écrit qu'une fois accepté", async () => {
    const c = await contact();
    expect(await inbox(t.db).thread({ userId: c.freelanceUser }, c.conversationId)).toMatchObject({ canDecide: true, canPost: false });
    expect(await inbox(t.db).thread({ userId: c.owner }, c.conversationId)).toMatchObject({ canDecide: false, canPost: false });
    await messaging(t.db).decide({ userId: c.freelanceUser }, c.conversationId, "accepted", NOW);
    expect(await inbox(t.db).thread({ userId: c.owner }, c.conversationId)).toMatchObject({ canDecide: false, canPost: true });
  });

  it("un tiers ne voit ni le fil ni son existence", async () => {
    const c = await contact();
    const stranger = await createUser(t.db);
    expect(await inbox(t.db).threads({ userId: stranger })).toEqual([]);
    expect(await inbox(t.db).thread({ userId: stranger }, c.conversationId)).toBeNull();
    expect(await inbox(t.db).thread({ userId: c.owner }, "pas-un-uuid")).toBeNull();
  });

  it("tronque l'aperçu d'un long message", async () => {
    const c = await contact(`Mission ${"x".repeat(400)}`);
    const [thread] = await inbox(t.db).threads({ userId: c.owner });
    expect(thread?.lastMessage?.preview).toHaveLength(140);
    expect(thread?.lastMessage?.preview.endsWith("…")).toBe(true);
    expect(INBOX_LIMIT).toBeGreaterThan(0);
  });

  it("ne donne comme destinataire qu'un profil publié, par sa référence", async () => {
    const published = await createProfile(t.db, await createUser(t.db));
    const hidden = await createProfile(t.db, await createUser(t.db), "private");
    expect(await inbox(t.db).contactTarget(await referenceOf(published))).toMatchObject({ profileId: published });
    expect(await inbox(t.db).contactTarget(await referenceOf(hidden))).toBeNull();
    expect(await inbox(t.db).contactTarget("FR-' OR 1=1")).toBeNull();
  });
});
