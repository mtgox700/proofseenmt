import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Operator } from "../src/back-office";
import { normalisedEmail, tombstoneHash, TOMBSTONE_RETENTION_YEARS } from "../src/erasure-tombstones";
import { gdpr, RETAINED_AFTER_ERASURE } from "../src/gdpr";
import { retention } from "../src/retention";
import { userDesk } from "../src/user-desk";
import { users } from "../src/users";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Une suspension ne s'efface pas avec le compte (revue de sécurité vague 3, L11) : l'effacement d'un compte suspendu
 * laisse une trace (empreinte de l'adresse, motif, date, rien d'autre), et la suspension revient si la même adresse
 * se réinscrit.
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

const KEY = "cle-de-test-derivee-du-secret-du-serveur-0123456789";
const REASON = "Fraude avérée au paiement";
let signups = 0;

const signUp = (email: string) => {
  signups += 1;
  return users(t.db, { tombstoneKey: KEY }).ensure({ clerkId: `user_tombstone_${signups}`, email, displayName: "Camille" });
};

describe("empreinte d'une adresse", () => {
  it("lit une adresse comme un fournisseur la livre : casse, alias +, points d'une adresse Gmail", () => {
    expect(normalisedEmail(" Camille.Martin+pro@Example.FR ")).toBe("camille.martin@example.fr");
    expect(normalisedEmail("c.a.m.i.l.l.e+x@googlemail.com")).toBe("camille@gmail.com");
    expect(tombstoneHash("Camille.Martin+a@example.fr", KEY)).toBe(tombstoneHash("camille.martin@example.fr", KEY));
    expect(tombstoneHash("camille@example.fr", KEY)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tombstoneHash("camille@example.fr", KEY)).not.toBe(tombstoneHash("camille@example.fr", `${KEY}x`));
  });
});

describe("compte suspendu puis effacé", () => {
  it("laisse une trace sans adresse, et la suspension revient à la réinscription", async () => {
    const first = await signUp("evade@example.fr");
    expect(await userDesk(t.db, operator).suspend(first.userId, REASON, new Date())).toBe("done");
    expect(await gdpr(t.db).eraseUser(first.userId, { tombstoneKey: KEY })).toBe("erased");
    const [stone] = await t.db.erasureTombstone.findMany({ where: { emailHash: tombstoneHash("evade@example.fr", KEY) } });
    expect(stone).toMatchObject({ suspensionReason: REASON });
    expect(JSON.stringify(stone)).not.toContain("evade");

    const again = await signUp("Evade+bis@example.fr");
    expect(again.suspension?.reason).toBe(REASON);
    expect((await t.db.user.findUniqueOrThrow({ where: { id: again.userId } })).suspendedAt).not.toBeNull();
    // La trace sert une fois : un opérateur qui lève la suspension n'est pas contredit au passage suivant.
    expect(await t.db.erasureTombstone.count({ where: { emailHash: tombstoneHash("evade@example.fr", KEY) } })).toBe(0);
    expect(await userDesk(t.db, operator).restore(again.userId, "Suspension levée après échange", new Date())).toBe("done");
    expect((await users(t.db, { tombstoneKey: KEY }).ensure({ clerkId: `user_tombstone_${signups}`, email: "evade+bis@example.fr", displayName: "Camille" })).suspension).toBeNull();
  });

  it("un compte effacé sans suspension ne laisse rien", async () => {
    const plain = await signUp("partie@example.fr");
    const before = await t.db.erasureTombstone.count();
    expect(await gdpr(t.db).eraseUser(plain.userId, { tombstoneKey: KEY })).toBe("erased");
    expect(await t.db.erasureTombstone.count()).toBe(before);
    expect((await signUp("partie@example.fr")).suspension).toBeNull();
  });

  it("dit ce qui reste après l'effacement, et part au bout de trois ans", async () => {
    expect(RETAINED_AFTER_ERASURE.some((line) => line.includes("suspension") && line.includes("trois ans"))).toBe(true);
    expect(TOMBSTONE_RETENTION_YEARS).toBe(3);
    const old = new Date();
    old.setUTCFullYear(old.getUTCFullYear() - TOMBSTONE_RETENTION_YEARS - 1);
    const emailHash = tombstoneHash("ancienne@example.fr", KEY);
    await t.db.erasureTombstone.create({ data: { emailHash, suspendedAt: old, suspensionReason: REASON, createdAt: old } });
    const report = await retention(t.db).purge(new Date());
    expect(report.erasureTombstones).toBeGreaterThanOrEqual(1);
    expect(await t.db.erasureTombstone.count({ where: { emailHash } })).toBe(0);
  });
});
