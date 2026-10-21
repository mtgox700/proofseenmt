import { describe, expect, it } from "vitest";
import { categorise, SOURCE_CATEGORIES } from "../src/lib/answers";

const cited = (platform: Record<string, number>, other = 0, client = 0) => ({ platform, other, client });

describe("categorise", () => {
  it("names the client first: one citation of the client outweighs everything", () => {
    expect(categorise(cited({ "malt.fr": 9 }, 3, 1))).toBe("you");
  });

  it("keeps an answer with no citation at all apart", () => {
    expect(categorise(cited({}, 0))).toBe("none");
  });

  it("files an answer citing only unlisted domains as other, never as a platform", () => {
    expect(categorise(cited({}, 4))).toBe("other");
  });

  it("picks the dominant platform family, both Malt domains counting together", () => {
    expect(categorise(cited({ "malt.fr": 1, "malt.com": 2, "linkedin.com": 2 }))).toBe("malt");
    expect(categorise(cited({ "github.com": 1, "gitlab.com": 1, "linkedin.com": 1 }))).toBe("code");
    expect(categorise(cited({ "free-work.com": 3 }))).toBe("platform");
  });

  it("exposes a closed list of categories: no domain can become a category by itself", () => {
    expect(SOURCE_CATEGORIES).toEqual(["you", "malt", "linkedin", "code", "platform", "other", "none"]);
  });
});
