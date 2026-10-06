import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditRequests } from "../src/audit-requests";
import { containsContact, InvalidCursorError, messaging } from "../src/messaging";
import { rateLimiter } from "../src/rate-limit";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

describe("demandes d'audit", () => {
  const request = { displayName: "Zak", email: "Zak@Example.FR", urls: ["https://zak.dev"], lang: "fr" as const, consentAt: new Date("2026-10-01") };

  it("enregistre, retrouve par adresse et efface", async () => {
    const repo = auditRequests(t.db);
    const { reference } = await repo.open(request, () => "FR-ABCDE");
    expect(reference).toBe("FR-ABCDE");

    const found = await repo.findByEmail("ZAK@example.fr");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ reference, email: "zak@example.fr", urls: ["https://zak.dev"] });

    expect(await repo.eraseByEmail("zak@example.fr")).toBe(1);
    expect(await repo.findByEmail("zak@example.fr")).toEqual([]);
  });

  it("retire une référence déjà prise au lieu de l'écraser", async () => {
    const repo = auditRequests(t.db);
    await repo.open(request, () => "FR-TAKEN");
    const draws = ["FR-TAKEN", "FR-TAKEN", "FR-FREEE"];
    const { reference } = await repo.open({ ...request, email: "autre@x.fr" }, () => draws.shift() ?? "FR-FREEE");
    expect(reference).toBe("FR-FREEE");
    expect(await repo.findByEmail("zak@example.fr")).toHaveLength(1);
  });

  it("refuse une demande sans adresse ou avec une référence hors format", async () => {
    const repo = auditRequests(t.db);
    await expect(repo.open({ ...request, urls: [] }, () => "FR-NOURL")).rejects.toThrow();
    await expect(repo.open(request, () => "pas-une-ref")).rejects.toThrow(/AuditRequest_reference_chk/);
  });
});

describe("messagerie : le freelance décide, chacun ne voit que ses fils", () => {
  const setup = async () => {
    const recruiter = await createUser(t.db);
    const freelanceUser = await createUser(t.db);
    const stranger = await createUser(t.db);
    const org = await createOrganisation(t.db, recruiter);
    const profile = await createProfile(t.db, freelanceUser);
    return { recruiter, freelanceUser, stranger, org, profile };
  };

  const opened = async (s: Awaited<ReturnType<typeof setup>>, body = "Bonjour, dispo en novembre ?"): Promise<string> => {
    const result = await messaging(t.db).contact({ userId: s.recruiter }, s.org, s.profile, body);
    if (result.kind !== "opened") throw new Error(`fil non ouvert : ${result.kind}`);
    return result.conversation.id;
  };

  it("l'entreprise prend contact par un premier message, puis attend l'accord du freelance", async () => {
    const m = messaging(t.db);
    const s = await setup();
    const id = await opened(s, "  Bonjour, dispo en novembre ?  ");
    const first = await m.listMessages({ userId: s.freelanceUser }, id);
    expect(first?.items).toMatchObject([{ body: "Bonjour, dispo en novembre ?", senderUserId: s.recruiter, containsContact: false }]);

    expect(await m.post({ userId: s.recruiter }, id, "Relance")).toEqual({ kind: "waiting" });
    expect(await m.contact({ userId: s.recruiter }, s.org, s.profile, "Second contact")).toMatchObject({ kind: "existing", conversation: { id } });

    expect(await m.decide({ userId: s.recruiter }, id, "accepted", new Date())).toBe(false);
    expect(await m.decide({ userId: s.freelanceUser }, id, "accepted", new Date())).toBe(true);
    expect(await m.decide({ userId: s.freelanceUser }, id, "declined", new Date())).toBe(false);

    expect(await m.post({ userId: s.recruiter }, id, "Merci !")).toMatchObject({ kind: "sent" });
    // Sans contrat signé, les coordonnées restent hors du fil (red team C6) : refusées, pas seulement signalées.
    expect(await m.post({ userId: s.freelanceUser }, id, "Écrivez-moi à moi@exemple.fr")).toEqual({ kind: "contact_details" });
    expect((await m.listMessages({ userId: s.recruiter }, id))?.items).toHaveLength(2);
  });

  it("ferme le fil pour les deux quand le freelance décline", async () => {
    const m = messaging(t.db);
    const s = await setup();
    const id = await opened(s);
    expect(await m.decide({ userId: s.freelanceUser }, id, "declined", new Date())).toBe(true);
    expect(await m.post({ userId: s.recruiter }, id, "Vraiment ?")).toEqual({ kind: "closed" });
    expect(await m.post({ userId: s.freelanceUser }, id, "Finalement oui")).toEqual({ kind: "closed" });
  });

  it("ne laisse aucun tiers lire, écrire, décider ni savoir que le fil existe", async () => {
    const m = messaging(t.db);
    const s = await setup();
    const id = await opened(s);
    expect(await m.post({ userId: s.stranger }, id, "intrusion")).toEqual({ kind: "absent" });
    expect(await m.listMessages({ userId: s.stranger }, id)).toBeNull();
    expect(await m.decide({ userId: s.stranger }, id, "accepted", new Date())).toBe(false);
    expect((await m.listConversations({ userId: s.stranger })).items).toEqual([]);
    expect((await m.listConversations({ userId: s.recruiter })).items.map((c) => c.id)).toEqual([id]);
    expect(await m.contact({ userId: s.stranger }, s.org, s.profile, "Je me fais passer pour l'entreprise")).toEqual({ kind: "absent" });
  });

  it("ne laisse pas un freelance prendre contact au nom d'une entreprise, ni une entreprise contacter un profil privé", async () => {
    const m = messaging(t.db);
    const s = await setup();
    expect(await m.contact({ userId: s.freelanceUser }, s.org, s.profile, "Bonjour")).toEqual({ kind: "absent" });
    const hidden = await createProfile(t.db, await createUser(t.db), "private");
    expect(await m.contact({ userId: s.recruiter }, s.org, hidden, "Bonjour")).toEqual({ kind: "absent" });
    expect(await t.db.conversation.count({ where: { profileId: { in: [s.profile, hidden] } } })).toBe(0);
  });

  it("garde la règle dans la base même si le code l'oublie", async () => {
    const s = await setup();
    const id = await opened(s);
    await expect(t.db.message.create({ data: { conversationId: id, senderUserId: s.recruiter, body: "Contournement" } })).rejects.toThrow(/en attente/);
    await expect(t.db.message.create({ data: { conversationId: id, senderUserId: s.stranger, body: "Intrus" } })).rejects.toThrow(/pas partie/);
    await t.db.conversation.update({ where: { id }, data: { status: "declined", decidedAt: new Date() } });
    await expect(t.db.conversation.update({ where: { id }, data: { status: "accepted" } })).rejects.toThrow(/définitive/);
  });

  it("répond « absent » à un identifiant mal formé plutôt que d'échouer", async () => {
    const m = messaging(t.db);
    const me = await createUser(t.db);
    expect(await m.listMessages({ userId: me }, "../../etc/passwd")).toBeNull();
    expect(await m.post({ userId: me }, "not-a-uuid", "x")).toEqual({ kind: "absent" });
    expect(await m.decide({ userId: me }, "not-a-uuid", "accepted", new Date())).toBe(false);
  });

  it("pagine les messages sans en sauter ni en répéter", async () => {
    const m = messaging(t.db);
    const s = await setup();
    const id = await opened(s, "message 0");
    await m.decide({ userId: s.freelanceUser }, id, "accepted", new Date());
    for (let i = 1; i < 7; i += 1) await m.post({ userId: s.recruiter }, id, `message ${i}`);

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await m.listMessages({ userId: s.recruiter }, id, { cursor, limit: 3 });
      seen.push(...(page?.items.map((msg) => msg.body) ?? []));
      cursor = page?.next ?? undefined;
    } while (cursor !== undefined);
    expect(seen).toEqual(Array.from({ length: 7 }, (_, i) => `message ${6 - i}`));
  });

  it("refuse un message vide et un curseur falsifié", async () => {
    const m = messaging(t.db);
    const s = await setup();
    await expect(m.contact({ userId: s.recruiter }, s.org, s.profile, "   ")).rejects.toThrow();
    await expect(m.listConversations({ userId: s.recruiter }, { cursor: "bidon" })).rejects.toThrow(InvalidCursorError);
  });
});

describe("repérage des coordonnées", () => {
  it.each([
    ["écrivez à jean@exemple.fr", true],
    ["appelez le 06 12 34 56 78", true],
    ["+33 6 12 34 56 78", true],
    ["mon site www.jean.dev", true],
    ["on passe sur WhatsApp ?", true],
    ["TJM 650 €, 3 jours par semaine, démarrage le 12/11", false],
    ["React 18 et Node 22, mission de 6 mois", false],
    ["0 6 1 2 3 4 5 6 7 8", true],
    ["6-1-2-3-4-5-6-7-8-9", true],
    ["06​12​34​56​78", true],
    ["jean at gmail dot com", true],
    ["lien : bit.ly/abc", true],
    ["discord : jean#1234", true],
    ["réunion le 2026-10-05, puis le 12/11/2026", false],
  ])("%s → %s", (text, expected) => {
    expect(containsContact(text)).toBe(expected);
  });
});

describe("repérage des coordonnées sous charge", () => {
  // Seuil large pour tolérer une machine chargée : la version quadratique dépassait 450 ms sur ces mêmes textes.
  it.each(["1)".repeat(5000), "1a".repeat(5000), "a".repeat(10_000), "1 ".repeat(5000), "1-".repeat(5000)])("reste rapide sur un message piégé", (text) => {
    // Le meilleur de cinq essais : une rafale de charge sur la machine ne fausse pas la mesure, un coût quadratique si.
    const timings = Array.from({ length: 5 }, () => {
      const started = performance.now();
      containsContact(text);
      return performance.now() - started;
    });
    expect(Math.min(...timings)).toBeLessThan(150);
  });
});

describe("limiteur de débit partagé", () => {
  const rule = { windowMs: 60_000, max: 3 };
  const now = new Date("2026-10-05T10:00:30Z");

  it("compte dans la fenêtre, bloque au-delà et repart à la fenêtre suivante", async () => {
    const limiter = rateLimiter(t.db);
    const decisions = [];
    for (let i = 0; i < 4; i += 1) decisions.push(await limiter.hit("ip:abc", rule, now));
    expect(decisions.map((d) => d.allowed)).toEqual([true, true, true, false]);
    expect(decisions[3]?.resetAt.toISOString()).toBe("2026-10-05T10:01:00.000Z");
    expect((await limiter.hit("ip:abc", rule, new Date("2026-10-05T10:01:01Z"))).allowed).toBe(true);
  });

  // PGlite n'a qu'une connexion et sérialise ces appels : ce test prouve le compte exact sous rafale, pas la concurrence
  // réelle. Celle-ci tient à l'instruction unique INSERT … ON CONFLICT, atomique sur Postgres ; elle sera rejouée sur
  // la base Railway dès qu'elle est branchée.
  it("compte exactement une rafale de requêtes", async () => {
    const limiter = rateLimiter(t.db);
    const results = await Promise.all(Array.from({ length: 10 }, () => limiter.hit("ip:burst", rule, now)));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });

  it("purge les fenêtres passées et refuse une clé suspecte", async () => {
    const limiter = rateLimiter(t.db);
    expect(await limiter.purge(new Date("2026-10-05T10:01:00Z"))).toBeGreaterThan(0);
    await expect(limiter.hit("'; DROP TABLE x; --", rule, now)).rejects.toThrow(/clé/);
  });
});
