import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { invitationAnswers } from "../src/invitation-answers";
import { invitations } from "../src/invitations";
import { talentPool } from "../src/talent-pool";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Le vivier privé (C23, relecture de sécurité) : un profil masqué n'y figure pas, un profil privé n'y montre que sa
 * référence, le freelance quitte un vivier quand il veut et seul un administrateur de l'entreprise l'en retire. Chaque
 * accès est tenté par quelqu'un d'autre.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const NOW = new Date("2026-10-19T09:00:00Z");
const pool = () => talentPool(t.db);

/** Une entreprise, et un freelance entré dans son vivier en acceptant son invitation. */
const joined = async () => {
  const ownerId = await createUser(t.db);
  const organisationId = await createOrganisation(t.db, ownerId);
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId);
  await t.db.freelanceProfile.update({ where: { id: profileId }, data: { skills: { create: { skill: { create: { key: `rust-${profileId}`, label: "Rust" } } } } } });
  const { email } = await t.db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const link = { id: randomUUID(), token: randomBytes(32).toString("base64url") };
  expect((await invitations(t.db).invite({ userId: ownerId }, { kind: "freelance", organisationId }, { email, message: null }, link, "fr", NOW)).kind).toBe("invited");
  const answer = await invitationAnswers(t.db).answer({ userId }, [email], { id: link.id, token: link.token, decision: "accept", kind: "freelance", organisationId: null }, NOW);
  expect(answer.kind).toBe("accepted");
  return { owner: { userId: ownerId }, organisationId, freelancer: { userId }, profileId };
};

describe("vivier privé", () => {
  it("n'y montre pas un profil masqué par un opérateur", async () => {
    const { owner, organisationId, profileId } = await joined();
    expect((await pool().list(owner, organisationId))?.map((m) => m.profileId)).toEqual([profileId]);
    await t.db.freelanceProfile.update({ where: { id: profileId }, data: { moderatedAt: NOW, moderationReason: "test" } });
    expect(await pool().list(owner, organisationId)).toEqual([]);
  });

  it("ne montre d'un profil privé que sa référence", async () => {
    const { owner, organisationId, profileId } = await joined();
    const shown = (await pool().list(owner, organisationId))?.[0];
    expect(shown?.headline).toBe("Dev");
    expect(shown?.skills).toEqual(["Rust"]);
    await t.db.freelanceProfile.update({ where: { id: profileId }, data: { visibility: "private", slug: null } });
    const hidden = (await pool().list(owner, organisationId))?.[0];
    expect(hidden?.reference).toMatch(/^FR-/);
    expect(hidden?.headline).toBeNull();
    expect(hidden?.skills).toEqual([]);
  });

  it("refuse le vivier à qui n'est pas membre de l'entreprise", async () => {
    const { organisationId, freelancer } = await joined();
    expect(await pool().list(freelancer, organisationId)).toBeNull();
  });
});

describe("quitter et retirer", () => {
  it("laisse le freelance quitter un vivier, et seulement le sien", async () => {
    const { owner, organisationId, freelancer } = await joined();
    const other = await joined();
    expect((await pool().joined(freelancer)).map((p) => p.organisationId)).toEqual([organisationId]);
    // Quitter le vivier d'une autre entreprise, où il n'est pas, ne retire personne.
    expect(await pool().leave(freelancer, other.organisationId)).toBe(false);
    expect(await pool().list(other.owner, other.organisationId)).toHaveLength(1);
    expect(await pool().leave(freelancer, organisationId)).toBe(true);
    expect(await pool().list(owner, organisationId)).toEqual([]);
    expect(await pool().leave(freelancer, "pas-un-uuid")).toBe(false);
  });

  it("ne laisse retirer un freelance du vivier qu'aux propriétaires et administrateurs de l'entreprise", async () => {
    const { owner, organisationId, freelancer, profileId } = await joined();
    const member = await createUser(t.db);
    await t.db.membership.create({ data: { organisationId, userId: member, role: "member" } });
    const outsider = await joined();
    expect(await pool().remove({ userId: member }, organisationId, profileId)).toBe(false);
    // L'administrateur d'une autre entreprise ne touche pas à ce vivier.
    expect(await pool().remove(outsider.owner, organisationId, profileId)).toBe(false);
    // Ni le freelance lui-même par cette voie (il a la sienne : quitter).
    expect(await pool().remove(freelancer, organisationId, profileId)).toBe(false);
    expect(await pool().list(owner, organisationId)).toHaveLength(1);
    expect(await pool().remove(owner, organisationId, profileId)).toBe(true);
    expect(await pool().list(owner, organisationId)).toEqual([]);
  });
});
