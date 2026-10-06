import { describe, expect, it } from "vitest";
import { paymentLink } from "../src/lib/payment";

describe("paymentLink", () => {
  it("accepts a Stripe Payment Link", () => {
    expect(paymentLink(" https://buy.stripe.com/test_00g5kE1aB2cD3eF ")).toBe("https://buy.stripe.com/test_00g5kE1aB2cD3eF");
  });

  it("refuses anything that is not a Stripe page over https: a misconfigured variable must not send money elsewhere", () => {
    expect(paymentLink("http://buy.stripe.com/abc")).toBeNull();
    expect(paymentLink("https://buy.stripe.com.evil.example/abc")).toBeNull();
    expect(paymentLink("https://evil.example/buy.stripe.com/abc")).toBeNull();
    expect(paymentLink("javascript:alert(1)")).toBeNull();
  });

  it("treats a missing or empty variable as not configured", () => {
    expect(paymentLink(undefined)).toBeNull();
    expect(paymentLink("   ")).toBeNull();
  });
});
