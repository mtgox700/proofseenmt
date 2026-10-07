import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applications } from "../src/applications";
import { missions, RESPONSE_MIN_DECIDED } from "../src/missions";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const DAY_MS = 86_400_000;
const NOW = new Date();

describe("délai de réponse d'une entreprise", () => {
  it(`n'est donné qu'à partir de ${RESPONSE_MIN_DECIDED} décisions de l'entreprise, en médiane de jours`, async () => {
    const recruiter = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const mission = await missions(t.db).create({ userId: recruiter }, org, { title: "Data engineer", description: "Pipeline Spark.", workMode: "remote", skills: ["Spark"] });
    if (mission === null) throw new Error("mission non créée");
    await missions(t.db).publish({ userId: recruiter }, mission.id, NOW);
    const decide = async (days: number, status: "shortlisted" | "declined" | "withdrawn") => {
      const freelance = await createUser(t.db);
      await createProfile(t.db, freelance);
      const applied = await applications(t.db).apply({ userId: freelance }, mission.id, "Disponible dès lundi.", NOW);
      if (applied.kind !== "applied") throw new Error(applied.kind);
      const createdAt = new Date(NOW.getTime() - 20 * DAY_MS);
      await t.db.application.update({ where: { id: applied.applicationId }, data: { status, createdAt, updatedAt: new Date(createdAt.getTime() + days * DAY_MS) } });
    };
    await decide(2, "shortlisted");
    await decide(4, "declined");
    // Un retrait du freelance n'est pas une réponse de l'entreprise.
    await decide(30, "withdrawn");
    expect((await missions(t.db).findPublic(mission.id, NOW))?.organisationResponse).toBeNull();
    await decide(9, "declined");
    expect((await missions(t.db).findPublic(mission.id, NOW))?.organisationResponse).toEqual({ medianDays: 4, decided: 3 });
  });
});
