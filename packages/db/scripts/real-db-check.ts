import { randomBytes } from "node:crypto";
import { createDb } from "../src/client";
import { gdpr } from "../src/gdpr";
import { messaging } from "../src/messaging";
import { notifications } from "../src/notifications";
import { rateLimiter } from "../src/rate-limit";

/*
 * Ce que la base de test (PGlite, une seule connexion) ne peut pas prouver : le comportement sous vraie concurrence,
 * sur un Postgres à plusieurs connexions. À lancer contre une base réelle (`DATABASE_URL`), en préproduction de
 * préférence. Toutes les données créées portent l'étiquette du passage et sont supprimées à la fin, même en cas d'échec.
 *
 *   pnpm --filter @proofseen/db exec tsx --env-file=../../.env scripts/real-db-check.ts
 */

const url = process.env.DATABASE_URL ?? "";
if (url === "") throw new Error("DATABASE_URL absente");
process.env.DATABASE_POOL_MAX = "10";
const db = createDb(url);
const tag = `realcheck-${randomBytes(4).toString("hex")}`;
const SNAPSHOT = { legalName: "Test", country: "FR" };
const results: { readonly check: string; readonly ok: boolean; readonly detail: string }[] = [];
const record = (check: string, ok: boolean, detail: string): void => {
  results.push({ check, ok, detail });
};

let sequence = 0;
const user = async (): Promise<string> => {
  sequence += 1;
  const { id } = await db.user.create({ data: { clerkId: `${tag}-${sequence}`, email: `${tag}-${sequence}@test.proofseen.invalid`, displayName: `Test ${sequence}` }, select: { id: true } });
  return id;
};
const org = async (owner: string): Promise<string> =>
  (await db.organisation.create({ data: { name: `Entreprise ${tag}`, kind: "pme", members: { create: { userId: owner, role: "owner" } } }, select: { id: true } })).id;
const profile = async (userId: string): Promise<string> => {
  sequence += 1;
  const reference = `FR-${randomBytes(4).toString("hex").toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "X").slice(0, 5)}`;
  return (await db.freelanceProfile.create({ data: { userId, reference, visibility: "pseudonymous", workMode: "remote", slug: `${tag}-${sequence}`, headline: "Test", summary: "Données de test", city: "Paris" }, select: { id: true } })).id;
};

const limiterBurst = async (): Promise<void> => {
  const limiter = rateLimiter(db);
  const rule = { windowMs: 60_000, max: 5 };
  const key = `${tag}-burst`;
  const decisions = await Promise.all(Array.from({ length: 40 }, () => limiter.hit(key, rule, new Date())));
  const allowed = decisions.filter((d) => d.allowed).length;
  record("limiteur : 40 requêtes simultanées, plafond 5", allowed === 5, `${allowed} acceptées`);
};

const doubleContact = async (): Promise<void> => {
  const recruiter = await user();
  const company = await org(recruiter);
  const target = await profile(await user());
  const outcomes = await Promise.all(Array.from({ length: 8 }, () => messaging(db).contact({ userId: recruiter }, company, target, "Bonjour, êtes-vous disponible ?")));
  const threads = await db.conversation.count({ where: { organisationId: company, profileId: target } });
  record("prise de contact : 8 clics simultanés", threads === 1 && outcomes.filter((o) => o.kind === "opened").length === 1, `${threads} fil(s), ${outcomes.map((o) => o.kind).join(",")}`);
};

const notificationLease = async (): Promise<void> => {
  const recipient = await user();
  await db.$transaction(async (tx) => {
    await notifications(db).enqueue(tx, [recipient], "message_received", { conversationId: `${tag}-thread` });
  });
  const claims = await Promise.all(Array.from({ length: 6 }, () => notifications(db).claim(50, new Date())));
  const mine = claims.map((batch) => batch.filter((n) => n.payload.conversationId === `${tag}-thread`).length);
  const total = mine.reduce((a, b) => a + b, 0);
  record("notification : 6 processus d'envoi simultanés", total === 1, `prise ${total} fois`);
};

const erasureRace = async (): Promise<void> => {
  const first = await user();
  const company = await org(first);
  const second = await user();
  await db.membership.create({ data: { organisationId: company, userId: second, role: "admin" } });
  const freelance = await profile(await user());
  await db.contract.create({
    data: {
      organisationId: company, profileId: freelance, dailyRateCents: 50_000, days: 2, totalCents: 100_000, currency: "EUR",
      sellerSnapshot: SNAPSHOT, buyerSnapshot: SNAPSHOT, startsOn: new Date(), status: "active", acceptedByFreelanceAt: new Date(), acceptedByOrgAt: new Date(),
    },
  });
  const outcomes = await Promise.all([gdpr(db).eraseUser(first), gdpr(db).eraseUser(second)]);
  const members = await db.membership.count({ where: { organisationId: company } });
  record("effacement : les deux derniers membres en même temps, contrat actif", [...outcomes].sort().join(",") === "erased,in_progress" && members === 1, `${outcomes.join(",")} ; ${members} membre(s) restant(s)`);
};

const cleanUp = async (): Promise<void> => {
  const orgs = (await db.organisation.findMany({ where: { name: `Entreprise ${tag}` }, select: { id: true } })).map((o) => o.id);
  const profiles = (await db.freelanceProfile.findMany({ where: { slug: { startsWith: tag } }, select: { id: true } })).map((p) => p.id);
  await db.contract.deleteMany({ where: { OR: [{ organisationId: { in: orgs } }, { profileId: { in: profiles } }] } });
  await db.organisation.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { clerkId: { startsWith: tag } } });
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: tag } } });
  const left = await db.user.count({ where: { clerkId: { startsWith: tag } } });
  record("nettoyage : aucune donnée de test restante", left === 0, `${left} utilisateur(s) restant(s)`);
};

try {
  for (const check of [limiterBurst, doubleContact, notificationLease, erasureRace]) {
    try {
      await check();
    } catch (error) {
      record(check.name, false, error instanceof Error ? error.name : "erreur");
    }
  }
} finally {
  await cleanUp().catch((error: unknown) => record("nettoyage", false, error instanceof Error ? error.name : "erreur"));
  await db.$disconnect();
}

for (const r of results) console.log(`${r.ok ? "[ ok ]" : "[FAIL]"} ${r.check} — ${r.detail}`);
if (results.some((r) => !r.ok)) process.exitCode = 1;
