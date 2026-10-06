import { describe, expect, it } from "vitest";
import { canAnswer, canDecide, canView, decide, newThread, reply, ThreadInputSchema, type Thread, type Viewer } from "../src/lib/messaging";

const now = new Date("2026-10-02T10:00:00Z");
const company: Viewer = { id: "user_company", role: "company", reference: null };
const otherCompany: Viewer = { id: "user_other", role: "company", reference: null };
const owner: Viewer = { id: "user_free", role: "freelance", reference: "FR-7H2XK" };
const otherFreelance: Viewer = { id: "user_free2", role: "freelance", reference: "FR-ZK7M4" };
const operator: Viewer = { id: "user_ops", role: "operator", reference: null };

const thread = (): Thread =>
  newThread({ id: "t1", profileId: "FR-7H2XK", company: { userId: "user_company", name: "Atelier Nord", email: "rh@example.com" }, body: "Mission React, 3 mois, Paris.", now });

describe("ThreadInputSchema", () => {
  it("refuses an empty or oversized message and a malformed profile id", () => {
    expect(ThreadInputSchema.safeParse({ profileId: "FR-7H2XK", body: "  " }).success).toBe(false);
    expect(ThreadInputSchema.safeParse({ profileId: "FR-7H2XK", body: "x".repeat(2001) }).success).toBe(false);
    expect(ThreadInputSchema.safeParse({ profileId: "../etc", body: "Bonjour" }).success).toBe(false);
    expect(ThreadInputSchema.safeParse({ profileId: "FR-7H2XK", body: "Bonjour" }).success).toBe(true);
  });
});

describe("who sees a thread", () => {
  it("is limited to the company that opened it, the freelancer of that profile, and the operator", () => {
    const t = thread();
    expect(canView(company, t)).toBe(true);
    expect(canView(owner, t)).toBe(true);
    expect(canView(operator, t)).toBe(true);
    expect(canView(otherCompany, t)).toBe(false);
    expect(canView(otherFreelance, t)).toBe(false);
  });
});

describe("decision", () => {
  it("belongs to the freelancer of the profile only, while the request is pending", () => {
    const t = thread();
    expect(canDecide(owner, t)).toBe(true);
    expect(canDecide(company, t)).toBe(false);
    expect(canDecide(operator, t)).toBe(false);
    const accepted = decide(t, owner, "accepted", now);
    expect(accepted.status).toBe("accepted");
    expect(canDecide(owner, accepted)).toBe(false);
  });

  it("does not mutate the thread it is given", () => {
    const t = thread();
    decide(t, owner, "declined", now);
    expect(t.status).toBe("pending");
  });

  it("throws when someone else tries to decide", () => {
    expect(() => decide(thread(), company, "accepted", now)).toThrow();
  });
});

describe("answers", () => {
  it("are closed to the company while the freelancer has not accepted, open to the freelancer and the operator", () => {
    const t = thread();
    expect(canAnswer(company, t)).toBe(false);
    expect(canAnswer(owner, t)).toBe(true);
    expect(canAnswer(operator, t)).toBe(true);
    expect(canAnswer(company, decide(t, owner, "accepted", now))).toBe(true);
  });

  it("are closed to everyone but the operator once declined", () => {
    const declined = decide(thread(), owner, "declined", now);
    expect(canAnswer(owner, declined)).toBe(false);
    expect(canAnswer(company, declined)).toBe(false);
    expect(canAnswer(operator, declined)).toBe(true);
  });

  it("append a message signed with the author's side", () => {
    const t = reply(thread(), operator, "Nous transmettons.", new Date("2026-10-02T11:00:00Z"));
    expect(t.messages.at(-1)).toMatchObject({ from: "operator", body: "Nous transmettons." });
    expect(t.messages).toHaveLength(2);
  });
});
