import { describe, expect, it } from "vitest";
import { operatorEmails, resolveRole } from "../src/lib/roles";

describe("operatorEmails", () => {
  it("reads a comma-separated allowlist, case-insensitively, ignoring blanks", () => {
    expect(operatorEmails(" Ayoub@Example.com, ,ops@example.com ")).toEqual(new Set(["ayoub@example.com", "ops@example.com"]));
  });

  it("is empty when the variable is missing: nobody is an operator by default", () => {
    expect(operatorEmails(undefined).size).toBe(0);
  });
});

describe("resolveRole", () => {
  const ops = new Set(["ops@example.com"]);

  it("makes an allowlisted email an operator, whatever the stored metadata says", () => {
    expect(resolveRole({ emails: ["OPS@example.com"], stored: "freelance" }, ops)).toBe("operator");
  });

  it("never lets stored metadata grant operator: only the allowlist can", () => {
    expect(resolveRole({ emails: ["someone@example.com"], stored: "operator" }, ops)).toBeNull();
  });

  it("returns the chosen side for everyone else", () => {
    expect(resolveRole({ emails: ["a@example.com"], stored: "company" }, ops)).toBe("company");
    expect(resolveRole({ emails: ["a@example.com"], stored: "freelance" }, ops)).toBe("freelance");
  });

  it("returns null for a new account that has not chosen yet, or junk metadata", () => {
    expect(resolveRole({ emails: ["a@example.com"], stored: undefined }, ops)).toBeNull();
    expect(resolveRole({ emails: ["a@example.com"], stored: 42 }, ops)).toBeNull();
  });
});
