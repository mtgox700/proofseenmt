import { describe, expect, it } from "vitest";
import { categorise, layoutAnswers, SOURCE_CATEGORIES } from "../src/lib/answers";

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

describe("layoutAnswers", () => {
  const answers = Array.from({ length: 12 }, (_, i) => ({ engine: i % 3, category: i % 2 === 0 ? "malt" : "none" }) as const);

  it("places every answer exactly once, in one column per engine", () => {
    const cells = layoutAnswers(answers, 3, 2);
    expect(cells).toHaveLength(12);
    expect(new Set(cells.map((c) => `${c.column}:${c.row}:${c.col}`)).size).toBe(12);
    expect(cells.filter((c) => c.column === 1)).toHaveLength(4);
  });

  it("groups a column by category, so the share of each source reads as a block", () => {
    const column = layoutAnswers(answers, 3, 2).filter((c) => c.column === 0);
    const order = column.sort((a, b) => a.row - b.row || a.col - b.col).map((c) => answers[c.index]?.category);
    expect(order).toEqual([...order].sort((a, b) => SOURCE_CATEGORIES.indexOf(a!) - SOURCE_CATEGORIES.indexOf(b!)));
  });
});
