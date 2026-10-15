import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PUBLISHER_RULE } from "../../hub/src/barometer-data";
import { cappedByPublisher, MAX_VALUES_PER_PUBLISHER, MIN_DISTINCT_PUBLISHERS, publisherGroupStats } from "../src/barometer-stats";
import { barometers, MIN_SKILL_DEMAND } from "../src/barometers";
import { missions } from "../src/missions";
import { createOrganisation, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Un baromètre tiré des missions ne doit pas refléter une seule entreprise (revue de sécurité vague 2, M5) : un groupe
 * ne sort qu'avec au moins MIN_DISTINCT_PUBLISHERS entreprises distinctes, et chacune y pèse au plus
 * MAX_VALUES_PER_PUBLISHER valeurs, ses plus récentes. Sinon, une entreprise qui publie douze missions fixerait seule la
 * « médiane du marché », ou ferait apparaître une compétence comme demandée.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const day = (n: number): Date => new Date(Date.UTC(2026, 8, n));

describe("règle des entreprises distinctes", () => {
  it("garde au plus trois valeurs par entreprise, les plus récentes", () => {
    const items = [1, 2, 3, 4, 5].map((n) => ({ publisher: "acme", at: day(n), value: n }));
    const others = ["beta", "gamma"].map((publisher) => ({ publisher, at: day(1), value: 100 }));
    const kept = cappedByPublisher([...items, ...others]);
    expect(kept?.filter((x) => x.publisher === "acme").map((x) => x.value).sort()).toEqual([3, 4, 5]);
    expect(kept).toHaveLength(MAX_VALUES_PER_PUBLISHER + 2);
  });

  it("ne rend rien sous trois entreprises distinctes", () => {
    const two = ["acme", "beta"].flatMap((publisher) => [1, 2, 3].map((n) => ({ publisher, at: day(n), value: n })));
    expect(cappedByPublisher(two)).toBeNull();
    expect(MIN_DISTINCT_PUBLISHERS).toBe(3);
  });

  it("dit dans la méthode publiée la règle qu'elle applique", () => {
    expect(PUBLISHER_RULE).toEqual({ minPublishers: MIN_DISTINCT_PUBLISHERS, maxPerPublisher: MAX_VALUES_PER_PUBLISHER });
  });

  it("un groupe tenu par une seule entreprise ne sort pas, même avec assez de valeurs", () => {
    const single = Array.from({ length: 12 }, (_, i) => ({ key: "go", label: "Go", publisher: "acme", at: day(i + 1), value: 50_000 }));
    expect(publisherGroupStats(single)).toEqual([]);
    const spread = Array.from({ length: 12 }, (_, i) => ({ key: "go", label: "Go", publisher: `org-${i % 4}`, at: day(i + 1), value: 50_000 + i * 1_000 }));
    expect(publisherGroupStats(spread)).toEqual([expect.objectContaining({ key: "go", n: 12 })]);
  });
});

const publish = async (organisation: { readonly recruiter: string; readonly org: string }, skills: string[], rate: number | null, publishedAt: Date): Promise<void> => {
  const created = await missions(t.db).create({ userId: organisation.recruiter }, organisation.org, {
    title: "Mission",
    description: "Réelle.",
    workMode: "remote",
    city: "Rennes",
    skills,
    dailyRateMinCents: rate,
    dailyRateMaxCents: rate,
  });
  await missions(t.db).publish({ userId: organisation.recruiter }, created?.id ?? "", publishedAt);
};

const company = async (): Promise<{ readonly recruiter: string; readonly org: string }> => {
  const recruiter = await createUser(t.db);
  return { recruiter, org: await createOrganisation(t.db, recruiter) };
};

describe("baromètres publiés", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  it("le TJM des missions d'une seule entreprise ne fait pas un baromètre", async () => {
    const acme = await company();
    for (let i = 0; i < 12; i += 1) await publish(acme, ["Haskell"], 60_000 + i * 1_000, day(i + 1));
    const rates = await barometers(t.db).rates(now);
    expect(rates.missions.total).toBe(12);
    expect(rates.missions.bySkill).toEqual([]);
    expect(rates.missions.byCity).toEqual([]);
    expect(rates.missions.overall).toBeNull();
  });

  it("avec quatre entreprises, chacune pèse au plus trois missions", async () => {
    const others = [await company(), await company(), await company()];
    for (const other of others) for (let i = 0; i < 3; i += 1) await publish(other, ["Haskell"], 80_000, day(20 + i));
    const rates = await barometers(t.db).rates(now);
    // Les trois plus récentes de la première entreprise, et trois de chacune des trois autres.
    expect(rates.missions.bySkill).toEqual([expect.objectContaining({ key: "haskell", n: 12 })]);
    expect(rates.missions.overall?.n).toBe(12);
  });

  it("une compétence demandée par une seule entreprise n'est pas listée ; sinon chacune compte au plus trois missions", async () => {
    const at = new Date("2026-10-01T00:00:00Z");
    const solo = await company();
    for (let i = 0; i < MIN_SKILL_DEMAND + 3; i += 1) await publish(solo, ["Erlang"], null, at);
    expect((await barometers(t.db).skills(now)).skills.map((s) => s.key)).not.toContain("erlang");

    await publish(await company(), ["Erlang"], null, at);
    await publish(await company(), ["Erlang"], null, at);
    const erlang = (await barometers(t.db).skills(now)).skills.find((s) => s.key === "erlang");
    expect(erlang?.missions).toBe(MAX_VALUES_PER_PUBLISHER + 2);
  });
});
