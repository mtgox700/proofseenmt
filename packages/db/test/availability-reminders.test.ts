import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { availabilityReminders } from "../src/availability-reminders";
import { dashboards } from "../src/dashboards";
import { profileSections } from "../src/profile-sections";
import { profiles } from "../src/profiles";
import { publicProfiles } from "../src/public-profiles";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

/*
 * Disponibilité reconfirmée (C23), contre une vraie base et sur une horloge injectée : un rappel tous les 14 jours sans
 * confirmation, jamais deux dans la même fenêtre, même lancés ensemble ; passé 30 jours, la page publique, l'annuaire
 * et le filtre « disponible maintenant » ne disent plus « disponible », et le profil reste publié.
 */

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const DAY_MS = 86_400_000;
const T0 = new Date("2026-11-02T08:00:00Z");
const day = (n: number): Date => new Date(T0.getTime() + n * DAY_MS);

let drawn = 0;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const nextReference = (): string => {
  drawn += 1;
  return `FR-R${ALPHABET[Math.floor(drawn / 31) % 31]}${ALPHABET[drawn % 31]}VQ`;
};

/** Un profil publié (ou privé), disponible, dont la disponibilité a été déclarée à T0. */
const freelancer = async (o: { visibility?: "pseudonymous" | "private"; availability?: "available" | "unavailable"; skill?: string } = {}) => {
  const userId = await createUser(t.db);
  const created = await profiles(t.db).create(
    { userId },
    { headline: "Dev Elixir", summary: "Résumé.", city: "Nantes", workMode: "remote", skills: [o.skill ?? "Elixir"], availability: o.availability ?? "available" },
    nextReference,
  );
  if (created === null) throw new Error("profil non créé");
  if ((o.visibility ?? "pseudonymous") !== "private") await profiles(t.db).setVisibility({ userId }, "pseudonymous");
  await t.db.freelanceProfile.update({ where: { id: created.id }, data: { availabilityAt: T0 } });
  const { slug } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: created.id }, select: { slug: true } });
  return { userId, profileId: created.id, slug: slug ?? "" };
};

const counts = async (userId: string) => ({
  emails: await t.db.notification.count({ where: { userId, kind: "availability_reminder" } }),
  inApp: await t.db.appNotification.count({ where: { userId, kind: "availability_reminder" } }),
});

/** Ne garde que les rappels de ces profils : d'autres tests du fichier en ont créé d'autres. */
const remindOnly = async (now: Date, ...profileIds: string[]): Promise<void> => {
  await t.db.freelanceProfile.updateMany({ where: { id: { notIn: profileIds } }, data: { availabilityRemindedAt: now } });
  await availabilityReminders(t.db).remindDue(now);
};

describe("rappel de reconfirmer la disponibilité", () => {
  it("rappelle à 14 jours, une seule fois par fenêtre, puis toutes les deux semaines sans confirmation", async () => {
    const p = await freelancer();
    await remindOnly(day(13), p.profileId);
    expect(await counts(p.userId)).toEqual({ emails: 0, inApp: 0 });
    await remindOnly(day(14), p.profileId);
    expect(await counts(p.userId)).toEqual({ emails: 1, inApp: 1 });
    // Relancé dans la même fenêtre : rien de plus.
    await remindOnly(day(14), p.profileId);
    await remindOnly(day(27), p.profileId);
    expect((await counts(p.userId)).emails).toBe(1);
    await remindOnly(day(28), p.profileId);
    expect((await counts(p.userId)).emails).toBe(2);
    await remindOnly(day(42), p.profileId);
    expect((await counts(p.userId)).emails).toBe(3);
  });

  it("s'arrête après trois rappels sans confirmation : pas de quatrième, même des mois plus tard", async () => {
    const p = await freelancer();
    for (const n of [14, 28, 42, 56, 70, 120, 365]) await remindOnly(day(n), p.profileId);
    expect(await counts(p.userId)).toEqual({ emails: 3, inApp: 1 });
    // Des passages sautés ne donnent pas plus de trois rappels : au plus un par fenêtre, et rien après 56 jours.
    const late = await freelancer();
    for (const n of [20, 34, 48, 55, 62]) await remindOnly(day(n), late.profileId);
    expect((await counts(late.userId)).emails).toBe(3);
  });

  it("repart de la confirmation : rien pendant 14 jours après, puis un rappel", async () => {
    const p = await freelancer();
    await remindOnly(day(14), p.profileId);
    expect(await profileSections(t.db).confirmAvailability({ userId: p.userId }, day(20))).toEqual(day(20));
    await remindOnly(day(30), p.profileId);
    expect((await counts(p.userId)).emails).toBe(1);
    await remindOnly(day(34), p.profileId);
    expect((await counts(p.userId)).emails).toBe(2);
  });

  it("n'envoie jamais deux rappels pour deux exécutions simultanées", async () => {
    const p = await freelancer();
    await t.db.freelanceProfile.updateMany({ where: { id: { not: p.profileId } }, data: { availabilityRemindedAt: day(15) } });
    const runs = await Promise.all([availabilityReminders(t.db).remindDue(day(15)), availabilityReminders(t.db).remindDue(day(15))]);
    expect(runs.reduce((sum, n) => sum + n, 0)).toBe(1);
    expect((await counts(p.userId)).emails).toBe(1);
  });

  it("borne chaque exécution, les plus anciennes d'abord, et garde le reste pour la suivante", async () => {
    const older = await freelancer();
    const newer = await freelancer();
    await t.db.freelanceProfile.update({ where: { id: older.profileId }, data: { availabilityAt: day(-1) } });
    await t.db.freelanceProfile.updateMany({ where: { id: { notIn: [older.profileId, newer.profileId] } }, data: { availabilityRemindedAt: day(16) } });
    expect(await availabilityReminders(t.db).remindDue(day(16), 1)).toBe(1);
    expect((await counts(older.userId)).emails).toBe(1);
    expect((await counts(newer.userId)).emails).toBe(0);
    expect(await availabilityReminders(t.db).remindDue(day(16), 1)).toBe(1);
    expect((await counts(newer.userId)).emails).toBe(1);
  });

  it("ne rappelle ni un profil privé, ni une disponibilité déclarée « indisponible »", async () => {
    const hidden = await freelancer({ visibility: "private" });
    const away = await freelancer({ availability: "unavailable" });
    await remindOnly(day(40), hidden.profileId, away.profileId);
    expect((await counts(hidden.userId)).emails).toBe(0);
    expect((await counts(away.userId)).emails).toBe(0);
  });

  it("garde la notification dans l'application quand l'e-mail de ce type est coupé", async () => {
    const p = await freelancer();
    await t.db.notificationPreference.create({ data: { userId: p.userId, kind: "availability_reminder", email: false } });
    await remindOnly(day(14), p.profileId);
    expect(await counts(p.userId)).toEqual({ emails: 0, inApp: 1 });
  });
});

describe("enregistrer le profil", () => {
  const input = (o: { summary: string; availability: "available" | "available_from"; availableFrom?: Date }) => ({
    headline: "Dev Elixir",
    summary: o.summary,
    city: "Nantes",
    workMode: "remote" as const,
    skills: ["Elixir"],
    availability: o.availability,
    ...(o.availableFrom === undefined ? {} : { availableFrom: o.availableFrom }),
  });
  const confirmedAt = async (profileId: string): Promise<Date> => (await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { availabilityAt: true } })).availabilityAt;

  it("ne reconfirme pas la disponibilité quand seul le résumé change", async () => {
    const p = await freelancer();
    await profiles(t.db).update({ userId: p.userId }, input({ summary: "Un autre résumé.", availability: "available" }));
    expect(await confirmedAt(p.profileId)).toEqual(T0);
  });

  it("la reconfirme quand le statut ou la date change", async () => {
    const p = await freelancer();
    await profiles(t.db).update({ userId: p.userId }, input({ summary: "Résumé.", availability: "available_from", availableFrom: new Date("2027-01-04T00:00:00Z") }));
    const moved = await confirmedAt(p.profileId);
    expect(moved).not.toEqual(T0);
    await t.db.freelanceProfile.update({ where: { id: p.profileId }, data: { availabilityAt: T0 } });
    await profiles(t.db).update({ userId: p.userId }, input({ summary: "Résumé.", availability: "available_from", availableFrom: new Date("2027-01-04T00:00:00Z") }));
    expect(await confirmedAt(p.profileId)).toEqual(T0);
    await profiles(t.db).update({ userId: p.userId }, input({ summary: "Résumé.", availability: "available_from", availableFrom: new Date("2027-02-01T00:00:00Z") }));
    expect(await confirmedAt(p.profileId)).not.toEqual(T0);
  });
});

describe("profil masqué par un opérateur", () => {
  it("n'est ni « publié » sur l'accueil, ni dit publié après un nouveau choix de publication", async () => {
    const p = await freelancer();
    expect((await dashboards(t.db).freelance({ userId: p.userId })).profile).toMatchObject({ published: true, moderated: false });
    await t.db.freelanceProfile.update({ where: { id: p.profileId }, data: { moderatedAt: day(1), moderationReason: "Contenu trompeur" } });
    expect((await dashboards(t.db).freelance({ userId: p.userId })).profile).toMatchObject({ published: false, moderated: true });
    expect(await profiles(t.db).setVisibility({ userId: p.userId }, "named")).toMatchObject({ kind: "ok", moderated: true });
  });
});

describe("disponibilité non confirmée après 30 jours", () => {
  it("la page publique dit « non confirmée », le profil reste publié", async () => {
    const p = await freelancer();
    expect((await publicProfiles(t.db).page(p.slug, day(30)))?.availability).toBe("available");
    const page = await publicProfiles(t.db).page(p.slug, day(31));
    expect(page?.availability).toBe("unconfirmed");
    expect(page?.availabilityConfirmedAt).toEqual(T0);
  });

  it("l'annuaire public garde la carte, « non confirmée », et le filtre « disponible maintenant » ne la retient plus", async () => {
    const p = await freelancer({ skill: "Gleam" });
    const listed = await publicProfiles(t.db).directory({ skill: "gleam" }, day(31));
    expect(listed.items.map((c) => [c.slug, c.availability])).toEqual([[p.slug, "unconfirmed"]]);
    expect((await publicProfiles(t.db).directory({ skill: "gleam", availableNow: true }, day(31))).items).toHaveLength(0);
    expect((await publicProfiles(t.db).directory({ skill: "gleam", availableNow: true }, day(30))).items).toHaveLength(1);
  });

  it("« plus disponible » en un clic : la page le dit, datée du jour, sans masquer le profil", async () => {
    const p = await freelancer();
    expect(await profileSections(t.db).declareUnavailable({ userId: p.userId }, day(40))).toEqual(day(40));
    const page = await publicProfiles(t.db).page(p.slug, day(41));
    expect(page?.availability).toBe("unavailable");
    expect(page?.availabilityConfirmedAt).toEqual(day(40));
    expect(await profileSections(t.db).declareUnavailable({ userId: await createUser(t.db) }, day(40))).toBeNull();
  });
});
