import { describe, expect, it } from "vitest";
import { accountEn } from "../src/i18n/market/account-en";
import { accountFr } from "../src/i18n/market/account-fr";

/*
 * The "Recrutement" block of the company home says, like « À traiter », whose signature each contract waits for: the
 * company signs first, the freelancer then. No count mixes both sides.
 */

describe("contracts to sign on the company home", () => {
  it("says whose signature each contract waits for, and leaves out a side with none", () => {
    expect(accountFr.dashboard.contractsFoot(2, { company: 1, freelance: 3 })).toBe("2 en cours · 1 attend votre signature · 3 attendent la signature du freelance");
    expect(accountFr.dashboard.contractsFoot(0, { company: 2, freelance: 0 })).toBe("0 en cours · 2 attendent votre signature");
    expect(accountFr.dashboard.contractsFoot(1, { company: 0, freelance: 0 })).toBe("1 en cours");
    expect(accountEn.dashboard.contractsFoot(2, { company: 1, freelance: 1 })).toBe("2 ongoing · 1 awaits your signature · 1 awaits the freelancer's signature");
  });

  it("no longer writes a bare « à signer »", () => {
    expect(accountFr.dashboard.contractsFoot(3, { company: 1, freelance: 1 })).not.toMatch(/à signer/);
  });
});
