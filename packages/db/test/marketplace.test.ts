import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applications } from "../src/applications";
import { messaging } from "../src/messaging";
import { missions, type MissionInput } from "../src/missions";
import { skillKey, uniqueSkills } from "../src/skills";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const MISSION: MissionInput = {
  title: "Développeur TypeScript senior",
  description: "Refonte d'une plateforme de paiement.",
  skills: ["TypeScript", "Node.js", "PostgreSQL"],
  durationMonths: 6,
  dailyRateMinCents: 55_000,
  dailyRateMaxCents: 70_000,
  city: "Paris",
  workMode: "hybrid",
};

const company = async () => {
  const recruiter = await createUser(t.db);
  const org = await createOrganisation(t.db, recruiter);
  return { recruiter, org };
};

const freelance = async () => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId);
  return { userId, profileId };
};

describe("compétences", () => {
  it("ramène les écritures d'une même compétence à une seule clé", () => {
    expect(skillKey("TypeScript")).toBe("typescript");
    expect(skillKey("Node.js")).toBe(skillKey("nodejs"));
    expect(skillKey("Génie logiciel")).toBe("genie-logiciel");
    expect(skillKey("C++")).toBe("c++");
    expect(uniqueSkills(["React", "react", " REACT ", "Vue"]).map((s) => s.label)).toEqual(["React", "Vue"]);
  });

  it("n'écrit jamais un libellé sur plusieurs lignes ni avec des caractères invisibles", () => {
    // Construits par code : un saut de ligne dans un libellé ajouterait une ligne à /llms.txt.
    const [lf, cr, nul, zwsp, bidi] = [10, 13, 0, 0x200b, 0x202e].map((code) => String.fromCharCode(code));
    const labels = uniqueSkills([`Type${lf}Script`, `Rust${nul}`, `React${zwsp} Native`, `  Go ${cr}${lf}  lang `, `${bidi}Kotlin`]).map((s) => s.label);
    expect(labels).toEqual(["Type Script", "Rust", "React Native", "Go lang", "Kotlin"]);
  });
});

describe("parcours : publier, trouver, postuler, échanger", () => {
  it("va de la mission publiée à la réponse de l'entreprise", async () => {
    const { recruiter, org } = await company();
    const dev = await freelance();
    const now = new Date("2026-10-19T09:00:00Z");

    const draft = await missions(t.db).create({ userId: recruiter }, org, MISSION);
    expect(draft).toMatchObject({ status: "draft", skills: ["TypeScript", "Node.js", "PostgreSQL"] });
    const id = draft?.id ?? "";
    expect(await missions(t.db).findPublic(id)).toBeNull();
    expect(await applications(t.db).apply({ userId: dev.userId }, id, "Bonjour", now)).toEqual({ kind: "absent" });

    expect(await missions(t.db).publish({ userId: recruiter }, id, now)).toBe(true);
    const found = await missions(t.db).search({ skills: ["typescript", "node.js"], workModes: ["hybrid", "remote"], minDailyRateCents: 60_000 });
    expect(found.items.map((m) => m.id)).toContain(id);

    const applied = await applications(t.db).apply({ userId: dev.userId }, id, "J'ai livré deux refontes similaires.", now);
    expect(applied.kind).toBe("applied");
    if (applied.kind !== "applied") return;
    expect(await applications(t.db).apply({ userId: dev.userId }, id, "Encore moi", now)).toEqual({ kind: "already_applied" });

    const mine = await applications(t.db).listMine({ userId: dev.userId });
    expect(mine).toMatchObject([{ status: "submitted", mission: { id, title: MISSION.title } }]);

    const applicants = await applications(t.db).listForMission({ userId: recruiter }, id);
    expect(applicants).toMatchObject([{ applicationId: applied.applicationId, status: "submitted", profile: { id: dev.profileId } }]);

    // Le fil né de la candidature est accepté d'emblée : l'entreprise répond sans attendre.
    expect(await messaging(t.db).post({ userId: recruiter }, applied.conversationId, "Disponible jeudi pour un échange ?")).toMatchObject({ kind: "sent" });
    const thread = await messaging(t.db).listMessages({ userId: dev.userId }, applied.conversationId);
    expect(thread?.items.map((m) => m.body)).toEqual(["Disponible jeudi pour un échange ?", "J'ai livré deux refontes similaires."]);

    expect(await applications(t.db).decide({ userId: recruiter }, applied.applicationId, "shortlisted")).toBe(true);
    expect((await applications(t.db).listMine({ userId: dev.userId }))[0]?.status).toBe("shortlisted");
  });
});

describe("missions : seule l'entreprise agit sur les siennes", () => {
  it("refuse création, modification, publication et clôture à un tiers", async () => {
    const { recruiter, org } = await company();
    const outsider = await createUser(t.db);
    expect(await missions(t.db).create({ userId: outsider }, org, MISSION)).toBeNull();
    const id = (await missions(t.db).create({ userId: recruiter }, org, MISSION))?.id ?? "";
    expect(await missions(t.db).update({ userId: outsider }, id, { ...MISSION, title: "Piratée" })).toEqual({ kind: "absent" });
    expect(await missions(t.db).publish({ userId: outsider }, id, new Date())).toBe(false);
    expect(await missions(t.db).close({ userId: outsider }, id, new Date())).toBe(false);
    expect(await missions(t.db).listForOrganisation({ userId: outsider }, org)).toBeNull();
    expect(await missions(t.db).listForOrganisation({ userId: recruiter }, org)).toHaveLength(1);
  });

  it("modifie une mission ouverte, mais ne rouvre pas une mission clôturée", async () => {
    const { recruiter, org } = await company();
    const id = (await missions(t.db).create({ userId: recruiter }, org, MISSION))?.id ?? "";
    await missions(t.db).publish({ userId: recruiter }, id, new Date());
    const edited = await missions(t.db).update({ userId: recruiter }, id, { ...MISSION, skills: ["Go"], workMode: "remote", city: null });
    expect(edited).toMatchObject({ kind: "ok", mission: { skills: ["Go"], workMode: "remote", status: "open" } });

    expect(await missions(t.db).close({ userId: recruiter }, id, new Date())).toBe(true);
    expect(await missions(t.db).update({ userId: recruiter }, id, MISSION)).toEqual({ kind: "absent" });
    expect(await missions(t.db).findPublic(id)).toBeNull();
    await expect(t.db.jobPost.update({ where: { id }, data: { status: "open" } })).rejects.toThrow(/ne rouvre pas/);
  });

  it("refuse une mission incohérente avant d'écrire", async () => {
    const { recruiter, org } = await company();
    await expect(missions(t.db).create({ userId: recruiter }, org, { ...MISSION, dailyRateMinCents: 90_000 })).rejects.toThrow(/minimum/);
    await expect(missions(t.db).create({ userId: recruiter }, org, { ...MISSION, workMode: "onsite", city: null })).rejects.toThrow(/ville/);
  });
});

describe("recherche : des filtres, un ordre choisi, aucun score", () => {
  it("exige toutes les compétences demandées et respecte l'ordre demandé", async () => {
    const { recruiter, org } = await company();
    const make = async (title: string, skills: string[], max: number) => {
      const id = (await missions(t.db).create({ userId: recruiter }, org, { ...MISSION, title, skills, dailyRateMaxCents: max, workMode: "remote", city: null }))?.id ?? "";
      await missions(t.db).publish({ userId: recruiter }, id, new Date());
      return id;
    };
    const rust = await make("Rust embarqué", ["Rust", "Embedded"], 80_000);
    const rustWeb = await make("Rust web", ["Rust", "WebAssembly"], 95_000);

    const both = await missions(t.db).search({ skills: ["rust", "embedded"] });
    expect(both.items.map((m) => m.id)).toEqual([rust]);

    const byRate = await missions(t.db).search({ skills: ["Rust"], sort: "rate_desc" });
    expect(byRate.items.map((m) => m.id)).toEqual([rustWeb, rust]);
  });

  it("ne met dans le sitemap que les missions ouvertes", async () => {
    const { recruiter, org } = await company();
    const open = (await missions(t.db).create({ userId: recruiter }, org, MISSION))?.id ?? "";
    await missions(t.db).publish({ userId: recruiter }, open, new Date());
    const draft = (await missions(t.db).create({ userId: recruiter }, org, MISSION))?.id ?? "";
    const closed = (await missions(t.db).create({ userId: recruiter }, org, MISSION))?.id ?? "";
    await missions(t.db).publish({ userId: recruiter }, closed, new Date());
    await missions(t.db).close({ userId: recruiter }, closed, new Date());

    const ids = (await missions(t.db).listOpenForSitemap()).map((m) => m.id);
    expect(ids).toContain(open);
    expect(ids).not.toContain(draft);
    expect(ids).not.toContain(closed);
  });

  it("ne propose que des tris explicites, sans pertinence calculée", async () => {
    const { SEARCH_SORTS } = await import("../src/missions");
    expect(SEARCH_SORTS).toEqual(["recent", "rate_desc", "rate_asc"]);
    await expect(missions(t.db).search({ sort: "relevance" as never })).rejects.toThrow();
  });
});

describe("candidatures : chacun à sa place", () => {
  it("ne laisse ni postuler sans profil, ni décider à un tiers, ni retirer la candidature d'un autre", async () => {
    const { recruiter, org } = await company();
    const id = (await missions(t.db).create({ userId: recruiter }, org, MISSION))?.id ?? "";
    await missions(t.db).publish({ userId: recruiter }, id, new Date());
    const dev = await freelance();
    const other = await freelance();
    const noProfile = await createUser(t.db);

    expect(await applications(t.db).apply({ userId: noProfile }, id, "Bonjour", new Date())).toEqual({ kind: "no_profile" });
    const applied = await applications(t.db).apply({ userId: dev.userId }, id, "Bonjour", new Date());
    if (applied.kind !== "applied") throw new Error(applied.kind);

    expect(await applications(t.db).decide({ userId: dev.userId }, applied.applicationId, "hired")).toBe(false);
    expect(await applications(t.db).withdraw({ userId: other.userId }, applied.applicationId)).toBe(false);
    expect(await applications(t.db).listForMission({ userId: dev.userId }, id)).toBeNull();
    expect(await messaging(t.db).listMessages({ userId: other.userId }, applied.conversationId)).toBeNull();

    expect(await applications(t.db).withdraw({ userId: dev.userId }, applied.applicationId)).toBe(true);
    expect(await applications(t.db).decide({ userId: recruiter }, applied.applicationId, "hired")).toBe(false);
    expect(await applications(t.db).listForMission({ userId: recruiter }, id)).toEqual([]);
  });

  it("garde l'historique d'une candidature dans la base, même si le code l'oublie", async () => {
    const { recruiter, org } = await company();
    const id = (await missions(t.db).create({ userId: recruiter }, org, MISSION))?.id ?? "";
    await missions(t.db).publish({ userId: recruiter }, id, new Date());
    const dev = await freelance();
    const applied = await applications(t.db).apply({ userId: dev.userId }, id, "Mot d'origine", new Date());
    if (applied.kind !== "applied") throw new Error(applied.kind);
    await applications(t.db).decide({ userId: recruiter }, applied.applicationId, "declined");
    await expect(t.db.application.update({ where: { id: applied.applicationId }, data: { status: "hired" } })).rejects.toThrow(/statut refusé/);
    await expect(t.db.application.update({ where: { id: applied.applicationId }, data: { coverNote: "Réécrit" } })).rejects.toThrow(/réécrit/);
  });
});
