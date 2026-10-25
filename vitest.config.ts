import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // apps/web keeps `jsx: preserve` for Next; tests that render a React component need the JSX compiled here, and the
  // storefront test resolves the "@/" alias of apps/web/tsconfig.json (no other workspace uses it).
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./apps/web/src/", import.meta.url)) }] },
  test: {
    pool: "forks",
    // End-to-end CLI tests write dozens of encrypted files; Windows + coverage instrumentation needs headroom.
    testTimeout: 60_000,
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
      exclude: ["**/index.ts", "apps/cli/src/main.ts"],
      reporter: ["text", "text-summary"],
      thresholds: {
        "packages/stats/src/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
        "packages/extract/src/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
        "packages/hub/src/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
        // Moteur de documents (L1) : mesuré le 2026-10-24 à 92,7 % des instructions et 84,9 % des branches.
        "packages/documents/src/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
        // Identity Firewall: une fuite serait irréversible (indexation LLM) — seuil plus haut que les autres.
        "packages/profiles/src/**": { lines: 90, functions: 90, branches: 85, statements: 90 },
      },
    },
  },
});
