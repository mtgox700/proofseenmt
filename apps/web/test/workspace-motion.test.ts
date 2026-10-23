import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThreadMessages, type ThreadMessageView } from "../src/components/live/ThreadMessages";

/*
 * Kensa m4, the rule of the brand in the connected space: nothing is hidden while it waits for an animation, and a
 * figure does not count up, it is true at once. Motion may only settle something already visible, briefly, and under
 * `prefers-reduced-motion: no-preference`, and nothing loops (lot 1 of the connected redesign removed the last loop,
 * the halo of the active step of a file). The home page (home.css and its four companion sheets, home-*.css) is held by its own tests; the sheets of
 * @proofseen/brand that React imports are held to the same rules here.
 */

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
const rel = (path: string): string => relative(src, path).replace(/\\/g, "/");
const code = filesUnder(src).filter((f) => /\.tsx?$/.test(f));
const brand = join(src, "..", "..", "..", "packages", "brand");
const stylesheets = [
  ...readdirSync(join(src, "styles"))
    .filter((f) => f.endsWith(".css") && !/^home(?:-[a-z]+)?\.css$/.test(f))
    .map((f) => join("styles", f)),
  ...readdirSync(brand)
    .filter((f) => f.endsWith(".css"))
    .map((f) => join("@proofseen", "brand", f)),
].map((f) => f.replace(/\\/g, "/"));

const read = (file: string): string =>
  readFileSync(file.startsWith("@proofseen/") ? join(brand, file.slice("@proofseen/brand/".length)) : join(src, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("the connected space shows its final state from the first paint (Kensa m4)", () => {
  it.each(stylesheets)("%s starts nothing invisible, empty or at zero", (file) => {
    const css = read(file);
    expect(css).not.toMatch(/opacity:\s*0(?:\.0+)?\s*[;}]/);
    expect(css).not.toMatch(/visibility:\s*hidden/);
    expect(css).not.toMatch(/scale[XY]?\(\s*0\s*\)/);
    expect(css).not.toMatch(/stroke-dashoffset:\s*var\(--dash\)/);
    expect(css).not.toMatch(/data-armed/);
  });

  it.each(stylesheets)("%s: every keyframe starts from something readable", (file) => {
    const css = read(file);
    for (const [, start] of css.matchAll(/(?:from|0%)\s*\{([^}]*)\}/g)) {
      const opacity = /opacity:\s*([\d.]+)/.exec(start ?? "")?.[1];
      if (opacity !== undefined) expect(Number(opacity), `${file}: ${start}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it.each(stylesheets)("%s keeps every animation under prefers-reduced-motion: no-preference", (file) => {
    // Walk the blocks: a rule that runs an animation sits inside a no-preference media query.
    const css = read(file);
    const stack: string[] = [];
    let prelude = "";
    const bare: string[] = [];
    for (const char of css) {
      if (char === "{") {
        stack.push(prelude.trim());
        prelude = "";
      } else if (char === "}") {
        stack.pop();
        prelude = "";
      } else if (char === ";") {
        if (/^animation(?:-name)?\s*:/.test(prelude.trim()) && !stack.some((s) => /prefers-reduced-motion:\s*no-preference/.test(s))) bare.push(`${stack.join(" > ")} { ${prelude.trim()} }`);
        prelude = "";
      } else {
        prelude += char;
      }
    }
    expect(bare).toEqual([]);
  });

  it.each(stylesheets)("%s loops nothing, except the skeleton that stands for a real wait", (file) => {
    const loops = [...read(file).matchAll(/([^{};]+)\{[^{}]*\binfinite\b/g)].map((m) => (m[1] ?? "").trim());
    expect(loops).toEqual(file === "styles/states.css" ? [".sk-bar"] : []);
  });

  it("counts nothing up: no CountUp, no reveal-on-scroll wrapper, no animation frame outside the storefront", () => {
    expect(code.filter((f) => /\bCountUp\b|\bInView\b|data-armed|dataset\.armed/.test(readFileSync(f, "utf8"))).map(rel)).toEqual([]);
    expect(code.filter((f) => !rel(f).startsWith("components/landing/") && readFileSync(f, "utf8").includes("requestAnimationFrame")).map(rel)).toEqual([]);
  });

  it("does not move the messages served with the page; only one that arrives while the thread is open settles in", () => {
    const message = (id: string): ThreadMessageView => ({ id, mine: false, body: `Message ${id}`, createdAt: "2026-10-20T09:00:00.000Z", at: "09:00", flagged: false, attachments: [] });
    const html = renderToStaticMarkup(
      createElement(ThreadMessages, {
        conversationId: "c-1",
        selfId: "u-1",
        lang: "fr",
        live: true,
        initial: [message("a"), message("b")],
        otherReadAt: null,
        labels: { you: "Vous", counterpart: "Acme", flagged: "signalé", read: "Lu", pdf: "Pièce jointe {n} (PDF)", image: "Image {n}" },
      }),
    );
    expect(html).toContain("Message a");
    expect(html).toContain("Message b");
    expect(html).not.toContain("data-new");
    expect(read("styles/workspace.css")).toMatch(/\.bubbles li\[data-new\]\s*\{\s*animation:/);
  });
});
