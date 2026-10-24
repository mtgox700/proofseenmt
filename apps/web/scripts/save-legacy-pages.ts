import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProfilesSite, PublicProfileSchema } from "@proofseen/profiles";

/*
 * Saves again the pages kept from the former static site (public/legacy), rendered by @proofseen/profiles with the
 * same options as test/legacy-render.test.ts, after a change of the shared header, head or footer:
 * `pnpm --filter ./apps/web exec tsx scripts/save-legacy-pages.ts`.
 */
const legacy = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "legacy");
const PAGES = ["contact/index.html", "methode/index.html", "n/ayoub-hammoudi/index.html", "en/contact/index.html", "en/method/index.html", "en/n/ayoub-hammoudi/index.html"];
const api = JSON.parse(readFileSync(join(legacy, "api", "profiles.json"), "utf8")) as { profiles: Record<string, unknown>[] };
const profiles = api.profiles.map(({ url: _url, ...p }) => PublicProfileSchema.parse(p));
const files = new Map(
  buildProfilesSite(profiles, {
    baseUrl: "https://proofseen.com",
    namedArm: {
      profileId: "FR-7H2XK",
      identity: {
        displayName: "Ayoub Hammoudi",
        slug: "ayoub-hammoudi",
        sameAs: ["https://github.com/Ayoubhm07", "https://www.linkedin.com/in/ayoub-hammoudi-3251851b8", "https://ayoubdevspace.vercel.app"],
      },
    },
  }).map((f) => [f.path, f.content]),
);
for (const path of PAGES) {
  const content = files.get(path);
  if (content === undefined) throw new Error(`not rendered: ${path}`);
  writeFileSync(join(legacy, path), content);
  console.log(`saved ${path}`);
}
