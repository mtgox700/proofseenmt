import { randomBytes, randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { missionConfirmations, publicProfiles, type Actor, type ConfirmationInput } from "@proofseen/db";
import { PROOF_LABELS, proofTally } from "@proofseen/hub";
import { createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";
import ProofsPage from "../src/app/[lang]/app/preuves/page";
import ProfilePage from "../src/app/[lang]/app/profil/page";
import { PublicTally } from "../src/components/registre/PublicTally";
import { proofsFr } from "../src/i18n/market/proofs-fr";
import { profileFr } from "../src/i18n/market/profile-fr";
import { publicStanding, registerOf } from "../src/lib/proof-register";
import { renderAsync } from "./support/render-async";

/*
 * Lot 2 of the connected redesign, "le registre du freelance", on a real database: /app/preuves opens under the very
 * tally of the public rail, then what is verified (each fact under its poinçon, with the sentence and the date of the
 * public page), then what waits for a client, then the addresses. The profile says it is declared, and is not green.
 */

let t: TestDatabase;
let signedIn: Actor = { userId: "" };

vi.mock("@proofseen/db", async (original) => ({ ...(await original<object>()), getDb: () => t.db }));
vi.mock("../src/data/throttle", () => ({ throttled: async () => false, addressFromHeaders: () => null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", async (original) => ({ ...(await original<object>()), usePathname: () => "/fr/app/preuves" }));
vi.mock("../src/lib/market", async (original) => {
  const real = await original<typeof import("../src/lib/market")>();
  const market = async () => ({ person: { id: "clerk", email: "x@y.fr", name: "X", role: "freelance" }, actor: signedIn, db: t.db });
  return { uuidOf: real.uuidOf, langOf: real.langOf, pageMarket: market, actionMarket: market };
});
// The profile page shows the standing of the account (C17): none here.
vi.mock("../src/components/market/StandingNotice", () => ({ StandingNotice: () => null }));

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const CONFIRMED_AT = new Date("2026-10-12T09:30:00Z");
const PAID_AT = new Date("2026-09-02T15:00:00Z");
const PROVEN_AT = new Date("2026-08-20T07:00:00Z");

let seq = 0;
const input = (over: Partial<ConfirmationInput> = {}): ConfirmationInput => ({
  role: "Lead data engineer",
  clientName: "Acme Industries",
  clientKind: "eti",
  clientSiret: null,
  contactEmail: `achats${(seq += 1)}@registre-client.fr`,
  startedOn: "2025-01",
  endedOn: "2025-06",
  summary: "Migration de la plateforme de données vers dbt et Snowflake.",
  ...over,
});

/** A freelancer with a published profile: two verified missions, one proven address, one waiting, one pending request. */
const freelancer = async (visibility: "pseudonymous" | "private" = "pseudonymous") => {
  const userId = await createUser(t.db);
  const profileId = await createProfile(t.db, userId, visibility);
  await t.db.verifiedMission.create({
    data: { profileId, role: "Architecte data plateforme de paiement européenne", clientKind: "grand_groupe", durationMonths: 14, summary: "Refonte des flux.", evidenceKind: "client_confirmation", verifiedAt: CONFIRMED_AT, clientName: null, confirmedByDomain: "client.example" },
  });
  await t.db.verifiedMission.create({ data: { profileId, role: "Lead dev", clientKind: "pme", durationMonths: 3, summary: "", evidenceKind: "paid_on_platform", verifiedAt: PAID_AT } });
  await t.db.ownedUrl.create({ data: { profileId, url: "https://camille-martin-data-engineering.example.org", urlKey: `k-${randomUUID()}`, proofMethod: "well_known_file", verifiedAt: PROVEN_AT, checkedAt: PROVEN_AT } });
  await t.db.ownedUrl.create({ data: { profileId, url: "https://github.com/camille", urlKey: `k-${randomUUID()}`, proofMethod: "meta_tag" } });
  const result = await missionConfirmations(t.db).request({ userId }, input(), { id: randomUUID(), token: randomBytes(32).toString("base64url") }, "fr", new Date());
  if (result.kind !== "requested") throw new Error(`demande refusée : ${result.kind}`);
  const { slug } = await t.db.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { slug: true } });
  return { actor: { userId }, slug };
};

const page = async (actor: Actor, query: Readonly<Record<string, string>> = {}): Promise<string> => {
  signedIn = actor;
  return renderToStaticMarkup(await ProofsPage({ params: Promise.resolve({ lang: "fr" }), searchParams: Promise.resolve(query) })).replace(/&#x27;/g, "'");
};

describe("/app/preuves, the register of the freelancer", () => {
  it("opens under the tally of the public rail, written by the same function, with the same counts", async () => {
    const { actor, slug } = await freelancer();
    const html = await page(actor);
    const pub = await publicProfiles(t.db).page(slug ?? "");
    expect(pub).not.toBeNull();
    const tally = proofTally(registerOf(pub!), "fr");
    expect(tally).toBe("2 missions vérifiées · 1 adresse prouvée");
    expect(html).toContain(`<p class="reg-tally"><span class="sq" aria-hidden="true"></span><span>${tally}</span></p>`);
    expect(html).toContain(`href="/fr/profils/${slug}"`);
  });

  it("reads in the order of a file: what is verified, what is on trial, then the addresses", async () => {
    const { actor } = await freelancer();
    const html = await page(actor);
    const at = (needle: string): number => html.indexOf(needle);
    expect(at('id="verifie"')).toBeGreaterThan(at('class="reg-tally"'));
    expect(at('id="missions"')).toBeGreaterThan(at('id="verifie"'));
    expect(at('id="adresses"')).toBeGreaterThan(at('id="missions"'));
    expect(html).toContain(`<h2 id="missions-title">${proofsFr.trial.title}</h2>`);
  });

  it("strikes each verified fact with the sentence and the date of the public page, and its trace", async () => {
    const { actor } = await freelancer();
    const html = await page(actor);
    const l = PROOF_LABELS.fr;
    expect(html).toContain('<p class="seal"><time dateTime="2026-10-12">Confirmée par un contact chez le client le 12 octobre 2026</time></p>');
    expect(html).toContain('<p class="seal"><time dateTime="2026-09-02">Payée sur Proofseen, vérifiée le 2 septembre 2026</time></p>');
    expect(html).toContain('<p class="seal"><time dateTime="2026-08-20">Possession prouvée le 20 août 2026</time></p>');
    expect(html).toContain(`<dt>${l.by}</dt><dd>${l.missionBy("client_confirmation", true)}</dd>`);
    expect(html).toContain(`<dt>${l.source}</dt><dd>fichier de vérification</dd>`);
    // Every seal carries the opaque id the island remembers, and the island is on the page.
    expect(html.match(/data-seal-id="[mu]:[0-9a-f-]{36}"/g)).toHaveLength(3);
    // Three seals, and nothing else green: no flat proof tag left on the page.
    expect(html.match(/class="seal"/g)).toHaveLength(3);
    expect(html).not.toContain("tag-proof");
    // The register strikes nothing by itself: only the island, for a fact this device has not seen.
    expect(html).not.toContain("data-strike");
  });

  it("puts the request on trial in amber, with its deadline in words, and keeps the address to prove at the end", async () => {
    const { actor } = await freelancer();
    const html = await page(actor);
    expect(html).toMatch(/<span class="tag tag-signal">En attente de réponse jusqu'au \d{1,2} [a-zéû]+ \d{4}<\/span>/);
    expect(html).toContain('<span class="tag tag-signal">En attente de preuve</span>');
    // The proven address reads in ink in the list: its poinçon is in the register, once.
    expect(html).toContain('<span class="tag tag-done">Prouvée le 20 août 2026 · fichier de vérification</span>');
  });

  it("tells a private profile that nothing is public yet, without a green square", async () => {
    const { actor } = await freelancer("private");
    const html = await page(actor);
    expect(html).toContain(`<p class="reg-tally"><span class="sq open" aria-hidden="true"></span><span>${proofsFr.standing.unpublished}</span></p>`);
    expect(html).toContain(proofsFr.register.notePrivate);
  });

  it("is honest when nothing is verified yet", async () => {
    const userId = await createUser(t.db);
    await createProfile(t.db, userId);
    const html = await page({ userId });
    expect(html).toContain(`<span class="sq open" aria-hidden="true"></span><span>${PROOF_LABELS.fr.tallyNone}</span>`);
    expect(html).toContain(proofsFr.register.empty);
    expect(html).not.toContain('class="seal"');
  });

  it("writes no long dash and no document check", async () => {
    const { actor } = await freelancer();
    const html = await page(actor);
    expect(html).not.toContain("\u2014");
    expect(html).not.toMatch(/sur pi[eè]ce|facture|attestation du client/i);
  });
});

describe("the tally on the home is the way in to the register", () => {
  it("links to /app/preuves, keeps its words in ink and its square green only when a fact is verified", async () => {
    const { slug } = await freelancer();
    const pub = await publicProfiles(t.db).page(slug ?? "");
    const profile = { visibility: "pseudonymous", slug } as Parameters<typeof publicStanding>[0];
    const html = renderToStaticMarkup(createElement(PublicTally, { lang: "fr", p: proofsFr, standing: publicStanding(profile, pub, "fr"), link: true }));
    expect(html).toContain('<a class="reg-tally" aria-describedby="reg-tally-detail" href="/fr/app/preuves"><span class="sq" aria-hidden="true"></span><span>2 missions vérifiées · 1 adresse prouvée</span></a>');
    const hidden = renderToStaticMarkup(createElement(PublicTally, { lang: "fr", p: proofsFr, standing: publicStanding(profile, null, "fr"), link: true }));
    expect(hidden).toContain('<span class="sq open" aria-hidden="true"></span>');
  });
});

describe("/app/profil says what is declared", () => {
  it("heads the page with the open square of a declared line, and links to what is verified", async () => {
    const { actor, slug } = await freelancer();
    signedIn = actor;
    // The rich sections of the profile read the database themselves: render as the server does, once they resolve.
    const html = (await renderAsync(await ProfilePage({ params: Promise.resolve({ lang: "fr" }), searchParams: Promise.resolve({}) }))).replace(/&#x27;/g, "'");
    expect(html).toContain(`<p class="reg-declared"><span class="sq open" aria-hidden="true"></span>${profileFr.declared}</p>`);
    expect(html).toContain(`href="/fr/profils/${slug}"`);
    expect(html).toContain(`href="/fr/app/preuves">${profileFr.proofsLink}</a>`);
    expect(html).not.toMatch(/class="(?:seal|sq)"/);
  });
});
