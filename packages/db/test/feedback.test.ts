import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { feedback } from "../src/feedback";
import { gdpr } from "../src/gdpr";
import { RETENTION, retention } from "../src/retention";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

describe("retours de la bêta", () => {
  it("classe les retours par nature et par côté, et rend le texte sans auteur", async () => {
    const user = await createUser(t.db);
    const repo = feedback(t.db);
    await repo.submit(user, { kind: "bug", side: "freelance", page: "/fr/app/profil?t=secret#x", body: "Le bouton publier ne répond pas." });
    await repo.submit(null, { kind: "missing", side: "visitor", page: null, body: "Il manque un filtre par région." });
    await repo.submit(null, { kind: "bug", side: "company", body: "Le devis ne s'affiche pas." });

    expect(await repo.summary()).toEqual({ total: 3, byKind: { bug: 2, missing: 1 }, bySide: { freelance: 1, visitor: 1, company: 1 } });
    const bugs = await repo.latest("bug", 10);
    expect(bugs.map((b) => b.body)).toEqual(["Le devis ne s'affiche pas.", "Le bouton publier ne répond pas."]);
    // Le chemin est gardé sans ses paramètres : un jeton passé dans l'adresse ne finit pas en base.
    expect(bugs[1]?.page).toBe("/fr/app/profil");
    expect(JSON.stringify(bugs)).not.toContain(user);
  });

  it("refuse un texte vide ou un chemin qui n'en est pas un", async () => {
    await expect(feedback(t.db).submit(null, { kind: "idea", side: "visitor", body: "ok" })).rejects.toThrow();
    await expect(feedback(t.db).submit(null, { kind: "idea", side: "visitor", page: "https://evil.example/x", body: "Une idée assez longue." })).rejects.toThrow();
  });

  it("figure dans l'export RGPD, part avec le compte, et au bout d'un an", async () => {
    const user = await createUser(t.db);
    await feedback(t.db).submit(user, { kind: "idea", side: "freelance", body: "Pouvoir exporter mes factures." });
    expect((await gdpr(t.db).exportUser(user, new Date()))?.feedback).toMatchObject([{ body: "Pouvoir exporter mes factures." }]);
    expect(await gdpr(t.db).eraseUser(user)).toBe("erased");
    expect(await t.db.feedback.count({ where: { body: "Pouvoir exporter mes factures." } })).toBe(0);

    const old = await t.db.feedback.create({ data: { kind: "other", side: "visitor", body: "Un vieux retour.", createdAt: new Date(Date.now() - (RETENTION.feedbackDays + 1) * 86_400_000) }, select: { id: true } });
    await retention(t.db).purge(new Date());
    expect(await t.db.feedback.count({ where: { id: old.id } })).toBe(0);
  });
});
