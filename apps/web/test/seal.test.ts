import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Seal } from "../src/components/proof/Seal";

/*
 * Lot 1 of the connected redesign: the poinçon as a React primitive, the same markup as the register of the hub
 * (packages/hub/src/profile-proofs.ts) on the same rules (@proofseen/brand/seal.css).
 */

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
// React writes the attribute as `dateTime` and the hub as `datetime`: HTML attribute names ignore case.
const html = (props: Parameters<typeof Seal>[0]): string => renderToStaticMarkup(createElement(Seal, props)).replace(/ dateTime=/g, " datetime=");

describe("the seal of a verified fact", () => {
  it("writes the cartouche of the hub: the whole sentence inside its <time>", () => {
    expect(html({ text: "Confirmée par le client le 14 octobre 2026", date: new Date("2026-10-14T09:30:00Z") })).toBe(
      '<p class="seal"><time datetime="2026-10-14">Confirmée par le client le 14 octobre 2026</time></p>',
    );
    expect(html({ text: "Payée sur Proofseen le 3 novembre 2026", date: "2026-11-03" })).toContain('<time datetime="2026-11-03">');
  });

  it("sets the trace beside it, in the trace face, and leaves out a row without a value", () => {
    const out = html({
      text: "Prouvée le 2 octobre 2026",
      date: "2026-10-02",
      trace: [
        { label: "Source", value: "Fichier de vérification" },
        { label: "Vérifié par", value: "" },
      ],
    });
    expect(out).toBe(
      '<div class="sealed"><p class="seal"><time datetime="2026-10-02">Prouvée le 2 octobre 2026</time></p><dl class="trace"><div><dt>Source</dt><dd>Fichier de vérification</dd></div></dl></div>',
    );
  });

  it("strikes only when asked to, for a real event", () => {
    expect(html({ text: "Confirmée", date: "2026-10-22" })).not.toContain("data-strike");
    expect(html({ text: "Confirmée", date: "2026-10-22", strike: true })).toContain('<p class="seal" data-strike="">');
  });

  it("refuses a seal that cannot say when, or says nothing", () => {
    expect(() => html({ text: "Confirmée", date: "bientôt" })).toThrow(/real date/);
    expect(() => html({ text: "  ", date: "2026-10-22" })).toThrow();
  });

  it("is placed only on verified facts: the files that may use it are listed here", () => {
    const users = filesUnder(src)
      .filter((f) => /\.tsx?$/.test(f) && /from "@\/components\/proof\/Seal"/.test(readFileSync(f, "utf8")))
      .map((f) => relative(src, f).replace(/\\/g, "/"))
      .sort();
    // Lots 2 to 4 add their screens here, each with the fact read from the database that earns the green.
    expect(users).toEqual([
      // Lot 6: the operator's acknowledgement of a URSSAF certificate, read back by vigilanceDesk.verified().
      "components/operator/VerificationQueues.tsx",
    ]);
  });
});
