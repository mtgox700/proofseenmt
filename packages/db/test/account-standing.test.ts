import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ESTABLISHED_ACCOUNT_DAYS, users } from "../src/users";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Un compte « établi » puise dans toute la réserve quotidienne de lectures de CV ; un compte neuf, jetable, partage une
 * petite part (revue de sécurité vague 2, M2). Établi : profil publié, ou compte de plus de sept jours.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const DAY_MS = 86_400_000;

describe("ancienneté d'un compte", () => {
  it("un compte neuf sans profil publié n'est pas établi ; il l'est passé sept jours", async () => {
    const userId = await createUser(t.db);
    const now = new Date();
    expect(await users(t.db).isEstablished({ userId }, now)).toBe(false);
    await createProfile(t.db, userId, "private");
    expect(await users(t.db).isEstablished({ userId }, now)).toBe(false);
    const later = new Date(now.getTime() + ESTABLISHED_ACCOUNT_DAYS * DAY_MS + 60_000);
    expect(await users(t.db).isEstablished({ userId }, later)).toBe(true);
  });

  it("un profil publié rend le compte établi dès le premier jour", async () => {
    const userId = await createUser(t.db);
    await createProfile(t.db, userId, "pseudonymous");
    expect(await users(t.db).isEstablished({ userId }, new Date())).toBe(true);
  });

  it("un compte inconnu ou un identifiant mal formé n'est jamais établi", async () => {
    expect(await users(t.db).isEstablished({ userId: randomUUID() }, new Date())).toBe(false);
    expect(await users(t.db).isEstablished({ userId: "pas-un-uuid" }, new Date())).toBe(false);
  });
});
