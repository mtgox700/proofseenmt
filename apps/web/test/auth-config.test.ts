import { afterEach, describe, expect, it, vi } from "vitest";
import { authConfigured, clerkClientConfigured } from "../src/lib/auth-config";

describe("Clerk configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("wraps the pages as soon as the publishable key exists, even before the secret key (build time)", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    expect(clerkClientConfigured()).toBe(true);
    expect(authConfigured()).toBe(false);
  });

  it("runs the connected app only with both keys", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    expect(authConfigured()).toBe(true);
  });

  it("leaves the public site alone without keys", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    expect(clerkClientConfigured()).toBe(false);
    expect(authConfigured()).toBe(false);
  });
});
