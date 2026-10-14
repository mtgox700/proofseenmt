import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MAX_OWNED_URLS,
  normaliseOwnedUrl,
  ownedUrls,
  PROOF_GRACE_DAYS,
  RECHECK_AFTER_DAYS,
  RECHECK_BATCH,
  RETRY_AFTER_HOURS,
  type OwnedUrlRecord,
} from "../src/owned-urls";
import { publicProfiles } from "../src/public-profiles";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "./support/database";

let t: TestDatabase;

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const NOW = new Date("2026-10-14T09:00:00Z");
const later = (ms: number): Date => new Date(NOW.getTime() + ms);
const UNKNOWN_ID = "0192f1c4-0000-7000-8000-00000000ffff";

/** Un freelance avec son profil, prêt à déclarer des adresses. */
const freelance = async () => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId);
  return { actor: { userId }, profileId };
};

let site = 0;
const nextSite = (): string => `https://site${(site += 1)}.dev/`;

const added = async (actor: { userId: string }, url: string, manual = false): Promise<OwnedUrlRecord> => {
  const result = await ownedUrls(t.db).add(actor, url, { manual });
  if (result.kind !== "added") throw new Error(`adresse non ajoutée : ${result.kind}`);
  return result.record;
};

describe("la forme normalisée d'une adresse", () => {
  it("garde l'adresse en https, sans requête ni ancre, et en tire une clé sans www, casse ni barre finale", () => {
    expect(normaliseOwnedUrl("  https://WWW.Camille.dev/A-Propos/?utm=x#haut ")).toEqual({
      url: "https://www.camille.dev/A-Propos/",
      urlKey: "https://camille.dev/a-propos",
    });
    expect(normaliseOwnedUrl("https://camille.dev")?.urlKey).toBe("https://camille.dev");
  });

  it("refuse ce qui ne se prouve pas : http, IP, port, identifiants, hôte privé ou réservé", () => {
    for (const raw of [
      "http://camille.dev/",
      "https://127.0.0.1/",
      "https://[::1]/",
      "https://169.254.169.254/latest",
      "https://camille.dev:8443/",
      "https://moi:secret@camille.dev/",
      "https://localhost/",
      "https://nas.local/",
      "https://wiki.internal/",
      "https://box.home.arpa/",
      "https://camille.example/",
      "https://intranet/",
      "javascript:alert(1)",
      "pas une adresse",
      "",
      `https://camille.dev/${"a".repeat(300)}`,
    ]) {
      expect(normaliseOwnedUrl(raw), raw).toBeNull();
    }
  });
});

describe("déclarer et retirer ses adresses", () => {
  it("ajoute, liste et retire les adresses de son propre profil", async () => {
    const { actor, profileId } = await freelance();
    const first = await added(actor, "https://camille.dev/");
    expect(first).toMatchObject({ profileId, url: "https://camille.dev/", proofMethod: "well_known_file", verifiedAt: null });
    await added(actor, "https://www.linkedin.com/in/camille", true);
    const list = await ownedUrls(t.db).list(actor);
    expect(list.map((u) => [u.url, u.proofMethod])).toEqual([
      ["https://camille.dev/", "well_known_file"],
      ["https://www.linkedin.com/in/camille", "profile_token"],
    ]);
    expect(await ownedUrls(t.db).remove(actor, first.id)).toBe(true);
    expect((await ownedUrls(t.db).list(actor)).map((u) => u.url)).toEqual(["https://www.linkedin.com/in/camille"]);
  });

  it("refuse une adresse invalide, un doublon, et un compte sans profil", async () => {
    const { actor } = await freelance();
    expect(await ownedUrls(t.db).add(actor, "http://camille.dev/", { manual: false })).toEqual({ kind: "invalid" });
    await added(actor, "https://doublon.dev/page");
    expect(await ownedUrls(t.db).add(actor, "https://www.doublon.dev/PAGE/", { manual: false })).toEqual({ kind: "duplicate" });
    const withoutProfile = { userId: await createUser(t.db) };
    expect(await ownedUrls(t.db).add(withoutProfile, "https://camille.dev/", { manual: false })).toEqual({ kind: "no_profile" });
  });

  it(`plafonne à ${MAX_OWNED_URLS} adresses par profil`, async () => {
    const { actor } = await freelance();
    for (let i = 0; i < MAX_OWNED_URLS; i += 1) await added(actor, nextSite());
    expect(await ownedUrls(t.db).add(actor, nextSite(), { manual: false })).toEqual({ kind: "limit" });
  });
});

describe("le contrôle d'accès", () => {
  it("rend l'adresse d'un autre absente, quoi qu'on demande", async () => {
    const owner = await freelance();
    const intruder = await freelance();
    const record = await added(owner.actor, nextSite());
    expect(await ownedUrls(t.db).get(intruder.actor, record.id)).toBeNull();
    expect(await ownedUrls(t.db).list(intruder.actor)).toEqual([]);
    expect(await ownedUrls(t.db).remove(intruder.actor, record.id)).toBe(false);
    expect(await ownedUrls(t.db).markVerified(intruder.actor, record.id, "dns_txt", NOW)).toEqual({ kind: "not_found" });
    // Rien n'a bougé chez le propriétaire.
    expect(await ownedUrls(t.db).get(owner.actor, record.id)).toMatchObject({ verifiedAt: null });
  });

  it("répond de même à un identifiant inconnu ou mal formé, sans lever d'erreur", async () => {
    const { actor } = await freelance();
    for (const id of [UNKNOWN_ID, "pas-un-uuid", ""]) {
      expect(await ownedUrls(t.db).get(actor, id)).toBeNull();
      expect(await ownedUrls(t.db).remove(actor, id)).toBe(false);
      expect(await ownedUrls(t.db).markVerified(actor, id, "meta_tag", NOW)).toEqual({ kind: "not_found" });
    }
  });
});

describe("enregistrer une preuve", () => {
  it("date la preuve et retient la méthode qui a réussi ; l'adresse paraît alors sur le profil public", async () => {
    const { actor, profileId } = await freelance();
    const record = await added(actor, nextSite());
    const result = await ownedUrls(t.db).markVerified(actor, record.id, "meta_tag", NOW);
    expect(result).toMatchObject({ kind: "verified", record: { verifiedAt: NOW, checkedAt: NOW, proofMethod: "meta_tag", failedAt: null } });
    const { slug } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { slug: true } });
    const page = await publicProfiles(t.db).page(slug ?? "");
    expect(page?.provenUrlCount).toBe(1);
  });

  it("garde la date de première preuve quand on la reconfirme", async () => {
    const { actor } = await freelance();
    const record = await added(actor, nextSite());
    await ownedUrls(t.db).markVerified(actor, record.id, "dns_txt", NOW);
    const again = await ownedUrls(t.db).markVerified(actor, record.id, "well_known_file", later(DAY_MS));
    expect(again).toMatchObject({ kind: "verified", record: { verifiedAt: NOW, checkedAt: later(DAY_MS), proofMethod: "well_known_file" } });
  });

  it("refuse qu'une adresse LinkedIn ou Malt soit déclarée prouvée par la personne elle-même", async () => {
    const { actor } = await freelance();
    const record = await added(actor, "https://www.malt.fr/profile/camille", true);
    expect(await ownedUrls(t.db).markVerified(actor, record.id, "well_known_file", NOW)).toEqual({ kind: "manual_only" });
    expect(await ownedUrls(t.db).get(actor, record.id)).toMatchObject({ verifiedAt: null });
  });

  it("répond « déjà prouvée ailleurs » quand un autre profil possède déjà l'adresse, sans fuite d'erreur", async () => {
    const first = await freelance();
    const second = await freelance();
    const url = nextSite();
    const mine = await added(first.actor, url);
    const theirs = await added(second.actor, url);
    expect((await ownedUrls(t.db).markVerified(first.actor, mine.id, "dns_txt", NOW)).kind).toBe("verified");
    expect(await ownedUrls(t.db).markVerified(second.actor, theirs.id, "dns_txt", NOW)).toEqual({ kind: "already_proven_elsewhere" });
    expect(await ownedUrls(t.db).get(second.actor, theirs.id)).toMatchObject({ verifiedAt: null });
  });

  it("tranche par l'index quand les deux preuves arrivent en même temps", async () => {
    const first = await freelance();
    const second = await freelance();
    const url = nextSite();
    const mine = await added(first.actor, url);
    const theirs = await added(second.actor, url);
    // La vérification préalable ne voit rien : la seconde écriture vient buter sur l'index partiel.
    const results = await Promise.all([
      ownedUrls(t.db).markVerified(first.actor, mine.id, "dns_txt", NOW),
      ownedUrls(t.db).markVerified(second.actor, theirs.id, "dns_txt", NOW),
    ]);
    expect(results.map((r) => r.kind).sort()).toEqual(["already_proven_elsewhere", "verified"]);
  });
});

describe("la relecture planifiée", () => {
  /** Une adresse prouvée à une date donnée, relue pour la dernière fois à cette même date. */
  const proven = async (at: Date, manual = false) => {
    const { actor, profileId } = await freelance();
    const record = await added(actor, manual ? "https://www.linkedin.com/in/x" : nextSite(), manual);
    if (manual) {
      // Une preuve manuelle est prononcée par un opérateur, hors de ce dépôt.
      await t.db.ownedUrl.update({ where: { id: record.id }, data: { verifiedAt: at, checkedAt: at } });
    } else {
      await ownedUrls(t.db).markVerified(actor, record.id, "well_known_file", at);
    }
    return { actor, profileId, id: record.id };
  };

  it(`relit une preuve après ${RECHECK_AFTER_DAYS} jours, pas avant, et jamais une preuve manuelle`, async () => {
    const at = new Date("2025-01-01T00:00:00Z");
    const old = await proven(at);
    const manual = await proven(at, true);
    const recent = await proven(later(-DAY_MS));
    const due = await ownedUrls(t.db).dueForRecheck(NOW, RECHECK_BATCH);
    const ids = due.map((d) => d.id);
    expect(ids).toContain(old.id);
    expect(ids).not.toContain(manual.id);
    expect(ids).not.toContain(recent.id);
    expect(due.find((d) => d.id === old.id)).toEqual({ id: old.id, profileId: old.profileId, url: expect.stringMatching(/^https:/) });
  });

  it("une relecture réussie repousse la suivante d'un mois", async () => {
    const p = await proven(later(-(RECHECK_AFTER_DAYS + 1) * DAY_MS));
    expect(await ownedUrls(t.db).recordRecheck(p.id, "dns_txt", NOW)).toBe("confirmed");
    expect((await ownedUrls(t.db).dueForRecheck(later(DAY_MS))).map((d) => d.id)).not.toContain(p.id);
    expect(await ownedUrls(t.db).get(p.actor, p.id)).toMatchObject({ checkedAt: NOW, proofMethod: "dns_txt", failedAt: null });
  });

  it(`une preuve qui ne se relit plus tient ${PROOF_GRACE_DAYS} jours, retentée chaque jour, puis tombe`, async () => {
    const p = await proven(later(-(RECHECK_AFTER_DAYS + 1) * DAY_MS));
    expect(await ownedUrls(t.db).recordRecheck(p.id, null, NOW)).toBe("grace");
    expect(await ownedUrls(t.db).get(p.actor, p.id)).toMatchObject({ failedAt: NOW });
    // Pas de nouvel essai dans l'heure, mais le lendemain.
    expect((await ownedUrls(t.db).dueForRecheck(later(HOUR_MS))).map((d) => d.id)).not.toContain(p.id);
    expect((await ownedUrls(t.db).dueForRecheck(later((RETRY_AFTER_HOURS + 1) * HOUR_MS))).map((d) => d.id)).toContain(p.id);
    expect(await ownedUrls(t.db).recordRecheck(p.id, null, later(3 * DAY_MS))).toBe("grace");
    expect(await ownedUrls(t.db).get(p.actor, p.id)).toMatchObject({ failedAt: NOW });
    expect(await ownedUrls(t.db).recordRecheck(p.id, null, later(PROOF_GRACE_DAYS * DAY_MS))).toBe("revoked");
    expect(await ownedUrls(t.db).get(p.actor, p.id)).toMatchObject({ verifiedAt: null, failedAt: null });
    // Retombée en attente, elle ne se relit plus d'elle-même.
    expect(await ownedUrls(t.db).recordRecheck(p.id, "dns_txt", later(8 * DAY_MS))).toBeNull();
  });

  it("une relecture réussie pendant la grâce efface l'échec", async () => {
    const p = await proven(later(-(RECHECK_AFTER_DAYS + 1) * DAY_MS));
    await ownedUrls(t.db).recordRecheck(p.id, null, NOW);
    expect(await ownedUrls(t.db).recordRecheck(p.id, "meta_tag", later(2 * DAY_MS))).toBe("confirmed");
    expect(await ownedUrls(t.db).get(p.actor, p.id)).toMatchObject({ failedAt: null, verifiedAt: expect.any(Date) });
  });

  // En dernier : les adresses dues créées ici rempliraient le passage des tests suivants.
  it(`borne un passage à ${RECHECK_BATCH} adresses`, async () => {
    const at = new Date("2025-02-01T00:00:00Z");
    for (let i = 0; i <= RECHECK_BATCH; i += 1) await proven(at);
    expect(await ownedUrls(t.db).dueForRecheck(NOW, 1_000)).toHaveLength(RECHECK_BATCH);
    expect(await ownedUrls(t.db).dueForRecheck(NOW, 3)).toHaveLength(3);
  });

  it("ignore une adresse disparue entre-temps", async () => {
    expect(await ownedUrls(t.db).recordRecheck(UNKNOWN_ID, null, NOW)).toBeNull();
  });
});
