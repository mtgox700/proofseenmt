import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncOutput } from "../src/files";

let dir: string;
let out: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "proofseen-sync-"));
  out = join(dir, "site");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const exists = async (path: string): Promise<boolean> =>
  readFile(path).then(
    () => true,
    () => false,
  );

describe("stale output", () => {
  it("removes what the previous build produced and this one no longer does", async () => {
    await syncOutput(out, [
      { path: "index.html", content: "a" },
      { path: "p/FR-AAAAA/index.html", content: "a" },
      { path: "freelances/go-lyon/index.html", content: "a" },
    ]);
    const stale = await syncOutput(out, [
      { path: "index.html", content: "b" },
      { path: "p/FR-AAAAA/index.html", content: "b" },
    ]);
    expect(stale).toEqual(["freelances/go-lyon/index.html"]);
    expect(await exists(join(out, "freelances", "go-lyon", "index.html"))).toBe(false);
    expect(await readFile(join(out, "index.html"), "utf8")).toBe("b");
  });

  it("never touches a file it did not generate", async () => {
    await syncOutput(out, [{ path: "index.html", content: "a" }]);
    await writeFile(join(out, "CNAME"), "proofseen.example");
    await syncOutput(out, [{ path: "index.html", content: "b" }]);
    expect(await readFile(join(out, "CNAME"), "utf8")).toBe("proofseen.example");
  });

  it("keeps its build record outside the published folder", async () => {
    await syncOutput(out, [{ path: "index.html", content: "a" }]);
    expect(await readdir(out)).toEqual(["index.html"]);
    expect(JSON.parse(await readFile(`${out}.build.json`, "utf8"))).toEqual(["index.html"]);
  });

  it("ignores a tampered record that points outside the folder", async () => {
    await writeFile(join(dir, "precious.txt"), "keep");
    await writeFile(`${out}.build.json`, JSON.stringify(["../precious.txt"]));
    expect(await syncOutput(out, [{ path: "index.html", content: "a" }])).toEqual([]);
    expect(await readFile(join(dir, "precious.txt"), "utf8")).toBe("keep");
  });
});
