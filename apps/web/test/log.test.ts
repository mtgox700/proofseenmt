import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "../src/lib/log";

afterEach(() => {
  vi.restoreAllMocks();
});

const captured = (): Record<string, unknown> => {
  const spy = vi.mocked(console.error);
  const line = spy.mock.calls.at(-1)?.[0];
  return JSON.parse(String(line)) as Record<string, unknown>;
};

describe("journal structuré", () => {
  it("écrit une ligne JSON : niveau, événement, nom de l'erreur, date", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    logError("payment open failed", new TypeError("boom"), new Date("2026-10-06T10:00:00Z"));
    expect(captured()).toEqual({ level: "error", event: "payment open failed", error: "TypeError", at: "2026-10-06T10:00:00.000Z" });
  });

  it("ne recopie jamais le message d'une erreur : il peut porter une adresse, un hôte ou un secret", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    logError("db down", new Error("connect ECONNREFUSED postgres://user:hunter2@db.internal:5432 for jane@doe.fr"));
    const line = String(vi.mocked(console.error).mock.calls.at(-1)?.[0]);
    expect(line).not.toMatch(/hunter2|db\.internal|jane@doe\.fr|ECONNREFUSED/);
  });

  it("garde un événement court et sans retour à la ligne, et nomme « unknown » ce qui n'est pas une erreur", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    logError(`x\ny${"z".repeat(500)}`, "a string");
    const entry = captured();
    expect(entry.error).toBe("unknown");
    expect(String(entry.event)).not.toContain("\n");
    expect(String(entry.event).length).toBeLessThanOrEqual(120);
  });

  it("un détail optionnel n'accepte qu'un mot court", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    logError("indexnow rejected", undefined, new Date(), "key-not-valid");
    expect(captured().detail).toBe("key-not-valid");
    logError("indexnow rejected", undefined, new Date(), "http-429");
    expect(captured().detail).toBe("http-429");
    for (const leak of ["an email jane@doe.fr in a sentence", "0199a1b2-0000-7000-8000-000000000001", "acct-1234567"]) {
      logError("indexnow rejected", undefined, new Date(), leak);
      expect(captured().detail).toBeUndefined();
    }
  });
});
