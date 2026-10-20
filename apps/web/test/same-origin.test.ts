import { describe, expect, it } from "vitest";
import { sameOrigin } from "../src/lib/same-origin";

/*
 * Behind the reverse proxy the request URL is the server's internal address: a write from proofseen.com must still be
 * accepted, and one from another site still refused (payments screen, 2026-10-21: every fetch POST answered 403).
 */

const PUBLIC = "https://proofseen.com";

const post = (url: string, headers: Record<string, string>): Request => new Request(url, { method: "POST", headers });

describe("same-origin check behind the proxy", () => {
  it("accepts our own page although the request URL is the internal address", () => {
    expect(sameOrigin(post("http://0.0.0.0:3100/api/contracts/x/payment", { origin: PUBLIC, host: "proofseen.com" }), PUBLIC)).toBe(true);
    expect(sameOrigin(post("http://0.0.0.0:3100/api/contracts/x/payment", { origin: PUBLIC }), PUBLIC)).toBe(true);
    expect(sameOrigin(post("http://0.0.0.0:3100/api/x", { origin: PUBLIC, host: "proofseen.com" }), undefined)).toBe(true);
  });

  it("refuses another site, a malformed origin and a look-alike host", () => {
    expect(sameOrigin(post("http://0.0.0.0:3100/api/x", { origin: "https://evil.example", host: "proofseen.com" }), PUBLIC)).toBe(false);
    expect(sameOrigin(post("http://0.0.0.0:3100/api/x", { origin: "https://proofseen.com.evil.example", host: "proofseen.com" }), PUBLIC)).toBe(false);
    expect(sameOrigin(post("http://0.0.0.0:3100/api/x", { origin: "null", host: "proofseen.com" }), PUBLIC)).toBe(false);
  });

  it("keeps the local behaviour: same host, or no Origin header at all", () => {
    expect(sameOrigin(post("http://localhost:3100/api/x", { origin: "http://localhost:3100" }), undefined)).toBe(true);
    expect(sameOrigin(post("http://localhost:3100/api/x", {}), PUBLIC)).toBe(true);
  });
});
