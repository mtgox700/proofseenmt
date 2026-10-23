import { renderToStaticMarkup } from "react-dom/server";
import { prerender } from "react-dom/static";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { dealDates, type Actor } from "@proofseen/db";
import { createUser, DB_STARTUP_MS, openTestDatabase, type TestDatabase } from "../../../packages/db/test/support/database";
import ContractPage from "../src/app/[lang]/app/contrats/[id]/page";
import BillingPage from "../src/app/[lang]/app/facturation/page";
import ThreadPage from "../src/app/[lang]/app/messages/[id]/page";
import { billingFr } from "../src/i18n/market/billing-fr";
import { dealsFr } from "../src/i18n/market/deals-fr";
import { day } from "../src/lib/format";
import { parisDay } from "../src/lib/paris-day";
import { dealScenario, type DealScenario } from "./support/deal-scenarios";

/*
 * Lot 4 of the connected space, as the server sends it, on a real test database: the thread of the deal on the contract
 * and in the conversation, the payment block, the verified facts of the billing page. No call reaches Stripe: payments
 * go through the fake gateway of packages/db, and the gateway of the billing page is switched off.
 */

let t: TestDatabase;
let signedIn: Actor = { userId: "" };
let role: "company" | "freelance" = "company";
const NOW = new Date("2026-11-20T10:00:00Z");

vi.mock("@proofseen/db", async (original) => ({ ...(await original<object>()), getDb: () => t.db }));
vi.mock("@proofseen/payments", async (original) => ({ ...(await original<object>()), gatewayFromEnv: () => null }));
vi.mock("../src/data/payments-config", async (original) => ({
  ...(await original<object>()),
  paymentsUi: () => ({ publishableKey: "pk_test_51Render", testMode: true, checkoutOpen: true }),
}));
vi.mock("../src/data/intake-sink", () => ({ hasDatabase: () => true }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", async (original) => ({ ...(await original<object>()), usePathname: () => "/fr/app", useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("../src/lib/market", async (original) => {
  const real = await original<typeof import("../src/lib/market")>();
  const market = async () => ({ person: { id: "clerk", email: "x@y.fr", name: "X", firstName: null, emailVerified: true, role }, actor: signedIn, db: t.db });
  return { ...real, pageMarket: market, actionMarket: market };
});

beforeAll(async () => {
  t = await openTestDatabase();
}, DB_STARTUP_MS);

afterAll(async () => {
  await t.close();
});

// React writes the attribute as `dateTime`: HTML attribute names ignore case, the tests read it as `datetime`.
const text = (html: string): string => html.replace(/&#x27;/g, "'").replace(/ dateTime=/g, " datetime=");
const as = (actor: Actor, r: typeof role): void => {
  signedIn = actor;
  role = r;
};

const contractPage = async (s: DealScenario, query: Readonly<Record<string, string>> = {}): Promise<string> =>
  text(renderToStaticMarkup(await ContractPage({ params: Promise.resolve({ lang: "fr", id: s.contractId ?? "" }), searchParams: Promise.resolve(query) })));
const threadPage = async (s: DealScenario): Promise<string> =>
  text(renderToStaticMarkup(await ThreadPage({ params: Promise.resolve({ lang: "fr", id: s.conversationId }), searchParams: Promise.resolve({}) })));
/** The billing page holds async server components (the certificate, the account notices): rendered to the end first. */
const billingPage = async (): Promise<string> => {
  const { prelude } = await prerender(await BillingPage({ params: Promise.resolve({ lang: "fr" }), searchParams: Promise.resolve({}) }));
  return text(await new Response(prelude).text());
};

/** The thread of the deal alone, to compare one page with another. */
const thread = (html: string): string => /<ol class="deal-thread">[\s\S]*?<\/ol>/.exec(html)?.[0] ?? "";
/** One step of the thread, by its label. */
const stepOf = (html: string, label: string): string => thread(html).split("<li").find((li) => li.includes(label)) ?? "";
const th = dealsFr.thread;

describe("the thread of the deal on the contract", () => {
  it("signed and unpaid: dates the signature, asks the company to pay, shows no green", async () => {
    const s = await dealScenario(t.db, "signed", NOW);
    as(s.recruiter, "company");
    const html = await contractPage(s);
    expect(html).toContain(th.title);
    expect(stepOf(html, th.steps.signed)).toContain(`<time datetime="${parisDay(NOW)}">${day(NOW, "fr")}</time>`);
    // The accepted quote has no date in the database: none is written.
    expect(stepOf(html, th.steps.quote)).not.toContain("<time");
    expect(stepOf(html, th.steps.escrow)).toContain('data-tone="current"');
    expect(stepOf(html, th.steps.escrow)).toContain(th.you);
    expect(html).not.toMatch(/class="(?:seal|sq|tag-proof)\b/);
    // The Stripe form: its button, the test note in its own frame, and the line that says it needs JavaScript.
    expect(html).toContain(dealsFr.contracts.pay.client.start);
    expect(html).toContain('<p class="test-note" role="note">');
    expect(html).toContain(`<noscript><p class="test-note">${dealsFr.contracts.pay.noscript}</p></noscript>`);
  });

  it("held in escrow: amber and in words, without a date the database does not have", async () => {
    const s = await dealScenario(t.db, "held", NOW);
    as(s.recruiter, "company");
    const html = await contractPage(s);
    const escrow = stepOf(html, th.steps.escrow);
    expect(escrow).toContain('data-tone="held"');
    expect(escrow).toContain(th.notes.held);
    expect(escrow).not.toContain("<time");
    expect(stepOf(html, th.steps.approved)).toContain(th.count(0, 1));
    expect(html).not.toMatch(/class="(?:seal|sq)\b/);
  });

  it("paid out: dates the payout and strikes the verified mission the database holds, on both sides", async () => {
    const s = await dealScenario(t.db, "released", NOW);
    const verified = await t.db.verifiedMission.findFirstOrThrow({ where: { contractId: s.contractId ?? "" }, select: { verifiedAt: true } });
    as(s.recruiter, "company");
    const company = await contractPage(s);
    expect(stepOf(company, th.steps.released)).toContain(`<time datetime="${parisDay(NOW)}">`);
    expect(company).toContain(`<p class="seal"><time datetime="${parisDay(verified.verifiedAt)}">${th.verified(day(verified.verifiedAt, "fr"))}</time></p>`);
    expect(company.match(/class="seal"/g)).toHaveLength(1);
    as(s.freelance, "freelance");
    const freelance = await contractPage(s);
    expect(thread(freelance)).toBe(thread(company));
  });

  it("cancelled: the thread stops at the signature", async () => {
    const s = await dealScenario(t.db, "cancelled", NOW);
    as(s.recruiter, "company");
    const html = await contractPage(s);
    expect(stepOf(html, th.steps.signed)).toContain('data-tone="stopped"');
    expect(thread(html)).not.toContain(th.steps.escrow);
  });
});

describe("the thread of the deal in the conversation", () => {
  it("says the same as the contract, and sits above the reply form with a way to the contract", async () => {
    const s = await dealScenario(t.db, "held", NOW);
    as(s.recruiter, "company");
    const contract = await contractPage(s);
    const conversation = await threadPage(s);
    expect(thread(conversation)).toBe(thread(contract));
    expect(conversation.indexOf('class="deal-thread"')).toBeLessThan(conversation.indexOf('class="reply"'));
    expect(conversation.indexOf('id="devis"')).toBeLessThan(conversation.indexOf('class="reply"'));
    expect(conversation).toContain(`href="/fr/app/contrats/${s.contractId}"`);
  });

  it("before a contract: the quote waits on the company, and the head of the page leads to it", async () => {
    const s = await dealScenario(t.db, "quote_sent", NOW);
    as(s.recruiter, "company");
    const html = await threadPage(s);
    expect(stepOf(html, th.steps.contact)).toContain(`<time datetime="${parisDay(NOW)}">`);
    expect(stepOf(html, th.steps.quote)).toContain(th.notes.quote_sent);
    expect(stepOf(html, th.steps.quote)).toContain(th.you);
    expect(html).toContain(`href="#devis"`);
    expect(html.indexOf('href="#devis"')).toBeLessThan(html.indexOf('id="devis"'));
  });

  it("a pending contact waits on the freelancer", async () => {
    const s = await dealScenario(t.db, "contact_pending", NOW);
    as(s.freelance, "freelance");
    const html = await threadPage(s);
    expect(stepOf(html, th.steps.contact)).toContain(th.notes.contact_pending);
    expect(stepOf(html, th.steps.contact)).toContain(th.you);
  });
});

describe("the dates of a deal are read for its parties only", () => {
  it("answers nothing to someone else, and nothing for an id that is not one", async () => {
    const s = await dealScenario(t.db, "released", NOW);
    const outsider = { userId: await createUser(t.db) };
    expect(await dealDates(t.db).contract(outsider, s.contractId ?? "")).toBeNull();
    expect(await dealDates(t.db).conversation(outsider, s.conversationId)).toBeNull();
    expect(await dealDates(t.db).contract(s.recruiter, "pas-un-uuid")).toBeNull();
    const mine = await dealDates(t.db).contract(s.freelance, s.contractId ?? "");
    expect(mine?.payment?.status).toBe("released");
    expect(mine?.approvedAt).toHaveLength(1);
    expect(mine?.verifiedAt).not.toBeNull();
  });
});

describe("the verified facts of the billing page", () => {
  const b = billingFr;

  it("strikes the SIRET checked active and the URSSAF certificate verified, each with its day", async () => {
    const s = await dealScenario(t.db, "contact_pending", NOW);
    as(s.freelance, "freelance");
    const html = await billingPage();
    const { verifiedAt } = await t.db.vigilanceAttestation.findUniqueOrThrow({ where: { profileId: s.profileId }, select: { verifiedAt: true } });
    expect(verifiedAt).not.toBeNull();
    expect(html).toContain(`<time datetime="${parisDay(NOW)}">${b.registry.sealActive(day(NOW, "fr"))}</time>`);
    expect(html).toContain(b.vigilance.sealVerified(day(verifiedAt ?? NOW, "fr")));
    expect(html.match(/class="seal"/g)).toHaveLength(2);
    expect(html).not.toContain('class="form-ok" role="note"');
  });

  it("keeps a certificate awaiting verification and a SIRET not checked in words, never green", async () => {
    const s = await dealScenario(t.db, "contact_pending", NOW);
    await t.db.vigilanceAttestation.update({ where: { profileId: s.profileId }, data: { verifiedAt: null } });
    await t.db.billingIdentity.update({ where: { profileId: s.profileId }, data: { registryStatus: "mismatch" } });
    as(s.freelance, "freelance");
    const html = await billingPage();
    expect(html).not.toContain('class="seal"');
    expect(html).toContain(b.vigilance.unverified);
    expect(html).toContain(b.registry.mismatch);
  });
});
