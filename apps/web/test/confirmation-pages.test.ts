import { randomBytes, randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { missionConfirmations, type Actor, type ConfirmationInput, type ConfirmationLink } from "@proofseen/db";
import { createOrganisation, createProfile, createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";
import { decideMissionConfirmation } from "../src/app/[lang]/app/confirmations/actions";
import ConfirmationsPage from "../src/app/[lang]/app/confirmations/page";
import { decideMissionByLink } from "../src/app/[lang]/confirmer-mission/[id]/actions";
import ConfirmMissionPage from "../src/app/[lang]/confirmer-mission/[id]/page";
import { confirmationsFr } from "../src/i18n/market/confirmations-fr";
import { day } from "../src/lib/format";

/*
 * The confirmation screens as the server sends them, on a real database. A decision is shown only when it is read in
 * the database: with the token of the link on the public page, within the companies the person administers in the
 * workspace. A crafted address, the token of another request, someone else's company or an unknown id all get the
 * same neutral answer, byte for byte.
 */

let t: TestDatabase;
let signedIn: Actor = { userId: "" };

vi.mock("@proofseen/db", async (original) => ({ ...(await original<object>()), getDb: () => t.db }));
vi.mock("../src/data/intake-sink", () => ({ hasDatabase: () => true }));
vi.mock("../src/data/throttle", () => ({ throttled: async () => false, addressFromHeaders: () => null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
// Outside the Next router there is no current path: the language switch of the header reads a fixed one.
vi.mock("next/navigation", async (original) => ({ ...(await original<object>()), usePathname: () => "/fr/confirmer-mission" }));
vi.mock("../src/lib/market", async (original) => {
  const real = await original<typeof import("../src/lib/market")>();
  const market = async () => ({ person: { id: "clerk", email: "x@y.fr", name: "X", role: "company" }, actor: signedIn, db: t.db });
  return { uuidOf: real.uuidOf, langOf: real.langOf, pageMarket: market, actionMarket: market };
});

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

const c = confirmationsFr;
const repo = () => missionConfirmations(t.db);
const link = (): ConfirmationLink => ({ id: randomUUID(), token: randomBytes(32).toString("base64url") });

let seq = 0;
const input = (over: Partial<ConfirmationInput> = {}): ConfirmationInput => ({
  role: "Lead data engineer",
  clientName: "Acme Industries",
  clientKind: "eti",
  clientSiret: null,
  contactEmail: `achats${(seq += 1)}@client-pages.fr`,
  startedOn: "2025-01",
  endedOn: "2025-06",
  summary: "Migration de la plateforme de données vers dbt et Snowflake.",
  ...over,
});

const freelance = async (): Promise<Actor> => {
  const userId = await createUser(t.db);
  await createProfile(t.db, userId);
  return { userId };
};

const requested = async (actor: Actor, over: Partial<ConfirmationInput> = {}): Promise<ConfirmationLink> => {
  const l = link();
  const result = await repo().request(actor, input(over), l, "fr", new Date());
  if (result.kind !== "requested") throw new Error(`demande refusée : ${result.kind}`);
  return l;
};

const company = async () => {
  const ownerId = await createUser(t.db);
  const orgId = await createOrganisation(t.db, ownerId);
  const siret = `7${String((seq += 1)).padStart(8, "0")}00012`;
  await t.db.organisation.update({ where: { id: orgId }, data: { siret, registryStatus: "active", registryCheckedAt: new Date() } });
  return { owner: { userId: ownerId }, siret };
};

const form = (fields: Readonly<Record<string, string>>): FormData => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

/** Where a server action sends the person: the address carried by Next's redirect error. */
const redirectOf = async (run: () => Promise<void>): Promise<string> => {
  try {
    await run();
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;")) return digest.split(";").slice(2, -2).join(";");
    throw error;
  }
  throw new Error("aucune redirection");
};

type Query = Readonly<Record<string, string | string[]>>;

const publicPage = async (id: string, query: Query = {}): Promise<string> =>
  renderToStaticMarkup(await ConfirmMissionPage({ params: Promise.resolve({ lang: "fr", id }), searchParams: Promise.resolve(query) }));

const companyPage = async (actor: Actor, query: Query = {}): Promise<string> => {
  signedIn = actor;
  return renderToStaticMarkup(await ConfirmationsPage({ params: Promise.resolve({ lang: "fr" }), searchParams: Promise.resolve(query) }));
};

const decidedAtOf = async (id: string): Promise<Date> => {
  const { decidedAt } = await t.db.missionConfirmationRequest.findUniqueOrThrow({ where: { id }, select: { decidedAt: true } });
  if (decidedAt === null) throw new Error("demande non décidée");
  return decidedAt;
};

/** French typography goes through the HTML as-is; only the apostrophe is escaped by React. */
const text = (html: string): string => html.replace(/&#x27;/g, "'");

describe("public link: the decision is read with the token, never from the address", () => {
  it("after a confirmation, sends back to the link itself and shows the answer with its real date", async () => {
    const l = await requested(await freelance());
    const to = await redirectOf(() => decideMissionByLink(form({ lang: "fr", id: l.id, t: l.token, decision: "confirm" })));
    expect(to).toBe(`/fr/confirmer-mission/${l.id}?t=${l.token}`);
    expect(to).not.toMatch(/fait=|etat=/);
    const html = text(await publicPage(l.id, { t: l.token }));
    expect(html).toContain(c.public.confirmedTitle);
    expect(html).toContain(c.public.confirmedOn(day(await decidedAtOf(l.id), "fr")));
    expect(html).toContain("Lead data engineer");
    // Something was struck: not the dashed outline of an empty place.
    expect(html).not.toContain("empty-mark");
    expect(html).not.toContain(c.decision.confirm);
  });

  it("a refusal reads as refused, dated, and publishes nothing", async () => {
    const l = await requested(await freelance());
    expect(await redirectOf(() => decideMissionByLink(form({ lang: "fr", id: l.id, t: l.token, decision: "refuse" })))).toBe(`/fr/confirmer-mission/${l.id}?t=${l.token}`);
    const html = text(await publicPage(l.id, { t: l.token }));
    expect(html).toContain(c.public.refusedOn(day(await decidedAtOf(l.id), "fr")));
    expect(html).not.toContain(c.public.confirmedTitle);
  });

  it("a crafted address, a wrong token or another request's token all get the invalid-link answer", async () => {
    const f = await freelance();
    const decided = await requested(f);
    const open = await requested(f);
    await repo().decideByToken(decided.id, decided.token, { confirm: true, showClientName: false }, new Date());
    const neutral = await publicPage(randomUUID());
    expect(text(neutral)).toContain(c.public.invalidTitle);
    const crafted: readonly (readonly [string, Query])[] = [
      [decided.id, { fait: "confirmee" }],
      [decided.id, { etat: "confirmee", fait: "confirmee" }],
      [open.id, { fait: "confirmee" }],
      [decided.id, { t: open.token, fait: "confirmee" }],
      [open.id, { t: decided.token }],
      [decided.id, { t: link().token }],
      [decided.id, { t: [decided.token, decided.token] }],
      [randomUUID(), { t: decided.token, fait: "confirmee" }],
      ["pas-un-uuid", { t: decided.token }],
    ];
    for (const [id, query] of crafted) expect(await publicPage(id, query)).toBe(neutral);
    // A crafted outcome posted with a wrong token decides nothing and lands on the same answer.
    const to = await redirectOf(() => decideMissionByLink(form({ lang: "fr", id: open.id, t: decided.token, decision: "confirm" })));
    expect(await publicPage(open.id, Object.fromEntries(new URL(to, "https://x.test").searchParams))).toBe(neutral);
    expect((await t.db.missionConfirmationRequest.findUniqueOrThrow({ where: { id: open.id } })).status).toBe("pending");
  });

  it("an open request still shows its form to the token holder", async () => {
    const l = await requested(await freelance());
    const html = text(await publicPage(l.id, { t: l.token, fait: "confirmee" }));
    expect(html).toContain(c.decision.confirm);
    expect(html).not.toContain(c.public.confirmedTitle);
  });
});

describe("company workspace: the redirect carries the request id, the page reads the decision in scope", () => {
  it("after a decision, shows it with its real date to the person who administers the company", async () => {
    const f = await freelance();
    const acme = await company();
    const l = link();
    await repo().request(f, input({ clientSiret: acme.siret, contactEmail: null }), l, "fr", new Date());
    signedIn = acme.owner;
    const to = await redirectOf(() => decideMissionConfirmation(form({ lang: "fr", id: l.id, decision: "confirm" })));
    expect(to).toBe(`/fr/app/confirmations?demande=${l.id}`);
    const html = text(await companyPage(acme.owner, { demande: l.id }));
    expect(html).toContain(c.company.done.confirmed("Lead data engineer", day(await decidedAtOf(l.id), "fr")));
  });

  it("someone else's company, an unknown id, a pending one or a crafted outcome show nothing more than the bare page", async () => {
    const f = await freelance();
    const acme = await company();
    const rival = await company();
    const decided = link();
    const pending = link();
    await repo().request(f, input({ clientSiret: acme.siret, contactEmail: null }), decided, "fr", new Date());
    await repo().request(f, input({ clientSiret: acme.siret, contactEmail: null, role: "Architecte" }), pending, "fr", new Date());
    expect(await repo().decideAsCompany(acme.owner, decided.id, { confirm: true, showClientName: false }, new Date())).toBe("confirmed");
    const emailRequest = await requested(f);
    await repo().decideByToken(emailRequest.id, emailRequest.token, { confirm: true, showClientName: false }, new Date());

    const rivalBare = await companyPage(rival.owner);
    for (const query of [{ demande: decided.id }, { demande: randomUUID() }, { demande: "pas-un-uuid" }, { demande: emailRequest.id }, { fait: "confirmee" }, { demande: [decided.id, decided.id] }]) {
      expect(await companyPage(rival.owner, query)).toBe(rivalBare);
    }
    expect(rivalBare).not.toContain("Lead data engineer");
    // In scope, a request still pending is not a decision: same page as without the id.
    const acmeBare = await companyPage(acme.owner);
    expect(await companyPage(acme.owner, { demande: pending.id })).toBe(acmeBare);
    expect(await companyPage(acme.owner, { fait: "confirmee" })).toBe(acmeBare);
    expect(acmeBare).not.toContain("form-ok");
  });
});
